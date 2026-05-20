import { QdrantClient } from "@qdrant/js-client-rest";
import { resolveNcertSubjectForFilter } from "@/lib/tutor-subject";

/**
 * Expected `ncert_content` point payload:
 *
 * **Flat shape** — fields at root: `grade`, `subject`, `chapter_index`, `content`, …
 *
 * **Nested shape** (common with LangChain / some ingest scripts) — classification under `metadata`:
 * `{ "content": "...", "metadata": { "grade": "10", "subject": "Science", "chapter_index": "2",
 *   "topic_index": "2.0", "topic_name": "Introduction", … } }`
 *
 * Filters always match **either** root keys (`grade`, `subject`, …) **or**
 * `metadata.{grade,subject,chapter_index}` via a `should` clause. Many ingest pipelines
 * flatten fields to the root in Qdrant even when the source JSON had a `metadata` object;
 * `QDRANT_NCERT_META_PREFIX` is ignored for filtering so flat payloads are never missed.
 *
 * Reads always merge `metadata` into the payload view via `flattenNcertPayload()`.
 */
/** Lazy init so callers can load dotenv before first use (scripts, tests). */
let qdrantClient: QdrantClient | null = null;
function getQdrant(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL ?? "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
    });
  }
  return qdrantClient;
}

const COLLECTION = "ncert_content";
export const TOP_K = 15; // fetch more candidates for hybrid RRF merge
const MIN_SCORE = 0.15;
const MIN_CHUNKS_FALLBACK = 3;

/**
 * Match payload field at root OR under `metadata.{localKey}` (nested NCERT chunks).
 * Implemented as a nested Filter with `should` so Qdrant requires at least one branch.
 */
function ncertFieldMatchFlatOrMetadata(localKey: string, value: string): Record<string, unknown> {
  return {
    should: [
      { key: localKey, match: { value } },
      { key: `metadata.${localKey}`, match: { value } },
    ],
  };
}

/**
 * Match only at payload root. Used for `book` so we do not reference `metadata.book` in filters:
 * Qdrant Cloud returns 400 if `metadata.book` has no keyword index, even inside a `should`.
 * SST ingest stores `book` at root alongside other NCERT fields.
 */
function ncertFieldMatchRootOnly(localKey: string, value: string): Record<string, unknown> {
  return { key: localKey, match: { value } };
}

/**
 * Merge nested `metadata` into one map. Root keys (e.g. `content`) override nested.
 */
export function flattenNcertPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = payload.metadata;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...(nested as Record<string, unknown>), ...payload };
  }
  return payload;
}

/**
 * grade + subject + optional chapter.
 * Always OR root vs `metadata.*` so both flattened Qdrant payloads and nested LangChain shapes match.
 * (Setting only `metadata.*` breaks collections where ingest flattened metadata to the root.)
 */
export function buildNcertPayloadFilter(
  grade: number | string,
  subject: string,
  chapterIndex?: number | string | null,
  book?: string | null
): Record<string, unknown> {
  const gradeStr = String(grade).trim();
  const normalizedSubject = resolveNcertSubjectForFilter(subject);

  const must: Record<string, unknown>[] = [
    ncertFieldMatchFlatOrMetadata("grade", gradeStr),
    ncertFieldMatchFlatOrMetadata("subject", normalizedSubject),
  ];

  if (chapterIndex != null && String(chapterIndex).trim() !== "") {
    must.push(ncertFieldMatchFlatOrMetadata("chapter_index", String(chapterIndex).trim()));
  }

  if (book != null && String(book).trim() !== "") {
    must.push(ncertFieldMatchRootOnly("book", String(book).trim()));
  }

  return { must };
}

export interface RetrievedChunk {
  chunk_id: string;
  content: string;
  chapter_name?: string;
  chapter_index?: string;
  topic_name?: string;
  topic_index?: string;
  subtopic_name?: string;
  subtopic_index?: string;
  page_start?: number;
  page_end?: number;
  score?: number;
  chunk_type?: string;
  importance?: string;
  referenced_figures?: string[];
  relevance_score: number;
}

