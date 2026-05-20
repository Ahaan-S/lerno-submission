/**
 * Shared types + normalisation + client prefetch cache for instant Study Feed open.
 */

export type StudyFeedOption = {
    id: string;
    text: string;
    is_correct: boolean;
    image_url?: string;
};

export type CaseStudySubPart = {
    question_text: string;
    marks: number;
    model_answer: string | null;
    key_points: string[] | null;
    solution_text: string | null;
    solution_steps: Array<{ step: number; text: string; explanation: string }> | null;
};

export type StudyFeedQuestion = {
    id: string;
    subject: string;
    chapter_name: string;
    chapter_index: number;
    topic_name: string;
    question_type: string;
    question_text: string;
    question_image_url: string | null;
    marks: number;
    difficulty: string;
    estimated_time_secs: number;
    options: StudyFeedOption[] | null;
    correct_option: string | null;
    blank_answer: string | null;
    blank_answers_alt: string[] | null;
    blank_tolerance: string | null;
    numeric_range: { min: number; max: number } | null;
    match_left: string[] | null;
    match_right: string[] | null;
    match_correct: Record<string, number> | null;
    model_answer: string | null;
    key_points: string[] | null;
    marking_scheme: Array<{ point: string; marks: number }> | null;
    min_words: number | null;
    hints: string[] | null;
    solution_text: string | null;
    /** Ordered worked solution; each step may include a short explanation. */
    solution_steps: Array<{ step: number; text: string; explanation: string }> | null;
    common_mistakes: string[] | null;
    /** e.g. ncert_exercise, ncert_intext, ncert_exemplar, pyq, sqp, ai_generated */
    source: string;
    pyq_year: number | null;
    pyq_set_code: string | null;
    sqp_year: number | null;
    sqp_set_code: string | null;
    ncert_ref: string | null;
    /** case_study only: ordered sub-questions */
    sub_parts: CaseStudySubPart[] | null;
};

export type StudyFeedFilters = {
    subjects: string[];
    chapters: number[];
    difficulties: string[];
    questionTypes: string[];
    marks: number[];
    sources: string[];
};

export const DEFAULT_FILTERS: StudyFeedFilters = {
    subjects: [],
    chapters: [],
    difficulties: [],
    questionTypes: [],
    marks: [],
    sources: [],
};

export function countActiveFilters(f: StudyFeedFilters): number {
    return (
        f.subjects.length +
        f.chapters.length +
        f.difficulties.length +
        f.questionTypes.length +
        f.marks.length +
        f.sources.length
    );
}

export type StudyFeedMeta = {
    grade: number;
    subjects: string[] | null;
    chapters: number[] | null;
    difficulty: string[] | null;
    question_types: string[] | null;
    marks: number[] | null;
    weak_topics_only: boolean;
    candidate_pool_size?: number;
};

export function normaliseStudyFeedQuestions(raw: unknown[]): StudyFeedQuestion[] {
    return raw.map((r) => {
        const o = r as Record<string, unknown>;
        return {
            id: String(o.id),
            subject: String(o.subject ?? ""),
            chapter_name: String(o.chapter_name ?? ""),
            chapter_index: Number(o.chapter_index ?? 0),
            topic_name: String(o.topic_name ?? ""),
            question_type: String(o.question_type ?? "mcq"),
            question_text: String(o.question_text ?? ""),
            question_image_url: (o.question_image_url as string | null) ?? null,
            marks: Number(o.marks ?? 1),
            difficulty: String(o.difficulty ?? "medium"),
            estimated_time_secs: Number(o.estimated_time_secs ?? 60),
            options: (o.options as StudyFeedOption[] | null) ?? null,
            correct_option: (o.correct_option as string | null) ?? null,
            blank_answer: (o.blank_answer as string | null) ?? null,
            blank_answers_alt: (o.blank_answers_alt as string[] | null) ?? null,
            blank_tolerance: (o.blank_tolerance as string | null) ?? null,
            numeric_range: (o.numeric_range as { min: number; max: number } | null) ?? null,
            match_left: (o.match_left as string[] | null) ?? null,
            match_right: (o.match_right as string[] | null) ?? null,
            match_correct: (o.match_correct as Record<string, number> | null) ?? null,
            model_answer: (o.model_answer as string | null) ?? null,
            key_points: (o.key_points as string[] | null) ?? null,
            marking_scheme: (o.marking_scheme as Array<{ point: string; marks: number }> | null) ?? null,
            min_words: (o.min_words as number | null) ?? null,
            hints: (o.hints as string[] | null) ?? null,
            solution_text: (o.solution_text as string | null) ?? null,
            solution_steps: (() => {
                const raw = o.solution_steps;
                if (!Array.isArray(raw) || raw.length === 0) return null;
                return raw.map((row) => {
                    const r = row as Record<string, unknown>;
                    return {
                        step: Number(r.step ?? 0),
                        text: String(r.text ?? ""),
                        explanation: String(r.explanation ?? ""),
                    };
                });
            })(),
            common_mistakes: (o.common_mistakes as string[] | null) ?? null,
            source: String(o.source ?? "unknown"),
            pyq_year: (() => {
                const raw = o.pyq_year;
                if (raw == null || raw === "") return null;
                const n = Number(raw);
                return Number.isFinite(n) ? n : null;
            })(),
            pyq_set_code: (o.pyq_set_code as string | null) ?? null,
            sqp_year: (() => {
                const raw = o.sqp_year;
                if (raw == null || raw === "") return null;
                const n = Number(raw);
                return Number.isFinite(n) ? n : null;
            })(),
            sqp_set_code: (o.sqp_set_code as string | null) ?? null,
            ncert_ref: (o.ncert_ref as string | null) ?? null,
            sub_parts: (() => {
                const sp = o.sub_parts;
                if (!Array.isArray(sp) || sp.length === 0) return null;
                return sp.map((p: unknown) => {
                    const r = p as Record<string, unknown>;
                    return {
                        question_text: String(r.question_text ?? ""),
                        marks: Number(r.marks ?? 1),
                        model_answer: (r.model_answer as string | null) ?? null,
                        key_points: (r.key_points as string[] | null) ?? null,
                        solution_text: (r.solution_text as string | null) ?? null,
                        solution_steps: (() => {
                            const ss = r.solution_steps;
                            if (!Array.isArray(ss) || ss.length === 0) return null;
                            return ss.map((row) => {
                                const sr = row as Record<string, unknown>;
                                return {
                                    step: Number(sr.step ?? 0),
                                    text: String(sr.text ?? ""),
                                    explanation: String(sr.explanation ?? ""),
                                };
                            });
                        })(),
                    };
                });
            })(),
        };
    });
}

