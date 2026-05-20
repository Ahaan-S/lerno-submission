/**
 * lib/ai/quiz-scope-detector.ts
 *
 * Detects the quiz scope (chapter, topics, quantity, difficulty) from the user's message.
 * Uses chatLite — cheap, fast, ~200ms.
 */

import { chatLite } from "@/lib/ai/llm";
import type { QuizQuantity } from "@/lib/ai/doc-types";
import type { ChapterMeta } from "@/lib/ai/ncert-metadata";
import { sameTopicIndex } from "@/lib/ai/qdrant";

export interface QuizScope {
  chapter_index: string;
  chapter_name: string;
  topic_indices: string[] | null; // null = full chapter
  scope_label: string;
  quantity: QuizQuantity;
  difficulty: "easy" | "medium" | "hard" | null; // null = mixed
}

/** Align scope with NCERT metadata and drop hallucinated topic_index values (avoids empty SQL pools). */
export function normalizeQuizScope(scope: QuizScope, chapterMeta: ChapterMeta): QuizScope {
  const ch = String(chapterMeta.chapter_index);
  let topic_indices = scope.topic_indices;
  if (topic_indices != null && topic_indices.length > 0) {
    const normalized: string[] = [];
    for (const ti of topic_indices) {
      const match = chapterMeta.topics.find((t) => sameTopicIndex(t.topic_index, String(ti)));
      if (match) normalized.push(match.topic_index);
    }
    topic_indices = normalized.length === 0 ? null : [...new Set(normalized)];
  }
  return {
    ...scope,
    chapter_index: ch,
    chapter_name: chapterMeta.chapter_name,
    topic_indices,
  };
}

export async function detectQuizScope(
  userMessage: string,
  chapterMeta: ChapterMeta
): Promise<QuizScope> {
  const topicList = chapterMeta.topics
    .map((t) => `${t.topic_index}: ${t.topic_name}`)
    .join("\n");

  const prompt = `
You are a quiz scope detector for an NCERT Class 10 tutoring platform.

CHAPTER: ${chapterMeta.chapter_index}. ${chapterMeta.chapter_name}
AVAILABLE TOPICS:
${topicList}

STUDENT REQUEST: "${userMessage}"

Determine:
1. topic_indices: which topics to include. null = full chapter, [] with specific values = specific topics.
2. quantity: how many of each type. Defaults: { "mcq": 4, "short": 2, "long": 1 }
   Override ONLY if explicitly requested:
   - "give me 5 MCQs" → mcq: 5
   - "2 short answer only" → mcq: 0, short: 2, long: 0
   - "quick quiz" → mcq: 3, short: 1, long: 0
   - "just MCQs" → short: 0, long: 0
3. difficulty: null (mixed) unless student says "hard", "easy", or "medium"
4. scope_label: short human-readable label, e.g. "Chapter 1" or "Types of Reactions"

Return ONLY valid JSON. No explanation. No markdown fences.
{
  "chapter_index": "${String(chapterMeta.chapter_index)}",
  "chapter_name": "${chapterMeta.chapter_name}",
  "topic_indices": null,
  "scope_label": "Chapter ${chapterMeta.chapter_index}",
  "quantity": { "mcq": 4, "short": 2, "long": 1 },
  "difficulty": null
}
`.trim();

  const fallback: QuizScope = {
    chapter_index: String(chapterMeta.chapter_index),
    chapter_name: chapterMeta.chapter_name,
    topic_indices: null,
    scope_label: `Chapter ${chapterMeta.chapter_index}`,
    quantity: { mcq: 4, short: 2, long: 1 },
    difficulty: null,
  };

  try {
    const raw = await chatLite([{ role: "user", content: prompt }]);
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(slice) as QuizScope;
    parsed.quantity = {
      mcq: parsed.quantity?.mcq ?? 4,
      short: parsed.quantity?.short ?? 2,
      long: parsed.quantity?.long ?? 1,
    };
    return parsed;
  } catch (err) {
    console.error("[quiz-scope-detector] Failed, using fallback:", err);
    return fallback;
  }
}
