import { createHash } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { embed } from "@/lib/ai/embed";
import {
  hybridSearch,
  hybridRerank,
  searchLearnChunks,
  getChapterTopicsFromQdrant,
  scrollChunksForLearnTopic,
  dedupeRetrievedChunksById,
  capLearnChunksForPrompt,
  TOP_K,
} from "@/lib/ai/qdrant";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { getNcertBookFromTutorSubject, normalizeMemorySubjectSlug, resolveSubjectSlug } from "@/lib/tutor-subject";
import { KNOWN_SUBJECT_SLUGS, getSubjectsForGrade } from "@/lib/ai/subject-detector";
import { rewriteQueryForRetrieval, type RewriterContext } from "@/lib/ai/query-rewriter";
import { streamChat, hasImageContent, resolveModel } from "@/lib/ai/llm";
import type { ContentBlock } from "@/lib/ai/llm";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { buildLearnModeSystemPrompt } from "@/lib/ai/learn-prompt";
import type { TutorTaskType, RetrievedChunksLogInsert, InlineCitation, AttachmentMeta } from "@/lib/database.types";
import type { GraphArtifact } from "@/lib/graphs/types";
import { generateGraphArtifactsForAnswer } from "@/lib/graphs/generate";
import { GRAPH_PLACEHOLDER_PROMPT } from "@/lib/graphs/prompt";
import { extractInlineCitations, fallbackCitations } from "@/lib/ai/citations";
import { getFallbackTitle, isGreeting, parseTitleFromResponse } from "@/lib/tutor-title";
import { seedMemoryFromOnboarding } from "@/lib/ai/memory-seed";
import { detectAskTaskTypeFromMessage } from "@/lib/tutor-detect-task";
import { getLearnProgressReadKeys } from "@/lib/learn-progress";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

const VALID_TASK_TYPES: TutorTaskType[] = ["explain", "notes", "quiz", "solve", "summary"];

/**
 * Quick heuristic to classify question complexity.
 * Appended as a [System note] to the user message to reinforce the
 * RESPONSE CALIBRATION section in the system prompt.
 */
function classifyComplexity(message: string): "quick" | "standard" | "detailed" {
  const m = message.toLowerCase().trim();
  const wordCount = m.split(/\s+/).length;

  // Quick: definitions, single-fact lookups, yes/no, formula recall
  const quickPatterns = [
    /^(what is|define|meaning of|kya hai|kya hota|formula (of|for)|who (is|was)|when (did|was)|which|name the)\b/,
    /^(is|are|does|do|can|will|was|were)\s/,
  ];
  if (wordCount <= 8 && quickPatterns.some((p) => p.test(m))) {
    return "quick";
  }

  // Detailed: broad, multi-part, comparative questions
  const detailedPatterns = [
    /\b(all types|compare|differentiate|difference between|explain in detail|describe all|list all|explain the process)\b/,
    /\b(advantages and disadvantages|pros and cons|similarities and differences)\b/,
    /\b(explain each|describe each|elaborate)\b/,
  ];
  if (detailedPatterns.some((p) => p.test(m)) || wordCount > 20) {
    return "detailed";
  }

  return "standard";
}

/**
 * Zero-cost heuristic: estimate retrieval k from the message in <1ms.
 * Used when query rewrite is skipped (quick mode, learn mode, rewrite disabled).
 * Range: 6 (single-fact) → 12 (broad/multi-part).
 */
function estimateKHeuristic(message: string): number {
  const m = message.toLowerCase().trim();
  const wordCount = m.split(/\s+/).length;

  // Broad-context signals: comparative, multi-part, process, application
  const broadPatterns = [
    /\b(compare|comparison|difference|differences|contrast|vs\.?|versus)\b/,
    /\b(explain|describe|discuss|elaborate|detail|overview|summaris|summariz)\b/,
    /\b(all|every|types?|kinds?|forms?|examples?|list|enumerate)\b/,
    /\b(relationship|connection|effect|impact|role|significance|importance)\b/,
    /\b(derivation|derive|proof|prove)\b/,
    /\b(process|mechanism|steps?|stages?|phases?)\b/,
    /\b(why|how does|how do|how is|how are|how can)\b/,
    /\b(applications?|uses?|advantages?|disadvantages?|limitations?|properties)\b/,
  ];
  const broadCount = broadPatterns.filter((p) => p.test(m)).length;
  const questionMarks = (m.match(/\?/g) ?? []).length;
  const andCount = (m.match(/\band\b/g) ?? []).length;

  if (wordCount > 20 || broadCount >= 3 || questionMarks >= 2) return 12;
  if (wordCount > 10 || broadCount >= 1 || andCount >= 2) return 8;
  return 6;
}

interface ChunkPreview {
  chunk_id: string;
  chapter_name?: string;
  chapter_index?: string;
  topic_name?: string;
  topic_index?: string;
  page_start?: number;
  page_end?: number;
  preview: string;
}

// Bump this whenever the system prompt changes significantly (citation rules, new task types, etc.)
// Old cache rows with a different version are ignored and naturally overwritten on next request.
const PROMPT_VERSION = 4;
const VERBOSE_PIPELINE_LOGS = process.env.TUTOR_VERBOSE_PIPELINE_LOGS === "1";
const ENABLE_QUERY_REWRITE = process.env.TUTOR_QUERY_REWRITE !== "0";
const QUERY_REWRITE_TIMEOUT_MS = Number(process.env.TUTOR_QUERY_REWRITE_TIMEOUT_MS ?? 6000);
// Queries longer than this word count get their retrieval query rewritten by the LLM.
// Shorter queries are already precise enough — the LLM call still runs for k/skipSearch/subject detection,
// but the original query text is kept for retrieval.
const REWRITE_MIN_WORDS = 6;
const HISTORY_MESSAGE_LIMIT = Number(process.env.TUTOR_HISTORY_MESSAGE_LIMIT ?? 10);
const HISTORY_ATTACHMENT_TEXT_LIMIT = Number(process.env.TUTOR_HISTORY_ATTACHMENT_TEXT_LIMIT ?? 800);

/**
 * Cache hits: split response into multiple SSE tokens so the UI can pace them.
 * Smaller = gentler delivery (match `STREAM_DISPLAY_DEFAULTS` in `lib/use-stream-display-buffer.ts`).
 */
const CACHE_SSE_CHUNK_CHARS = 80;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${timeoutLabel} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

interface ChatBody {
  message: string;
  session_id: string;
  subject?: string;
  grade?: number | string | null;
  chapter_index?: string | null;
  user_id?: string; // optional, we verify via auth + session
  task_type?: string;
  quick_mode?: boolean;
  attachments?: AttachmentMeta[];
  /** Short UI label for user bubble (full prompt stays in `message` / stored `content`). */
  display_content?: string | null;
}