/** Alias used by doc-generator and related pipelines. */
export type QdrantChunk = RetrievedChunk;

/** Search ncert_content by vector, filtered by grade, subject, optionally chapter_index. */
export async function searchChunks(
  vector: number[],
  grade: number | string,
  subject: string,
  chapter_index?: string | null,
  book?: string | null
): Promise<RetrievedChunk[]> {
  const normalizedGrade = String(grade);
  const normalizedSubject = resolveNcertSubjectForFilter(subject);
  const filter = buildNcertPayloadFilter(grade, subject, chapter_index ?? undefined, book);

  console.log(
    "[qdrant] Search params: collection=",
    COLLECTION,
    "| grade=",
    normalizedGrade,
    "| subject=",
    normalizedSubject,
    "| chapter_index=",
    chapter_index ?? "(none)",
    "| book=",
    book ?? "(none)",
    "| vector_len=",
    vector.length
  );

  let results: Awaited<ReturnType<QdrantClient["search"]>>;
  try {
    results = await getQdrant().search(COLLECTION, {
      vector,
      limit: TOP_K,
      filter,
      with_payload: true,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errData = err && typeof err === "object" && "data" in err ? (err as { data?: unknown }).data : undefined;
    console.error("[qdrant] Search failed. Error:", errMsg);
    console.error("[qdrant] Full error (for debugging):", JSON.stringify(errData ?? err, null, 2));
    throw err;
  }
  console.log("[qdrant] Raw results count:", results.length, "| scores:", results.map((r) => r.score?.toFixed(4)).join(", "));

  const toChunk = (p: (typeof results)[0]): RetrievedChunk => {
    const payload = flattenNcertPayload((p.payload ?? {}) as Record<string, unknown>);
    return {
      chunk_id: String(p.id ?? ""),
      content: String(payload.content ?? payload.text ?? ""),
      chapter_name: (payload.chapter_name ?? payload.chapter) as string | undefined,
      chapter_index: payload.chapter_index as string | undefined,
      topic_name: payload.topic_name as string | undefined,
      topic_index: payload.topic_index as string | undefined,
      subtopic_name: payload.subtopic_name as string | undefined,
      subtopic_index: payload.subtopic_index as string | undefined,
      page_start: payload.page_start as number | undefined,
      page_end: payload.page_end as number | undefined,
      chunk_type: payload.chunk_type as string | undefined,
      importance: payload.importance as string | undefined,
      referenced_figures: Array.isArray(payload.referenced_figures) ? (payload.referenced_figures as string[]) : undefined,
      relevance_score: p.score ?? 0,
    };
  };

  const filtered = results.filter((p) => (p.score ?? 0) >= MIN_SCORE).map(toChunk);
  if (filtered.length === 0 && results.length > 0) {
    const fallback = results.slice(0, Math.min(MIN_CHUNKS_FALLBACK, results.length)).map(toChunk);
    console.log("[qdrant] Score filter yielded 0 (all below", MIN_SCORE, "); using top", fallback.length, "as fallback. Top score:", results[0]?.score?.toFixed(4));
    return fallback;
  }
  return filtered;
}

/**
 * Full-text (keyword) search using Qdrant's built-in text index on content.
 * Sparse leg of hybrid retrieval — finds chunks containing exact query terms.
 * Essential for specific NCERT terms: "kala-azar", "Snell's law", "NaCl", "Ohm's law", etc.
 * Topic/subtopic metadata filtering is NOT needed here — the re-embedding pipeline
 * prepends metadata to the embedding text, so the dense leg handles topic-level retrieval.
 */
export async function searchChunksByFullText(
  query: string,
  grade: number | string,
  subject: string,
  chapter_index?: string | null,
  limit: number = TOP_K,
  book?: string | null
): Promise<RetrievedChunk[]> {
  const normalizedGrade = String(grade);
  const normalizedSubject = resolveNcertSubjectForFilter(subject);

  const base = buildNcertPayloadFilter(grade, subject, chapter_index ?? undefined, book);
  const must = [...((base.must as Record<string, unknown>[]) ?? []), { key: "content", match: { text: query } }];

  console.log(
    "[qdrant] Full-text search | grade:",
    normalizedGrade,
    "| subject:",
    normalizedSubject,
    "| book:",
    book ?? "(none)",
    "| query:",
    query.slice(0, 80)
  );

  try {
    const results = await getQdrant().scroll(COLLECTION, {
      filter: { must },
      limit,
      with_payload: true,
      with_vector: false,
    });

    const chunks: RetrievedChunk[] = results.points.map((p) => {
      const payload = flattenNcertPayload((p.payload ?? {}) as Record<string, unknown>);
      return {
        chunk_id: String(p.id ?? ""),
        content: String(payload.content ?? payload.text ?? ""),
        chapter_name: (payload.chapter_name ?? payload.chapter) as string | undefined,
        chapter_index: payload.chapter_index as string | undefined,
        topic_name: payload.topic_name as string | undefined,
        topic_index: payload.topic_index as string | undefined,
        subtopic_name: payload.subtopic_name as string | undefined,
        subtopic_index: payload.subtopic_index as string | undefined,
        page_start: payload.page_start as number | undefined,
        page_end: payload.page_end as number | undefined,
        chunk_type: payload.chunk_type as string | undefined,
        importance: payload.importance as string | undefined,
        referenced_figures: Array.isArray(payload.referenced_figures) ? (payload.referenced_figures as string[]) : undefined,
        relevance_score: 0.5,
      };
    });

    console.log("[qdrant] Full-text results:", chunks.length);
    return chunks;
  } catch (err) {
    console.error("[qdrant] Full-text search failed (non-fatal):", err);
    return [];
  }
}

/**
 * Reciprocal Rank Fusion — merges multiple ranked lists without score normalisation.
 * k=60 is the standard constant. Higher final score = appeared high in multiple lists.
 */
function rrfMerge(
  legs: { results: RetrievedChunk[]; weight: number }[],
  topN: number,
  k: number = 60
): RetrievedChunk[] {
  const scores = new Map<string, { chunk: RetrievedChunk; score: number }>();

  for (const { results, weight } of legs) {
    results.forEach((chunk, rank) => {
      const contribution = weight * (1 / (k + rank + 1));
      const existing = scores.get(chunk.chunk_id);
      if (existing) {
        existing.score += contribution;
      } else {
        scores.set(chunk.chunk_id, { chunk, score: contribution });
      }
    });
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ chunk }) => chunk);
}

