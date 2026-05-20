import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { embed } from "@/lib/ai/embed";
import {
  getChapterTopicsFromQdrant,
  scrollChunksForLearnTopic,
  searchLearnChunks,
  dedupeRetrievedChunksById,
  capLearnChunksForPrompt,
} from "@/lib/ai/qdrant";
import { streamChat } from "@/lib/ai/llm";
import { buildLearnModeSystemPrompt } from "@/lib/ai/learn-prompt";
import { extractInlineCitations, fallbackCitations } from "@/lib/ai/citations";
import { getChapterLimitForSubject, SUBJECT_LABELS } from "@/lib/chapters";
import { getNcertBookFromTutorSubject, resolveSubjectSlug } from "@/lib/tutor-subject";
import { getChapterFromCurriculum } from "@/lib/curriculum";
import { buildLearnProgressSubjectKey, getLearnProgressReadKeys } from "@/lib/learn-progress";
import type { RetrievedChunk } from "@/lib/ai/qdrant";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { generateGraphArtifactsForAnswer } from "@/lib/graphs/generate";

/** POST /api/learn/kickoff
 * Generates the AI's first message when a teaching session page loads.
 * Streams the response via SSE so the frontend can show it progressively. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(user.id, "llm_learn");
  if (!rl.success) {
    console.log("[learn/kickoff] Rate limited:", user.id);
    return rateLimitedResponse(rl.reset);
  }

  const body = await request.json() as {
    session_id: string;
    subject: string;
    chapter_index: number;
    chapter_name: string;
    grade?: number;
  };

  const rawSubject = body.subject;
  const { session_id, chapter_index, chapter_name, grade = 10 } = body;
  if (!session_id || !rawSubject || chapter_index == null) {
    return NextResponse.json({ error: "session_id, subject, chapter_index required" }, { status: 400 });
  }
  // Normalise: handles legacy sessions/requests that may carry a display label ("Geography")
  const subject = resolveSubjectSlug(rawSubject);
  const chapterLimit = getChapterLimitForSubject(grade, subject);
  if (chapterLimit != null && Number(chapter_index) > chapterLimit) {
    return NextResponse.json({ error: `Chapter ${chapter_index} is not available for this subject yet` }, { status: 400 });
  }

  const admin = createAdminClient() ?? supabase;
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const progressSubjectKey = buildLearnProgressSubjectKey(grade, subject);
  const readProgressKeys = getLearnProgressReadKeys(grade, subject);
  const ncertBook = getNcertBookFromTutorSubject(subject) ?? null;

  // Verify session ownership
  const { data: session } = await admin
    .from("tutor_sessions")
    .select("id, mode")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Check if session already has messages (avoid double kickoff)
  const { count } = await admin
    .from("tutor_messages")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session_id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "Session already has messages" }, { status: 409 });
  }

  // Curriculum JSON → Qdrant fallback for topic list
  const curriculumChapter = getChapterFromCurriculum(grade, subject, chapter_index, chapter_name);
  const curriculumTopics = curriculumChapter
    ? curriculumChapter.topics.map((t) => ({ topic_index: t.topic_index, topic_name: t.topic_name }))
    : null;

  // Fetch data in parallel
  const [qdrantTopics, progressRow, memoryRow, profileRow] = await Promise.all([
    curriculumTopics ? Promise.resolve([] as { topic_index: string; topic_name: string }[]) : getChapterTopicsFromQdrant(grade, subject, chapter_index, ncertBook),
    admin
      .from("chapter_learn_progress")
      .select("topics_completed, current_topic_index, diagnostic_completed, diagnostic_score, status")
      .eq("user_id", user.id)
      .in("subject", readProgressKeys)
      .eq("chapter_index", chapter_index)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("student_ai_memory")
      .select("memory_summary, weak_topics, learning_pace, preferred_style")
      .eq("user_id", user.id)
      .eq("subject", subjectLabel)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("full_name, grade")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // Priority: curriculum JSON → Qdrant → synthesised single-topic fallback
  const allTopics = curriculumTopics ?? (qdrantTopics.length > 0 ? qdrantTopics : null);
  const resolvedTopics =
    allTopics && allTopics.length > 0
      ? allTopics
      : [{ topic_index: `${chapter_index}.0`, topic_name: chapter_name }];

  const progress = {
    topics_completed: (progressRow.data?.topics_completed as string[] | null) ?? [],
    current_topic_index: progressRow.data?.current_topic_index ?? resolvedTopics[0]?.topic_index ?? null,
    diagnostic_completed: progressRow.data?.diagnostic_completed ?? false,
    diagnostic_score: (progressRow.data?.diagnostic_score as Record<string, number> | null) ?? null,
  };

  const isResume = (progress.topics_completed?.length ?? 0) > 0;
  const firstTopic = resolvedTopics[0];
  const currentTopicInfo =
    resolvedTopics.find((t) => t.topic_index === progress.current_topic_index) ?? firstTopic;
  const topicIdx = currentTopicInfo?.topic_index ?? firstTopic?.topic_index;
  const topicName = currentTopicInfo?.topic_name ?? firstTopic?.topic_name ?? chapter_name;

  // Fire both topic scroll and intro scroll in parallel — they're independent Qdrant queries.
  // capLearnChunksForPrompt caps at 48 chunks, so 80 is ample headroom without over-fetching.
  const introTopicIdx = `${chapter_index}.0`;
  const needsIntroChunks = !isResume && topicIdx !== introTopicIdx;

  const [mainScrolled, introScrolled] = await Promise.all([
    topicIdx ? scrollChunksForLearnTopic(grade, subject, chapter_index, topicIdx, 80, ncertBook) : Promise.resolve([] as Awaited<ReturnType<typeof scrollChunksForLearnTopic>>),
    needsIntroChunks ? scrollChunksForLearnTopic(grade, subject, chapter_index, introTopicIdx, 80, ncertBook) : Promise.resolve([] as Awaited<ReturnType<typeof scrollChunksForLearnTopic>>),
  ]);

  // Fallback: if main scroll returned nothing (topic_index not indexed), use semantic search
  let retrieved = mainScrolled;
  if (retrieved.length === 0 && topicIdx) {
    const v = await embed(`${topicName} ${chapter_name} grade ${grade} NCERT`);
    retrieved = await searchLearnChunks(v, topicName, grade, subject, chapter_index, [], 28, ncertBook);
  }

  // Fallback: if intro scroll returned nothing, use semantic search
  let introChunks = introScrolled;
  if (needsIntroChunks && introChunks.length === 0) {
    const iv = await embed(`introduction overview ${chapter_name} grade ${grade} NCERT`);
    introChunks = await searchLearnChunks(iv, `introduction ${chapter_name}`, grade, subject, chapter_index, [introTopicIdx], 10, ncertBook);
  }

  // Intro chunks go first so they appear as [1][2]… in the prompt; topic chunks follow.
  const mergedForKickoff = needsIntroChunks ? [...introChunks, ...retrieved] : retrieved;
  const capped = capLearnChunksForPrompt(dedupeRetrievedChunksById(mergedForKickoff));
  const chunksForCitation: RetrievedChunk[] = capped.map((c) => ({
    chunk_id: String(c.chunk_id),
    content: c.content,
    chapter_name: c.chapter_name,
    chapter_index: c.chapter_index,
    topic_name: c.topic_name,
    topic_index: c.topic_index,
    subtopic_name: c.subtopic_name,
    subtopic_index: c.subtopic_index,
    page_start: c.page_start,
    page_end: c.page_end,
    relevance_score: c.relevance_score ?? 1,
  }));
  const chunksForPrompt = capped.map((c) => ({
    content: c.content,
    chapter_name: c.chapter_name,
    chapter_index: c.chapter_index,
    topic_name: c.topic_name,
    topic_index: c.topic_index,
    subtopic_name: c.subtopic_name,
    subtopic_index: c.subtopic_index,
    chunk_id: c.chunk_id,
    page_start: c.page_start,
    page_end: c.page_end,
  }));

  const systemPrompt = buildLearnModeSystemPrompt({
    grade,
    subject,
    chapter_index,
    chapter_name,
    all_topics: resolvedTopics,
    progress,
    memory: memoryRow.data,
    student_name: profileRow.data?.full_name ?? null,
    chunks: chunksForPrompt,
    chapter: curriculumChapter ?? null,
  });

  const topicLine = `${topicIdx} — ${topicName}`;
  const planOneLiner = resolvedTopics.map((t) => `${t.topic_index}: ${t.topic_name}`).join(" | ");

  // Build a rich chapter overview from curriculum JSON (if available) for the opening message.
  // • Skip the X.0 intro topic (covered separately via intro chunks).
  // • Skip placeholder "Introduction" subtopics — they just mean no real subtopics exist.
  const isPlaceholderSubtopic = (name: string) => name.trim().toLowerCase() === "introduction";
  const chapterOverview = curriculumChapter
    ? curriculumChapter.topics
        .filter((t) => !t.topic_index.endsWith(".0"))
        .map((t) => {
          const pagesStr = t.page_start === t.page_end ? `p.${t.page_start}` : `pp.${t.page_start}–${t.page_end}`;
          const realSubtopics = (t.subtopics ?? []).filter((st) => !isPlaceholderSubtopic(st.subtopic_name));
          const focusLine = realSubtopics.length
            ? `    Focus: ${realSubtopics.slice(0, 2).map((st) => st.subtopic_name).join("; ")}.`
            : "    Focus: Core concept, method, and common exam-style application.";
          const subtopicLines = realSubtopics.length
            ? "\n" + realSubtopics.map((st) => `      - ${st.subtopic_name}`).join("\n")
            : "";
          return `  ${t.topic_index}: ${t.topic_name} (${pagesStr})\n${focusLine}${subtopicLines}`;
        })
        .join("\n")
    : planOneLiner;

  const diagnosticScoreMap = progress.diagnostic_score ?? {};
  const hasDiagnosticResults =
    progress.diagnostic_completed && Object.keys(diagnosticScoreMap).length > 0;
  const assessedTopicOutcomes = resolvedTopics
    .filter((t) => !t.topic_index.endsWith(".0"))
    .map((t) => {
      const score = diagnosticScoreMap[t.topic_index];
      if (typeof score !== "number") return null;
      const pct = Math.round(score * 100);
      const band = score >= 0.75 ? "strong" : score >= 0.5 ? "developing" : "needs support";
      return { topic_index: t.topic_index, topic_name: t.topic_name, pct, band };
    })
    .filter((x): x is { topic_index: string; topic_name: string; pct: number; band: "strong" | "developing" | "needs support" } => x !== null);
  const diagnosticTopicLines = assessedTopicOutcomes
    .map((t) => `- ${t.topic_index}: ${t.topic_name} — ${t.pct}% (${t.band})`)
    .join("\n");
  const strongTopicsLine = assessedTopicOutcomes
    .filter((t) => t.band === "strong")
    .map((t) => `${t.topic_index}: ${t.topic_name}`)
    .join(", ");
  const weakTopicsLine = assessedTopicOutcomes
    .filter((t) => t.band === "needs support" || t.band === "developing")
    .map((t) => `${t.topic_index}: ${t.topic_name}`)
    .join(", ");
  const fallbackOutcomesFromMap = Object.entries(diagnosticScoreMap)
    .map(([topicKey, score]) => {
      if (typeof score !== "number") return null;
      const pct = Math.round(score * 100);
      const band = score >= 0.75 ? "strong" : score >= 0.5 ? "developing" : "needs support";
      return { topic_index: topicKey, topic_name: topicKey, pct, band };
    })
    .filter((x): x is { topic_index: string; topic_name: string; pct: number; band: "strong" | "developing" | "needs support" } => x !== null);
  const effectiveOutcomes = assessedTopicOutcomes.length > 0 ? assessedTopicOutcomes : fallbackOutcomesFromMap;
  const effectiveDiagnosticTopicLines = effectiveOutcomes
    .map((t) => `- ${t.topic_index}: ${t.topic_name} — ${t.pct}% (${t.band})`)
    .join("\n");
  const effectiveStrongTopicsLine = effectiveOutcomes
    .filter((t) => t.band === "strong")
    .map((t) => `${t.topic_index}: ${t.topic_name}`)
    .join(", ");
  const effectiveWeakTopicsLine = effectiveOutcomes
    .filter((t) => t.band === "needs support" || t.band === "developing")
    .map((t) => `${t.topic_index}: ${t.topic_name}`)
    .join(", ");

  // When no NCERT passages are available, start the session warmly without citations rather
  // than showing an error. The original kickoff behaved this way and it was "almost working".
  const kickoffInstruction =
    chunksForPrompt.length === 0
      ? isResume
        ? `Write a warm welcome-back message for a student resuming Chapter ${chapter_index}: "${chapter_name}".
Topics already covered: ${progress.topics_completed.join(", ")}.
Continue from topic: ${topicLine}.
Give a brief 1-sentence recap of what was covered, then start teaching the next topic immediately with a hook question or interesting observation. Keep it under 120 words.`
        : `This is the FIRST message of the chapter session. Write ONLY these two sections and nothing else:

1) **Diagnostic review**
2) **Chapter roadmap**

Hard constraints:
- Do NOT teach any chapter content yet.
- Do NOT give chapter introduction/background.
- Do NOT ask a quiz/check question.
- Do NOT add any other sections.

For **Diagnostic review**:
${hasDiagnosticResults
    ? `- Write like a private tutor speaking directly to one student, not like a report.
- Keep this section to 3-5 short lines total.
- Do NOT use rigid labels like "You did well in:" / "You need deeper work in:" / "Plan:".
- Start with one personal takeaway sentence about the student's current level.
- Then mention strengths by grouping patterns (for example: "angle values and identities"), not by listing every correct topic.
- Mention at most 1-2 specific weak or watchout areas. If no clear weak area exists, explicitly say you'll validate depth with quick checks.
- End with one tailored next-step sentence describing how pace will be adjusted.
- Do NOT mention any topic as "not assessed" when diagnostic scores exist.
- Use these topic-wise outcomes:
${effectiveDiagnosticTopicLines}
- Strong topics reference list: ${effectiveStrongTopicsLine || "none"}
- Weak/developing topics reference list: ${effectiveWeakTopicsLine || "none"}`
    : `- State clearly that no detailed diagnostic score is available yet.
- Say you will infer strengths/weaknesses while teaching and adapt pace accordingly.`}

For **Chapter roadmap**:
- Give the chapter topic breakdown in the same style as the current roadmap.
- For EACH topic, include one short "Focus: ..." line that explains what the student will learn in that topic.
- Use this exact topic structure:
${chapterOverview}
- Keep it concise and scannable.`
      : isResume
        ? `Welcome the student back to Chapter ${chapter_index}: "${chapter_name}".
Topics already completed: ${progress.topics_completed.length ? progress.topics_completed.join(", ") : "none"}.
We are on topic ${topicLine}. You have the textbook excerpts for THIS topic in TEXTBOOK CONTENT.

Give one short recap sentence (one line only), then pick up where this topic left off. Teach the FIRST or NEXT natural part/subtopic — not the whole topic at once. Cover one concept clearly using the passages [N]. Then either:
- End with ONE **Quick Check ✅** if an important concept just finished, OR
- Ask "Any questions so far? Ready to continue to [next part]?" if more remains.`
        : `This is the FIRST message of the chapter session. Write ONLY these two sections and nothing else:

1) **Diagnostic review**
2) **Chapter roadmap**

Hard constraints:
- Do NOT teach any chapter content yet.
- Do NOT give chapter introduction/background.
- Do NOT ask a quiz/check question.
- Do NOT add any other sections.

For **Diagnostic review**:
${hasDiagnosticResults
    ? `- Write like a private tutor speaking directly to one student, not like a report.
- Keep this section to 3-5 short lines total.
- Do NOT use rigid labels like "You did well in:" / "You need deeper work in:" / "Plan:".
- Start with one personal takeaway sentence about the student's current level.
- Then mention strengths by grouping patterns (for example: "angle values and identities"), not by listing every correct topic.
- Mention at most 1-2 specific weak or watchout areas. If no clear weak area exists, explicitly say you'll validate depth with quick checks.
- End with one tailored next-step sentence describing how pace will be adjusted.
- Do NOT mention any topic as "not assessed" when diagnostic scores exist.
- Use these topic-wise outcomes:
${effectiveDiagnosticTopicLines}
- Strong topics reference list: ${effectiveStrongTopicsLine || "none"}
- Weak/developing topics reference list: ${effectiveWeakTopicsLine || "none"}`
    : `- State clearly that no detailed diagnostic score is available yet.
- Say you will infer strengths/weaknesses while teaching and adapt pace accordingly.`}

For **Chapter roadmap**:
- Give the chapter topic breakdown in the same style as the current roadmap.
- For EACH topic, include one short "Focus: ..." line that explains what the student will learn in that topic.
- Use this exact topic structure:
${chapterOverview}
- Keep it concise and scannable.`;

  // Stream the kickoff message
  const encoder = new TextEncoder();
  let fullContent = "";

  // Build chunk previews for the thinking block
  const chunkPreviews = capped.map((c) => ({
    chunk_id: String(c.chunk_id),
    chapter_name: c.chapter_name ?? "",
    chapter_index: String(c.chapter_index ?? ""),
    topic_name: c.topic_name ?? "",
    topic_index: String(c.topic_index ?? ""),
    page_start: c.page_start,
    page_end: c.page_end,
    preview: (c.content ?? "").slice(0, 130) + ((c.content?.length ?? 0) > 130 ? "…" : ""),
  }));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Emit step events so the frontend can show a thinking block
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "step:searching", label: "Reading NCERT" })}\n\n`));
        if (chunkPreviews.length > 0) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "step:chunks", label: `Found ${chunkPreviews.length} passage${chunkPreviews.length !== 1 ? "s" : ""}`, chunks: chunkPreviews })}\n\n`
          ));
        }

        for await (const token of streamChat(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: kickoffInstruction },
          ],
          { maxTokens: 16384 }
        )) {
          fullContent += token;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
        }

        let inlineCitations = extractInlineCitations(fullContent, chunksForCitation, grade, subject);
        if (inlineCitations.length === 0 && chunksForCitation.length > 0) {
          inlineCitations = fallbackCitations(chunksForCitation, grade, subject, 3);
        }

        const graphArtifacts = await generateGraphArtifactsForAnswer({
          answer: fullContent,
          userMessage: kickoffInstruction,
          subject,
          grade,
          chapter_name,
          topic_name: topicName,
        });
        if (graphArtifacts.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "graphs", graph_artifacts: graphArtifacts })}\n\n`));
        }

        // Save the kickoff message to DB
        const { data: savedMsg } = await admin
          .from("tutor_messages")
          .insert({
            session_id,
            role: "assistant",
            content: fullContent,
            task_type: "explain",
            citations: inlineCitations,
            graph_artifacts: graphArtifacts.length > 0 ? graphArtifacts : null,
          })
          .select("id")
          .single();

        // Update chapter progress to in_progress + set current_topic
        await admin
          .from("chapter_learn_progress")
          .upsert(
            {
              user_id: user.id,
              subject: progressSubjectKey,
              chapter_index,
              chapter_name,
              status: "in_progress",
              current_topic_index: progress.current_topic_index ?? resolvedTopics[0]?.topic_index ?? null,
              last_session_id: session_id,
              last_session_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,subject,chapter_index" }
          );

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              message_id: savedMsg?.id,
              content: fullContent,
              citations: inlineCitations,
              graph_artifacts: graphArtifacts,
            })}\n\n`
          )
        );
      } catch (err) {
        Sentry.captureException(err, { tags: { api_route: "learn/kickoff" } });
        console.error("[learn/kickoff] Stream error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Kickoff failed" })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
