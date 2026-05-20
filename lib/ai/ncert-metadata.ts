/**
 * lib/ai/ncert-metadata.ts
 *
 * NCERT chapter metadata — topics, chapter name, chapter index.
 * Used by notes, summary, quiz, and learn mode pipelines for scope detection.
 *
 * Implementation: Queries Qdrant live via getChapterTopicsFromQdrant and
 * getChapterListFromQdrant. No static JSON files required — the vector DB is
 * the source of truth for chapter/topic structure.
 */

import {
  getChapterTopicsFromQdrant,
  getChapterListFromQdrant,
} from "@/lib/ai/qdrant";
import { getNcertBookFromTutorSubject } from "@/lib/tutor-subject";

export interface ChapterTopicMeta {
  topic_index: string;
  topic_name: string;
  subtopics?: { subtopic_index: string; subtopic_name: string }[];
}

export interface ChapterMeta {
  chapter_index: number;
  chapter_name: string;
  page_start: number;
  page_end: number;
  topics: ChapterTopicMeta[];
}

/**
 * Returns the chapter metadata for a given subject + chapter index.
 * Fetches topic list from Qdrant. Returns null if the chapter has no indexed content.
 *
 * @param subject       e.g. "science", "social_history"
 * @param chapterIndex  e.g. "1", 1 — the chapter_index stored in Qdrant
 * @param grade         defaults to 10
 */
export async function getNcertChapterMeta(
  subject: string,
  chapterIndex: string | number,
  grade: number | string = 10
): Promise<ChapterMeta | null> {
  const book = getNcertBookFromTutorSubject(subject) ?? null;

  const [topics, chapters] = await Promise.all([
    getChapterTopicsFromQdrant(grade, subject, chapterIndex, book),
    getChapterListFromQdrant(grade, subject, book),
  ]);

  if (topics.length === 0) {
    console.warn(
      `[ncert-metadata] No topics found for subject=${subject} chapter=${chapterIndex} grade=${grade}`
    );
    return null;
  }

  // Find chapter name from the chapter list
  const chapterStr = String(chapterIndex);
  const chapterEntry = chapters.find((c) => c.chapter_index === chapterStr);
  const chapterName = chapterEntry?.chapter_name ?? `Chapter ${chapterStr}`;

  return {
    chapter_index: Number(chapterIndex),
    chapter_name: chapterName,
    page_start: 0, // Not stored in Qdrant — not needed by pipeline
    page_end: 0,
    topics: topics.map((t) => ({
      topic_index: t.topic_index,
      topic_name: t.topic_name,
    })),
  };
}
