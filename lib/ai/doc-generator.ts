/** Notes and summary document generation helpers. */

import { chat } from "@/lib/ai/llm";
import { isVertexConfigured } from "@/lib/ai/vertex-auth";
import type {
  NotesDocument,
  NotesTopicSection,
  SummaryDocument,
  SummaryTopicSection,
  DocScope,
} from "@/lib/ai/doc-types";
import type { ChapterMeta } from "@/lib/ai/ncert-metadata";
import type { QdrantChunk } from "@/lib/ai/qdrant";

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Groups a flat array of chunks into a Map keyed by topic_index.
 * Preserves sort order within each group (chunks are pre-sorted by page_start).
 */
function groupChunksByTopic(chunks: QdrantChunk[]): Map<string, QdrantChunk[]> {
  const map = new Map<string, QdrantChunk[]>();
  for (const chunk of chunks) {
    const key = chunk.topic_index ?? "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(chunk);
  }
  return map;
}

/**
 * Converts an array of chunks into a numbered text block for the AI prompt.
 */
function chunksToPromptText(chunks: QdrantChunk[]): string {
  return chunks
    .map((c, i) => `[SECTION ${i + 1}]\n${c.content}`)
    .join("\n\n---\n\n");
}

const vertexUtilityThinking =
  isVertexConfigured() ? ({ thinkingBudget: 0 } as const) : {};

/** Parse JSON object from model output. */
function parseLlmJsonObject<TResult>(raw: string): TResult {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  if (!cleaned) throw new Error("empty model output");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as TResult;
}

// ── Notes section generator ───────────────────────────────────────────────────

/**
 * Generates structured notes for a single topic.
 *
 * @param topicIndex       e.g. "1.2"
 * @param topicName        e.g. "Types of Chemical Reactions"
 * @param chunks           All chunks for this topic (pre-filtered, sorted by page_start)
 * @param subject          e.g. "science"
 * @param chapterName      e.g. "Chemical Reactions and Equations"
 * @param extraInstruction Optional edit instruction injected by the edit pipeline.
 *                         Pass undefined for initial generation.
 */
export async function generateNotesSection(
  topicIndex: string,
  topicName: string,
  chunks: QdrantChunk[],
  subject: string,
  chapterName: string,
  extraInstruction?: string
): Promise<NotesTopicSection> {
  const contentText = chunksToPromptText(chunks);

  const editClause = extraInstruction
    ? `\n\nSPECIAL INSTRUCTION FOR THIS GENERATION: ${extraInstruction}`
    : "";

  const prompt = `
You are generating structured NCERT study notes for Class 10 ${subject}.
Chapter: ${chapterName}
Topic: ${topicIndex}. ${topicName}

TEXTBOOK CONTENT (from NCERT):
${contentText}

Generate comprehensive, exam-ready notes for THIS TOPIC ONLY.
Return ONLY valid JSON matching the schema below. No explanation. No markdown fences. No trailing commas.

{
  "topic_index": "${topicIndex}",
  "topic_name": "${topicName}",
  "items": []
}

The "items" array must contain objects of these types:

{ "type": "definition", "term": "term name", "text": "what it means" }
  → Use for key NCERT terms. Use exact NCERT wording for the definition text.
  → One definition per distinct term. Do not cluster multiple terms in one definition.

{ "type": "subheading", "text": "sub-section name" }
  → Use to divide the topic into readable sub-sections.
  → Place before the items belonging to that sub-section.

{ "type": "points", "heading": "optional heading", "items": ["point 1", "point 2", ...] }
  → Use for lists of facts, properties, characteristics, or steps.
  → 4–8 items per points block. Each item = one complete, self-contained fact.
  → heading is optional — only include if it adds clarity.

{ "type": "formula", "label": "optional label", "expression": "...", "note": "optional note" }
  → Use for ALL equations, chemical reactions, and formulas.
  → expression: use plain text. Use → for reactions, = for equations.
  → Example: "2Mg + O₂ → 2MgO" or "PV = nRT"
  → Do NOT use LaTeX or KaTeX here — plain Unicode text only.
  → note: optional context, e.g. "This reaction is exothermic."

{ "type": "remember", "text": "the key fact" }
  → Use sparingly: max 2 per topic. Only for the most exam-critical facts.
  → The text should be a single sentence the student should memorise.

RULES:
- Cover EVERY important concept from the textbook content. Do not skip any sub-topics.
- Give equal depth to every sub-section — do not write detailed notes for the first sub-topic
  and then rush the rest.
- Quality must be consistent throughout: if topic has 4 sub-topics, each gets the same depth.
- Definitions: only for key NCERT terms. Do not define common English words.
- Formulas: include ALL equations and chemical reactions mentioned in the content.
- No filler text. Every item must add factual information.
- Do not include page numbers, section numbers, or textbook references in the items.${editClause}
`.trim();

  try {
    const raw = await chat([{ role: "user", content: prompt }], {
      temperature: 0.1,
      maxTokens: 8192,
      jsonMode: true,
      ...vertexUtilityThinking,
    });
    const parsed = parseLlmJsonObject<NotesTopicSection>(raw);
    return parsed;
  } catch (err) {
    console.error(
      `[doc-generator] generateNotesSection failed for topic ${topicIndex}:`,
      err
    );
    return {
      topic_index: topicIndex,
      topic_name: topicName,
      items: [
        {
          type: "points",
          items: chunks
            .slice(0, 5)
            .map((c) => c.content.slice(0, 200).trim())
            .filter(Boolean),
        },
      ],
    };
  }
}

