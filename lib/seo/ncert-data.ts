import { CHAPTER_DATA_9, CHAPTER_DATA_10, CHAPTER_DATA_11 } from "@/lib/chapters";

export interface NcertSubjectConfig {
  gradeSlug: string;       // URL segment: 'class-9', 'class-10', 'class-11'
  gradeLabel: string;      // Display: 'Class 9', 'Class 10', 'Class 11'
  grade: number;           // 9, 10, 11
  subjectSlug: string;     // URL segment: 'science', 'mathematics', 'history', ...
  subjectLabel: string;    // Display: 'Science', 'Mathematics', 'History', ...
  bookTitle?: string;      // NCERT book title (set for social sub-subjects)
  internalSubject: string; // Key used by getChapterFromCurriculum
  chapters: string[];      // Chapter names, 0-indexed (chapter N = index N-1)
  hasCurriculum: boolean;  // Whether detailed topic data is available
}

function flatten(sections: { title?: string; items: string[] }[]): string[] {
  return sections.flatMap((s) => s.items);
}

export const NCERT_CONFIGS: NcertSubjectConfig[] = [
  // ── Grade 10 ──────────────────────────────────────────────────────────────
  {
    gradeSlug: "class-10", gradeLabel: "Class 10", grade: 10,
    subjectSlug: "science", subjectLabel: "Science",
    internalSubject: "science",
    chapters: flatten(CHAPTER_DATA_10.science),
    hasCurriculum: true,
  },
  {
    gradeSlug: "class-10", gradeLabel: "Class 10", grade: 10,
    subjectSlug: "mathematics", subjectLabel: "Mathematics",
    internalSubject: "math",
    chapters: flatten(CHAPTER_DATA_10.math),
    hasCurriculum: true,
  },
  {
    gradeSlug: "class-10", gradeLabel: "Class 10", grade: 10,
    subjectSlug: "history", subjectLabel: "History",
    bookTitle: "India and the Contemporary World – II",
    internalSubject: "social_history",
    chapters: CHAPTER_DATA_10.social[0].items,
    hasCurriculum: true,
  },
  {
    gradeSlug: "class-10", gradeLabel: "Class 10", grade: 10,
    subjectSlug: "geography", subjectLabel: "Geography",
    bookTitle: "Contemporary India – II",
    internalSubject: "social_geography",
    chapters: CHAPTER_DATA_10.social[1].items,
    hasCurriculum: true,
  },
  {
    gradeSlug: "class-10", gradeLabel: "Class 10", grade: 10,
    subjectSlug: "political-science", subjectLabel: "Political Science",
    bookTitle: "Democratic Politics – II",
    internalSubject: "social_civics",
    chapters: CHAPTER_DATA_10.social[2].items,
    hasCurriculum: true,
  },
  {
    gradeSlug: "class-10", gradeLabel: "Class 10", grade: 10,
    subjectSlug: "economics", subjectLabel: "Economics",
    bookTitle: "Understanding Economic Development",
    internalSubject: "social_economics",
    chapters: CHAPTER_DATA_10.social[3].items,
    hasCurriculum: true,
  },

  // ── Grade 11 ──────────────────────────────────────────────────────────────
  {
    gradeSlug: "class-11", gradeLabel: "Class 11", grade: 11,
    subjectSlug: "physics", subjectLabel: "Physics",
    internalSubject: "physics",
    chapters: flatten(CHAPTER_DATA_11.physics),
    hasCurriculum: true,
  },
  {
    gradeSlug: "class-11", gradeLabel: "Class 11", grade: 11,
    subjectSlug: "chemistry", subjectLabel: "Chemistry",
    internalSubject: "chemistry",
    chapters: flatten(CHAPTER_DATA_11.chemistry),
    hasCurriculum: true,
  },
  {
    gradeSlug: "class-11", gradeLabel: "Class 11", grade: 11,
    subjectSlug: "mathematics", subjectLabel: "Mathematics",
    internalSubject: "math",
    chapters: flatten(CHAPTER_DATA_11.math),
    hasCurriculum: true,
  },
  {
    gradeSlug: "class-11", gradeLabel: "Class 11", grade: 11,
    subjectSlug: "biology", subjectLabel: "Biology",
    internalSubject: "biology",
    chapters: flatten(CHAPTER_DATA_11.biology),
    hasCurriculum: false,
  },

  // ── Grade 9 ───────────────────────────────────────────────────────────────
  {
    gradeSlug: "class-9", gradeLabel: "Class 9", grade: 9,
    subjectSlug: "science", subjectLabel: "Science",
    internalSubject: "science",
    chapters: flatten(CHAPTER_DATA_9.science),
    hasCurriculum: false,
  },
  {
    gradeSlug: "class-9", gradeLabel: "Class 9", grade: 9,
    subjectSlug: "mathematics", subjectLabel: "Mathematics",
    internalSubject: "math",
    chapters: flatten(CHAPTER_DATA_9.math),
    hasCurriculum: false,
  },
  {
    gradeSlug: "class-9", gradeLabel: "Class 9", grade: 9,
    subjectSlug: "history", subjectLabel: "History",
    bookTitle: "India and the Contemporary World – I",
    internalSubject: "social_history",
    chapters: CHAPTER_DATA_9.social[0].items,
    hasCurriculum: false,
  },
  {
    gradeSlug: "class-9", gradeLabel: "Class 9", grade: 9,
    subjectSlug: "geography", subjectLabel: "Geography",
    bookTitle: "Contemporary India – I",
    internalSubject: "social_geography",
    chapters: CHAPTER_DATA_9.social[1].items,
    hasCurriculum: false,
  },
  {
    gradeSlug: "class-9", gradeLabel: "Class 9", grade: 9,
    subjectSlug: "political-science", subjectLabel: "Political Science",
    bookTitle: "Democratic Politics – I",
    internalSubject: "social_civics",
    chapters: CHAPTER_DATA_9.social[2].items,
    hasCurriculum: false,
  },
  {
    gradeSlug: "class-9", gradeLabel: "Class 9", grade: 9,
    subjectSlug: "economics", subjectLabel: "Economics",
    bookTitle: "Economics",
    internalSubject: "social_economics",
    chapters: CHAPTER_DATA_9.social[3].items,
    hasCurriculum: false,
  },
];

export function getNcertConfig(
  gradeSlug: string,
  subjectSlug: string
): NcertSubjectConfig | null {
  return (
    NCERT_CONFIGS.find(
      (c) => c.gradeSlug === gradeSlug && c.subjectSlug === subjectSlug
    ) ?? null
  );
}
