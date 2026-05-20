// app/api/tutor/edit-doc/route.ts
//
// SSE endpoint for surgical document editing.
// Called when the doc panel is open and the user sends an edit message.
//
// SSE event sequence:
//   { type: "step", label: "..." }
//   { type: "edit_confirmed", edit_type, affected_topics[], message }
//   { type: "step", label: "..." }
//   { type: "progress", current, total, topic_name, label }   ← one per section regenerated
//   { type: "patch", patch_type: "replace"|"insert"|"remove", updated_sections?, removed_topic_indices?, all_chapter_topics? }
//   { type: "error", message }

import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getNcertChapterMeta } from "@/lib/ai/ncert-metadata";
import { getNcertBookFromTutorSubject, resolveSubjectSlug } from "@/lib/tutor-subject";
import { detectDocEdit } from "@/lib/ai/doc-edit-detector";
import { fetchAllChunksForScope, sameTopicIndex, topicReferencedInName } from "@/lib/ai/qdrant";
import { generateNotesSection, generateSummarySection } from "@/lib/ai/doc-generator";
import type {
  GeneratedDocument,
  NotesTopicSection,
  SummaryTopicSection,
} from "@/lib/ai/doc-types";

interface EditDocBody {
  doc_id: string;
  edit_message: string;
  subject: string;
  chapter_index: string;
  task_type: "notes" | "summary";
  grade?: number | string | null;
  current_sections: { topic_index: string; topic_name: string }[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body: EditDocBody = await request.json();
  const {
    doc_id,
    edit_message,
    subject: rawSubject,
    chapter_index,
    task_type,
    grade = 10,
    current_sections,
  } = body;
  const subject = resolveSubjectSlug(rawSubject);

  const encoder = new TextEncoder();
  const ncertBook = getNcertBookFromTutorSubject(subject) ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      function sse(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // ignore disconnect
        }
      }

