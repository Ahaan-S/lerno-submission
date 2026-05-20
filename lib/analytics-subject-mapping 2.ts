import {
  CHAPTER_DATA_10,
  CHAPTER_DATA_11,
  CHAPTER_DATA_9,
  SUBJECT_LABELS,
} from "@/lib/chapters";
import { getLearnProgressReadKeys, parseLearnProgressStoredSubject } from "@/lib/learn-progress";

const SOCIAL_BOOK_SLUGS = [
  "social_history",
  "social_geography",
  "social_civics",
  "social_economics",
] as const;

/** Values of `chapter_learn_progress.subject` to query for this tutor slug and grade (scoped keys + grade-10 legacy labels). */
export function chapterLearnProgressQuerySubjectKeys(grade: number, slug: string): string[] {
  const s = slug.toLowerCase().trim();
  const keys = new Set<string>();
  if (s === "social") {
    for (const book of SOCIAL_BOOK_SLUGS) {
      for (const k of getLearnProgressReadKeys(grade, book)) keys.add(k);
    }
    keys.add("Civics");
    return [...keys];
  }
  for (const k of getLearnProgressReadKeys(grade, s)) keys.add(k);
  return [...keys];
}

/** Display labels associated with a tutor subject slug (not necessarily equal to DB `subject` column). */
export function chapterLearnProgressSubjectLabels(slug: string): string[] {
  const s = slug.toLowerCase().trim();
  if (s === "social") {
    return [
      SUBJECT_LABELS.social_history,
      SUBJECT_LABELS.social_geography,
      SUBJECT_LABELS.social_civics,
      SUBJECT_LABELS.social_economics,
      "Civics",
    ];
  }
  const label = SUBJECT_LABELS[s];
  return label ? [label] : [slug];
}

/** `student_topic_progress.subject` / study question subjects use the same display labels. */
export function topicProgressSubjectLabels(slug: string): string[] {
  return chapterLearnProgressSubjectLabels(slug);
}

/** Whether a `student_topic_progress.subject` value belongs to this tutor slug (plain label or grade-scoped key). */
export function topicProgressRowMatchesSubject(rowSubject: string, grade: number, slug: string): boolean {
  const raw = (rowSubject ?? "").trim();
  if (!raw) return false;
  const candidates = new Set<string>();
  for (const label of chapterLearnProgressSubjectLabels(slug)) {
    candidates.add(label);
    candidates.add(label.toLowerCase());
  }
  for (const key of chapterLearnProgressQuerySubjectKeys(grade, slug)) {
    candidates.add(key);
    candidates.add(key.toLowerCase());
    const parsed = parseLearnProgressStoredSubject(key);
    candidates.add(parsed);
    candidates.add(parsed.toLowerCase());
  }
  const parsedRow = parseLearnProgressStoredSubject(raw);
  if (candidates.has(raw) || candidates.has(raw.toLowerCase())) return true;
  if (candidates.has(parsedRow) || candidates.has(parsedRow.toLowerCase())) return true;
  return false;
}

function chapterDataForGrade(grade: number): Record<string, { items: string[] }[]> {
  if (grade === 11) return CHAPTER_DATA_11;
  if (grade === 9) return CHAPTER_DATA_9;
  return CHAPTER_DATA_10;
}

/** Total NCERT chapters in curriculum for this grade + subject slug (sums SST books for `social`). */
export function curriculumChapterCount(grade: number, slug: string): number {
  const data = chapterDataForGrade(grade);
  const s = slug.toLowerCase().trim();
  if (s === "social") {
    const books = data.social;
    if (!books) return 0;
    return books.reduce((sum, sec) => sum + sec.items.length, 0);
  }
  const sections = data[s];
  if (!sections) return 0;
  return sections.reduce((sum, sec) => sum + sec.items.length, 0);
}