/**
 * Hybrid search: dense (vector) + full-text (keyword on content), merged with RRF.
 * The re-embedding pipeline prepends Chapter/Topic/Subtopic to each chunk's embedding text,
 * so topic-level retrieval is handled by the dense leg without needing a separate metadata leg.
 */
export async function hybridSearch(
  vector: number[],
  query: string,
  grade: number | string,
  subject: string,
  chapter_index?: string | null,
  limit: number = TOP_K,
  book?: string | null
): Promise<RetrievedChunk[]> {
  console.log("[qdrant] hybridSearch: running dense + full-text in parallel | book:", book ?? "(none)");

  const [denseResults, fullTextResults] = await Promise.all([
    searchChunks(vector, grade, subject, chapter_index, book),
    searchChunksByFullText(query, grade, subject, chapter_index, limit, book),
  ]);

  console.log("[qdrant] hybridSearch: dense=", denseResults.length, "| full-text=", fullTextResults.length);

  const merged = rrfMerge(
    [
      { results: denseResults, weight: 1.0 },
      { results: fullTextResults, weight: 0.8 },
    ],
    limit
  );
  console.log("[qdrant] hybridSearch: merged=", merged.length);
  return merged;
}

// ─── Learn Mode: topic-filtered search ────────────────────────────────────

