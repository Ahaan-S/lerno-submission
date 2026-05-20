import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

interface QuizResultBody {
  subject: string;
  chapter_index: string;
  topic_index: string;
  topic_name: string;
  is_correct: boolean;
  session_id?: string;
}

/**
 * POST /api/study/quiz-result
 * Called by the study feed when a student answers a quiz question.
 *
 * Updates student_topic_progress mastery level based on cumulative quiz performance.
 * After 3+ attempts: >= 75% accuracy → strong, >= 40% → learning, < 40% → weak.
 *
 * Also updates student_ai_memory weak_topics / strong_topics (quiz-verified only).
 * These arrays are the ONLY place mastery is written — the chat memory update function
 * never touches them.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: QuizResultBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subject, chapter_index, topic_index, topic_name, is_correct, session_id } = body;
  if (!subject || !chapter_index || !topic_index || !topic_name) {
    return NextResponse.json(
      { error: "subject, chapter_index, topic_index, topic_name required" },
      { status: 400 }
    );
  }

  console.log(
    "[quiz-result] User:", user.id,
    "| subject:", subject,
    "| chapter:", chapter_index,
    "| topic:", topic_name,
    "| topic_index:", topic_index,
    "| correct:", is_correct
  );

  // Fetch existing progress for this topic
  const { data: existing } = await supabase
    .from("student_topic_progress")
    .select("id, quiz_attempts, quiz_correct, mastery_level")
    .eq("user_id", user.id)
    .eq("subject", subject)
    .eq("chapter_index", chapter_index)
    .eq("topic_index", topic_index)
    .maybeSingle();

  const prevAttempts = (existing as { quiz_attempts?: number } | null)?.quiz_attempts ?? 0;
  const prevCorrect = (existing as { quiz_correct?: number } | null)?.quiz_correct ?? 0;
  const newAttempts = prevAttempts + 1;
  const newCorrect = prevCorrect + (is_correct ? 1 : 0);

  console.log(
    "[quiz-result] Previous:", prevAttempts, "attempts,", prevCorrect, "correct",
    "| New:", newAttempts, "attempts,", newCorrect, "correct"
  );

  // Mastery level: need at least 3 attempts before assigning weak/strong
  let masteryLevel: string;
  if (newAttempts < 3) {
    masteryLevel = "learning";
  } else {
    const accuracy = newCorrect / newAttempts;
    if (accuracy >= 0.75) {
      masteryLevel = "strong";
    } else if (accuracy >= 0.4) {
      masteryLevel = "learning";
    } else {
      masteryLevel = "weak";
    }
  }

  console.log("[quiz-result] Mastery level:", masteryLevel, "| accuracy:", newAttempts > 0 ? `${((newCorrect / newAttempts) * 100).toFixed(1)}%` : "n/a");

  // Upsert topic progress
  const { error: progressErr } = await supabase.from("student_topic_progress").upsert(
    {
      user_id: user.id,
      subject,
      chapter_index,
      topic_index,
      topic_name,
      mastery_level: masteryLevel,
      mastery_source: "quiz_verified",
      quiz_attempts: newAttempts,
      quiz_correct: newCorrect,
      last_practiced_at: new Date().toISOString(),
    },
    { onConflict: "user_id,subject,chapter_index,topic_index" }
  );

  if (progressErr) {
    console.error("[quiz-result] Failed to upsert student_topic_progress:", progressErr.message);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }

  // After 3+ attempts, update student_ai_memory weak_topics / strong_topics
  // Uses admin client (service role) to bypass RLS for memory writes
  if (newAttempts >= 3) {
    const admin = createAdminClient();
    if (admin) {
      const { data: memory } = await admin
        .from("student_ai_memory")
        .select("weak_topics, strong_topics")
        .eq("user_id", user.id)
        .eq("subject", subject)
        .maybeSingle();

      const weakTopics: string[] = (memory as { weak_topics?: string[] } | null)?.weak_topics ?? [];
      const strongTopics: string[] = (memory as { strong_topics?: string[] } | null)?.strong_topics ?? [];

      let updatedWeak = weakTopics;
      let updatedStrong = strongTopics;

      if (masteryLevel === "strong") {
        // Promote: add to strong, remove from weak
        updatedStrong = [...new Set([...strongTopics, topic_name])];
        updatedWeak = weakTopics.filter((t) => t !== topic_name);
        console.log("[quiz-result] Promoting", topic_name, "to strong | strong count:", updatedStrong.length);
      } else if (masteryLevel === "weak") {
        // Add to weak, remove from strong
        updatedWeak = [...new Set([...weakTopics, topic_name])];
        updatedStrong = strongTopics.filter((t) => t !== topic_name);
        console.log("[quiz-result] Adding", topic_name, "to weak | weak count:", updatedWeak.length);
      } else {
        // learning — remove from both extremes (student is progressing)
        updatedWeak = weakTopics.filter((t) => t !== topic_name);
        updatedStrong = strongTopics.filter((t) => t !== topic_name);
      }

      const { error: memErr } = await admin.from("student_ai_memory").upsert(
        {
          user_id: user.id,
          subject,
          weak_topics: updatedWeak,
          strong_topics: updatedStrong,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,subject" }
      );

      if (memErr) {
        console.error("[quiz-result] Failed to update student_ai_memory:", memErr.message);
        // Non-fatal — topic progress is already saved
      }

      // Write a quiz_verified memory_entry for the audit log
      const { error: entryErr } = await admin.from("memory_entries").insert({
        user_id: user.id,
        subject,
        entry_type: masteryLevel === "strong" ? "style_preference" : "confusion_signal",
        content: `Quiz-verified: ${topic_name} — ${masteryLevel} (${newCorrect}/${newAttempts} correct)`,
        confidence: "quiz_verified",
        source: "quiz",
        session_id: session_id ?? null,
      });

      if (entryErr) {
        console.warn("[quiz-result] Failed to insert memory_entry (non-fatal):", entryErr.message);
      } else {
        console.log("[quiz-result] memory_entry inserted | topic:", topic_name, "| mastery:", masteryLevel);
      }
    } else {
      console.warn("[quiz-result] Admin client unavailable — skipping memory_ai_memory update");
    }
  }

  return NextResponse.json({
    ok: true,
    mastery_level: masteryLevel,
    quiz_attempts: newAttempts,
    quiz_correct: newCorrect,
  });
}