      try {
        // ── Load chapter metadata ───────────────────────────────────────────────
        const chapterMeta = await getNcertChapterMeta(subject, chapter_index, grade ?? 10);
        if (!chapterMeta) {
          sse({ type: "error", message: "Chapter not found." });
          controller.close();
          return;
        }

        // ── Detect the edit ─────────────────────────────────────────────────────
        sse({ type: "step", label: "Understanding your edit..." });

        const edit = await detectDocEdit(
          edit_message,
          current_sections,
          chapterMeta.topics
        );

        if (!edit) {
          sse({
            type: "error",
            message:
              "Couldn't understand that edit. Try being more specific, e.g. 'add more detail on oxidation'.",
          });
          controller.close();
          return;
        }

        // ── Handle remove_topic — no AI regeneration needed ─────────────────────
        if (edit.edit_type === "remove_topic") {
          if (edit.topic_indices.length === 0) {
            sse({ type: "error", message: "Couldn't identify which section to remove." });
            controller.close();
            return;
          }

          await applyRemovePatchToDb(supabase, doc_id, user.id, edit.topic_indices);

          sse({
            type: "patch",
            patch_type: "remove",
            removed_topic_indices: edit.topic_indices,
          });

          controller.close();
          return;
        }

        // ── Determine which topics to process ───────────────────────────────────
        const topicsToProcess: {
          topic_index: string;
          topic_name: string;
          is_new: boolean;
        }[] = [];

        if (edit.edit_type === "add_topic") {
          for (let i = 0; i < edit.new_topic_indices.length; i++) {
            topicsToProcess.push({
              topic_index: edit.new_topic_indices[i],
              topic_name:
                edit.new_topic_names[i] ??
                chapterMeta.topics.find(
                  (t) => t.topic_index === edit.new_topic_indices[i]
                )?.topic_name ??
                edit.new_topic_indices[i],
              is_new: true,
            });
          }
        } else {
          for (const ti of edit.topic_indices) {
            const topicMeta = chapterMeta.topics.find((t) => t.topic_index === ti);
            if (topicMeta) {
              topicsToProcess.push({
                topic_index: ti,
                topic_name: topicMeta.topic_name,
                is_new: false,
              });
            }
          }
        }

        if (topicsToProcess.length === 0) {
          sse({
            type: "error",
            message: "Couldn't find the section you're referring to. Try using the topic name.",
          });
          controller.close();
          return;
        }

        sse({
          type: "edit_confirmed",
          edit_type: edit.edit_type,
          affected_topics: topicsToProcess.map((t) => t.topic_name),
          message: `Updating: ${topicsToProcess.map((t) => t.topic_name).join(", ")}...`,
        });

        // ── Re-fetch chunks for affected topics ─────────────────────────────────
        sse({ type: "step", label: "Retrieving NCERT content..." });

        const chunks = await fetchAllChunksForScope(
          grade ?? 10,
          subject,
          chapter_index,
          topicsToProcess.map((t) => t.topic_index),
          ncertBook
        );

        // ── Regenerate each affected section ────────────────────────────────────
        const updatedSections: (NotesTopicSection | SummaryTopicSection)[] = [];

        for (let i = 0; i < topicsToProcess.length; i++) {
          const topic = topicsToProcess[i];
          const topicChunks = chunks.filter(
            (c) =>
              sameTopicIndex(c.topic_index, topic.topic_index) ||
              topicReferencedInName(c.topic_name, topic.topic_index)
          );

          sse({
            type: "progress",
            current: i + 1,
            total: topicsToProcess.length,
            topic_name: topic.topic_name,
            label: `Regenerating: ${topic.topic_name}... (${i + 1}/${topicsToProcess.length})`,
          });

          let section: NotesTopicSection | SummaryTopicSection;

          if (task_type === "notes") {
            section = await generateNotesSection(
              topic.topic_index,
              topic.topic_name,
              topicChunks,
              subject,
              chapterMeta.chapter_name,
              edit.instruction || undefined
            );
          } else {
            section = await generateSummarySection(
              topic.topic_index,
              topic.topic_name,
              topicChunks,
              subject,
              chapterMeta.chapter_name,
              edit.instruction || undefined
            );
          }

          updatedSections.push(section);
        }

        // ── Apply patch to DB ───────────────────────────────────────────────────
        const patchType = edit.edit_type === "add_topic" ? "insert" : "replace";
        await applyUpdatePatchToDb(
          supabase,
          doc_id,
          user.id,
          updatedSections,
          patchType,
          chapterMeta.topics
        );

        // ── Send patch event to frontend ────────────────────────────────────────
        sse({
          type: "patch",
          patch_type: patchType,
          updated_sections: updatedSections,
          all_chapter_topics: chapterMeta.topics,
        });

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[edit-doc] Fatal error:", msg);
        sse({ type: "error", message: "Edit failed. Please try again." });
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

// ── DB helpers ────────────────────────────────────────────────────────────────

async function applyRemovePatchToDb(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docId: string,
  userId: string,
  removedIndices: string[]
): Promise<void> {
  const { data } = await supabase
    .from("generated_docs")
    .select("content")
    .eq("id", docId)
    .eq("user_id", userId)
    .single();

  if (!data) return;

  const doc = data.content as GeneratedDocument;
  doc.sections = (doc.sections as { topic_index: string }[]).filter(
    (s) => !removedIndices.includes(s.topic_index)
  ) as typeof doc.sections;

  await supabase
    .from("generated_docs")
    .update({ content: doc })
    .eq("id", docId)
    .eq("user_id", userId);
}

async function applyUpdatePatchToDb(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docId: string,
  userId: string,
  updatedSections: (NotesTopicSection | SummaryTopicSection)[],
  patchType: "replace" | "insert",
  allChapterTopics: { topic_index: string }[]
): Promise<void> {
  const { data } = await supabase
    .from("generated_docs")
    .select("content")
    .eq("id", docId)
    .eq("user_id", userId)
    .single();

  if (!data) return;

  const doc = data.content as GeneratedDocument;
  const sections = doc.sections as { topic_index: string }[];

  if (patchType === "replace") {
    for (const updated of updatedSections) {
      const idx = sections.findIndex((s) => s.topic_index === updated.topic_index);
      if (idx !== -1) sections[idx] = updated as (typeof sections)[0];
    }
  } else {
    // insert — add new sections, then re-sort to chapter order
    for (const newSection of updatedSections) {
      sections.push(newSection as (typeof sections)[0]);
    }
    const topicOrder = new Map(
      allChapterTopics.map((t, i) => [t.topic_index, i])
    );
    sections.sort(
      (a, b) =>
        (topicOrder.get(a.topic_index) ?? 999) -
        (topicOrder.get(b.topic_index) ?? 999)
    );
  }

  doc.sections = sections as typeof doc.sections;

  await supabase
    .from("generated_docs")
    .update({ content: doc })
    .eq("id", docId)
    .eq("user_id", userId);
}