/** POST — Chat with AI tutor (RAG pipeline) */
export async function POST(request: NextRequest) {
  console.log("[tutor/chat] POST request received");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.log("[tutor/chat] Unauthorized: no user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(user.id, "llm_chat");
  if (!rl.success) {
    console.log("[tutor/chat] Rate limited:", user.id);
    return rateLimitedResponse(rl.reset);
  }

  let body: ChatBody;
  try {
    body = await request.json();
  } catch {
    console.log("[tutor/chat] Invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, session_id, subject, grade: rawGrade, chapter_index = null, task_type: rawTask } = body;
  const quickMode = body.quick_mode === true;
  const attachments: AttachmentMeta[] = body.attachments ?? [];
  const userDisplayContentRaw = typeof body.display_content === "string" ? body.display_content.trim().slice(0, 600) : "";
  const userDisplayContentPersist = userDisplayContentRaw.length > 0 ? userDisplayContentRaw : null;
  const hasAttachments = attachments.length > 0;
  console.log("[tutor/chat] Body parsed:", {
    message: message?.slice(0, 50),
    session_id,
    subject,
    grade: rawGrade,
    chapter_index,
    task_type: rawTask,
    quick_mode: quickMode,
    attachments: attachments.length,
  });

  // Fire session fetch + optional grade fetch in parallel immediately after body parse.
  // Both only need user.id and session_id which are already available.
  const needsGradeFromDB = rawGrade === undefined || rawGrade === null || rawGrade === "";
  const [sessionFetchResult, profileGradeFetchResult] = await Promise.all([
    supabase
      .from("tutor_sessions")
      .select("id, title, mode, chapter_index, subject, chapter_name")
      .eq("id", session_id ?? "")
      .eq("user_id", user.id)
      .single(),
    needsGradeFromDB
      ? supabase.from("profiles").select("grade").eq("id", user.id).maybeSingle()
      : Promise.resolve(null as null),
  ]);

  let grade = rawGrade;
  let gradeSource = "body";
  if (needsGradeFromDB) {
    // Prefer profile (updatable DB) over auth metadata (can be stale)
    const profileRow = profileGradeFetchResult?.data as { grade?: number | string | null } | null;
    const profileGrade = profileRow?.grade;
    const authGrade = (user.user_metadata as { grade?: number | string | null } | undefined)?.grade;
    if (profileGrade !== undefined && profileGrade !== null && profileGrade !== "") {
      grade = profileGrade;
      gradeSource = "profile";
    } else if (authGrade !== undefined && authGrade !== null && authGrade !== "") {
      grade = authGrade;
      gradeSource = "auth_metadata";
    } else {
      grade = null;
    }
  }
  // Normalize "Class 9"/"Class 10" -> 9/10 for Qdrant (collection uses "9"/"10")
  let gradeForQdrant = typeof grade === "string" && grade.startsWith("Class ")
    ? grade.replace("Class ", "").trim()
    : String(grade);
  if (!gradeForQdrant || gradeForQdrant === "undefined" || gradeForQdrant === "null") gradeForQdrant = "9";

  console.log("[tutor/chat] Grade resolved:", { raw: grade, source: gradeSource, forQdrant: gradeForQdrant });
  if (gradeSource !== "body") {
    const authG = (user.user_metadata as { grade?: unknown } | undefined)?.grade;
    console.log("[tutor/chat] Grade fallback context: auth_metadata.grade=", authG, "| (profile was fetched if needed)");
  }

  if ((!message || typeof message !== "string") && !hasAttachments) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (!session_id || typeof session_id !== "string") {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }
  if (grade === undefined || grade === null) {
    return NextResponse.json({ error: "grade is required" }, { status: 400 });
  }

  // Detect task type early so we can decide whether subject is required.
  const taskType: TutorTaskType =
    rawTask && VALID_TASK_TYPES.includes(rawTask as TutorTaskType)
      ? (rawTask as TutorTaskType)
      : detectAskTaskTypeFromMessage(message);

  // Quick mode skips the rewriter, so subject detection never runs — require subject upfront.
  // In normal mode the rewriter can detect the subject, so we allow it to be missing.
  const subjectMissing = !subject || typeof subject !== "string" || subject.trim() === "";
  if (subjectMissing && quickMode) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }

  console.log("[tutor/chat] Resolved: grade=", grade, "| taskType=", taskType);

  // Notes/summary use filter-only Qdrant scroll + document pipeline — never hybrid search / query rewrite here.
  if (taskType === "notes" || taskType === "summary") {
    return NextResponse.json(
      {
        error: "Notes and summary are generated via the document pipeline, not chat RAG.",
        code: "NOTES_SUMMARY_USE_GENERATE_DOC",
      },
      { status: 422 }
    );
  }

  const chapterKey = chapter_index ?? "";

  // Session was fetched in parallel with grade above — unwrap result now
  const { data: session, error: sessionError } = sessionFetchResult;

  if (sessionError || !session) {
    console.log("[tutor/chat] Session not found or access denied:", sessionError?.message ?? "no session");
    return NextResponse.json({ error: "Session not found or access denied" }, { status: 404 });
  }

  const sessionRow = session as {
    mode?: string | null;
    subject?: string | null;
    chapter_name?: string | null;
    chapter_index?: string | null;
    title?: string | null;
  };

  const rawBodySubject = (subject ?? "").trim();
  // "auto" is the client-side placeholder meaning "no subject selected yet" — treat as empty.
  const bodySubject = rawBodySubject === "auto" ? "" : rawBodySubject;
  const rawSessionSubject = (sessionRow.subject && String(sessionRow.subject).trim()) || "";
  // Similarly, discard "auto" if it was ever persisted to the session.
  const sessionSubject = rawSessionSubject === "auto" ? "" : rawSessionSubject;
  const isLearnModeSession = sessionRow.mode === "learn";

  // Ask mode: client's dropdown (`body.subject`) wins so users can switch book mid-chat.
  // Learn mode: session subject wins (tied to chapter curriculum).
  // resolveSubjectSlug handles legacy sessions that stored display labels ("Geography") instead of slugs.
  let tutorSubjectSlug = resolveSubjectSlug(
    isLearnModeSession
      ? sessionSubject || bodySubject
      : bodySubject || sessionSubject
  );

  if (!isLearnModeSession && bodySubject && sessionSubject && bodySubject !== sessionSubject) {
    const { error: subjectPersistErr } = await supabase
      .from("tutor_sessions")
      .update({ subject: bodySubject })
      .eq("id", session_id)
      .eq("user_id", user.id);
    if (subjectPersistErr) {
      console.warn("[tutor/chat] Could not persist subject change:", subjectPersistErr.message);
    } else {
      console.log("[tutor/chat] Session subject synced to dropdown:", bodySubject);
    }
  }

  let ncertBook = getNcertBookFromTutorSubject(tutorSubjectSlug);
  let memorySubjectKey = normalizeMemorySubjectSlug(tutorSubjectSlug);

  // Semantic cache key — exact match on normalized query + context (include book for SST splits)
  const cacheKey = createHash("sha256")
    .update(
      `${message.toLowerCase().trim()}|${grade}|${tutorSubjectSlug}|${chapterKey}|${taskType}|quick:${quickMode ? "1" : "0"}|${ncertBook ?? ""}`
    )
    .digest("hex");

  console.log("[tutor/chat] Session verified for user:", user.id, "| tutorSubject:", tutorSubjectSlug, "| ncertBook:", ncertBook ?? "(none)", "| memoryKey:", memorySubjectKey, "| learnMode:", isLearnModeSession);

  const startTime = Date.now();
  const encoder = new TextEncoder();

  function sse(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      let streamWritable = true;
      const timings: Record<string, number> = {};
      const timeStep = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
        const t0 = Date.now();
        try {
          return await fn();
        } finally {
          timings[key] = (timings[key] ?? 0) + (Date.now() - t0);
        }
      };
      function enqueueSafe(data: object): boolean {
        if (!streamWritable) return false;
        try {
          controller.enqueue(sse(data));
          return true;
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          if (m.includes("closed") || m.includes("Invalid state")) {
            streamWritable = false;
            return false;
          }
          throw e;
        }
      }

      try {
        // Elapsed time for the thinking UI: stop the clock when the first answer
        // token is sent (matches client ThinkingBlock), not when the stream ends.
        let thinkingElapsedSec: number | null = null;
        let llmFirstTokenMs: number | null = null;
        const onFirstToken = () => {
          if (thinkingElapsedSec === null) {
            thinkingElapsedSec = (Date.now() - startTime) / 1000;
            llmFirstTokenMs = Date.now() - startTime;
          }
        };

        // ── Step: thinking ────────────────────────────────────────────────────
        enqueueSafe({ type: "step:thinking", label: "Thinking..." });

        // Subject detection is folded into the query rewriter (same LLM call, no extra step shown).
        // needsSubjectDetection=true when: no subject in body/session, not learn mode, not quick mode.
        // Any task type can trigger detection — the rewriter handles it in the same call.
        let skipRag = false;
        const needsSubjectDetection =
          !quickMode &&
          !bodySubject &&
          !isLearnModeSession &&
          !KNOWN_SUBJECT_SLUGS.has(tutorSubjectSlug);

        // Applies the subject slug returned by the rewriter. Mutates outer let vars.
        const applyDetectedSubject = (detected: string | null | undefined) => {
          if (detected) {
            tutorSubjectSlug = resolveSubjectSlug(detected);
            ncertBook = getNcertBookFromTutorSubject(tutorSubjectSlug);
            memorySubjectKey = normalizeMemorySubjectSlug(tutorSubjectSlug);
            supabase
              .from("tutor_sessions")
              .update({ subject: detected })
              .eq("id", session_id)
              .eq("user_id", user.id)
              .then(({ error }) => {
                if (error) console.warn("[tutor/chat] Could not persist detected subject:", error.message);
                else console.log("[tutor/chat] Auto-detected subject persisted:", detected);
              });
          } else {
            skipRag = true;
          }
        };

        // ── Step: attachments (if any) ────────────────────────────────────────
        if (hasAttachments) {
          const imgCount = attachments.filter((a) => a.type.startsWith("image/")).length;
          const pdfCount = attachments.filter((a) => a.type === "application/pdf").length;
          let attachLabel: string;
          if (imgCount > 0 && pdfCount === 0) {
            attachLabel = imgCount === 1 ? "Viewing image" : `Viewing ${imgCount} images`;
          } else if (pdfCount > 0 && imgCount === 0) {
            attachLabel = pdfCount === 1 ? "Reading document" : `Reading ${pdfCount} documents`;
          } else {
            attachLabel = "Reviewing attachments";
          }
          enqueueSafe({ type: "step:attachments", label: attachLabel });
        }

        const admin = createAdminClient();

        // ── Cache check (skipped when subject is unknown — detected later in rewriter) ──
        if (!needsSubjectDetection && admin && !hasAttachments && sessionRow.mode !== "learn") {
          const { data: cached } = await admin
            .from("query_cache")
            .select("response_content, citations, graph_artifacts")
            .eq("cache_key", cacheKey)
            .eq("prompt_version", PROMPT_VERSION)
            .maybeSingle();

          if (cached) {
            console.log("[tutor/chat] CACHE HIT | cache_key:", cacheKey.slice(0, 16) + "...");
            const { data: row } = await admin.from("query_cache").select("hit_count").eq("cache_key", cacheKey).single();
            if (row) {
              await admin.from("query_cache").update({ hit_count: ((row as { hit_count?: number }).hit_count ?? 1) + 1 }).eq("cache_key", cacheKey);
            }
            const cachedCitations = ((cached as { citations?: unknown[] }).citations ?? []) as InlineCitation[];
            const cachedGraphArtifacts = ((cached as { graph_artifacts?: unknown[] }).graph_artifacts ?? []) as GraphArtifact[];
            const assistantContent = (cached as { response_content: string }).response_content;

            const { error: userMsgErr } = await supabase
              .from("tutor_messages")
              .insert({ session_id, role: "user", content: message, task_type: taskType })
              .select("id")
              .single();
            const parsedCache = parseTitleFromResponse(assistantContent);
            const displayContent = parsedCache?.content ?? assistantContent;
            const sessionNeedsTitleCache = !sessionRow.title;

            let cachedAssistantMsgId: string | undefined;
            if (!userMsgErr) {
              const { data: cachedMsgData } = await supabase.from("tutor_messages").insert({
                session_id,
                role: "assistant",
                content: displayContent,
                task_type: taskType,
                citations: cachedCitations,
                graph_artifacts: cachedGraphArtifacts.length > 0 ? cachedGraphArtifacts : null,
              }).select("id").single();
              cachedAssistantMsgId = cachedMsgData?.id;
              const updatePayload: Record<string, unknown> = { last_message_at: new Date().toISOString() };
              if (sessionNeedsTitleCache) {
                updatePayload.title = parsedCache?.title ?? getFallbackTitle([], tutorSubjectSlug);
              }
              await supabase.from("tutor_sessions").update(updatePayload).eq("id", session_id);
            }

            const resolvedTitle = sessionNeedsTitleCache
              ? (parsedCache?.title ?? getFallbackTitle([], tutorSubjectSlug))
              : undefined;

            enqueueSafe({ type: "step:generating", label: "Generating answer" });
            onFirstToken();
            for (let i = 0; i < displayContent.length; i += CACHE_SSE_CHUNK_CHARS) {
              if (!enqueueSafe({ type: "token", token: displayContent.slice(i, i + CACHE_SSE_CHUNK_CHARS) })) break;
            }
            const elapsed = thinkingElapsedSec ?? (Date.now() - startTime) / 1000;
            if (cachedGraphArtifacts.length > 0) {
              enqueueSafe({ type: "graphs", graph_artifacts: cachedGraphArtifacts });
            }
            enqueueSafe({
              type: "done",
              citations: cachedCitations,
              graph_artifacts: cachedGraphArtifacts,
              elapsed,
              message_id: cachedAssistantMsgId,
              ...(resolvedTitle && { title: resolvedTitle }),
            });
            if (cachedAssistantMsgId) {
              const cacheThinkingData = {
                steps: [{ type: "step:searching", label: "Searching NCERT Textbook" }],
                elapsed,
                sourcesCount: 0,
              };
              supabase
                .from("tutor_messages")
                .update({ thinking: cacheThinkingData })
                .eq("id", cachedAssistantMsgId)
                .then(({ error }) => {
                  if (error) console.warn("[tutor/chat] thinking save skipped (cache path):", error.message);
                });
            }
            controller.close();
            return;
          }
        }

        console.log("[tutor/chat] Cache miss (or admin unavailable), running full RAG pipeline");
        const isLearnMode = sessionRow.mode === "learn";
        const chapterForProgress = String(sessionRow.chapter_index ?? chapter_index ?? "").trim();
        const hasChapterForProgress = chapterForProgress !== "";

        // Start memory/profile fetch early so it overlaps with rewriting + embedding + retrieval.
        const memoryProfileFetchStartedAt = Date.now();
        const memoryProfilePromise = Promise.all([
          supabase
            .from("student_ai_memory")
            .select("subject, memory_summary, weak_topics, strong_topics, recently_discussed_topics, common_mistakes, struggle_patterns, learning_pace, preferred_style, total_sessions, total_messages, onboarding_seeded, chapters_visited")
            .eq("user_id", user.id)
            .in("subject", [memorySubjectKey, "__global__"]),
          hasChapterForProgress
            ? supabase
                .from("student_topic_progress")
                .select("topic_name, mastery_level")
                .eq("user_id", user.id)
                .eq("subject", memorySubjectKey)
                .eq("chapter_index", chapterForProgress)
            : supabase
                .from("student_topic_progress")
                .select("topic_name, mastery_level")
                .eq("user_id", user.id)
                .eq("subject", memorySubjectKey),
          supabase
            .from("profiles")
            .select("full_name, first_name, learning_style, weak_subjects, strong_subjects, additional_info, tutor_preferences")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        // ── Step 0.4: Fetch conversation history ──────────────────────────────
        console.log("[tutor/chat] Step 0.4: Fetching conversation history for rewriter context");
        const { data: historyRowsDesc } = await timeStep("history_fetch_ms", async () =>
          supabase
            .from("tutor_messages")
            .select("role, content, attachments")
            .eq("session_id", session_id)
            .order("created_at", { ascending: false })
            .limit(HISTORY_MESSAGE_LIMIT)
        );
        const recentHistory: { role: string; content: string; attachments?: unknown }[] = (historyRowsDesc ?? []).reverse();

        const historyMessages = recentHistory.map((r) => {
          const rowAttachments = (r.attachments as AttachmentMeta[] | null) ?? [];

          if (r.role === "user" && rowAttachments.length > 0) {
            const blocks: ContentBlock[] = [{ type: "text", text: r.content }];

            for (const att of rowAttachments) {
              if (att.type.startsWith("image/")) {
                // Use the stored description generated at upload time — no image bytes re-sent,
                // so follow-up turns are as fast as plain text. The AI already saw the image on
                // the first turn; its previous response + the description give full context.
                const desc = att.description?.trim();
                blocks.push({
                  type: "text",
                  text: desc
                    ? `[Image: "${att.name}" — ${desc}]`
                    : `[Image: "${att.name}" — analyzed by the AI earlier in this conversation]`,
                });
              } else if (att.type === "application/pdf" && att.extracted_text) {
                const snippet = att.extracted_text.slice(0, HISTORY_ATTACHMENT_TEXT_LIMIT);
                const truncated = att.extracted_text.length > HISTORY_ATTACHMENT_TEXT_LIMIT;
                blocks.push({
                  type: "text",
                  text: `[Document: "${att.name}"]\n${snippet}${truncated ? "\n[...document continues...]" : ""}`,
                });
              } else if (att.extracted_text) {
                blocks.push({
                  type: "text",
                  text: `[File: "${att.name}"]\n${att.extracted_text.slice(0, HISTORY_ATTACHMENT_TEXT_LIMIT)}`,
                });
              }
            }

            return { role: r.role as "user" | "assistant", content: blocks };
          }

          return { role: r.role as "user" | "assistant", content: r.content };
        });

        // Extract plain text content for rewriter context (history may contain ContentBlock arrays)
        const toPlainText = (c: string | ContentBlock[]): string =>
          typeof c === "string" ? c : c.filter((b): b is { type: "text"; text: string } => b.type === "text").map((b) => b.text).join("\n");

        const lastAssistantContent = [...historyMessages].reverse().find((m) => m.role === "assistant")?.content;
        const lastUserContent = [...historyMessages].reverse().find((m) => m.role === "user")?.content;

        const lastAssistantText = lastAssistantContent ? toPlainText(lastAssistantContent) : undefined;
        const lastUserText = lastUserContent ? toPlainText(lastUserContent) : undefined;

        const rewriterContext: RewriterContext | undefined =
          lastAssistantText || lastUserText
            ? {
                lastUserMessage: lastUserText?.slice(0, 150),
                lastAssistantMessage: lastAssistantText
                  ? lastAssistantText.length > 400
                    ? lastAssistantText.slice(0, 200) + "..." + lastAssistantText.slice(-200)
                    : lastAssistantText
                  : undefined,
              }
            : undefined;

        // ── Step 0.5 onwards: RAG pipeline (skipped for non-academic messages) ─
        // Declare all RAG-output variables with defaults so they're accessible
        // regardless of whether we ran the full pipeline.
        const effectiveMessage = message.trim() || (
          hasAttachments
            ? `${SUBJECT_LABELS[tutorSubjectSlug] ?? tutorSubjectSlug} question from attached document`
            : "general question"
        );
        // complexity is computed after skipRag is resolved (post-rewriter) below
        let complexity: "quick" | "standard" | "detailed" = "standard";
        let retrievalQuery = effectiveMessage;
        let retrievalK = estimateKHeuristic(effectiveMessage);
        let learnTopicIndices: string[] = [];
        let allLearnTopics: { topic_index: string; topic_name: string }[] = [];
        let learnProgress: {
          topics_completed: string[];
          current_topic_index: string | null;
          diagnostic_completed: boolean;
          diagnostic_score: Record<string, number> | null;
        } | null = null;
        let chunks = [] as Awaited<ReturnType<typeof hybridSearch>>;
        let chunkPreviews: ChunkPreview[] = [];
        let searchSkipped = false;
        let skipSearchDirectAnswer = "";
        let skipSearchReason: "greeting" | "acknowledgement" | "meta" | "general_knowledge" | null = null;
        let skipSearchTrigger: string | null = null;
        let queryWasRewritten = false;

        if (!skipRag) {
          console.log("[tutor/chat] Step 0.5: Rewriting query for retrieval");
          // Seed k with the zero-cost heuristic; query rewriter may override it below.
          const shouldRewrite = ENABLE_QUERY_REWRITE && !isLearnMode && !quickMode;
          if (!shouldRewrite) {
            const reasons: string[] = [];
            if (!ENABLE_QUERY_REWRITE) reasons.push("env_disabled");
            if (isLearnMode) reasons.push("learn_mode");
            if (quickMode) reasons.push("quick_mode");
            console.log("[tutor/chat] Rewrite skipped:", reasons.join(", ") || "unknown", "| heuristic k:", retrievalK);
          } else {
            console.log("[tutor/chat] Rewrite enabled | timeoutMs:", QUERY_REWRITE_TIMEOUT_MS);
          }
          // When subject is unknown, pass options so the rewriter detects it in the same call.
          const subjectOptionsForDetection = needsSubjectDetection
            ? getSubjectsForGrade(grade)
            : undefined;

          // Pass current-message attachments to the rewriter for image-aware query generation.
          // History images don't need to be re-passed — their descriptions are already in
          // historyMessages text and the rewriter sees the last assistant response as context.
          const rewriterAttachments = attachments;

          // Start speculative embed of the original message in parallel with the rewriter.
          // If the rewriter is skipped, times out, or returns the same query we reuse the
          // speculative result and skip a second round-trip to OpenAI (~200-500 ms saved).
          const speculativeEmbedPromise = embed(effectiveMessage);

          if (shouldRewrite) {
            try {
              const rewriteResult = await timeStep("rewrite_ms", () =>
                withTimeout(
                  rewriteQueryForRetrieval(
                    effectiveMessage,
                    grade,
                    tutorSubjectSlug,
                    rewriterContext,
                    rewriterAttachments.length > 0 ? rewriterAttachments : undefined,
                    subjectOptionsForDetection
                  ),
                  QUERY_REWRITE_TIMEOUT_MS,
                  "rewriteQueryForRetrieval"
                )
              );
              // Only swap the retrieval query when the message is long enough to benefit from rewriting.
              // Short queries are already precise — we still use k and skipSearch from the result.
              const wordCount = effectiveMessage.trim().split(/\s+/).filter(Boolean).length;
              if (wordCount > REWRITE_MIN_WORDS && rewriteResult.query !== effectiveMessage) {
                retrievalQuery = rewriteResult.query;
                queryWasRewritten = true;
              }
              retrievalK = rewriteResult.k;
              if (rewriteResult.skipSearch) {
                searchSkipped = true;
                skipSearchDirectAnswer = (rewriteResult.directAnswer ?? "").trim();
                skipSearchReason = rewriteResult.skipReason ?? null;
                skipSearchTrigger = rewriteResult.skipTrigger ?? null;
                console.log("[tutor/chat] Rewriter signalled skip_search — bypassing Qdrant retrieval");
              }
              if (needsSubjectDetection) {
                applyDetectedSubject(rewriteResult.detectedSubject);
              }
            } catch (rewriteErr) {
              const msg = rewriteErr instanceof Error ? rewriteErr.message : String(rewriteErr);
              console.warn("[tutor/chat] Query rewrite failed, falling back to original query:", msg.slice(0, 160));
              if (needsSubjectDetection) applyDetectedSubject(null);
            }
          }
          console.log("[tutor/chat] Step 0.5: retrievalQuery:", retrievalQuery, "| k:", retrievalK, "| skipRag:", skipRag, "| searchSkipped:", searchSkipped);

          // skipRag may have been set by applyDetectedSubject above — skip embed+qdrant if so
          // searchSkipped is set by the rewriter when the message needs no retrieval (greetings, casual chat)
          const searchSkippedLabel = "Search skipped";
          if (searchSkipped) {
            enqueueSafe({ type: "step:search_skipped", label: searchSkippedLabel });
            speculativeEmbedPromise.catch(() => {}); // prevent unhandled rejection
          }

          if (!skipRag && !searchSkipped) {
          const queryStreamLabel = !isLearnMode && quickMode ? "Query" : "Searching for:";
          enqueueSafe({ type: "step:query", label: queryStreamLabel, query: retrievalQuery });

          // ── Step 1: Embed ─────────────────────────────────────────────────────
          console.log("[tutor/chat] Step 1: Embedding user message");
          // Reuse the speculative embed when the rewriter didn't change the query
          // (or was skipped / timed out), saving a second OpenAI round-trip.
          const vector = await timeStep("embed_ms", () =>
            retrievalQuery === effectiveMessage
              ? speculativeEmbedPromise
              : (speculativeEmbedPromise.catch(() => {}), embed(retrievalQuery))
          );

          // ── Step 2: Qdrant search ─────────────────────────────────────────────
          enqueueSafe({ type: "step:searching", label: "Searching NCERT" });

          // ── Detect Learn Mode ─────────────────────────────────────────────────
          if (isLearnMode) {
            const sessionChapterIndex = sessionRow.chapter_index;
            const readLearnProgressKeys = getLearnProgressReadKeys(gradeForQdrant, tutorSubjectSlug);
            const [topicsResult, progressResult] = await Promise.all([
              getChapterTopicsFromQdrant(gradeForQdrant, tutorSubjectSlug, sessionChapterIndex ?? chapter_index ?? "1", ncertBook ?? null),
              admin
                ? admin
                    .from("chapter_learn_progress")
                    .select("topics_completed, current_topic_index, diagnostic_completed, diagnostic_score")
                    .eq("user_id", user.id)
                    .in("subject", readLearnProgressKeys)
                    .eq("chapter_index", Number(sessionChapterIndex ?? chapter_index ?? "1"))
                    .order("updated_at", { ascending: false })
                    .limit(1)
                    .maybeSingle()
                : Promise.resolve({ data: null }),
            ]);
            allLearnTopics = topicsResult;
            const prog = progressResult.data;
            learnProgress = {
              topics_completed: (prog?.topics_completed as string[] | null) ?? [],
              current_topic_index: prog?.current_topic_index ?? allLearnTopics[0]?.topic_index ?? null,
              diagnostic_completed: prog?.diagnostic_completed ?? false,
              diagnostic_score: (prog?.diagnostic_score as Record<string, number> | null) ?? null,
            };
            const currentOnly = learnProgress.current_topic_index ?? allLearnTopics[0]?.topic_index ?? null;
            learnTopicIndices = currentOnly ? [currentOnly] : [];
            console.log("[tutor/chat] LEARN MODE | current topic only for Qdrant:", learnTopicIndices.join(", ") || "(none)");
          }

          await timeStep("retrieval_ms", async () => {
            try {
              console.log("[tutor/chat] Step 2: Searching Qdrant (RAG retrieval)");
              const sessionChapterKey = sessionRow.chapter_index ?? chapter_index ?? "1";
              let rawChunks: Awaited<ReturnType<typeof hybridSearch>>;

              if (isLearnMode && learnProgress && learnTopicIndices.length > 0) {
                const [topicIdx] = learnTopicIndices;
                const [scrolled, searched] = await Promise.all([
                  scrollChunksForLearnTopic(
                    gradeForQdrant,
                    tutorSubjectSlug,
                    sessionChapterKey,
                    topicIdx,
                    80,
                    ncertBook ?? null
                  ),
                  searchLearnChunks(
                    vector,
                    retrievalQuery,
                    gradeForQdrant,
                    tutorSubjectSlug,
                    sessionChapterKey,
                    learnTopicIndices,
                    24,
                    ncertBook ?? null
                  ),
                ]);
                rawChunks = capLearnChunksForPrompt(dedupeRetrievedChunksById([...scrolled, ...searched]));
              } else if (isLearnMode) {
                rawChunks = await searchLearnChunks(
                  vector,
                  retrievalQuery,
                  gradeForQdrant,
                  tutorSubjectSlug,
                  sessionChapterKey,
                  learnTopicIndices,
                  24,
                  ncertBook ?? null
                );
              } else {
                rawChunks = await hybridSearch(
                  vector,
                  retrievalQuery,
                  gradeForQdrant,
                  tutorSubjectSlug,
                  chapter_index,
                  TOP_K,
                  ncertBook
                );
              }

              console.log("[tutor/chat] Raw chunks from Qdrant:", rawChunks.length);
              if (VERBOSE_PIPELINE_LOGS && rawChunks.length > 0) {
                console.log("[tutor/chat] === ALL RETRIEVED CHUNKS (FULL) ===");
                rawChunks.forEach((c, i) => {
                  console.log(`[tutor/chat] CHUNK ${i + 1} | id=${c.chunk_id} | chapter=${c.chapter_name ?? "—"} (${c.chapter_index ?? "—"}) | topic=${c.topic_name ?? "—"} (${c.topic_index ?? "—"}) | score=${c.relevance_score}`);
                  console.log(`[tutor/chat]   CONTENT:`, c.content);
                });
              }
              chunks = isLearnMode
                ? rawChunks
                : hybridRerank(rawChunks, effectiveMessage, retrievalK);
              console.log(
                "[tutor/chat] After learn cap / hybridRerank, chunks:",
                chunks.length,
                isLearnMode ? "(learn: no 5-chunk rerank cap)" : `top ${retrievalK}`
              );
            } catch (searchError) {
              console.error("[tutor/chat] qdrant search failed:", searchError);
            }
          });

          chunkPreviews = chunks.slice(0, 5).map((c) => ({
            chunk_id: c.chunk_id,
            chapter_name: c.chapter_name,
            chapter_index: c.chapter_index,
            topic_name: c.topic_name,
            topic_index: c.topic_index,
            page_start: c.page_start,
            page_end: c.page_end,
            preview: c.content.slice(0, 140).replace(/\n/g, " "),
          }));
          enqueueSafe({
            type: "step:chunks",
            label: `Found ${chunks.length} source${chunks.length !== 1 ? "s" : ""}`,
            chunks: chunkPreviews,
          });
          } // end inner !skipRag (embed+qdrant)
        } // end outer !skipRag (rewriter)

        // Fast path: when rewriter explicitly skipped retrieval and already produced
        // a usable answer, return it immediately without memory fetch/prompt build/LLM call.
        if (searchSkipped && skipSearchDirectAnswer) {
          const fastAnswer = skipSearchDirectAnswer;
          const searchSkippedLabel = "Search skipped";
          enqueueSafe({ type: "step:generating", label: "Generating answer" });
          onFirstToken();
          for (let i = 0; i < fastAnswer.length; i += CACHE_SSE_CHUNK_CHARS) {
            if (!enqueueSafe({ type: "token", token: fastAnswer.slice(i, i + CACHE_SSE_CHUNK_CHARS) })) break;
          }

          if (!streamWritable) {
            console.warn("[tutor/chat] SSE closed during fast skip_search response — skipping DB persist");
            return;
          }

          const elapsed = thinkingElapsedSec ?? (Date.now() - startTime) / 1000;
          const sessionNeedsTitleFast = !sessionRow.title;
          const resolvedTitleFast = sessionNeedsTitleFast
            ? (message.trim().slice(0, 100) || "Chat")
            : undefined;

          const userMsgCreatedAt = new Date();
          const assistantMsgCreatedAt = new Date(userMsgCreatedAt.getTime() + 1);
          const [userMsgResultFast, assistantMsgResultFast] = await Promise.all([
            supabase.from("tutor_messages").insert({
              session_id,
              role: "user",
              content: message || "",
              ...(userDisplayContentPersist ? { display_content: userDisplayContentPersist } : {}),
              task_type: taskType,
              attachments: attachments.length > 0 ? attachments : null,
              created_at: userMsgCreatedAt.toISOString(),
            }).select("id").single(),
            supabase.from("tutor_messages").insert({
              session_id,
              role: "assistant",
              content: fastAnswer,
              task_type: taskType,
              citations: [],
              created_at: assistantMsgCreatedAt.toISOString(),
            }).select("id").single(),
          ]);
          if (userMsgResultFast.error) {
            console.error("[tutor/chat] user message insert (fast path):", userMsgResultFast.error);
            throw new Error("Failed to save message");
          }
          if (assistantMsgResultFast.error || !assistantMsgResultFast.data) {
            console.error("[tutor/chat] assistant message insert (fast path):", assistantMsgResultFast.error);
            throw new Error("Failed to save response");
          }
          const assistantMsgIdFast = assistantMsgResultFast.data.id;

          enqueueSafe({
            type: "done",
            citations: [],
            elapsed,
            message_id: assistantMsgIdFast,
            ...(resolvedTitleFast && { title: resolvedTitleFast }),
          });
          try {
            controller.close();
          } catch {
            /* already closed */
          }

          const thinkingDataFast = {
            steps: [{ type: "step:search_skipped", label: searchSkippedLabel }],
            elapsed,
            sourcesCount: 0,
            ...(skipSearchReason ? { skipReason: skipSearchReason } : {}),
            ...(skipSearchTrigger ? { skipTrigger: skipSearchTrigger } : {}),
          };
          supabase
            .from("tutor_messages")
            .update({ thinking: thinkingDataFast })
            .eq("id", assistantMsgIdFast)
            .then(({ error }) => {
              if (error) console.warn("[tutor/chat] thinking save skipped (fast path):", error.message);
            });

          const updatePayloadFast: Record<string, unknown> = { last_message_at: new Date().toISOString() };
          if (resolvedTitleFast) updatePayloadFast.title = resolvedTitleFast;
          supabase.from("tutor_sessions").update(updatePayloadFast).eq("id", session_id)
            .then(({ error }) => {
              if (error) console.warn("[tutor/chat] session update (fast path):", error.message);
            });

          return;
        }

        // Classify complexity now that skipRag is resolved
        if (!skipRag) {
          complexity = hasAttachments ? "standard" : classifyComplexity(effectiveMessage);
        }

        // ── Steps 3, 3.5: Memory, profile, seeding ────────────────────────────
        console.log("[tutor/chat] Step 3: Fetching memory, topic progress, profile");
        const [memoryRes, topicProgressRes, profileRes] = await timeStep("memory_profile_wait_ms", () => memoryProfilePromise);
        timings.memory_profile_ms = Date.now() - memoryProfileFetchStartedAt;

        const memoryRows = memoryRes.data ?? [];
        const subjectMemory = memoryRows.find((r) => (r as { subject: string }).subject === memorySubjectKey) ?? null;
        const globalMemory  = memoryRows.find((r) => (r as { subject: string }).subject === "__global__") ?? null;

        let memory = subjectMemory
          ? {
              ...subjectMemory,
              learning_pace:   (globalMemory as { learning_pace?: string | null } | null)?.learning_pace   ?? (subjectMemory as { learning_pace?: string | null }).learning_pace,
              preferred_style: (globalMemory as { preferred_style?: string | null } | null)?.preferred_style ?? (subjectMemory as { preferred_style?: string | null }).preferred_style,
              memory_summary:  (globalMemory as { memory_summary?: string | null } | null)?.memory_summary  ?? (subjectMemory as { memory_summary?: string | null }).memory_summary,
              total_sessions:  (globalMemory as { total_sessions?: number | null } | null)?.total_sessions  ?? (subjectMemory as { total_sessions?: number | null }).total_sessions,
              total_messages:  (globalMemory as { total_messages?: number | null } | null)?.total_messages  ?? (subjectMemory as { total_messages?: number | null }).total_messages,
            }
          : globalMemory
          ? {
              ...globalMemory,
              subject: memorySubjectKey,
              recently_discussed_topics: [] as string[],
              weak_topics:               [] as string[],
              strong_topics:             [] as string[],
              common_mistakes:           [] as string[],
              struggle_patterns:         [] as { pattern: string; evidence: string }[],
              chapters_visited:          [] as string[],
              onboarding_seeded:         false,
            }
          : null;

        const profile = profileRes.data as {
          full_name?: string | null;
          first_name?: string | null;
          learning_style?: string[] | null;
          weak_subjects?: string[] | null;
          strong_subjects?: string[] | null;
          additional_info?: string | null;
          tutor_preferences?: Record<string, string> | null;
        } | null;

        if (!subjectMemory && profile) {
          console.log("[tutor/chat] Step 3.5: No subject memory — seeding from onboarding");
          await seedMemoryFromOnboarding(user.id, memorySubjectKey, grade, profile, admin ?? supabase);
          const { data: reseeded } = await supabase
            .from("student_ai_memory")
            .select("subject, memory_summary, weak_topics, strong_topics, recently_discussed_topics, common_mistakes, struggle_patterns, learning_pace, preferred_style, total_sessions, total_messages, onboarding_seeded, chapters_visited")
            .eq("user_id", user.id)
            .in("subject", [memorySubjectKey, "__global__"]);
          const newSubjectRow = (reseeded ?? []).find((r) => (r as { subject: string }).subject === memorySubjectKey) ?? null;
          const newGlobalRow  = (reseeded ?? []).find((r) => (r as { subject: string }).subject === "__global__") ?? globalMemory;
          if (newSubjectRow) {
            memory = {
              ...newSubjectRow,
              learning_pace:   (newGlobalRow as { learning_pace?: string | null } | null)?.learning_pace   ?? (newSubjectRow as { learning_pace?: string | null }).learning_pace,
              preferred_style: (newGlobalRow as { preferred_style?: string | null } | null)?.preferred_style ?? (newSubjectRow as { preferred_style?: string | null }).preferred_style,
              memory_summary:  (newGlobalRow as { memory_summary?: string | null } | null)?.memory_summary  ?? (newSubjectRow as { memory_summary?: string | null }).memory_summary,
            };
            console.log("[tutor/chat] Step 3.5: Seeded memory re-fetched successfully");
          }
        }

        console.log("[tutor/chat] Memory:", memory ? "found" : "none", "| topicProgress rows:", (topicProgressRes.data ?? []).length, "| profile:", profile ? "found" : "none");
        if (VERBOSE_PIPELINE_LOGS && memory) {
          console.log("[tutor/chat] === MEMORY (FULL) ===");
          console.log("[tutor/chat] memory_summary:", memory.memory_summary ?? "(null)");
          console.log("[tutor/chat] weak_topics:", (memory as { weak_topics?: unknown[] }).weak_topics ?? []);
          console.log("[tutor/chat] strong_topics:", (memory as { strong_topics?: unknown[] }).strong_topics ?? []);
          console.log("[tutor/chat] recently_discussed_topics:", (memory as { recently_discussed_topics?: unknown[] }).recently_discussed_topics ?? []);
          console.log("[tutor/chat] common_mistakes:", (memory as { common_mistakes?: unknown[] }).common_mistakes ?? []);
          console.log("[tutor/chat] struggle_patterns:", (memory as { struggle_patterns?: unknown[] }).struggle_patterns ?? []);
          console.log("[tutor/chat] learning_pace:", (memory as { learning_pace?: string }).learning_pace ?? "(null)");
          console.log("[tutor/chat] preferred_style:", (memory as { preferred_style?: string }).preferred_style ?? "(null)");
          console.log("[tutor/chat] onboarding_seeded:", (memory as { onboarding_seeded?: boolean }).onboarding_seeded ?? false);
          console.log("[tutor/chat] total_sessions:", (memory as { total_sessions?: number }).total_sessions, "| total_messages:", (memory as { total_messages?: number }).total_messages);
        }
        if (VERBOSE_PIPELINE_LOGS && topicProgressRes.data && topicProgressRes.data.length > 0) {
          console.log("[tutor/chat] === TOPIC PROGRESS (FULL) ===");
          console.log("[tutor/chat]", JSON.stringify(topicProgressRes.data, null, 2));
        }
        const topicProgress = (topicProgressRes.data ?? []).map((t) => ({
          topic_name: (t as { topic_name: string | null }).topic_name,
          mastery_level: (t as { mastery_level: string }).mastery_level,
        }));

        // 4. Conversation history already fetched at Step 0.4 — reused here
        console.log("[tutor/chat] Step 4: History messages count:", historyMessages.length);

        // ── Step 5: Build prompt ──────────────────────────────────────────────
        const isFirstMessage = historyMessages.length === 0;
        const sessionNeedsTitle = !sessionRow.title;
        const includeTitleInstruction =
          isFirstMessage && sessionNeedsTitle && !isGreeting(message);

        const alternateTeachingPattern =
          isLearnMode &&
          /\b(different teaching pattern|different pattern|learn (this|it)?\s+again|explain (this|it)?\s+again|try a different (approach|style)|teach (this|it)?\s+again|new teaching style)\b/i.test(
            message
          );

        console.log("[tutor/chat] Step 5: Building system prompt | includeTitleInstruction:", includeTitleInstruction, "| learnMode:", isLearnMode);

        const chunksMapped = chunks.map((c) => ({
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

        const systemPrompt = skipRag
          ? `You are Lerno, a friendly AI study buddy for Indian school students. Answer the student's question helpfully and conversationally. Keep your response brief and warm.

${GRAPH_PLACEHOLDER_PROMPT}`
          : await timeStep("prompt_build_ms", async () => (
              isLearnMode && learnProgress
              ? buildLearnModeSystemPrompt({
                  grade: Number(gradeForQdrant),
                  subject: tutorSubjectSlug,
                  chapter_index: Number(sessionRow.chapter_index ?? chapter_index ?? 1),
                  chapter_name:
                    sessionRow.chapter_name?.trim() ||
                    sessionRow.title?.replace(/^Chapter\s+\d+:\s*/i, "").trim() ||
                    `Chapter ${chapter_index}`,
                  all_topics: allLearnTopics,
                  progress: learnProgress,
                  memory: memory
                    ? {
                        memory_summary: (memory as { memory_summary?: string | null }).memory_summary,
                        weak_topics: (memory as { weak_topics?: string[] | null }).weak_topics,
                        learning_pace: (memory as { learning_pace?: string | null }).learning_pace,
                        preferred_style: (memory as { preferred_style?: string | null }).preferred_style,
                      }
                    : null,
                  student_name: profile?.full_name ?? profile?.first_name ?? null,
                  chunks: chunksMapped,
                  alternate_teaching_pattern: alternateTeachingPattern,
                  profile: profile ?? null,
                })
              : buildSystemPrompt(
                  taskType,
                  grade,
                  tutorSubjectSlug,
                  chunksMapped,
                  memory,
                  topicProgress,
                  profile,
                  { includeTitleInstruction }
                )
            ));

        // complexity was classified early (before rewrite step) — reuse it here
        const complexityHint =
          isLearnMode
            ? ""
            : complexity === "quick"
            ? "\n\n[System note: This is a simple question. Give a brief, direct answer — 2-4 sentences max. No summary or practice question needed.]"
            : complexity === "detailed"
            ? "\n\n[System note: This is a broad/multi-part question. Give a full, structured response with all relevant details.]"
            : ""; // standard — calibration block in system prompt handles this
        console.log("[tutor/chat] complexity:", complexity, "| learnMode skips calibration hint:", isLearnMode);

        // Build the current user message content (multimodal if attachments present)
        let currentUserContent: string | ContentBlock[];

        if (attachments.length > 0) {
          // First block carries the student's text + complexity hint
          const blocks: ContentBlock[] = [{ type: "text", text: (message || "") + complexityHint }];

          for (const att of attachments) {
            if (att.type.startsWith("image/")) {
              // Images: pass as vision block with signed URL
              blocks.push({
                type: "image_url",
                image_url: { url: att.url, detail: "low" },
              });
            } else if (att.type === "application/pdf" && att.extracted_text) {
              // PDFs: inject extracted text as a block
              blocks.push({
                type: "text",
                text: `\n\n[Attached document: "${att.name}"]\n\n${att.extracted_text}`,
              });
            } else if (att.type === "application/pdf") {
              blocks.push({
                type: "text",
                text: `[Attached document: "${att.name}" — This appears to be a scanned image PDF. Text could not be extracted.]`,
              });
            }
          }

          currentUserContent = blocks;
        } else {
          currentUserContent = message + complexityHint;
        }

        const aiMessages = [
          { role: "system" as const, content: systemPrompt },
          ...historyMessages,
          { role: "user" as const, content: currentUserContent },
        ];

        console.log("[tutor/chat] System prompt length:", systemPrompt.length, "| RAG chunks in prompt:", chunks.length);
        if (VERBOSE_PIPELINE_LOGS) {
          console.log("[tutor/chat] === FULL MESSAGES SENT TO AI ===");
          console.log("[tutor/chat] Msg 1 (system) FULL:\n", aiMessages[0]?.content);
          for (let i = 1; i < aiMessages.length; i++) {
            console.log(`[tutor/chat] Msg ${i + 1} (${aiMessages[i]?.role}) FULL:\n`, aiMessages[i]?.content);
          }
        }

        // ── Step: generating ──────────────────────────────────────────────────
        enqueueSafe({ type: "step:generating", label: "Generating answer" });

        // Resolve model — use vision model when images are present
        const modelToUse = resolveModel(hasImageContent(aiMessages));
        const maxTokens = isLearnMode
          ? 16384
          : complexity === "quick"
          ? 2048
          : complexity === "detailed"
          ? 6144
          : 4096;

        // ── Stream AI tokens ──────────────────────────────────────────────────
        let rawAssistantContent = "";
        let titleLine = "";
        let pastTitle = !includeTitleInstruction;
        const llmStartedAt = Date.now();

        streamTokens: for await (const token of streamChat(aiMessages, {
          model: modelToUse,
          maxTokens,
          signal: request.signal,
        })) {
          if (!pastTitle) {
            titleLine += token;
            if (titleLine.includes("\n")) {
              pastTitle = true;
              const afterNewline = titleLine.slice(titleLine.indexOf("\n") + 1);
              if (afterNewline) {
                rawAssistantContent += afterNewline;
                onFirstToken();
                if (!enqueueSafe({ type: "token", token: afterNewline })) break streamTokens;
              }
            }
            continue;
          }
          rawAssistantContent += token;
          onFirstToken();
          if (!enqueueSafe({ type: "token", token })) break streamTokens;
        }
        timings.llm_stream_ms = Date.now() - llmStartedAt;

        if (!streamWritable) {
          console.warn("[tutor/chat] SSE closed mid-stream (client disconnect or navigate away) — skipping DB persist");
          return;
        }

        const parsed = includeTitleInstruction
          ? { title: titleLine.match(/^TITLE:\s*(.+)/im)?.[1]?.trim() ?? null, content: rawAssistantContent }
          : { title: null, content: rawAssistantContent };
        const displayContent = parsed.content;
        const resolvedTitle = sessionNeedsTitle
          ? (parsed.title ?? (
              (searchSkipped || skipRag)
                ? message.trim().slice(0, 100)
                : getFallbackTitle(chunks, tutorSubjectSlug)
            ))
          : undefined;

        // ── Step 6: Citations ─────────────────────────────────────────────────
        console.log("[tutor/chat] Step 6: Extracting inline citations");
        let inlineCitations: InlineCitation[] = extractInlineCitations(
          displayContent,
          chunks,
          grade,
          tutorSubjectSlug
        );
        if (inlineCitations.length === 0 && chunks.length > 0) {
          console.log("[tutor/chat] Step 6: No markers found — using fallback citations");
          inlineCitations = fallbackCitations(chunks, grade, tutorSubjectSlug, 3);
        }
        // Strip referenced_figures for grade 11 (figures not yet available)
        if (Number(grade) === 11) {
          inlineCitations = inlineCitations.map(c => ({ ...c, referenced_figures: undefined }));
        }
        console.log("[tutor/chat] Step 6: Citations resolved:", inlineCitations.length, "| indices:", inlineCitations.map((c) => c.index).join(", "));

        console.log("[tutor/chat] Step 6.5: Building graph artifacts if placeholders exist");
        const graphArtifacts = await timeStep("graph_generation_ms", async () =>
          generateGraphArtifactsForAnswer({
            answer: displayContent,
            userMessage: message,
            subject: tutorSubjectSlug,
            grade,
            chapter_name: sessionRow.chapter_name ?? undefined,
          })
        );
        console.log("[tutor/chat] Step 6.5: Graph artifacts resolved:", graphArtifacts.length);
        if (graphArtifacts.length > 0) {
          enqueueSafe({ type: "graphs", graph_artifacts: graphArtifacts });
        }

        // ── Steps 7–11: DB saves ──────────────────────────────────────────────
        console.log("[tutor/chat] Step 7: Inserting user + assistant messages to DB");
        const dbPersistStartedAt = Date.now();

        // Insert both messages in parallel with explicit timestamps to preserve ordering.
        const userMsgCreatedAt = new Date();
        const assistantMsgCreatedAt = new Date(userMsgCreatedAt.getTime() + 1);

        const [userMsgResult, assistantMsgResult] = await Promise.all([
          supabase.from("tutor_messages").insert({
            session_id,
            role: "user",
            content: message || "",
            ...(userDisplayContentPersist ? { display_content: userDisplayContentPersist } : {}),
            task_type: taskType,
            attachments: attachments.length > 0 ? attachments : null,
            created_at: userMsgCreatedAt.toISOString(),
          }).select("id").single(),
          supabase.from("tutor_messages").insert({
            session_id,
            role: "assistant",
            content: displayContent,
            task_type: taskType,
            citations: inlineCitations,
            graph_artifacts: graphArtifacts.length > 0 ? graphArtifacts : null,
            created_at: assistantMsgCreatedAt.toISOString(),
          }).select("id").single(),
        ]);

        const { error: userMsgError } = userMsgResult;
        const { data: assistantMsgData, error: assistantMsgError } = assistantMsgResult;

        if (userMsgError) {
          console.error("[tutor/chat] user message insert:", userMsgError);
          throw new Error("Failed to save message");
        }

        if (assistantMsgError || !assistantMsgData) {
          console.error("[tutor/chat] assistant message insert:", assistantMsgError);
          throw new Error("Failed to save response");
        }

        const assistantMsgId = assistantMsgData.id;
        timings.db_persist_ms = Date.now() - dbPersistStartedAt;

        // ── Done — send to client immediately before non-critical writes ──────
        console.log("[tutor/chat] Success | response length:", displayContent.length, "| citations:", inlineCitations.length, "| title:", resolvedTitle ?? "(unchanged)");
        const elapsed = thinkingElapsedSec ?? (Date.now() - startTime) / 1000;
        console.log("[tutor/chat] Timing breakdown (ms):", {
          total_ms: Date.now() - startTime,
          first_token_ms: llmFirstTokenMs,
          history_fetch_ms: timings.history_fetch_ms ?? 0,
          rewrite_ms: timings.rewrite_ms ?? 0,
          embed_ms: timings.embed_ms ?? 0,
          retrieval_ms: timings.retrieval_ms ?? 0,
          memory_profile_ms: timings.memory_profile_ms ?? 0,
          memory_profile_wait_ms: timings.memory_profile_wait_ms ?? 0,
          prompt_build_ms: timings.prompt_build_ms ?? 0,
          llm_stream_ms: timings.llm_stream_ms ?? 0,
          graph_generation_ms: timings.graph_generation_ms ?? 0,
          db_persist_ms: timings.db_persist_ms ?? 0,
        });
        enqueueSafe({
          type: "done",
          citations: inlineCitations,
          graph_artifacts: graphArtifacts,
          elapsed,
          message_id: assistantMsgId,
          ...(resolvedTitle && { title: resolvedTitle }),
        });
        try {
          controller.close();
        } catch {
          /* already closed */
        }

        // ── Non-critical writes (fire-and-forget, after client receives done) ──
        // Save thinking data — non-blocking, tolerates missing column
        const askQuickMode = !isLearnMode && quickMode;
        const includePersistedQueryStep = !searchSkipped && !isLearnMode;
        const persistedQueryLabel = askQuickMode ? "Query" : queryWasRewritten ? "Rephrased" : "Prompt";
        const searchSkippedLabel = "Search skipped";
        const thinkingData = {
          steps: [
            ...(searchSkipped
              ? [{ type: "step:search_skipped", label: searchSkippedLabel }]
              : [
                  ...(includePersistedQueryStep
                    ? [{ type: "step:query", label: persistedQueryLabel, query: retrievalQuery }]
                    : []),
                  { type: "step:searching", label: "Searching NCERT Textbook" },
                  { type: "step:chunks", label: `Found ${chunks.length} source${chunks.length !== 1 ? "s" : ""}`, chunks: chunkPreviews },
                ]
            ),
          ],
          elapsed,
          sourcesCount: chunks.length,
          ...(skipSearchReason ? { skipReason: skipSearchReason } : {}),
          ...(skipSearchTrigger ? { skipTrigger: skipSearchTrigger } : {}),
        };
        supabase
          .from("tutor_messages")
          .update({ thinking: thinkingData })
          .eq("id", assistantMsgId)
          .then(({ error }) => {
            if (error) console.warn("[tutor/chat] thinking save skipped (column may not exist yet):", error.message);
          });

        const logs: RetrievedChunksLogInsert[] = chunks.map((c) => ({
          message_id: assistantMsgId,
          chunk_id: c.chunk_id,
          relevance_score: c.relevance_score,
          was_used: true,
        }));
        if (logs.length > 0) {
          supabase.from("retrieved_chunks_log").insert(logs)
            .then(({ error }) => {
              if (error) console.warn("[tutor/chat] chunks log insert:", error.message);
            });
        }

        const updatePayload: Record<string, unknown> = { last_message_at: new Date().toISOString() };
        if (resolvedTitle) {
          updatePayload.title = resolvedTitle;
        }
        supabase.from("tutor_sessions").update(updatePayload).eq("id", session_id)
          .then(({ error }) => {
            if (error) console.warn("[tutor/chat] session update:", error.message);
          });

        if (admin && !hasAttachments && sessionRow.mode !== "learn") {
          admin.from("query_cache").upsert(
            {
              cache_key: cacheKey,
              query_text: message,
              grade: String(grade),
              subject: tutorSubjectSlug,
              chapter_index: chapter_index ?? null,
              task_type: taskType,
              response_content: displayContent,
              citations: inlineCitations,
              graph_artifacts: graphArtifacts.length > 0 ? graphArtifacts : null,
              prompt_version: PROMPT_VERSION,
            },
            { onConflict: "cache_key" }
          ).then(({ error }) => {
            if (error) console.warn("[tutor/chat] query_cache upsert:", error.message);
          });
        }

      } catch (err) {
        Sentry.captureException(err, { tags: { api_route: "tutor/chat" } });
        console.error("[tutor/chat] stream error:", err);
        enqueueSafe({
          type: "error",
          message: err instanceof Error ? err.message : "Something went wrong",
        });
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
