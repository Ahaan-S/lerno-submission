/**
 * lib/ai/quiz-pool.ts
 *
 * Fetches a pool of questions from study_questions for AI selection.
 * Two-phase approach:
 *   Phase 1 (fetchQuestionPool): fetch minimal question data for AI selection
 *   Phase 2 (fetchFullQuestions): after AI selection, fetch full data for selected IDs
 *
 * question_type → QuizQuantity bucket mapping:
 *   mcq bucket:   "mcq", "assertion_reasoning", "true_false"
 *   short bucket: "short_ans", "fill_blank"
 *   long bucket:  "long_ans"
 */

import { createClient } from "@/utils/supabase/server";
import type { QuizScope } from "@/lib/ai/quiz-scope-detector";
import type { QuizQuestion } from "@/lib/ai/doc-types";
import { studyQuestionsSubjectFromTutorSlug } from "@/lib/tutor-subject";

/**
 * `study_questions.grade` is an int; client may send 10, "10", or "Class 10" (profiles).
 * Matches `parseProfileGrade` in app/api/study/feed/route.ts.
 */
export function parseQuizRequestGrade(raw: unknown): number {
  if (raw == null) return 10;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    return n >= 6 && n <= 12 ? n : 10;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return 10;
    const classMatch = t.match(/^class\s*(\d{1,2})\b/i);
    if (classMatch) {
      const n = parseInt(classMatch[1], 10);
      return n >= 6 && n <= 12 ? n : 10;
    }
    const n = parseInt(t.replace(/\D/g, "") || "NaN", 10);
    if (!Number.isNaN(n) && n >= 6 && n <= 12) return n;
  }
  return 10;
}

export type ChaptersWithQuiz = { chapter_index: string; chapter_name: string };

/**
 * Question bank rows are often seeded for Class 10 only. If the student's grade has no
 * rows (e.g. Class 9 profile), fall back to grade 10 for the same subject label so quizzes still work.
 */
export async function resolveQuizBankGradeAndChapters(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileGrade: number,
  tutorSubjectSlug: string
): Promise<{ bankGrade: number; chapters: ChaptersWithQuiz[] }> {
  let chapters = await listChaptersWithQuizQuestions(supabase, profileGrade, tutorSubjectSlug);
  if (chapters.length > 0) {
    return { bankGrade: profileGrade, chapters };
  }
  if (profileGrade >= 6 && profileGrade <= 9) {
    chapters = await listChaptersWithQuizQuestions(supabase, 10, tutorSubjectSlug);
    if (chapters.length > 0) {
      console.log(
        `[quiz-pool] No study_questions for grade=${profileGrade}; using bank grade 10 for subject=${tutorSubjectSlug}`
      );
      return { bankGrade: 10, chapters };
    }
  }
  return { bankGrade: profileGrade, chapters: [] };
}

export interface QuestionPoolItem {
  id: string;
  question_text: string;
  question_type: string;
  marks: number;
  difficulty: string;
  topic_name: string;
}

const TYPE_BUCKETS = {
  mcq: ["mcq", "assertion_reasoning", "true_false"],
  short: ["short_ans", "fill_blank"],
  long: ["long_ans"],
} as const;

/**
 * Chapters that have at least one active question in `study_questions` for this grade + subject label.
 * Uses a single range query and deduplicates chapter_index in JS — same pattern as the Study Feed.
 */
export async function listChaptersWithQuizQuestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grade: number | string,
  tutorSubjectSlug: string
): Promise<ChaptersWithQuiz[]> {
  const g = typeof grade === "number" ? grade : Number(grade);
  if (!Number.isFinite(g)) {
    console.warn("[quiz-pool] Invalid grade for listChaptersWithQuizQuestions:", grade);
    return [];
  }
  const bankSubject = studyQuestionsSubjectFromTutorSlug(tutorSubjectSlug);

  const { data, error } = await supabase
    .from("study_questions")
    .select("chapter_index, chapter_name")
    .eq("is_active", true)
    .eq("grade", g)
    .eq("subject", bankSubject)
    .order("chapter_index", { ascending: true })
    .limit(500);

  if (error) {
    console.error(`[quiz-pool] listChaptersWithQuizQuestions error | grade=${g} subject=${bankSubject}:`, error.message);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn(`[quiz-pool] No active questions found | grade=${g} subject=${bankSubject}`);
    return [];
  }

  // Deduplicate by chapter_index — keep first occurrence (lowest chapter_index order)
  const seen = new Set<string>();
  const out: ChaptersWithQuiz[] = [];
  for (const row of data) {
    const key = String(row.chapter_index);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ chapter_index: key, chapter_name: String(row.chapter_name ?? `Chapter ${key}`) });
    }
  }

  console.log(`[quiz-pool] Chapters with questions | grade=${g} subject=${bankSubject} → [${out.map(c => c.chapter_index).join(", ")}]`);
  return out;
}

const FULL_COLUMNS = [
  "id",
  "question_code",
  "question_type",
  "question_text",
  "question_image_url",
  "marks",
  "difficulty",
  "topic_name",
  "options",
  "correct_option",
  "model_answer",
  "key_points",
  "hints",
  "source",
].join(", ");

/**
 * Fetches a pool of questions from study_questions for a given quiz scope.
 * Returns minimal data (id, text, type, marks, difficulty, topic_name) for AI selection.
 *
 * @param poolLimit  Max questions to fetch. Default 60.
 */
export async function fetchQuestionPool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scope: QuizScope,
  grade: number | string,
  subject: string,
  poolLimit = 60
): Promise<QuestionPoolItem[]> {
  const typesNeeded: string[] = [];
  if (scope.quantity.mcq > 0) typesNeeded.push(...TYPE_BUCKETS.mcq);
  if (scope.quantity.short > 0) typesNeeded.push(...TYPE_BUCKETS.short);
  if (scope.quantity.long > 0) typesNeeded.push(...TYPE_BUCKETS.long);

  if (typesNeeded.length === 0) return [];

  const bankSubject = studyQuestionsSubjectFromTutorSlug(subject);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("study_questions")
    .select("id, question_text, question_type, marks, difficulty, topic_name")
    .eq("grade", Number(grade))
    .eq("subject", bankSubject)
    .eq("is_active", true)
    .in("question_type", typesNeeded);

  if (Number(scope.chapter_index) > 0) {
    query = query.eq("chapter_index", Number(scope.chapter_index));
  }

  if (scope.topic_indices && scope.topic_indices.length > 0) {
    query = query.in("topic_index", scope.topic_indices);
  }

  if (scope.difficulty) {
    query = query.eq("difficulty", scope.difficulty);
  }

  const { data, error } = await query.limit(poolLimit);

  if (error) {
    console.error("[quiz-pool] fetchQuestionPool error:", error.message);
    return [];
  }

  console.log(
    `[quiz-pool] Pool size: ${data?.length ?? 0} questions | bank_subject=${bankSubject} ch=${scope.chapter_index} scope=${scope.scope_label}`
  );
  return (data ?? []) as QuestionPoolItem[];
}

/**
 * Fetches full question data for a list of question IDs.
 * Called after the AI has selected which questions to include.
 */
export async function fetchFullQuestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  questionIds: string[]
): Promise<QuizQuestion[]> {
  if (questionIds.length === 0) return [];

  const { data, error } = await supabase
    .from("study_questions")
    .select(FULL_COLUMNS)
    .in("id", questionIds);

  if (error || !data) {
    console.error("[quiz-pool] fetchFullQuestions error:", error?.message);
    return [];
  }

  return data as unknown as QuizQuestion[];
}
