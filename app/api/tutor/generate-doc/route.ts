// app/api/tutor/generate-doc/route.ts
//
// SSE endpoint for generating notes and summary documents.
// Completely separate from /api/tutor/chat — that route is not modified.
// The frontend routes notes and summary task types here directly.
//
// SSE event sequence:
//   { type: "step", label: "..." }
//   { type: "scope_confirmed", scope_label, topic_count, message }
//   { type: "step", label: "..." }
//   { type: "progress", current, total, topic_name, label }   ← one per topic section
//   { type: "complete", doc_id, document }                    ← final event
//   { type: "error", message }                                ← only on failure

import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getNcertChapterMeta } from "@/lib/ai/ncert-metadata";
import { getNcertBookFromTutorSubject, resolveSubjectSlug } from "@/lib/tutor-subject";
import {
  detectDocScope,
  normalizeDocScopeTopics,
  resolveChapterForDocRequest,
} from "@/lib/ai/doc-scope-detector";
import { fetchAllChunksForScope, getChapterListFromQdrant } from "@/lib/ai/qdrant";
import { generateNotesDocument, generateSummaryDocument } from "@/lib/ai/doc-generator";

interface GenerateDocBody {
  message: string;
  session_id: string;
  subject: string;
  chapter_index?: string | null;
  task_type: "notes" | "summary";
  grade?: number | string | null;
  display_content?: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body: GenerateDocBody = await request.json();
  const {
    message,
    session_id,
    subject: rawSubject,
    chapter_index,
    task_type,
    grade = 10,
  } = body;
  const userDisplayContentRaw = typeof body.display_content === "string" ? body.display_content.trim().slice(0, 600) : "";
  const userDisplayContentPersist = userDisplayContentRaw.length > 0 ? userDisplayContentRaw : null;
  const subject = resolveSubjectSlug(rawSubject);

  if (!["notes", "summary"].includes(task_type)) {
    return new Response("Invalid task_type — must be 'notes' or 'summary'", { status: 400 });
  }

  const encoder = new TextEncoder();
  const ncertBook = getNcertBookFromTutorSubject(subject) ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      const collectedSteps: { type: string; label: string }[] = [];

      function sse(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected — ignore
        }
      }

      function sseStep(label: string) {
        const event = { type: "step", label };
        collectedSteps.push(event);
        sse(event);
      }

      try {
        // ── Step 1: Resolve chapter from Qdrant + user message (session chapter is only a hint)
        sseStep("Loading chapter structure...");

        const sessionChapterHint =
          chapter_index != null && String(chapter_index).trim() !== ""
            ? String(chapter_index).trim()
            : null;

        const chapters = await getChapterListFromQdrant(grade ?? 10, subject, ncertBook);
        if (chapters.length === 0) {
          sse({
            type: "error",
            message:
              "No NCERT chapters found for this subject in the index. Check Qdrant ingest and subject mapping.",
          });
          controller.close();
          return;
        }

        const resolvedChapterIndex = await resolveChapterForDocRequest(
          message,
          chapters,
          sessionChapterHint
        );
        console.log(
          "[generate-doc] Qdrant scope | subject:",
          subject,
          "| session_chapter_hint:",
          sessionChapterHint ?? "(none)",
          "| resolved_chapter_index:",
          resolvedChapterIndex
        );

        const chapterMeta = await getNcertChapterMeta(
          subject,
          resolvedChapterIndex,
          grade ?? 10
        );

        if (!chapterMeta) {
          sse({
            type: "error",
            message:
              "Chapter data not found. Make sure you have selected a subject and chapter first.",
          });
          controller.close();
          return;
        }

        // ── Step 2: Detect topic scope ───────────────────────────────────────────
        sseStep("Understanding your request...");

        let scope = await detectDocScope(message, chapterMeta);
        scope = normalizeDocScopeTopics(scope, chapterMeta);

        const topicCount =
          scope.topic_indices?.length ?? chapterMeta.topics.length;

        sse({
          type: "scope_confirmed",
          scope_label: scope.scope_label,
          topic_count: topicCount,
          message: `Generating ${task_type} for ${scope.scope_label} (${topicCount} topic${topicCount !== 1 ? "s" : ""})...`,
        });

        // ── Step 3: Bulk-fetch all chunks for scope from Qdrant ─────────────────
        sseStep("Retrieving NCERT content...");

        const chunks = await fetchAllChunksForScope(
          grade ?? 10,
          subject,
          scope.chapter_index,
          scope.topic_indices,
          ncertBook
        );

        if (chunks.length === 0) {
          sse({
            type: "error",
            message:
              "No NCERT content found for this topic. Make sure content has been uploaded for this chapter.",
          });
          controller.close();
          return;
        }

        sseStep(`Found ${chunks.length} content sections. Starting generation...`);

        // ── Step 4: Generate document section by section ────────────────────────
        const onSectionComplete = (
          i: number,
          total: number,
          topicName: string
        ) => {
          sse({
            type: "progress",
            current: i + 1,
            total,
            topic_name: topicName,
            label: `Writing: ${topicName}... (${i + 1}/${total})`,
          });
        };

        const doc =
          task_type === "notes"
            ? await generateNotesDocument(chunks, scope, subject, chapterMeta, onSectionComplete)
            : await generateSummaryDocument(chunks, scope, subject, chapterMeta, onSectionComplete);

        // ── Step 5: Persist user + assistant messages to tutor_messages ─────────
        // This powers chat history — without these rows the session reloads blank.
        if (session_id) {
          await supabase.from("tutor_messages").insert([
            {
              session_id,
              role: "user" as const,
              content: message,
              ...(userDisplayContentPersist ? { display_content: userDisplayContentPersist } : {}),
            },
            {
              session_id,
              role: "assistant" as const,
              task_type,
              content: doc.title,
              // Store full document in thinking so the page can reconstruct the card on reload.
              // elapsedMs and steps are also persisted so DocGenProgressBlock can show correct info.
              thinking: {
                _kind: "doc",
                document: doc,
                elapsedMs: Date.now() - startTime,
                steps: collectedSteps,
              } as unknown as import("@/lib/database.types").Json,
            },
          ]);
        }

        // ── Step 6: Send complete document ─────────────────────────────────────
        sse({
          type: "complete",
          doc_id: null,
          document: doc,
        });

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[generate-doc] Fatal error:", msg);
        sse({
          type: "error",
          message:
            "Something went wrong generating your document. Please try again.",
        });
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
