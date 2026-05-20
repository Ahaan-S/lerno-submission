// app/api/tutor/generate-quiz/route.ts
//
// SSE endpoint for quiz generation from study_questions.
//
// SSE event sequence:
//   { type: "step", label: "..." }
//   { type: "scope_confirmed", scope_label, quantity, message }
//   { type: "step", label: "..." }
//   { type: "quiz_ready", quiz: QuizDocument }
//   { type: "error", message }

import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getNcertChapterMeta } from "@/lib/ai/ncert-metadata";
import { resolveChapterForDocRequest } from "@/lib/ai/doc-scope-detector";
import { detectQuizScope, normalizeQuizScope } from "@/lib/ai/quiz-scope-detector";
import {
  fetchQuestionPool,
  fetchFullQuestions,
  parseQuizRequestGrade,
  resolveQuizBankGradeAndChapters,
} from "@/lib/ai/quiz-pool";
import { resolveSubjectSlug } from "@/lib/tutor-subject";
import { selectQuizQuestions } from "@/lib/ai/quiz-selector";
import type { QuizDocument, QuizQuestion } from "@/lib/ai/doc-types";

interface GenerateQuizBody {
  message: string;
  session_id: string;
  subject: string;
  chapter_index?: string | null;
  grade?: number | string | null;
}

const MCQ_TYPES = new Set(["mcq", "assertion_reasoning", "true_false"]);
const SHORT_TYPES = new Set(["short_ans", "fill_blank"]);
const LONG_TYPES = new Set(["long_ans"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body: GenerateQuizBody = await request.json();
  const { message, session_id, subject: rawSubject, chapter_index, grade: rawGrade } = body;
  const subject = resolveSubjectSlug(rawSubject);
  const profileGrade = parseQuizRequestGrade(rawGrade);

  const encoder = new TextEncoder();

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
        // ── Resolve chapter: question bank uses labels ("Science"); session chapter may be null
        sse({ type: "step", label: "Loading chapter..." });

        const sessionChapterHint =
          chapter_index != null && String(chapter_index).trim() !== ""
            ? String(chapter_index).trim()
            : null;

        const { bankGrade, chapters: chaptersWithQuestions } = await resolveQuizBankGradeAndChapters(
          supabase,
          profileGrade,
          subject
        );
        if (chaptersWithQuestions.length === 0) {
          sse({
            type: "error",
            message:
              "No quiz questions are available for this subject yet. Try another subject or check back later.",
          });
          controller.close();
          return;
        }

        const resolvedChapterIndex = await resolveChapterForDocRequest(
          message,
          chaptersWithQuestions,
          sessionChapterHint
        );

        const hasQuestionsForChapter = chaptersWithQuestions.some(
          (c) => c.chapter_index === resolvedChapterIndex
        );
        if (!hasQuestionsForChapter) {
          sse({
            type: "error",
            message:
              "Could not match your request to a chapter that has questions. Try naming the chapter (e.g. chapter 2) or pick a chapter in the subject menu first.",
          });
          controller.close();
          return;
        }

        const chapterMeta = await getNcertChapterMeta(
          subject,
          resolvedChapterIndex,
          bankGrade
        );
        if (!chapterMeta) {
          sse({
            type: "error",
            message:
              "Chapter structure could not be loaded. Try again or pick a different chapter.",
          });
          controller.close();
          return;
        }

        // ── Detect scope + quantities ───────────────────────────────────────────
        sse({ type: "step", label: "Understanding your request..." });

        let scope = await detectQuizScope(message, chapterMeta);
        scope = normalizeQuizScope(scope, chapterMeta);

        sse({
          type: "scope_confirmed",
          scope_label: scope.scope_label,
          quantity: scope.quantity,
          message: `Building quiz for ${scope.scope_label}...`,
        });

        // ── Fetch question pool from study_questions ────────────────────────────
        sse({ type: "step", label: "Fetching questions..." });

        const pool = await fetchQuestionPool(supabase, scope, bankGrade, subject);

        if (pool.length === 0) {
          sse({
            type: "error",
            message:
              "No questions found for this topic yet. Questions are being added — check back soon, or try a different chapter.",
          });
          controller.close();
          return;
        }

        sse({
          type: "step",
          label: `Found ${pool.length} questions. Selecting the best ones...`,
        });

        // ── AI selects best questions ───────────────────────────────────────────
        const selection = await selectQuizQuestions(
          pool,
          scope.quantity,
          chapterMeta.chapter_name
        );

        const allSelectedIds = [
          ...selection.mcq_ids,
          ...selection.short_ids,
          ...selection.long_ids,
        ];

        if (allSelectedIds.length === 0) {
          sse({
            type: "error",
            message:
              "Could not select questions for this topic. Please try a different chapter.",
          });
          controller.close();
          return;
        }

        // ── Fetch full question data ─────────────────────────────────────────────
        sse({ type: "step", label: "Preparing your quiz..." });

        const fullQuestions = await fetchFullQuestions(supabase, allSelectedIds);

        const byId = new Map(fullQuestions.map((q) => [q.id, q]));

        const mcqQuestions: QuizQuestion[] = selection.mcq_ids
          .map((id) => byId.get(id))
          .filter((q): q is QuizQuestion => !!q && MCQ_TYPES.has(q.question_type));

        const shortQuestions: QuizQuestion[] = selection.short_ids
          .map((id) => byId.get(id))
          .filter((q): q is QuizQuestion => !!q && SHORT_TYPES.has(q.question_type));

        const longQuestions: QuizQuestion[] = selection.long_ids
          .map((id) => byId.get(id))
          .filter((q): q is QuizQuestion => !!q && LONG_TYPES.has(q.question_type));

        const totalMarks = [...mcqQuestions, ...shortQuestions, ...longQuestions].reduce(
          (sum, q) => sum + q.marks,
          0
        );

        const quiz: QuizDocument = {
          type: "quiz",
          title: `Quiz — ${scope.scope_label}`,
          subject,
          chapter_name: chapterMeta.chapter_name,
          scope_label: scope.scope_label,
          generated_at: new Date().toISOString(),
          mcq_questions: mcqQuestions,
          short_questions: shortQuestions,
          long_questions: longQuestions,
          total_marks: totalMarks,
        };

        // ── Persist user + assistant messages to tutor_messages ─────────────
        if (session_id) {
          await supabase.from("tutor_messages").insert([
            {
              session_id,
              role: "user" as const,
              content: message,
            },
            {
              session_id,
              role: "assistant" as const,
              task_type: "quiz" as const,
              content: quiz.title,
              thinking: { _kind: "quiz", quiz } as unknown as import("@/lib/database.types").Json,
            },
          ]);
        }

        sse({ type: "quiz_ready", quiz });
        controller.close();
      } catch (err) {
        console.error("[generate-quiz]", err);
        sse({
          type: "error",
          message: "Something went wrong generating the quiz. Please try again.",
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