/**
 * Get all unique topics for a given chapter from Qdrant (used for Learn Mode sidebar + teaching flow).
 * Returns topics sorted by topic_index so the AI can teach in curriculum order.
 */
export async function getChapterTopicsFromQdrant(
  grade: number | string,
  subject: string,
  chapterIndex: number | string,
  book?: string | null
): Promise<{ topic_index: string; topic_name: string }[]> {
  const chIdx = String(chapterIndex);

  try {
    // Scroll up to 300 points to capture all unique topics in a chapter
    const result = await getQdrant().scroll(COLLECTION, {
      filter: buildNcertPayloadFilter(grade, subject, chIdx, book ?? null),
      limit: 300,
      with_payload: true,
      with_vector: false,
    });

    const seen = new Map<string, string>();
    for (const point of result.points) {
      const p = flattenNcertPayload((point.payload ?? {}) as Record<string, unknown>);
      const rawTi = p.topic_index;
      const ti =
        rawTi != null && String(rawTi).trim() !== "" ? String(rawTi).trim() : undefined;
      const tn = p.topic_name != null ? String(p.topic_name) : undefined;
      if (ti && !seen.has(ti)) {
        seen.set(ti, tn && tn.trim() !== "" ? tn : ti);
      }
    }

    // Sort numerically by topic_index ("1.0" < "1.1" < "1.2")
    return Array.from(seen.entries())
      .sort((a, b) => {
        const partsA = a[0].split(".").map(Number);
        const partsB = b[0].split(".").map(Number);
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
          if (diff !== 0) return diff;
        }
        return 0;
      })
      .map(([topic_index, topic_name]) => ({ topic_index, topic_name }));
  } catch (err) {
    console.error("[qdrant] getChapterTopicsFromQdrant failed:", err);
    return [];
  }
}

/**
 * Get all unique chapters for a subject+grade from Qdrant.
 * Returns chapters sorted by chapter_index.
 */
export async function getChapterListFromQdrant(
  grade: number | string,
  subject: string,
  book?: string | null
): Promise<{ chapter_index: string; chapter_name: string }[]> {
  const seen = new Map<string, string>();
  let scrollOffset: string | number | undefined = undefined;
  const batchLimit = 250; // larger batch = fewer round trips
  const maxPages = 4;     // cap at 1000 items max; NCERT has ≤30 chapters per subject

  try {
    for (let page = 0; page < maxPages; page++) {
      const result = await getQdrant().scroll(COLLECTION, {
        filter: buildNcertPayloadFilter(grade, subject, null, book ?? null),
        limit: batchLimit,
        with_payload: true,
        with_vector: false,
        ...(scrollOffset != null ? { offset: scrollOffset } : {}),
      });

      for (const point of result.points) {
        const p = flattenNcertPayload((point.payload ?? {}) as Record<string, unknown>);
        const raw = p.chapter_index;
        if (raw == null || raw === "") continue;
        const ci = String(raw);
        const cn = (p.chapter_name ?? p.chapter) as string | undefined;
        if (!seen.has(ci)) {
          const name = cn != null && String(cn).trim() !== "" ? String(cn) : `Chapter ${ci}`;
          seen.set(ci, name);
        }
      }

      const next = result.next_page_offset;
      if (!result.points.length || next == null) break;
      if (typeof next !== "string" && typeof next !== "number") break;
      scrollOffset = next;
    }

    return Array.from(seen.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([chapter_index, chapter_name]) => ({ chapter_index, chapter_name }));
  } catch (err) {
    console.error("[qdrant] getChapterListFromQdrant failed:", err);
    return [];
  }
}