// ─── Prefetch cache (dashboard idle → study opens with session + questions) ─────

type PrefetchPayload = {
    sessionId: string;
    questions: unknown[];
    meta: StudyFeedMeta | null;
    fetchedAt: number;
};

let prefetchCache: PrefetchPayload | null = null;

/** Orphan warmup session ended when starting a new warmup (user stayed on dashboard). */
let pendingWarmupSessionId: string | null = null;
let warmupInFlight: Promise<void> | null = null;
let lastWarmupAt = 0;

const DEFAULT_PREFETCH_TTL_MS = 120_000;
const DEFAULT_WARMUP_COOLDOWN_MS = 90_000;

export function cacheStudyFeedPrefetch(
    sessionId: string,
    questions: unknown[],
    meta: StudyFeedMeta | null,
): void {
    prefetchCache = { sessionId, questions, meta, fetchedAt: Date.now() };
}

export function hasStudyFeedPrefetchFresh(ttlMs: number = DEFAULT_PREFETCH_TTL_MS): boolean {
    if (!prefetchCache) return false;
    return Date.now() - prefetchCache.fetchedAt <= ttlMs;
}

/** Returns payload and clears cache so the next navigation can warm again. */
export function takeStudyFeedPrefetchIfFresh(ttlMs: number): PrefetchPayload | null {
    if (!prefetchCache) return null;
    const age = Date.now() - prefetchCache.fetchedAt;
    if (age > ttlMs) {
        prefetchCache = null;
        return null;
    }
    const p = prefetchCache;
    prefetchCache = null;
    pendingWarmupSessionId = null;
    return p;
}

/**
 * Warm the feed while the student is on the dashboard (idle) so /study opens instantly.
 * Starts a real study_feed_sessions row and fetches the first batch.
 */
export async function runStudyFeedWarmup(batchSize = 5): Promise<void> {
    if (warmupInFlight) return warmupInFlight;
    if (hasStudyFeedPrefetchFresh(DEFAULT_PREFETCH_TTL_MS)) return;
    if (Date.now() - lastWarmupAt < DEFAULT_WARMUP_COOLDOWN_MS) return;

    lastWarmupAt = Date.now();
    warmupInFlight = (async () => {
        try {
            if (pendingWarmupSessionId) {
                void fetch("/api/study/session/end", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        session_id: pendingWarmupSessionId,
                        time_active_secs: 0,
                    }),
                }).catch(() => {});
                pendingWarmupSessionId = null;
            }

            const start = await fetch("/api/study/session/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ filters_applied: {}, entry_source: "dashboard" }),
            });
            if (!start.ok) return;
            const { session_id } = (await start.json()) as { session_id: string };
            pendingWarmupSessionId = session_id;

            const params = new URLSearchParams();
            params.set("session_id", session_id);
            params.set("batch_size", String(Math.min(6, Math.max(4, batchSize))));
            const res = await fetch(`/api/study/feed?${params.toString()}`, {
                credentials: "include",
            });
            if (!res.ok) return;
            const data = (await res.json()) as {
                questions?: unknown[];
                meta?: StudyFeedMeta;
            };
            const qs = data.questions ?? [];
            if (qs.length === 0) return;
            cacheStudyFeedPrefetch(session_id, qs, data.meta ?? null);
        } catch {
            /* ignore */
        } finally {
            warmupInFlight = null;
        }
    })();

    return warmupInFlight;
}

export function mergeQuestionsDedupe(
    prev: StudyFeedQuestion[],
    incoming: StudyFeedQuestion[],
): StudyFeedQuestion[] {
    const seen = new Set(prev.map((p) => p.id));
    const merged = [...prev];
    for (const q of incoming) {
        if (!seen.has(q.id)) {
            seen.add(q.id);
            merged.push(q);
        }
    }
    return merged;
}
