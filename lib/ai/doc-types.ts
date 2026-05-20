/** Shared document types for notes, summaries, and quizzes. */

// ── Notes types ───────────────────────────────────────────────────────────────

/**
 * A single item inside a notes section.
 * The discriminated union allows the renderer to apply different visual styles:
 *   - definition  → blue left-border callout box
 *   - points      → bulleted list, optionally with a sub-heading
 *   - formula     → green left-border callout, monospace expression
 *   - remember    → yellow callout, used sparingly for exam-critical facts
 *   - subheading  → small uppercase label separating sub-sections
 */
export type NoteItemType =
  | { type: "definition"; term: string; text: string }
  | { type: "points"; heading?: string; items: string[] }
  | { type: "formula"; label?: string; expression: string; note?: string }
  | { type: "remember"; text: string }
  | { type: "subheading"; text: string };

/** One topic's worth of notes (e.g. "1.2 — Types of Chemical Reactions") */
export interface NotesTopicSection {
  topic_index: string;   // e.g. "1.2"
  topic_name: string;    // e.g. "Types of Chemical Reactions"
  items: NoteItemType[];
}

/** The full notes document returned by the generator and stored in generated_docs */
export interface NotesDocument {
  type: "notes";
  title: string;          // e.g. "Chapter 1 Notes — Chemical Reactions and Equations"
  subject: string;        // e.g. "science"
  chapter_name: string;   // e.g. "Chemical Reactions and Equations"
  generated_at: string;   // ISO 8601 timestamp
  sections: NotesTopicSection[];
}

// ── Summary types ─────────────────────────────────────────────────────────────

/** One topic's worth of summary bullets */
export interface SummaryTopicSection {
  topic_index: string;
  topic_name: string;
  bullets: string[];  // 4–6 concise bullet points, each a standalone exam fact
}

export interface SummaryDocument {
  type: "summary";
  title: string;
  subject: string;
  chapter_name: string;
  generated_at: string;
  sections: SummaryTopicSection[];
}

// ── Union type used wherever notes or summary can appear ──────────────────────

export type GeneratedDocument = NotesDocument | SummaryDocument;

// ── Scope type (output of scope detector) ────────────────────────────────────

/**
 * Describes what content to retrieve/generate.
 * topic_indices: null  means full chapter (all topics)
 * topic_indices: [...] means only those specific topic_index values
 */
export interface DocScope {
  chapter_index: string;
  chapter_name: string;
  topic_indices: string[] | null;
  topic_names: string[];
  scope_label: string;  // human-readable, e.g. "Chapter 1" or "Oxidation, Decomposition"
}

// ── Quiz types ────────────────────────────────────────────────────────────────

export type QuizQuestionType = "mcq" | "assertion_reasoning" | "true_false" | "short_ans" | "fill_blank" | "long_ans";

export interface QuizOption {
  id: string;          // "a", "b", "c", "d"
  text: string;
  is_correct: boolean;
}

/**
 * A single question in a generated quiz.
 * Fetched from study_questions after AI selection — these are real NCERT questions.
 */
export interface QuizQuestion {
  id: string;                    // UUID from study_questions
  question_code: string;         // e.g. "sci_g10_ch1_exe_003"
  question_type: QuizQuestionType;
  question_text: string;
  question_image_url: string | null;
  marks: number;
  difficulty: string;            // "easy" | "medium" | "hard"
  topic_name: string;
  options: QuizOption[] | null;  // MCQ / assertion_reasoning / true_false only
  correct_option: string | null; // "a" | "b" | "c" | "d" — MCQ only
  model_answer: string | null;   // short_ans / long_ans
  key_points: string[] | null;   // marking points for short/long
  hints: string[] | null;
  source: string;                // "ncert_exercise" | "ncert_exemplar" | "pyq" etc.
}

/**
 * The full quiz document sent to the frontend.
 * Questions are pre-sorted into sections by type.
 */
export interface QuizDocument {
  type: "quiz";
  title: string;
  subject: string;
  chapter_name: string;
  scope_label: string;
  generated_at: string;
  mcq_questions: QuizQuestion[];    // includes assertion_reasoning, true_false
  short_questions: QuizQuestion[];  // short_ans, fill_blank
  long_questions: QuizQuestion[];   // long_ans only
  total_marks: number;
}

/**
 * Requested question quantities (resolved from user's message by quiz scope detector).
 * Defaults: 4 MCQ, 2 short, 1 long.
 * The AI selector will give as many as are available if pool is smaller.
 */
export interface QuizQuantity {
  mcq: number;
  short: number;
  long: number;
}

/** Frontend-only state tracking user's answers during a quiz session. Never persisted. */
export interface QuizAnswerState {
  [question_id: string]: {
    selected_option?: string;   // MCQ: which option the student clicked
    is_correct?: boolean;       // MCQ: computed immediately on selection
    revealed: boolean;          // short/long: whether model answer is shown
  };
}