function payloadToRetrievedChunk(id: string | number, payload: Record<string, unknown>): RetrievedChunk {
  const flat = flattenNcertPayload(payload);
  return {
    chunk_id: String(id ?? ""),
    content: String(flat.content ?? flat.text ?? ""),
    chapter_name: (flat.chapter_name ?? flat.chapter) as string | undefined,
    chapter_index: flat.chapter_index as string | undefined,
    topic_name: flat.topic_name as string | undefined,
    topic_index: flat.topic_index as string | undefined,
    subtopic_name: flat.subtopic_name as string | undefined,
    subtopic_index: flat.subtopic_index as string | undefined,
    page_start: flat.page_start as number | undefined,
    page_end: flat.page_end as number | undefined,
    chunk_type: flat.chunk_type as string | undefined,
    importance: flat.importance as string | undefined,
    referenced_figures: Array.isArray(flat.referenced_figures) ? (flat.referenced_figures as string[]) : undefined,
    relevance_score: 0.5,
  };
}

/** Deduplicate retrieved chunks by id (order preserved: first wins). */
export function dedupeRetrievedChunksById(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const map = new Map<string, RetrievedChunk>();
  for (const c of chunks) {
    if (c.chunk_id && !map.has(c.chunk_id)) map.set(c.chunk_id, c);
  }
  return [...map.values()];
}

function sortLearnChunksForPrompt(a: RetrievedChunk, b: RetrievedChunk): number {
  const sa = a.subtopic_index ?? "";
  const sb = b.subtopic_index ?? "";
  const sub = sa.localeCompare(sb, undefined, { numeric: true });
  if (sub !== 0) return sub;
  const pa = a.page_start ?? 0;
  const pb = b.page_start ?? 0;
  if (pa !== pb) return pa - pb;
  return a.chunk_id.localeCompare(b.chunk_id);
}

/**
 * Qdrant Cloud often has no keyword index on `topic_index`, so we must NOT filter by it server-side.
 * Compare topic ids loosely: "4.0" matches numeric 4 and string "4" where appropriate.
 */
export function sameTopicIndex(payloadValue: unknown, expected: string): boolean {
  const exp = expected.trim();
  if (!exp) return false;
  if (payloadValue == null || payloadValue === "") return false;
  const raw = String(payloadValue).trim();
  if (raw === exp) return true;
  const nPayload = Number(raw);
  const nExp = Number(exp);
  if (Number.isFinite(nPayload) && Number.isFinite(nExp) && nPayload === nExp) return true;
  return false;
}

/** Some ingest pipelines omit `topic_index` but encode it in `topic_name` (e.g. "Introduction (4.0)"). */
export function topicReferencedInName(topicName: string | undefined, expected: string): boolean {
  const exp = expected.trim();
  if (!exp || !topicName) return false;
  const re = new RegExp(`\\(\\s*${exp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\)`);
  return re.test(topicName);
}

export function chunkMatchesTopicIndices(chunk: RetrievedChunk, topicIndices: string[]): boolean {
  if (topicIndices.length === 0) return true;
  return topicIndices.some(
    (t) => sameTopicIndex(chunk.topic_index, t) || topicReferencedInName(chunk.topic_name, t)
  );
}

/**
 * Cap how much textbook text goes into the learn-mode prompt (token safety).
 */
export function capLearnChunksForPrompt(
  chunks: RetrievedChunk[],
  maxChunks = 48,
  maxChars = 52000
): RetrievedChunk[] {
  const sorted = [...chunks].sort(sortLearnChunksForPrompt);
  const out: RetrievedChunk[] = [];
  let chars = 0;
  for (const c of sorted) {
    if (out.length >= maxChunks) break;
    if (chars + c.content.length > maxChars && out.length >= 8) break;
    out.push(c);
    chars += c.content.length;
  }
  return out;
}

/**
 * Pull all indexed passages for one chapter topic from Qdrant (ordered for teaching).
 * Use this in Learn Mode so the tutor sees the full topic corpus, not just top‑K semantic hits.
 */