// ── Summary section generator ─────────────────────────────────────────────────

/**
 * Generates a bullet-point summary for a single topic.
 *
 * @param extraInstruction  Same as in generateNotesSection — used by edit pipeline.
 */
export async function generateSummarySection(
  topicIndex: string,
  topicName: string,
  chunks: QdrantChunk[],
  subject: string,
  chapterName: string,
  extraInstruction?: string
): Promise<SummaryTopicSection> {
  const contentText = chunksToPromptText(chunks);

  const editClause = extraInstruction
    ? `\n\nSPECIAL INSTRUCTION FOR THIS GENERATION: ${extraInstruction}`
    : "";

  const prompt = `
You are generating a chapter summary for Class 10 ${subject} NCERT.
Chapter: ${chapterName}
Topic: ${topicIndex}. ${topicName}

TEXTBOOK CONTENT (from NCERT):
${contentText}

Return ONLY valid JSON. No explanation. No markdown fences.

{
  "topic_index": "${topicIndex}",
  "topic_name": "${topicName}",
  "bullets": []
}

The "bullets" array: 4–6 strings.

RULES:
- Each bullet = one complete, standalone exam fact. A student should be able to memorise it.
- Start with the most important fact / definition for this topic.
- Include key terms, formulas, and reactions as inline text (plain text, no LaTeX).
- No filler. Every bullet must be directly exam-relevant.
- Bullets should be varied — avoid starting multiple bullets with the same word.
- Plain English, no jargon beyond standard NCERT terminology.${editClause}
`.trim();

  try {
    const raw = await chat([{ role: "user", content: prompt }], {
      temperature: 0.1,
      maxTokens: 2048,
      jsonMode: true,
      ...vertexUtilityThinking,
    });
    return parseLlmJsonObject<SummaryTopicSection>(raw);
  } catch (err) {
    console.error(
      `[doc-generator] generateSummarySection failed for topic ${topicIndex}:`,
      err
    );
    return { topic_index: topicIndex, topic_name: topicName, bullets: [] };
  }
}

// ── Full document generators ──────────────────────────────────────────────────

/**
 * Generates a complete notes document by calling generateNotesSection for each topic.
 * Topics with zero chunks are skipped (e.g. stub intro topics).
 *
 * @param onSectionComplete  Called before each section's generation starts.
 *                           Use to emit SSE progress events.
 */
export async function generateNotesDocument(
  chunks: QdrantChunk[],
  scope: DocScope,
  subject: string,
  chapterMeta: ChapterMeta,
  onSectionComplete?: (index: number, total: number, topicName: string) => void
): Promise<NotesDocument> {
  const grouped = groupChunksByTopic(chunks);

  const topicsToGenerate = scope.topic_indices
    ? chapterMeta.topics.filter((t) => scope.topic_indices!.includes(t.topic_index))
    : chapterMeta.topics;

  const sections: NotesTopicSection[] = [];

  for (let i = 0; i < topicsToGenerate.length; i++) {
    const topic = topicsToGenerate[i];
    const topicChunks = grouped.get(topic.topic_index) ?? [];

    if (topicChunks.length === 0) {
      console.log(`[doc-generator] Skipping topic ${topic.topic_index} — no chunks found`);
      continue;
    }

    onSectionComplete?.(i, topicsToGenerate.length, topic.topic_name);

    const section = await generateNotesSection(
      topic.topic_index,
      topic.topic_name,
      topicChunks,
      subject,
      chapterMeta.chapter_name
    );
    sections.push(section);
  }

  return {
    type: "notes",
    title: `${chapterMeta.chapter_name} Notes`,
    subject,
    chapter_name: chapterMeta.chapter_name,
    generated_at: new Date().toISOString(),
    sections,
  };
}

/**
 * Generates a complete summary document.
 * Same structure as generateNotesDocument — see that function's comments.
 */
export async function generateSummaryDocument(
  chunks: QdrantChunk[],
  scope: DocScope,
  subject: string,
  chapterMeta: ChapterMeta,
  onSectionComplete?: (index: number, total: number, topicName: string) => void
): Promise<SummaryDocument> {
  const grouped = groupChunksByTopic(chunks);

  const topicsToGenerate = scope.topic_indices
    ? chapterMeta.topics.filter((t) => scope.topic_indices!.includes(t.topic_index))
    : chapterMeta.topics;

  const sections: SummaryTopicSection[] = [];

  for (let i = 0; i < topicsToGenerate.length; i++) {
    const topic = topicsToGenerate[i];
    const topicChunks = grouped.get(topic.topic_index) ?? [];
    if (topicChunks.length === 0) continue;

    onSectionComplete?.(i, topicsToGenerate.length, topic.topic_name);

    const section = await generateSummarySection(
      topic.topic_index,
      topic.topic_name,
      topicChunks,
      subject,
      chapterMeta.chapter_name
    );
    sections.push(section);
  }

  return {
    type: "summary",
    title: `${chapterMeta.chapter_name} Summary`,
    subject,
    chapter_name: chapterMeta.chapter_name,
    generated_at: new Date().toISOString(),
    sections,
  };
}
