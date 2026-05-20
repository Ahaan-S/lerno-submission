/// <reference path="../../../types/supabase-edge-runtime.d.ts" />
// Supabase Edge Function: update-student-memory
// Fires after session ends (inactive 10 min or user closes tutor).
//
// Philosophy change from v1:
//   - Asking questions ≠ weakness. A curious student asks more questions.
//   - weak_topics / strong_topics come ONLY from quiz results (quiz-result route).
//   - This function tracks BEHAVIORAL signals only:
//       recently_discussed_topics, learning_pace, preferred_style,
//       common_mistakes, struggle_patterns, confusion_signals.
//   - confusion_signals = explicit confusion markers (was_confused flag,
//     multiple follow-ups, "I don't understand" phrasing). Not mere curiosity.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BehavioralExtract {
  memory_summary?: string;
  recently_discussed_topics?: string[];
  confusion_signals?: string[];
  common_mistakes?: string[];
  struggle_patterns?: { pattern: string; evidence: string }[];
  learning_pace?: "slow" | "medium" | "fast";
  preferred_style?: string;
}

/** Align with lib/tutor-subject.ts — SST book slugs share one `social` memory row. */
function normalizeMemorySubjectSlug(slug: string): string {
  if (slug.startsWith("social_")) return "social";
  return slug;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { session_id } = (await req.json()) as { session_id?: string };
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch session (includes memory_updated_at idempotency guard)
    const { data: session, error: sessionErr } = await supabase
      .from("tutor_sessions")
      .select("id, user_id, subject, chapter_index, memory_updated_at")
      .eq("id", session_id)
      .single();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memorySubjectKey = normalizeMemorySubjectSlug((session as { subject: string }).subject);

    // Idempotency guard — already processed
    if ((session as { memory_updated_at?: string }).memory_updated_at) {
      console.log("[update-memory] Already processed session:", session_id, "— skipping");
      return new Response(JSON.stringify({ ok: true, skipped: "already_processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch messages with confusion signals
    const { data: messages } = await supabase
      .from("tutor_messages")
      .select("role, content, was_confused, follow_up_count, task_type")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });

    if (!messages || messages.length < 2) {
      await supabase
        .from("tutor_sessions")
        .update({ memory_updated_at: new Date().toISOString() })
        .eq("id", session_id);
      console.log("[update-memory] Too few messages for session:", session_id, "— marking processed");
      return new Response(JSON.stringify({ ok: true, skipped: "too_few_messages" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Include confusion markers so the model can distinguish confusion from curiosity.
    const transcript = messages
      .map((m) => {
        const flags: string[] = [];
        if (m.was_confused) flags.push("[CONFUSED]");
        if (m.follow_up_count && m.follow_up_count > 1) flags.push(`[${m.follow_up_count} follow-ups]`);
        return `${(m.role as string).toUpperCase()}${flags.length ? " " + flags.join(" ") : ""}: ${m.content}`;
      })
      .join("\n\n");

    // Fetch existing subject memory (topic data) and global memory (behavioral traits)
    const { data: existingMemory } = await supabase
      .from("student_ai_memory")
      .select(
        "memory_summary, recently_discussed_topics, common_mistakes, struggle_patterns, learning_pace, preferred_style, total_sessions, total_messages, chapters_visited, weak_topics, strong_topics"
      )
      .eq("user_id", (session as { user_id: string }).user_id)
      .eq("subject", memorySubjectKey)
      .maybeSingle();

    const { data: globalMemory } = await supabase
      .from("student_ai_memory")
      .select("memory_summary, learning_pace, preferred_style, total_sessions, total_messages")
      .eq("user_id", (session as { user_id: string }).user_id)
      .eq("subject", "__global__")
      .maybeSingle();

    const appUrl = Deno.env.get("LERNO_APP_URL")?.replace(/\/$/, "");
    const internalSecret = Deno.env.get("LERNO_INTERNAL_LLM_SECRET");
    if (!appUrl || !internalSecret) {
      return new Response(
        JSON.stringify({
          error:
            "LERNO_APP_URL and LERNO_INTERNAL_LLM_SECRET must be set (edge function calls Next.js /api/internal/llm-chat for Vertex/Gemini)",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chatModel = Deno.env.get("GEMINI_CHAT_MODEL") ?? "google/gemini-2.5-flash";

    const existingRecentTopics =
      (existingMemory as { recently_discussed_topics?: string[] } | null)?.recently_discussed_topics ?? [];
    const existingMistakes =
      (existingMemory as { common_mistakes?: string[] } | null)?.common_mistakes ?? [];

    const sysPrompt = `You are analyzing a tutoring chat transcript to extract BEHAVIORAL learning signals.

CRITICAL RULES — read carefully:
1. You are observing HOW the student learns, NOT whether they know the topic.
2. Asking questions about a topic does NOT mean it is weak. Curiosity ≠ weakness.
3. "recently_discussed_topics" = topics that came up in this session (neutral — no mastery judgement).
4. "confusion_signals" = only topics where the student EXPLICITLY showed confusion:
   - Messages flagged [CONFUSED] or [N follow-ups] in the transcript
   - Student wrote "I don't understand", "I'm confused", "what does X mean" after an explanation
   - NOT: simply asking about a topic for the first time
5. "common_mistakes" = specific errors in reasoning/phrasing in the student's own messages.
6. "struggle_patterns" = HOW they struggle (e.g. "has trouble with formula-heavy topics"), not WHAT they struggle with.
7. Do NOT output weak_topics or strong_topics — those come from quiz results only.

SESSION TRANSCRIPT (confusion markers included where recorded):
${transcript}

EXISTING MEMORY (merge, do not discard):
${JSON.stringify(
  {
    memory_summary: (existingMemory as { memory_summary?: string } | null)?.memory_summary,
    learning_pace: (existingMemory as { learning_pace?: string } | null)?.learning_pace,
    preferred_style: (existingMemory as { preferred_style?: string } | null)?.preferred_style,
    common_mistakes: existingMistakes,
  },
  null,
  2
)}

Respond in valid JSON only — no markdown, no explanation:
{
  "memory_summary": "2-3 sentences about HOW this student learns — their communication style, thinking patterns, how they engage. Write in subject-agnostic terms (e.g. 'prefers examples, asks follow-up questions') — NOT about what topics they studied. Merge with existing if present: ${(globalMemory as { memory_summary?: string } | null)?.memory_summary ?? 'none yet'}",
  "recently_discussed_topics": ["topics that came up in this session — chapter names, concepts, formulas. Max 6."],
  "confusion_signals": ["topics/concepts where student EXPLICITLY showed confusion this session. Empty array if none."],
  "common_mistakes": ["specific recurring reasoning errors in student messages. Merge with existing."],
  "struggle_patterns": [{"pattern": "...", "evidence": "..."}],
  "learning_pace": "slow | medium | fast — infer from follow-ups needed per concept",
  "preferred_style": "explanation | examples | visual_description | step_by_step — infer from engagement"
}`;

    console.log("[update-memory] Calling Lerno LLM proxy for behavioral extraction | session:", session_id);

    const completion = await fetch(`${appUrl}/api/internal/llm-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lerno-internal-secret": internalSecret,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: "Extract the behavioral JSON." },
        ],
        options: {
          model: chatModel,
          temperature: 0.2,
        },
      }),
    });

    const completionData = (await completion.json()) as { content?: string; error?: string };
    if (!completion.ok) {
      console.error("[update-memory] LLM proxy error:", completion.status, completionData);
      return new Response(
        JSON.stringify({ error: completionData.error ?? "LLM proxy failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const rawContent = completionData?.content ?? "";

    let parsed: BehavioralExtract;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent) as BehavioralExtract;
    } catch {
      console.error("[update-memory] Failed to parse behavioral JSON:", rawContent);
      return new Response(JSON.stringify({ error: "Failed to parse extraction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[update-memory] Extracted | recently_discussed:", parsed.recently_discussed_topics?.length ?? 0, "| confusion_signals:", parsed.confusion_signals?.length ?? 0, "| mistakes:", parsed.common_mistakes?.length ?? 0);

    // Merge recently_discussed_topics — keep last 20, most recent first
    const newTopics = parsed.recently_discussed_topics ?? [];
    const mergedRecentTopics = [...new Set([...newTopics, ...existingRecentTopics])].slice(0, 20);

    const existingMemoryRecord = existingMemory as {
      total_sessions?: number;
      total_messages?: number;
      chapters_visited?: string[];
      weak_topics?: string[];
      strong_topics?: string[];
      struggle_patterns?: unknown[];
    } | null;

    // Update chapters_visited
    const existingChapters = existingMemoryRecord?.chapters_visited ?? [];
    const sessionChapterIndex = (session as { chapter_index?: string }).chapter_index;
    const updatedChapters =
      sessionChapterIndex && !existingChapters.includes(String(sessionChapterIndex))
        ? [...existingChapters, String(sessionChapterIndex)]
        : existingChapters;

    // ── Global row: behavioral traits shared across all subjects ──────────────
    await supabase.from("student_ai_memory").upsert(
      {
        user_id:         (session as { user_id: string }).user_id,
        subject:         "__global__",
        memory_summary:  parsed.memory_summary ?? (globalMemory as { memory_summary?: string } | null)?.memory_summary,
        learning_pace:   parsed.learning_pace  ?? (globalMemory as { learning_pace?: string } | null)?.learning_pace  ?? "medium",
        preferred_style: parsed.preferred_style ?? (globalMemory as { preferred_style?: string } | null)?.preferred_style ?? "explanation",
        total_sessions:  ((globalMemory as { total_sessions?: number } | null)?.total_sessions ?? 0) + 1,
        total_messages:  ((globalMemory as { total_messages?: number } | null)?.total_messages ?? 0) + messages.length,
        // Subject-specific fields are irrelevant on the global row
        weak_topics:               [],
        strong_topics:             [],
        recently_discussed_topics: [],
        common_mistakes:           [],
        struggle_patterns:         [],
        chapters_visited:          [],
        last_session_at: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      },
      { onConflict: "user_id,subject" }
    );

    // ── Subject row: topic data for this subject ───────────────────────────────
    // Never overwrite weak_topics / strong_topics (those come from quiz-result route).
    await supabase.from("student_ai_memory").upsert(
      {
        user_id:  (session as { user_id: string }).user_id,
        subject:  memorySubjectKey,
        memory_summary: null, // behavioral summary lives on global row only
        recently_discussed_topics: mergedRecentTopics,
        common_mistakes:  parsed.common_mistakes ?? existingMistakes,
        struggle_patterns: parsed.struggle_patterns ?? existingMemoryRecord?.struggle_patterns ?? [],
        // Preserve quiz-verified mastery — never overwrite from chat
        weak_topics:  existingMemoryRecord?.weak_topics ?? [],
        strong_topics: existingMemoryRecord?.strong_topics ?? [],
        chapters_visited: updatedChapters,
        last_session_at: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      },
      { onConflict: "user_id,subject" }
    );

    console.log("[update-memory] student_ai_memory upserted | user:", (session as { user_id: string }).user_id, "| subject:", memorySubjectKey);

    // Write confusion_signals as memory_entries (service role — bypasses RLS)
    if (parsed.confusion_signals && parsed.confusion_signals.length > 0) {
      const confusionEntries = parsed.confusion_signals.map((signal) => ({
        user_id: (session as { user_id: string }).user_id,
        subject: memorySubjectKey,
        entry_type: "confusion_signal",
        content: signal,
        confidence: "observed_once",
        source: "chat_session",
        session_id: session_id,
      }));
      const { error: confErr } = await supabase.from("memory_entries").insert(confusionEntries);
      if (confErr) {
        console.warn("[update-memory] Failed to insert confusion_signal entries:", confErr.message);
      } else {
        console.log("[update-memory] Inserted", confusionEntries.length, "confusion_signal entries");
      }
    }

    // Write recently_discussed topics as memory_entries
    if (newTopics.length > 0) {
      const discussedEntries = newTopics.map((topic) => ({
        user_id: (session as { user_id: string }).user_id,
        subject: memorySubjectKey,
        entry_type: "recently_discussed",
        content: topic,
        confidence: "observed_once",
        source: "chat_session",
        session_id: session_id,
      }));
      const { error: discErr } = await supabase.from("memory_entries").insert(discussedEntries);
      if (discErr) {
        console.warn("[update-memory] Failed to insert recently_discussed entries:", discErr.message);
      } else {
        console.log("[update-memory] Inserted", discussedEntries.length, "recently_discussed entries");
      }
    }

    // Mark session as processed (idempotency)
    await supabase
      .from("tutor_sessions")
      .update({ memory_updated_at: new Date().toISOString() })
      .eq("id", session_id);

    console.log("[update-memory] Done | session:", session_id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[update-memory] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
