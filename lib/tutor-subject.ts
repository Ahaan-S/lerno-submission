/**
 * Tutor/API subject slugs for NCERT Social Science (Ask mode): one slug per book.
 * Qdrant stores subject "Social Science" and a separate `book` payload field.
 */

import { SUBJECT_LABELS } from "@/lib/chapters";

const NCERT_BOOK_BY_TUTOR_SLUG: Record<string, "history" | "geography" | "civics" | "economics"> = {
  social_history: "history",
  social_geography: "geography",
  social_civics: "civics",
  social_economics: "economics",
};

/** Value for Qdrant `subject` match — always "Social Science" for SST book slugs and umbrella `social`. */
export function resolveNcertSubjectForFilter(tutorSlug: string): string {
  if (NCERT_BOOK_BY_TUTOR_SLUG[tutorSlug] != null || tutorSlug === "social") {
    return "Social Science";
  }
  return SUBJECT_LABELS[tutorSlug] ?? tutorSlug;
}

/** Qdrant `book` value for Political Science (frontend label only). */
export function getNcertBookFromTutorSubject(
  slug: string
): "history" | "geography" | "civics" | "economics" | undefined {
  return NCERT_BOOK_BY_TUTOR_SLUG[slug];
}

/**
 * Reverse-map SST display labels back to subject slugs.
 * Handles legacy sessions that stored the display label ("Geography", "History", etc.)
 * instead of the slug ("social_geography", "social_history", etc.).
 * Non-SST values and already-correct slugs pass through unchanged.
 */
const SST_LABEL_TO_SLUG: Record<string, string> = {
  "Geography": "social_geography",
  "History": "social_history",
  "Political Science": "social_civics",
  "Civics": "social_civics",
  "Economics": "social_economics",
  "Social Science": "social",
  "Business Studies": "business_studies",
  "Accountancy": "accountancy",
};

export function resolveSubjectSlug(raw: string): string {
  // Already a known slug or generic — pass through unchanged
  if (
    raw.startsWith("social") ||
    raw === "science" ||
    raw === "math" ||
    raw === "english" ||
    raw === "economics" ||
    raw === "business_studies" ||
    raw === "accountancy"
  )
    return raw;
  return SST_LABEL_TO_SLUG[raw] ?? raw;
}

/**
 * Value for `study_questions.subject` filters.
 * Rows are stored as lowercased NCERT labels — same as Study Feed
 * (`getStudyFeedSubjectLabelsForGrade` → `.toLowerCase()` → `.in("subject", …)`).
 * Examples: "science", "mathematics", "social science", "history".
 */
export function studyQuestionsSubjectFromTutorSlug(tutorSlug: string): string {
  const slug = resolveSubjectSlug(tutorSlug);
  const label = SUBJECT_LABELS[slug] ?? slug;
  return String(label).trim().toLowerCase();
}

/**
 * Collapse SST book slugs to onboarding/memory key `social`.
 * Other slugs pass through unchanged.
 */
export function normalizeMemorySubjectSlug(slug: string): string {
  if (slug.startsWith("social_")) return "social";
  return slug;
}

/**
 * Key for SUBJECT_STYLE in prompts — matches history, geography, civics, economics, science, mathematics, english.
 * Legacy `social` (no book) uses default style.
 */
export function resolveSubjectStyleKey(tutorSubjectSlug: string): string {
  const book = getNcertBookFromTutorSubject(tutorSubjectSlug);
  if (book) return book;

  const s = tutorSubjectSlug.toLowerCase();
  if (s === "social") return "default";
  if (s === "math") return "mathematics";
  return s;
}
