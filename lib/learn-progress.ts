import { SUBJECT_LABELS } from "@/lib/chapters";

function normalizeGrade(grade: number | string): number {
  const parsed =
    typeof grade === "string" && grade.startsWith("Class ")
      ? Number(grade.replace("Class ", ""))
      : Number(grade);
  return Number.isFinite(parsed) ? parsed : 10;
}

/** Canonical key for chapter progress rows so grade 10/11 do not collide on common subjects. */
export function buildLearnProgressSubjectKey(
  grade: number | string,
  subjectSlugOrLabel: string
): string {
  const g = normalizeGrade(grade);
  const label = SUBJECT_LABELS[subjectSlugOrLabel] ?? subjectSlugOrLabel;
  return `grade_${g}:${label}`;
}

/** Read keys; keep grade-10 legacy fallback so old rows remain visible. */
export function getLearnProgressReadKeys(
  grade: number | string,
  subjectSlugOrLabel: string
): string[] {
  const g = normalizeGrade(grade);
  const label = SUBJECT_LABELS[subjectSlugOrLabel] ?? subjectSlugOrLabel;
  const scoped = buildLearnProgressSubjectKey(g, subjectSlugOrLabel);
  return g === 10 ? [scoped, label] : [scoped];
}

/** Convert stored key back to label for UI grouping. */
export function parseLearnProgressStoredSubject(stored: string): string {
  const m = /^grade_\d+:(.+)$/.exec(stored ?? "");
  return m?.[1] ?? stored;
}

function tutorSlugFromProgressLabel(label: string, grade: number | null): string {
  const entries = Object.entries(SUBJECT_LABELS) as [string, string][];
  const exact = entries.filter(([, v]) => v === label);
  if (exact.length === 1) return exact[0][0];
  if (exact.length > 1) {
    if (label === "Economics") {
      if (grade === 10) return "social_economics";
      return "economics";
    }
    return exact[0][0];
  }
  const ci = entries.filter(([, v]) => v.toLowerCase() === label.toLowerCase());
  if (ci.length === 1) return ci[0][0];
  if (ci.length > 1 && label.toLowerCase() === "economics") {
    if (grade === 10) return "social_economics";
    return "economics";
  }
  const asSlug = label.toLowerCase().replace(/\s+/g, "_");
  if (SUBJECT_LABELS[asSlug]) return asSlug;
  return asSlug;
}

/**
 * `chapter_learn_progress.subject` is often `grade_10:Mathematics` (see `buildLearnProgressSubjectKey`).
 * Returns a display label without the grade scope and a tutor slug for shared accent/dot colors.
 */
export function resolveChapterProgressSubjectForDisplay(raw: string): {
  displayLabel: string;
  tutorSlug: string;
} {
  const trimmed = (raw ?? "").trim();
  const m = /^grade_(\d+):(.+)$/.exec(trimmed);
  if (m) {
    const grade = Number(m[1]);
    const label = m[2];
    return { displayLabel: label, tutorSlug: tutorSlugFromProgressLabel(label, grade) };
  }
  const lower = trimmed.toLowerCase();
  if (SUBJECT_LABELS[lower]) {
    return { displayLabel: SUBJECT_LABELS[lower], tutorSlug: lower };
  }
  const tutorSlug = tutorSlugFromProgressLabel(trimmed, null);
  const displayLabel = SUBJECT_LABELS[tutorSlug] ?? trimmed;
  return { displayLabel, tutorSlug };
}

