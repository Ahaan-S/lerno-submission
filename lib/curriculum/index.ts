export interface CurriculumSubtopic {
  subtopic_index: string;
  subtopic_name: string;
  page_start: number;
  page_end: number;
}

export interface CurriculumTopic {
  topic_index: string;
  topic_name: string;
  page_start: number;
  page_end: number;
  subtopics: CurriculumSubtopic[];
}

export interface CurriculumChapter {
  chapter_index: number;
  chapter_name: string;
  page_start: number;
  page_end: number;
  topics: CurriculumTopic[];
}

interface CurriculumFile {
  grade: string;
  subject: string;
  book?: string;
  language: string;
  year: string;
  chapters: CurriculumChapter[];
}

// Lazy-loaded curriculum data (only loaded on server — these are large JSON files)
function loadScience10(): CurriculumFile {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./grade-10-science.json") as CurriculumFile;
}

function loadMath10(): CurriculumFile {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./grade-10-math.json") as CurriculumFile;
}

function loadSocial10(): CurriculumFile[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const geo = require("./grade-10-social-geography.json") as CurriculumFile;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const history = require("./grade-10-social-history.json") as CurriculumFile;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const econ = require("./grade-10-social-economics.json") as CurriculumFile;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const civics = require("./grade-10-social-civics.json") as CurriculumFile;
  return [geo, history, econ, civics];
}

function loadPhysics11(): CurriculumFile {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./grade-11-physics.json") as CurriculumFile;
}

function loadChemistry11(): CurriculumFile {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./grade-11-chemistry.json") as CurriculumFile;
}

function loadMath11(): CurriculumFile {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./grade-11-mathematics.json") as CurriculumFile;
}

function loadEconomics11(): CurriculumFile {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./grade-11-economics.json") as CurriculumFile;
}

function loadBusinessStudies11(): CurriculumFile {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./grade-11-business-studies.json") as CurriculumFile;
}

function loadAccountancy11(): CurriculumFile {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./grade-11-accountancy.json") as CurriculumFile;
}

/**
 * Look up a chapter from the curriculum JSON.
 *
 * - For science: match by chapter_index (single book, unambiguous)
 * - For social: four books share overlapping chapter indices — disambiguate via chapter_name
 *
 * Returns null if no curriculum data exists for this grade/subject/chapter.
 */
export function getChapterFromCurriculum(
  grade: number,
  subject: string,
  chapterIndex: number,
  chapterName?: string
): CurriculumChapter | null {
  const slug = subject.toLowerCase();

  // ── Grade 11 ──────────────────────────────────────────────────────────────
  if (grade === 11) {
    if (slug === "physics") {
      const file = loadPhysics11();
      return file.chapters.find((c) => c.chapter_index === chapterIndex) ?? null;
    }
    if (slug === "chemistry") {
      const file = loadChemistry11();
      return file.chapters.find((c) => c.chapter_index === chapterIndex) ?? null;
    }
    if (slug === "math" || slug === "mathematics") {
      const file = loadMath11();
      return file.chapters.find((c) => c.chapter_index === chapterIndex) ?? null;
    }
    if (slug === "economics") {
      const file = loadEconomics11();
      return file.chapters.find((c) => c.chapter_index === chapterIndex) ?? null;
    }
    if (slug === "business_studies") {
      const file = loadBusinessStudies11();
      return file.chapters.find((c) => c.chapter_index === chapterIndex) ?? null;
    }
    if (slug === "accountancy") {
      const file = loadAccountancy11();
      return file.chapters.find((c) => c.chapter_index === chapterIndex) ?? null;
    }
    return null;
  }

  // ── Grade 10 ──────────────────────────────────────────────────────────────
  if (grade !== 10) return null;

  if (slug === "science") {
    const file = loadScience10();
    return file.chapters.find((c) => c.chapter_index === chapterIndex) ?? null;
  }

  if (slug === "math" || slug === "mathematics") {
    const file = loadMath10();
    return file.chapters.find((c) => c.chapter_index === chapterIndex) ?? null;
  }

  if (slug === "social" || slug.startsWith("social_")) {
    const books = loadSocial10();

    // For social_* slugs, scope to the specific book first
    const targetBookKey = slug.startsWith("social_") ? slug.replace("social_", "") : null;
    const candidates = targetBookKey
      ? books.filter((b) => b.book === targetBookKey)
      : books;

    // Primary lookup: match chapter_name (case-insensitive, trimmed)
    if (chapterName) {
      const normalized = chapterName.trim().toLowerCase();
      for (const book of candidates) {
        const match = book.chapters.find(
          (c) => c.chapter_name.trim().toLowerCase() === normalized
        );
        if (match) return match;
      }
    }
    // Fallback: first matching chapter_index
    for (const book of candidates) {
      const match = book.chapters.find((c) => c.chapter_index === chapterIndex);
      if (match) return match;
    }
    return null;
  }

  return null;
}

/**
 * Get a flat list of topics for a chapter — same shape as what Qdrant used to return.
 * Returns an empty array if no curriculum data is available (caller should fall back to Qdrant).
 */
export function getTopicsFromCurriculum(
  grade: number,
  subject: string,
  chapterIndex: number,
  chapterName?: string
): { topic_index: string; topic_name: string; page_start: number; page_end: number }[] {
  const chapter = getChapterFromCurriculum(grade, subject, chapterIndex, chapterName);
  if (!chapter) return [];
  return chapter.topics.map((t) => ({
    topic_index: t.topic_index,
    topic_name: t.topic_name,
    page_start: t.page_start,
    page_end: t.page_end,
  }));
}
