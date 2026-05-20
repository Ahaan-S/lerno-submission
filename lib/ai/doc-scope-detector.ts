/**
 * lib/ai/doc-scope-detector.ts
 *
 * Detects the content scope for notes/summary generation.
 * Receives: user message + chapter metadata (topics list).
 * Returns: DocScope — which chapter, which topics, human label.
 *
 * Uses chatLite (Gemini Flash Lite, ~200–400ms). Called before Qdrant fetch.
 */

import { chatLite } from "@/lib/ai/llm";
import type { DocScope } from "@/lib/ai/doc-types";
import type { ChapterMeta } from "@/lib/ai/ncert-metadata";
import { sameTopicIndex } from "@/lib/ai/qdrant";

/**
 * When the session has no chapter or the student names a different chapter in text,
 * pick the Qdrant chapter_index from the indexed chapter list.
 */
export async function resolveChapterForDocRequest(
  userMessage: string,
  chapters: { chapter_index: string; chapter_name: string }[],
  sessionChapterHint: string | null | undefined
): Promise<string> {
  if (chapters.length === 0) return "1";
  const valid = new Set(chapters.map((c) => String(c.chapter_index).trim()));
  const hint = sessionChapterHint?.trim() ?? "";
  if (chapters.length === 1) return chapters[0].chapter_index;

  const list = chapters.map((c) => `${c.chapter_index}: ${c.chapter_name}`).join("\n");
  const allowed = [...valid].join(", ");

  const prompt = `
You choose which NCERT chapter the student wants notes or a summary for.

CHAPTERS (use exactly one chapter_index from this list):
${list}

SESSION UI CHAPTER (hint, may be unset): ${hint || "none — student did not pick a chapter in the UI"}

STUDENT REQUEST: "${userMessage}"

Rules:
- If they name a chapter by number ("chapter 3", "ch 3") or by title, map it to the matching chapter_index.
- If the request is generic ("notes for everything", "full chapter") and a session chapter hint is set, use that chapter_index.
- If generic and no hint, prefer chapter_index "1" only if that exists in the list; otherwise use the first chapter in the list order above.
- Your chapter_index MUST be one of: ${allowed}

Return ONLY valid JSON. No markdown fences.
{"chapter_index":"..."}
`.trim();

  try {
    const raw = await chatLite([{ role: "user", content: prompt }]);
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(slice) as { chapter_index?: string };
    const ci = parsed.chapter_index?.trim();
    if (ci && valid.has(ci)) return ci;
  } catch (err) {
    console.error("[doc-scope-detector] resolveChapterForDocRequest failed:", err);
  }
  if (hint && valid.has(hint)) return hint;
  return chapters[0].chapter_index;
}

/** Drop topic indices the model hallucinated; normalize to canonical indices from chapter metadata. */
export function normalizeDocScopeTopics(scope: DocScope, chapterMeta: ChapterMeta): DocScope {
  const ch = String(chapterMeta.chapter_index);
  if (scope.topic_indices == null || scope.topic_indices.length === 0) {
    return {
      ...scope,
      chapter_index: ch,
      chapter_name: chapterMeta.chapter_name,
    };
  }
  const normalized: string[] = [];
  for (const ti of scope.topic_indices) {
    const match = chapterMeta.topics.find((t) => sameTopicIndex(t.topic_index, String(ti)));
    if (match) normalized.push(match.topic_index);
  }
  const unique = [...new Set(normalized)];
  return {
    ...scope,
    chapter_index: ch,
    chapter_name: chapterMeta.chapter_name,
    topic_indices: unique.length === 0 ? null : unique,
  };
}

export async function detectDocScope(
  userMessage: string,
  chapterMeta: ChapterMeta
): Promise<DocScope> {
  const topicList = chapterMeta.topics
    .map((t) => `${t.topic_index}: ${t.topic_name}`)
    .join("\n");

  const prompt = `
You are a scope detector for an NCERT Class 10 tutoring platform.
A student asked for notes or a summary. Determine which topics to include.

CHAPTER: ${chapterMeta.chapter_index}. ${chapterMeta.chapter_name}

AVAILABLE TOPICS:
${topicList}

STUDENT REQUEST: "${userMessage}"

RULES:
- If the student asked for the full chapter, all topics, or didn't mention specific topics → set topic_indices to null
- If the student mentioned specific topics → set topic_indices to only those matching topic_index values
- Match topic names approximately: "oxidation" matches "Oxidation and Reduction"
- scope_label: short human-readable string. Examples: "Chapter 1", "Oxidation and Reduction", "Types of Reactions, Decomposition"
- topic_names: human-readable names of the selected topics (empty array if full chapter)

Return ONLY valid JSON. No explanation. No markdown fences. No trailing commas.

{
  "chapter_index": "${String(chapterMeta.chapter_index)}",
  "chapter_name": "${chapterMeta.chapter_name}",
  "topic_indices": null,
  "topic_names": [],
  "scope_label": "Chapter ${chapterMeta.chapter_index}"
}
`.trim();

  const fallback: DocScope = {
    chapter_index: String(chapterMeta.chapter_index),
    chapter_name: chapterMeta.chapter_name,
    topic_indices: null,
    topic_names: chapterMeta.topics.map((t) => t.topic_name),
    scope_label: `Chapter ${chapterMeta.chapter_index}`,
  };

  try {
    const raw = await chatLite([{ role: "user", content: prompt }]);
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(slice) as DocScope;
    if (!parsed.chapter_index || parsed.scope_label === undefined) {
      console.warn("[doc-scope-detector] Incomplete response, using fallback");
      return fallback;
    }
    return parsed;
  } catch (err) {
    console.error("[doc-scope-detector] Failed, using fallback full-chapter scope:", err);
    return fallback;
  }
}