export async function scrollChunksForLearnTopic(
  grade: number | string,
  subject: string,
  chapterIndex: number | string,
  topicIndex: string,
  maxPoints = 200,
  book?: string | null
): Promise<RetrievedChunk[]> {
  const chIdx = String(chapterIndex);

  // Only filter on fields that are indexed in Qdrant (grade, subject, chapter_index).
  // topic_index is applied in-process — Cloud clusters without a topic_index keyword index
  // return 400 if we filter on it in scroll/search.
  const chapterFilter = buildNcertPayloadFilter(grade, subject, chIdx, book ?? null);

  const all: RetrievedChunk[] = [];
  let scrollOffset: string | number | undefined = undefined;

  try {
    while (all.length < maxPoints) {
      const batch = 100;
      const result = await getQdrant().scroll(COLLECTION, {
        filter: chapterFilter,
        limit: batch,
        with_payload: true,
        with_vector: false,
        ...(scrollOffset != null ? { offset: scrollOffset } : {}),
      });

      for (const point of result.points) {
        const payload = (point.payload ?? {}) as Record<string, unknown>;
        const chunk = payloadToRetrievedChunk(point.id as string | number, payload);
        if (sameTopicIndex(chunk.topic_index, topicIndex) || topicReferencedInName(chunk.topic_name, topicIndex)) {
          all.push(chunk);
          if (all.length >= maxPoints) break;
        }
      }

      const next = result.next_page_offset;
      if (!result.points.length || next == null) break;
      if (typeof next !== "string" && typeof next !== "number") break;
      scrollOffset = next;
    }
  } catch (err) {
    console.error("[qdrant] scrollChunksForLearnTopic failed:", err);
    return [];
  }

  console.log("[qdrant] scrollChunksForLearnTopic | topic:", topicIndex, "| points:", all.length);
  return dedupeRetrievedChunksById(all).sort(sortLearnChunksForPrompt);
}

/**
 * Learn Mode search — same hybrid pipeline as hybridSearch() but filtered to
 * specific topic_indices (the expanding window of topics taught so far).
 */
