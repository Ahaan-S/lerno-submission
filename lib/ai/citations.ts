import type { RetrievedChunk } from "@/lib/ai/qdrant";
import type { InlineCitation } from "@/lib/database.types";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { getNcertBookFromTutorSubject } from "@/lib/tutor-subject";

/**
 * Derives a human-readable book name from grade + subject.
 * Shown in the source modal as "Science for Class X"
 */
export function deriveBookName(grade: number | string, subject: string): string {
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const gradeNum = parseInt(String(grade), 10);

  const sstBook = getNcertBookFromTutorSubject(subject);
  if (sstBook) {
    const romanMap: Record<number, string> = {
      1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
      6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
      11: "XI", 12: "XII",
    };
    const classLabel = romanMap[gradeNum] ? `Class ${romanMap[gradeNum]}` : `Class ${grade}`;
    const sstTitles: Record<string, string> = {
      history: `History (NCERT) — ${classLabel}`,
      geography: gradeNum >= 6 && gradeNum <= 8
        ? `The Earth Our Habitat — ${classLabel}`
        : `Contemporary India — ${classLabel}`,
      civics: `Social and Political Life — ${classLabel}`,
      economics: `Economics (NCERT) — ${classLabel}`,
    };
    return sstTitles[sstBook] ?? `Social Science (${subjectLabel}) — ${classLabel}`;
  }

  const romanMap: Record<number, string> = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
    6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
    11: "XI", 12: "XII",
  };
  const classLabel = romanMap[gradeNum] ? `Class ${romanMap[gradeNum]}` : `Class ${grade}`;

  const bookNames: Record<string, string> = {
    science:     `Science for ${classLabel}`,
    biology:     `Biology (NCERT) — ${classLabel}`,
    chemistry:   `Chemistry (NCERT) — ${classLabel}`,
    physics:     `Physics (NCERT) — ${classLabel}`,
    mathematics: `Mathematics for ${classLabel}`,
    maths:       `Mathematics for ${classLabel}`,
    history:     `Our Pasts — ${classLabel}`,
    geography:   gradeNum >= 6 && gradeNum <= 8
      ? `The Earth Our Habitat — ${classLabel}`
      : `Contemporary India — ${classLabel}`,
    economics:   `Economics (NCERT) — ${classLabel}`,
    civics:      `Social and Political Life — ${classLabel}`,
    english:     `English (NCERT) — ${classLabel}`,
    business_studies: `Business Studies (NCERT) — ${classLabel}`,
    accountancy: `Accountancy (NCERT) — ${classLabel}`,
  };

  const key = subject.toLowerCase().replace(/\s+/g, "");
  return bookNames[key] ?? `NCERT ${subjectLabel} — ${classLabel}`;
}

/**
 * Parses [N] citation markers from AI response text and maps each to full chunk metadata.
 * Only returns citations that were actually referenced in the response.
 */
export function extractInlineCitations(
  responseText: string,
  chunks: RetrievedChunk[],
  grade: number | string,
  subject: string
): InlineCitation[] {
  if (chunks.length === 0) return [];

  const book = deriveBookName(grade, subject);

  const seenIndices = new Set<number>();
  const orderedIndices: number[] = [];
  const markerRegex = /\[(\d+)\]/g;
  let match;

  while ((match = markerRegex.exec(responseText)) !== null) {
    const n = parseInt(match[1], 10);
    if (n >= 1 && n <= chunks.length && !seenIndices.has(n)) {
      seenIndices.add(n);
      orderedIndices.push(n);
    }
  }

  return orderedIndices.map((n) => {
    const chunk = chunks[n - 1]; // 1-indexed → 0-indexed
    return {
      index: n,
      chunk_id: chunk.chunk_id,
      chapter_name: chunk.chapter_name,
      chapter_index: chunk.chapter_index,
      topic_name: chunk.topic_name,
      topic_index: chunk.topic_index,
      subtopic_name: chunk.subtopic_name,
      subtopic_index: chunk.subtopic_index,
      page_start: chunk.page_start,
      page_end: chunk.page_end,
      content: chunk.content,
      book,
      ...(chunk.referenced_figures?.length ? { referenced_figures: chunk.referenced_figures } : {}),
    };
  });
}

/**
 * Fallback: if AI produced no [N] markers, return metadata for the top N chunks.
 * Ensures citations array is never empty.
 */
export function fallbackCitations(
  chunks: RetrievedChunk[],
  grade: number | string,
  subject: string,
  topN: number = 3
): InlineCitation[] {
  const book = deriveBookName(grade, subject);
  return chunks.slice(0, topN).map((chunk, i) => ({
    index: i + 1,
    chunk_id: chunk.chunk_id,
    chapter_name: chunk.chapter_name,
    chapter_index: chunk.chapter_index,
    topic_name: chunk.topic_name,
    topic_index: chunk.topic_index,
    subtopic_name: chunk.subtopic_name,
    subtopic_index: chunk.subtopic_index,
    page_start: chunk.page_start,
    page_end: chunk.page_end,
    content: chunk.content,
    book,
    ...(chunk.referenced_figures?.length ? { referenced_figures: chunk.referenced_figures } : {}),
  }));
}
