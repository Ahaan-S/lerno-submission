/**
 * lib/ai/quiz-selector.ts
 *
 * AI selects the best questions from the pool.
 *
 * IMPORTANT: The AI only sees question text + type + marks + difficulty.
 * It does NOT see the correct answers. This keeps the selection prompt small
 * and prevents any answer leakage into selection reasoning.
 * Correct answers are fetched separately in Phase 2 of quiz-pool.ts.
 */

import { chatLite } from "@/lib/ai/llm";
import type { QuestionPoolItem } from "@/lib/ai/quiz-pool";
import type { QuizQuantity } from "@/lib/ai/doc-types";

export interface QuizSelection {
  mcq_ids: string[];
  short_ids: string[];
  long_ids: string[];
}

const MCQ_TYPES = new Set(["mcq", "assertion_reasoning", "true_false"]);
const SHORT_TYPES = new Set(["short_ans", "fill_blank"]);
const LONG_TYPES = new Set(["long_ans"]);

function pickDeterministic(pool: QuestionPoolItem[], quantity: QuizQuantity): QuizSelection {
  return {
    mcq_ids: pool.filter((q) => MCQ_TYPES.has(q.question_type)).slice(0, quantity.mcq).map((q) => q.id),
    short_ids: pool.filter((q) => SHORT_TYPES.has(q.question_type)).slice(0, quantity.short).map((q) => q.id),
    long_ids: pool.filter((q) => LONG_TYPES.has(q.question_type)).slice(0, quantity.long).map((q) => q.id),
  };
}

function extractJsonObject(raw: string): string {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}

/** Map model output to real pool UUIDs (models often return 1-based indices from the numbered list). */
function resolvePoolId(
  raw: unknown,
  pool: QuestionPoolItem[],
  validIds: Set<string>
): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (validIds.has(s)) return s;
  const n = parseInt(s.replace(/^#/, ""), 10);
  if (!Number.isNaN(n) && n >= 1 && n <= pool.length) return pool[n - 1]!.id;
  const m = /^0*(\d+)$/.exec(s);
  if (m) {
    const idx = parseInt(m[1], 10);
    if (idx >= 1 && idx <= pool.length) return pool[idx - 1]!.id;
  }
  return null;
}

function normalizeSelection(
  parsed: QuizSelection,
  pool: QuestionPoolItem[],
  quantity: QuizQuantity
): QuizSelection {
  const validIds = new Set(pool.map((q) => q.id));
  const mapBucket = (ids: unknown[] | undefined, cap: number): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of ids ?? []) {
      const id = resolvePoolId(item, pool, validIds);
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
        if (out.length >= cap) break;
      }
    }
    return out;
  };
  return {
    mcq_ids: mapBucket((parsed.mcq_ids ?? []) as unknown[], quantity.mcq + 2),
    short_ids: mapBucket((parsed.short_ids ?? []) as unknown[], quantity.short + 1),
    long_ids: mapBucket((parsed.long_ids ?? []) as unknown[], quantity.long + 1),
  };
}

function selectionNonEmpty(sel: QuizSelection): boolean {
  return sel.mcq_ids.length + sel.short_ids.length + sel.long_ids.length > 0;
}

/**
 * Uses chatLite to select the best questions from the pool.
 * Returns selected IDs organised by bucket (mcq / short / long).
 *
 * Falls back to deterministic selection if the AI call fails or returns no valid IDs.
 */
export async function selectQuizQuestions(
  pool: QuestionPoolItem[],
  quantity: QuizQuantity,
  chapterName: string
): Promise<QuizSelection> {
  if (pool.length === 0) {
    return { mcq_ids: [], short_ids: [], long_ids: [] };
  }

  const poolText = pool
    .map(
      (q, i) =>
        `[${String(i + 1).padStart(2, "0")}] ` +
        `ID:${q.id} | TYPE:${q.question_type} | ${q.difficulty} | ${q.marks}M | TOPIC:${q.topic_name}\n` +
        `Q: ${q.question_text.slice(0, 180)}${q.question_text.length > 180 ? "..." : ""}`
    )
    .join("\n\n");

  const prompt = `
You are selecting questions for a Class 10 NCERT quiz on "${chapterName}".
Select the best questions from the pool.

TARGET QUANTITIES:
- MCQ (mcq, assertion_reasoning, true_false): ${quantity.mcq} questions
- Short answer (short_ans, fill_blank): ${quantity.short} questions
- Long answer (long_ans): ${quantity.long} questions

If fewer questions exist in the pool than requested for a type, select ALL available for that type.
Do not pad with wrong types to meet the count.

SELECTION CRITERIA (in order of priority):
1. Variety: pick questions from different topics/sub-topics if the pool has them
2. Difficulty spread: mix of easy, medium, hard where available
3. Question quality: prefer well-formed, unambiguous questions
4. Avoid near-duplicates: if two questions test the same fact, pick the better one

QUESTION POOL:
${poolText}

Return ONLY valid JSON with the selected UUIDs. No explanation. No markdown fences.
{
  "mcq_ids": [],
  "short_ids": [],
  "long_ids": []
}
`.trim();

  const fallback = pickDeterministic(pool, quantity);

  try {
    const raw = await chatLite([{ role: "user", content: prompt }]);
    const slice = extractJsonObject(raw);
    const parsed = JSON.parse(slice) as QuizSelection;
    const normalized = normalizeSelection(parsed, pool, quantity);
    if (selectionNonEmpty(normalized)) {
      return normalized;
    }
    console.warn("[quiz-selector] AI returned no valid IDs after normalization; using deterministic pick");
    return fallback;
  } catch (err) {
    console.error("[quiz-selector] AI selection failed, using deterministic fallback:", err);
    return fallback;
  }
}