export async function searchLearnChunks(
  vector: number[],
  query: string,
  grade: number | string,
  subject: string,
  chapterIndex: number | string,
  topicIndices: string[],
  topK: number = 12,
  book?: string | null
): Promise<RetrievedChunk[]> {
  const chIdx = String(chapterIndex);

  const baseFilter = buildNcertPayloadFilter(grade, subject, chIdx, book ?? null);

  const restrictTopics = topicIndices.length > 0;
  const denseFetchLimit = restrictTopics ? Math.min(150, Math.max(topK * 12, 60)) : topK;
  const ftFetchLimit = restrictTopics ? Math.min(100, Math.max(topK * 8, 40)) : topK;

  console.log("[qdrant] searchLearnChunks | chapter:", chIdx, "| topics (post-filter):", topicIndices.join(", ") || "(any)");

  const [denseResults, ftResults] = await Promise.all([
    (async () => {
      try {
        const res = await getQdrant().search(COLLECTION, {
          vector,
          limit: denseFetchLimit,
          filter: baseFilter,
          with_payload: true,
        });
        const mapped = res.filter((p) => (p.score ?? 0) >= MIN_SCORE).map((p) => {
          const payload = flattenNcertPayload((p.payload ?? {}) as Record<string, unknown>);
          return {
            chunk_id: String(p.id ?? ""),
            content: String(payload.content ?? payload.text ?? ""),
            chapter_name: (payload.chapter_name ?? payload.chapter) as string | undefined,
            chapter_index: payload.chapter_index as string | undefined,
            topic_name: payload.topic_name as string | undefined,
            topic_index: payload.topic_index as string | undefined,
            subtopic_name: payload.subtopic_name as string | undefined,
            subtopic_index: payload.subtopic_index as string | undefined,
            page_start: payload.page_start as number | undefined,
            page_end: payload.page_end as number | undefined,
            chunk_type: payload.chunk_type as string | undefined,
            importance: payload.importance as string | undefined,
            referenced_figures: Array.isArray(payload.referenced_figures) ? (payload.referenced_figures as string[]) : undefined,
            relevance_score: p.score ?? 0,
          } as RetrievedChunk;
        });
        return restrictTopics ? mapped.filter((c) => chunkMatchesTopicIndices(c, topicIndices)) : mapped;
      } catch (err) {
        console.error("[qdrant] searchLearnChunks dense failed:", err);
        return [] as RetrievedChunk[];
      }
    })(),
    (async () => {
      try {
        const ftMust = [...((baseFilter.must as Record<string, unknown>[]) ?? []), { key: "content", match: { text: query } }];
        const res = await getQdrant().scroll(COLLECTION, {
          filter: { must: ftMust },
          limit: ftFetchLimit,
          with_payload: true,
          with_vector: false,
        });
        const mapped = res.points.map((p) => {
          const payload = flattenNcertPayload((p.payload ?? {}) as Record<string, unknown>);
          return {
            chunk_id: String(p.id ?? ""),
            content: String(payload.content ?? payload.text ?? ""),
            chapter_name: (payload.chapter_name ?? payload.chapter) as string | undefined,
            chapter_index: payload.chapter_index as string | undefined,
            topic_name: payload.topic_name as string | undefined,
            topic_index: payload.topic_index as string | undefined,
            subtopic_name: payload.subtopic_name as string | undefined,
            subtopic_index: payload.subtopic_index as string | undefined,
            page_start: payload.page_start as number | undefined,
            page_end: payload.page_end as number | undefined,
            chunk_type: payload.chunk_type as string | undefined,
            importance: payload.importance as string | undefined,
            referenced_figures: Array.isArray(payload.referenced_figures) ? (payload.referenced_figures as string[]) : undefined,
            relevance_score: 0.5,
          } as RetrievedChunk;
        });
        return restrictTopics ? mapped.filter((c) => chunkMatchesTopicIndices(c, topicIndices)) : mapped;
      } catch {
        return [] as RetrievedChunk[];
      }
    })(),
  ]);

  const mergeCap = restrictTopics ? Math.max(topK * 4, 48) : topK;
  const merged = rrfMerge(
    [
      { results: denseResults, weight: 1.0 },
      { results: ftResults, weight: 0.8 },
    ],
    mergeCap
  );
  return merged;
}

const RRF_K = 60;

/** Tokenize text into terms (lowercase, split on non-alphanumeric) */
function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((s) => s.length > 0));
}

/** Hybrid: RRF merge of vector ranking + lexical ranking. Boosts chunks with exact query terms. */
export function hybridRerank(chunks: RetrievedChunk[], query: string, topK = 5): RetrievedChunk[] {
  console.log("[qdrant] hybridRerank: input chunks=", chunks.length, "| query=", query.slice(0, 80));
  if (chunks.length === 0) return [];
  const terms = tokenize(query);
  if (terms.size === 0) return chunks.slice(0, topK);

  const withLexical = chunks.map((c) => {
    const contentLower = c.content.toLowerCase();
    let matches = 0;
    for (const t of terms) {
      if (contentLower.includes(t)) matches++;
    }
    return { chunk: c, lexicalScore: matches / terms.size };
  });

  const byLexical = [...withLexical].sort((a, b) => b.lexicalScore - a.lexicalScore);

  const rrfScores = new Map<string, number>();
  chunks.forEach((c, i) => {
    const rv = 1 / (RRF_K + i + 1);
    rrfScores.set(c.chunk_id, (rrfScores.get(c.chunk_id) ?? 0) + rv);
  });
  byLexical.forEach(({ chunk }, i) => {
    const rl = 1 / (RRF_K + i + 1);
    rrfScores.set(chunk.chunk_id, (rrfScores.get(chunk.chunk_id) ?? 0) + rl);
  });

  const reranked = chunks
    .sort((a, b) => (rrfScores.get(b.chunk_id) ?? 0) - (rrfScores.get(a.chunk_id) ?? 0))
    .slice(0, topK);
  console.log("[qdrant] hybridRerank output: top", topK, "chunks | chunk_ids:", reranked.map((c) => c.chunk_id).join(", "));
  reranked.forEach((c, i) => {
    console.log("[qdrant]   ", i + 1, "| chunk_id:", c.chunk_id, "| chapter:", c.chapter_name ?? "—", "| ch_idx:", c.chapter_index ?? "—", "| topic:", c.topic_name ?? "—", "| subtopic:", c.subtopic_name ?? "—", "| content_preview:", c.content.slice(0, 80) + "...");
  });
  return reranked;
}

/**
 * Bulk-fetches ALL chunks matching a chapter/topic scope from Qdrant.
 *
 * Used for notes and summary generation where we want COMPLETE coverage of a
 * topic, not just the top-K most relevant chunks. Does NOT use vector search.
 *
 * Uses Qdrant's scroll API to paginate through all matching points.
 * Handles chapters with >100 chunks (typical science chapter: 30–80 chunks).
 *
 * @param grade         e.g. 10
 * @param subject       e.g. "science" — must match the value stored in Qdrant payload
 * @param chapterIndex  e.g. "1" — the chapter_index stored in Qdrant payload
 * @param topicIndices  null = all topics in chapter; ["1.1","1.2"] = specific topics only
 * @param ncertBook     for SST subjects (e.g. "history", "geography") — narrows to correct book.
 *                      Pass null for science, maths.
 * @returns             All matching chunks, sorted ascending by chunk_index / page_start
 */
export async function fetchAllChunksForScope(
  grade: number | string,
  subject: string,
  chapterIndex: string,
  topicIndices: string[] | null,
  ncertBook: string | null
): Promise<RetrievedChunk[]> {
  const baseFilter = buildNcertPayloadFilter(grade, subject, chapterIndex, ncertBook);

  const allChunks: RetrievedChunk[] = [];
  let scrollOffset: string | number | undefined = undefined;
  const SCROLL_BATCH_SIZE = 100;

  try {
    do {
      const result = await getQdrant().scroll(COLLECTION, {
        filter: baseFilter,
        limit: SCROLL_BATCH_SIZE,
        with_payload: true,
        with_vector: false,
        ...(scrollOffset != null ? { offset: scrollOffset } : {}),
      });

      for (const point of result.points) {
        const chunk = payloadToRetrievedChunk(
          point.id as string | number,
          (point.payload ?? {}) as Record<string, unknown>
        );

        // Apply topic filter in-process (same pattern as scrollChunksForLearnTopic)
        if (topicIndices && topicIndices.length > 0) {
          if (!chunkMatchesTopicIndices(chunk, topicIndices)) continue;
        }

        allChunks.push(chunk);
      }

      const next = result.next_page_offset;
      if (!result.points.length || next == null) break;
      if (typeof next !== "string" && typeof next !== "number") break;
      scrollOffset = next;
    } while (true);
  } catch (err) {
    console.error("[qdrant] fetchAllChunksForScope failed:", err);
    return [];
  }

  // Sort by page_start then chunk_id so sections are in document (reading) order
  allChunks.sort((a, b) => {
    const pa = a.page_start ?? 0;
    const pb = b.page_start ?? 0;
    if (pa !== pb) return pa - pb;
    return a.chunk_id.localeCompare(b.chunk_id);
  });

  console.log(
    `[qdrant] fetchAllChunksForScope: ${allChunks.length} chunks | ` +
    `subject=${subject} ch=${chapterIndex} topics=${topicIndices ? topicIndices.join(",") : "all"}`
  );

  return allChunks;
}
