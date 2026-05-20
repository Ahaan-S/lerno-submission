"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
    mergeQuestionsDedupe,
    normaliseStudyFeedQuestions,
    takeStudyFeedPrefetchIfFresh,
    type StudyFeedFilters,
    type StudyFeedMeta,
    type StudyFeedOption,
    type StudyFeedQuestion,
} from "@/lib/study-feed-shared";
import { useStudyFeedShellHeaderWriter } from "@/components/dashboard/study-feed-header-context";
import {
    getAiTutorSubjectOptionsForGrade,
    getStudyFeedSubjectLabelsForGrade,
    SUBJECT_LABELS,
} from "@/lib/chapters";
import { track } from "@/lib/analytics";
import { ShareButton } from "@/components/social/ShareButton";
import { refreshStreakAfterActivity } from "@/lib/streak-client";
import { useDashboardGrade } from "@/lib/dashboard-context";

/** Fetch the next batch when fewer than this many cards remain ahead. */
const AHEAD_BUFFER = 3;
/** Cards per fetch request — small batches = fast responses. */
const FETCH_CHUNK = 6;
/** Preload images for this many cards ahead (1-2 is plenty). */
const IMAGE_PRELOAD_AHEAD = 2;
/** How many cards to keep mounted in the DOM around the current index. */
const RENDER_WINDOW_BEHIND = 1;
const RENDER_WINDOW_AHEAD = 4;
const PREFETCH_TTL_MS = 120_000;

// ─── Types (re-export for callers) ─────────────────────────────────────────────

export type StudyQuestionOption = StudyFeedOption;
export type StudyQuestion = StudyFeedQuestion;

type SessionStats = {
    questions_attempted: number;
    questions_correct: number;
    streak_peak: number;
};

type PersistedQuestionState = {
    selected: string | null;
    revealed: boolean;
    showBack: boolean;
    wasSkipped: boolean;
    hintLevel: number;
    textAnswer: string;
    subAnswers: Record<number, string>;
    matchSelections: Record<number, number>;
    selfAssessResult: "correct" | "partial" | "incorrect" | null;
    aiCheckResult: { marks: number; max_marks: number; remarks: string } | null;
    aiCheckError: string | null;
};

function formatFeedFilters(m: StudyFeedMeta): string {
    const parts: string[] = [`Grade ${m.grade}`];
    parts.push(m.subjects?.length ? `Subjects: ${m.subjects.join(", ")}` : "All subjects");
    parts.push(m.chapters?.length ? `Chapters: ${m.chapters.join(", ")}` : "All chapters");
    if (m.difficulty?.length) parts.push(`Difficulty: ${m.difficulty.join(", ")}`);
    if (m.question_types?.length) parts.push(`Types: ${m.question_types.join(", ")}`);
    if (m.marks?.length) parts.push(`Marks: ${m.marks.join(", ")}`);
    if (m.weak_topics_only) parts.push("Weak topics only");
    if (m.candidate_pool_size != null) parts.push(`${m.candidate_pool_size} in pool`);
    return parts.join(" · ");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSubject(s: string): string {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function normaliseFill(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^\w\s.]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function checkFillBlank(q: StudyQuestion, raw: string): boolean {
    const ans = normaliseFill(raw);
    if (!ans) return false;
    const primary = q.blank_answer ? normaliseFill(q.blank_answer) : "";
    if (primary && ans === primary) return true;
    const alts = q.blank_answers_alt ?? [];
    for (const a of alts) {
        if (normaliseFill(a) === ans) return true;
    }
    if (q.blank_tolerance === "numeric" && q.numeric_range) {
        const n = parseFloat(raw.replace(/,/g, "").trim());
        if (!Number.isNaN(n) && n >= q.numeric_range.min && n <= q.numeric_range.max) return true;
    }
    if (q.blank_tolerance === "fuzzy" || !q.blank_tolerance) {
        if (primary && (ans.includes(primary) || primary.includes(ans))) return true;
    }
    return false;
}

function checkMatch(q: StudyQuestion, mapping: Record<number, number>): boolean {
    const correct = q.match_correct;
    if (!correct) return false;
    const keys = Object.keys(correct);
    if (keys.length === 0) return false;
    for (const k of keys) {
        if (mapping[Number(k)] !== correct[k]) return false;
    }
    return true;
}

function hasOptionImages(q: StudyQuestion): boolean {
    const o = q.options?.[0];
    return !!(o && o.image_url);
}

function showQuestionDiagram(q: StudyQuestion): boolean {
    return !!(q.question_image_url && q.question_image_url !== "options");
}

/** Strip leading "Exemplar …" / "Exercise …" from ncert_ref so we don't repeat the source name. */
function ncertRefDisplaySuffix(source: string, ref: string): string {
    const r = ref.trim();
    if (!r) return "";
    if (source === "ncert_exemplar") {
        const rest = r.replace(/^exemplar\b[\s.:]*/i, "").trim();
        return rest || r;
    }
    if (source === "ncert_exercise") {
        const rest = r.replace(/^exercise\b[\s.:]*/i, "").trim();
        return rest || r;
    }
    return r;
}

/** Source + ref for the question card metadata row (NCERT kinds, PYQ, etc.). */
function formatQuestionSourceLabel(q: StudyQuestion): string | null {
    const src = (q.source ?? "").trim();
    if (!src || src === "unknown") return null;

    if (src === "pyq") {
        const parts: string[] = ["PYQ"];
        if (q.pyq_year != null) parts.push(String(q.pyq_year));
        const code = q.pyq_set_code?.trim();
        if (code) parts.push(code);
        return parts.join(" · ");
    }
    if (src === "sqp") {
        const parts: string[] = ["SQP"];
        const year = q.sqp_year ?? q.pyq_year;
        if (year != null) parts.push(String(year));
        const rawCode = (q.sqp_set_code ?? q.pyq_set_code)?.trim();
        if (rawCode) {
            // Extract "Set N" — find "set" (case-insensitive), ignore anything before it,
            // strip separators between "set" and the number/identifier.
            const match = rawCode.match(/set[\s\-_]*(\w+)/i);
            parts.push(match ? `Set ${match[1]}` : rawCode);
        }
        return parts.join(" · ");
    }

    const ncertLabels: Record<string, string> = {
        ncert_exercise: "NCERT Exercise",
        ncert_intext: "NCERT Intext",
        ncert_exemplar: "NCERT Exemplar",
    };
    const base = ncertLabels[src];
    if (base) {
        const rawRef = q.ncert_ref?.trim();
        if ((src === "ncert_exercise" || src === "ncert_exemplar") && rawRef) {
            const suffix = ncertRefDisplaySuffix(src, rawRef);
            return suffix ? `${base} · ${suffix}` : base;
        }
        return base;
    }

    if (src === "ai_generated") return "AI generated";
    return src.replace(/_/g, " ");
}

function formatMarksLabel(marks: number): string {
    const n = Number(marks);
    if (!Number.isFinite(n)) return "—";
    if (n === 1) return "1 mark";
    return `${n} marks`;
}

/** Compact marks for narrow study cards (e.g. mobile). */
function formatMarksLabelShort(marks: number): string {
    const n = Number(marks);
    if (!Number.isFinite(n)) return "—";
    if (n === 1) return "1 M";
    return `${n}M`;
}

const META_SEP_CLASS = "mx-1.5 text-[var(--base-600)] select-none";

/** Markdown body classes: 18px medium question stem, left-aligned for readability. */
const STUDY_QUESTION_MARKDOWN_BODY =
    "text-left text-[14px] sm:text-[18px] font-medium leading-relaxed [&_p]:text-[14px] [&_p]:sm:text-[18px] [&_p]:font-medium [&_p]:leading-relaxed [&_p]:mb-3 [&_p]:last:mb-0 [&_li]:text-[14px] [&_li]:sm:text-[18px] [&_li]:font-medium [&_ul]:my-2 [&_ol]:my-2";

/** Remove whole lines like `[Diagram: …]` / `[Diagram …]` (alt/fallback text when the image loads). */
function stripDiagramPlaceholderLines(raw: string): string {
    const cleaned = raw
        .replace(/\r\n/g, "\n")
        .split("\n")
        .filter((line) => {
            const t = line.trim();
            if (!t) return true;
            return !/^\[Diagram[^\]]*\]\s*$/i.test(t);
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return cleaned;
}

/** Preserve intentional single newlines as Markdown hard line breaks within each block. */
function prepareStudyQuestionMarkdown(raw: string): string {
    const t = raw.replace(/\r\n/g, "\n").trim();
    if (!t) return "";
    return t
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => block.replace(/([^\n])\n/g, "$1  \n"))
        .join("\n\n");
}

/** Capitalize the first real letter of an option string, skipping LaTeX safely. */
function capitalizeFirstLetter(s: string): string {
    if (!s) return s;
    const trimmed = s.trimStart();
    // Pure math option (starts with $ or \) — never touch it
    if (trimmed.startsWith("$") || trimmed.startsWith("\\")) return s;
    for (let i = 0; i < s.length; i++) {
        if (/[a-z]/i.test(s[i])) {
            // Letter is part of a LaTeX command — bail out entirely
            if (i > 0 && s[i - 1] === "\\") return s;
            return s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
        }
    }
    return s;
}

/**
 * Lightweight inline renderer for MCQ option text.
 * Handles KaTeX math, bold/italic, code — renders without block-level margins.
 * katex CSS is already loaded via MarkdownRenderer on the same page.
 */
function OptionContent({ text }: { text: string }) {
    const content = capitalizeFirstLetter(text.trim());
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
            components={{
                // Unwrap paragraph so it renders inline inside the button
                p: ({ children }) => <span className="leading-tight">{children}</span>,
                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => (
                    <code className="font-mono text-[0.9em] bg-black/5 rounded px-0.5">{children}</code>
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

/**
 * Markdown + KaTeX for short strings (match columns, chips). No MCQ capitalization.
 */
function RichLine({ text }: { text: string }) {
    const content = text.trim();
    if (!content) return null;
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
            components={{
                p: ({ children }) => <span className="leading-snug inline-block w-full">{children}</span>,
                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => (
                    <code className="font-mono text-[0.9em] bg-black/5 rounded px-0.5">{children}</code>
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

const KATEX_OPTIONS = {
    throwOnError: false,
    strict: "ignore" as const,
    macros: {
        "\\Dfrac": "\\dfrac",
        "\\Frac": "\\frac",
        "\\Text": "\\text",
        "\\Cdot": "\\cdot",
        "\\Times": "\\times",
        "\\Sqrt": "\\sqrt",
        "\\Sin": "\\sin",
        "\\Cos": "\\cos",
        "\\Tan": "\\tan",
        "\\Cot": "\\cot",
        "\\Sec": "\\sec",
        "\\Cosec": "\\csc",
        "\\Csc": "\\csc",
        "\\ArcSin": "\\arcsin",
        "\\ArcCos": "\\arccos",
        "\\ArcTan": "\\arctan",
        "\\Degree": "^\\circ",
        "\\degree": "^\\circ",
        "\\Circ": "\\circ",
    },
};

/** Short answer (2m/3m): cap to keep AI evaluation input tokens manageable. */
const SHORT_ANS_MAX_WORDS = 200;
/** Long answer (5m): larger cap — still limits input tokens but gives more room. */
const LONG_ANS_MAX_WORDS = 500;

function countWords(s: string): number {
    const t = s.trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
}

/** Truncate to at most `max` words (whitespace-separated). */
function clampToMaxWords(text: string, max: number): string {
    if (!text) return text;
    const words = text.split(/\s+/);
    if (words.length <= max) return text;
    return words.slice(0, max).join(" ");
}

/** Tighter MarkdownRenderer for list rows / side panels (full GFM + math like Solution). */
const STUDY_COMPACT_MD =
    "text-[14px] leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_li]:leading-snug";

const STUDY_COMPACT_MD_ROSE =
    "text-[14px] leading-relaxed text-rose-900 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-rose-950 [&_code]:bg-rose-100/70";

// ─── Question card ──────────────────────────────────────────────────────────────

function DifficultyBadge({ d }: { d: string }) {
    const tone =
        d === "easy"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : d === "hard"
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : "bg-amber-50 text-amber-900 border-amber-200";
    return (
        <span
            className={`text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full border capitalize shrink-0 ${tone}`}
            style={{ fontFamily: "var(--font-inter)" }}
        >
            {d}
        </span>
    );
}

// ─── AI grade card ────────────────────────────────────────────────────────────

function AiGradeCard({
    checking,
    result,
    maxMarks,
}: {
    checking: boolean;
    result: { marks: number; max_marks: number; remarks: string } | null;
    maxMarks: number;
}) {
    if (checking) {
        return (
            <div className="rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-3.5 flex items-center gap-3" style={{ fontFamily: "var(--font-inter)" }}>
                {/* Pulsing spinner */}
                <div className="w-7 h-7 rounded-full border-2 border-[var(--base-200)] border-t-[var(--primary-400)] animate-spin shrink-0" aria-hidden />
                <div className="space-y-1">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--base-500)]">AI Grade</p>
                    <p className="text-[13px] text-[var(--base-600)]">Grading your answer…</p>
                </div>
            </div>
        );
    }

    if (!result) return null;

    const ratio = maxMarks > 0 ? result.marks / maxMarks : 0;
    const tone = ratio >= 1
        ? { bar: "bg-emerald-400", border: "border-emerald-200", bg: "bg-emerald-50", score: "text-emerald-700", label: "text-emerald-600" }
        : ratio >= 0.4
          ? { bar: "bg-amber-400", border: "border-amber-200", bg: "bg-amber-50", score: "text-amber-700", label: "text-amber-600" }
          : { bar: "bg-rose-400", border: "border-rose-200", bg: "bg-rose-50", score: "text-rose-700", label: "text-rose-600" };

    return (
        <div className={`rounded-xl border ${tone.border} ${tone.bg} overflow-hidden`} style={{ fontFamily: "var(--font-inter)" }}>
            {/* Score bar */}
            <div className="h-1 bg-black/5 w-full">
                <div
                    className={`h-full ${tone.bar} transition-all duration-500`}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                />
            </div>
            <div className="px-4 py-3 flex items-start gap-4">
                {/* Score number */}
                <div className="shrink-0 text-center">
                    <span className={`text-[28px] font-bold leading-none tabular-nums ${tone.score}`}>{result.marks}</span>
                    <span className={`text-[13px] font-medium ${tone.label} block`}>/{result.max_marks}</span>
                </div>
                {/* Divider */}
                <div className={`w-px self-stretch ${tone.border} border-l`} aria-hidden />
                {/* Label + remarks */}
                <div className="min-w-0 flex-1 space-y-0.5">
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${tone.label}`}>AI Grade</p>
                    {result.remarks && (
                        <p className={`text-[13px] leading-snug ${tone.score}`}>{result.remarks}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Question card ─────────────────────────────────────────────────────────────

type CardProps = {
    q: StudyQuestion;
    sessionId: string;
    persistedState?: PersistedQuestionState;
    onPersistState: (questionId: string, state: PersistedQuestionState) => void;
    onAttemptLogged: (
        stats: SessionStats | null,
        streakDelta?: number,
        opts?: { statsOnly?: boolean; scroll?: boolean },
    ) => void;
    onNext: () => void;
    startTimeRef: React.MutableRefObject<number>;
};

function QuestionCard({ q, sessionId, persistedState, onPersistState, onAttemptLogged, onNext, startTimeRef }: CardProps) {
    const [selected, setSelected] = useState<string | null>(null);
    const [revealed, setRevealed] = useState(false);
    const [wasSkipped, setWasSkipped] = useState(false);
    const [hintLevel, setHintLevel] = useState(0);
    const [busy, setBusy] = useState(false);

    const [textAnswer, setTextAnswer] = useState("");
    const [subAnswers, setSubAnswers] = useState<Record<number, string>>({});
    const [matchSelections, setMatchSelections] = useState<Record<number, number>>({});
    const [selfAssessResult, setSelfAssessResult] = useState<"correct" | "partial" | "incorrect" | null>(null);
    const [aiCheckResult, setAiCheckResult] = useState<{ marks: number; max_marks: number; remarks: string } | null>(null);
    const [aiChecking, setAiChecking] = useState(false);
    const [aiCheckError, setAiCheckError] = useState<string | null>(null);
    const [showBack, setShowBack] = useState(false);

    useEffect(() => {
        startTimeRef.current = Date.now();
        setSelected(persistedState?.selected ?? null);
        setRevealed(persistedState?.revealed ?? false);
        setShowBack(persistedState?.showBack ?? false);
        setWasSkipped(persistedState?.wasSkipped ?? false);
        setHintLevel(persistedState?.hintLevel ?? 0);
        setTextAnswer(persistedState?.textAnswer ?? "");
        setSubAnswers(persistedState?.subAnswers ?? {});
        setMatchSelections(persistedState?.matchSelections ?? {});
        setSelfAssessResult(persistedState?.selfAssessResult ?? null);
        setAiCheckResult(persistedState?.aiCheckResult ?? null);
        setAiChecking(false);
        setAiCheckError(persistedState?.aiCheckError ?? null);
    }, [q.id, startTimeRef]);

    useEffect(() => {
        onPersistState(q.id, {
            selected,
            revealed,
            showBack,
            wasSkipped,
            hintLevel,
            textAnswer,
            subAnswers,
            matchSelections,
            selfAssessResult,
            aiCheckResult,
            aiCheckError,
        });
    }, [
        q.id,
        selected,
        revealed,
        showBack,
        wasSkipped,
        hintLevel,
        textAnswer,
        subAnswers,
        matchSelections,
        selfAssessResult,
        aiCheckResult,
        aiCheckError,
        onPersistState,
    ]);

    const hints = q.hints ?? [];
    const hintsShown = hintLevel > 0 ? hints.slice(0, hintLevel) : [];
    const hasSubParts = (q.sub_parts?.length ?? 0) > 0;
    const sourceLabel = formatQuestionSourceLabel(q);
    const hasQuestionDiagram = showQuestionDiagram(q);
    const questionMarkdownForCard = prepareStudyQuestionMarkdown(stripDiagramPlaceholderLines(q.question_text));

    const timeSecs = () =>
        Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));

    const postAttempt = async (body: Record<string, unknown>) => {
        const res = await fetch("/api/study/attempt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error ?? "Attempt failed");
        }
        return res.json() as Promise<{ ok: boolean; session_stats: SessionStats }>;
    };

    const logSkip = () => {
        if (busy || revealed) return;
        setWasSkipped(true);
        setRevealed(true);
        void postAttempt({
            session_id: sessionId,
            question_id: q.id,
            interaction_type: "skipped",
            hints_used: hintLevel,
            time_taken_secs: timeSecs(),
        })
            .then((data) => onAttemptLogged(data.session_stats, 0))
            .catch((e) => console.error(e));
    };

    /** Reveal immediately; persist attempt in background (Instagram-style perceived speed). */
    const logAnswered = (payload: {
        answer_given?: string | null;
        selected_option?: string | null;
        is_correct: boolean | null;
        self_assessed_result?: string | null;
    }) => {
        if (busy || revealed) return;
        setBusy(true);
        setRevealed(true);
        setShowBack(true);
        const streakDelta = payload.is_correct === true ? 1 : 0;
        track("study_answer_submitted", {
            is_correct: payload.is_correct === true,
            question_type: q.question_type,
            subject: q.subject,
        });
        void postAttempt({
            session_id: sessionId,
            question_id: q.id,
            interaction_type: "answered",
            hints_used: hintLevel,
            time_taken_secs: timeSecs(),
            ...payload,
        })
            .then((data) => {
                onAttemptLogged(data.session_stats, streakDelta, { scroll: false });
                void refreshStreakAfterActivity();
            })
            .catch((e) => console.error(e))
            .finally(() => setBusy(false));
    };

    const handleMcqSubmit = () => {
        if (!selected || revealed) return;
        const opt = q.options?.find((o) => o.id === selected);
        const correct = opt?.is_correct === true;
        logAnswered({
            selected_option: selected,
            answer_given: selected,
            is_correct: correct,
        });
    };

    const handleTrueFalseSubmit = () => {
        if (!selected || revealed) return;
        const correct = selected === q.correct_option;
        logAnswered({
            selected_option: selected,
            answer_given: selected,
            is_correct: correct,
        });
    };

    const handleFillBlankSubmit = () => {
        if (revealed) return;
        const ok = checkFillBlank(q, textAnswer);
        logAnswered({
            answer_given: textAnswer,
            is_correct: ok,
        });
    };

    const handleMatchSubmit = () => {
        if (revealed) return;
        const ok = checkMatch(q, matchSelections);
        logAnswered({
            answer_given: JSON.stringify(matchSelections),
            is_correct: ok,
        });
    };

    /** Short/long answer: reveal the solution and show self-assess buttons. */
    const handleRevealAndSelfAssess = () => {
        if (revealed) return;
        setRevealed(true);
        setShowBack(true);
    };

    /** short_ans only: reveal + fire AI grading. Can be called from front face before or after reveal. */
    const handleAiCheck = () => {
        if (aiChecking || aiCheckResult) return;
        if (!revealed) {
            setRevealed(true);
            setShowBack(true);
        }
        setAiCheckError(null);
        setAiChecking(true);
        void (async () => {
            try {
                const res = await fetch("/api/study/evaluate/short", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ question_id: q.id, answer_given: textAnswer }),
                });
                const data = await res.json() as { marks?: number; max_marks?: number; remarks?: string; error?: string };
                if (!res.ok) throw new Error(data.error);
                const result = { marks: data.marks ?? 0, max_marks: data.max_marks ?? q.marks, remarks: data.remarks ?? "" };
                setAiCheckResult(result);
                const isCorrect = result.marks === result.max_marks ? true : result.marks === 0 ? false : null;
                void postAttempt({
                    session_id: sessionId,
                    question_id: q.id,
                    interaction_type: "answered",
                    hints_used: hintLevel,
                    time_taken_secs: timeSecs(),
                    answer_given: textAnswer,
                    is_correct: isCorrect,
                    ai_score: result.max_marks > 0 ? result.marks / result.max_marks : null,
                })
                    // short_ans is subjective — AI score doesn't affect streak
                    .then((d) => onAttemptLogged(d.session_stats, undefined, { scroll: false }))
                    .catch((e) => console.error(e));
            } catch (e) {
                console.error("[study] AI check failed:", e);
                const msg = e instanceof Error ? e.message : "Could not grade your answer.";
                setAiCheckError(msg);
            } finally {
                setAiChecking(false);
            }
        })();
    };

    const handleSelfAssess = (result: "correct" | "partial" | "incorrect") => {
        if (busy) return;
        setSelfAssessResult(result);
        setBusy(true);
        const isCorrect = result === "correct" ? true : result === "incorrect" ? false : null;
        // Self-assessed questions (long_ans, case_study, short_ans) don't affect streak —
        // we can't verify answers objectively, so neither correct nor incorrect should move it
        onAttemptLogged(null, undefined, { scroll: false });
        void postAttempt({
            session_id: sessionId,
            question_id: q.id,
            interaction_type: "answered",
            hints_used: hintLevel,
            time_taken_secs: timeSecs(),
            answer_given: hasSubParts ? JSON.stringify(subAnswers) : (textAnswer || null),
            is_correct: isCorrect,
            self_assessed_result: result,
        })
            .then((data) => onAttemptLogged(data.session_stats, undefined, { statsOnly: true }))
            .catch((e) => console.error(e))
            .finally(() => setBusy(false));
    };

    const optionGridClass = "grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 sm:gap-3 w-full min-w-0";

    /**
     * Option buttons: auto height on very narrow viewports; fixed height from sm+.
     */
    const MCQ_BTN_BASE =
        "mcq-btn relative w-full min-h-[3.25rem] min-[420px]:h-[5.5rem] sm:h-25 px-3 sm:px-4 py-3 min-[420px]:py-0 rounded-2xl text-center text-[13.5px] sm:text-[16px] font-medium sm:font-semibold select-none flex items-center justify-center overflow-hidden min-w-0";

    const mcqStateClass = (isSel: boolean, showResult: boolean, isCorrectOpt: boolean): string => {
        if (showResult) {
            if (isCorrectOpt) return "mcq-correct";
            if (isSel) return "mcq-wrong";
            return "mcq-dimmed";
        }
        return isSel ? "mcq-selected" : "cursor-pointer";
    };

    const renderOptions = () => {
        const opts = q.options ?? [];

        if (hasOptionImages(q)) {
            return (
                <div className={optionGridClass}>
                    {opts.map((o) => {
                        const sel = selected === o.id;
                        const show = revealed;
                        const isCor = o.is_correct;
                        return (
                            <button
                                key={o.id}
                                type="button"
                                disabled={revealed}
                                onClick={() => setSelected(o.id)}
                                className={`${MCQ_BTN_BASE} ${mcqStateClass(sel, show, isCor)} !h-auto aspect-square overflow-hidden`}
                            >
                                {o.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- Supabase storage URLs; no remotePatterns in next.config
                                    <img
                                        src={o.image_url}
                                        alt={o.text}
                                        className="absolute inset-0 w-full h-full object-contain p-2"
                                    />
                                ) : (
                                    <OptionContent text={o.text} />
                                )}
                            </button>
                        );
                    })}
                </div>
            );
        }

        return (
            <div className={optionGridClass}>
                {opts.map((o) => {
                    const sel = selected === o.id;
                    const show = revealed;
                    const isCor = o.is_correct;
                    return (
                        <button
                            key={o.id}
                            type="button"
                            disabled={revealed}
                            onClick={() => setSelected(o.id)}
                            className={`${MCQ_BTN_BASE} ${mcqStateClass(sel, show, isCor)}`}
                            style={{ fontFamily: "var(--font-inter)" }}
                        >
                            <span className="line-clamp-3 w-full">
                                <OptionContent text={o.text} />
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    };

    const hintAvailable = hints.length > 0 && hintLevel < hints.length;
    // "Hint" until first tap; "Hint 2" / "Hint 3" for subsequent; back to "Hint" (disabled) when exhausted
    const hintLabel = hintLevel === 0 || hintLevel >= hints.length ? "Hint" : `Hint ${hintLevel + 1}`;

    const footerActions = (
        onSubmit: () => void,
        submitLabel = "Submit answer",
        extraDisabled = false,
        showCheckAi = false,
    ) => {
        // When already revealed but viewing front, clicking submit just flips to the back face
        const isAlreadyRevealed = revealed && !showBack;
        const isSubmitDisabled = !isAlreadyRevealed && (busy || revealed || extraDisabled);
        const handleSubmitClick = isAlreadyRevealed ? () => setShowBack(true) : onSubmit;
        const aiDone = !!aiCheckResult;
        const isAiDisabled = aiChecking || aiDone || !textAnswer.trim();

        const renderSubmit = () => (
            <button
                type="button"
                disabled={isSubmitDisabled}
                onClick={handleSubmitClick}
                className="flex flex-1 min-w-0 items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14px] sm:text-[16px] font-medium sm:font-semibold transition-colors duration-75 cursor-pointer disabled:cursor-not-allowed"
                style={isSubmitDisabled
                    ? { backgroundColor: "var(--base-100)", color: "var(--base-300)" }
                    : { backgroundColor: "var(--primary-400)", color: "#fff" }
                }
            >
                {submitLabel}
            </button>
        );

        const renderAiCheck = (fullWidth: boolean) =>
            showCheckAi &&
            !revealed && (
                <button
                    type="button"
                    disabled={isAiDisabled}
                    onClick={handleAiCheck}
                    className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-[13px] sm:text-[14px] font-medium sm:font-semibold transition-opacity duration-75 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""}`}
                    style={{ backgroundColor: "var(--base-100)", color: "var(--base-600)", border: "2px solid var(--base-200)" }}
                    aria-label="AI Check"
                >
                    {aiChecking ? (
                        <div className="w-4 h-4 rounded-full border-2 border-[var(--base-300)] border-t-[var(--base-600)] animate-spin" aria-hidden />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M12 8V4H8" />
                            <rect width="16" height="12" x="4" y="8" rx="2" />
                            <path d="M2 14h2" /><path d="M20 14h2" />
                            <path d="M15 13v2" /><path d="M9 13v2" />
                        </svg>
                    )}
                    <span>{aiChecking ? "Checking…" : "AI Check"}</span>
                </button>
            );

        const hintBulb = (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 shrink-0"
                aria-hidden
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                />
            </svg>
        );

        const hintBtnDesktop =
            hints.length > 0 ? (
                <button
                    type="button"
                    disabled={busy || revealed || !hintAvailable}
                    onClick={() => setHintLevel((h) => Math.min(h + 1, hints.length))}
                    className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-[16px] font-semibold transition-opacity duration-75 disabled:opacity-40 cursor-pointer"
                    style={{
                        backgroundColor: "var(--primary-100)",
                        color: "var(--primary-400)",
                    }}
                    aria-label={hintLabel}
                >
                    {hintBulb}
                    <span>{hintLabel}</span>
                </button>
            ) : null;

        const hintBtnMobileIcon =
            hints.length > 0 ? (
                <button
                    type="button"
                    disabled={busy || revealed || !hintAvailable}
                    onClick={() => setHintLevel((h) => Math.min(h + 1, hints.length))}
                    className="flex shrink-0 w-12 items-center justify-center rounded-xl transition-opacity duration-75 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    style={{
                        backgroundColor: "var(--primary-100)",
                        color: "var(--primary-400)",
                    }}
                    aria-label={hintLabel}
                >
                    {hintBulb}
                </button>
            ) : null;

        return (
            <>
                {/* Mobile: submit + hint icon on one row; AI Check below (lg breakpoint matches shell) */}
                <div className="flex lg:hidden flex-col gap-2 min-w-0" style={{ fontFamily: "var(--font-inter)" }}>
                    <div className="flex flex-row gap-2 items-stretch min-w-0">
                        {renderSubmit()}
                        {hintBtnMobileIcon}
                    </div>
                    {renderAiCheck(true)}
                </div>
                {/* Desktop: submit, AI Check, full hint — single row */}
                <div
                    className="hidden lg:flex lg:flex-row lg:items-stretch lg:gap-3 mt-6 sm:mt-8 min-w-0"
                    style={{ fontFamily: "var(--font-inter)" }}
                >
                    {renderSubmit()}
                    {renderAiCheck(false)}
                    {hintBtnDesktop}
                </div>
            </>
        );
    };


    /** Split core into body (interaction UI) + footer (submit/hint actions) for mobile layout. */
    const coreParts = (): { body: React.ReactNode; footer: React.ReactNode } => {
        switch (q.question_type) {
            case "true_false": {
                const opts = q.options?.length
                    ? q.options
                    : [
                          { id: "a", text: "True", is_correct: q.correct_option === "a" },
                          { id: "b", text: "False", is_correct: q.correct_option === "b" },
                      ];
                return {
                    body: (
                        <div className="grid grid-cols-2 gap-3">
                            {opts.map((o) => {
                                const sel = selected === o.id;
                                const show = revealed;
                                const isCor = o.is_correct;
                                return (
                                    <button
                                        key={o.id}
                                        type="button"
                                        disabled={revealed}
                                        onClick={() => setSelected(o.id)}
                                        className={`${MCQ_BTN_BASE} ${mcqStateClass(sel, show, isCor)}`}
                                        style={{ fontFamily: "var(--font-inter)" }}
                                    >
                                        <OptionContent text={o.text} />
                                    </button>
                                );
                            })}
                        </div>
                    ),
                    footer: footerActions(handleTrueFalseSubmit, "Submit answer", !selected),
                };
            }
            case "fill_blank":
                return {
                    body: (
                        <input
                            type="text"
                            value={textAnswer}
                            onChange={(e) => setTextAnswer(e.target.value)}
                            disabled={revealed}
                            placeholder="Type your answer here..."
                            className="w-full rounded-xl px-5 py-4 text-[14px] sm:text-[16px] font-normal outline-none bg-[var(--base-100)] border-2 border-[var(--base-200)] placeholder:text-[var(--base-300)] focus:border-[var(--base-300)] transition-[border-color] duration-150"
                            style={{ fontFamily: "var(--font-inter)" }}
                        />
                    ),
                    footer: footerActions(handleFillBlankSubmit, "Submit answer", !textAnswer.trim()),
                };
            case "match_following": {
                const left = q.match_left ?? [];
                const right = q.match_right ?? [];
                return {
                    body: (
                        <div className="space-y-3">
                            {/* Column B reference */}
                            <div className="rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-2.5" style={{ fontFamily: "var(--font-inter)" }}>
                                    Column B
                                </p>
                                <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
                                    {right.map((r, j) => (
                                        <div key={j} className="flex items-start gap-2 min-w-0">
                                            <span
                                                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                                                style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-500)" }}
                                            >
                                                {String.fromCharCode(65 + j)}
                                            </span>
                                            <span className="text-[13px] text-[var(--base-700)] leading-snug min-w-0" style={{ fontFamily: "var(--font-inter)" }}>
                                                <RichLine text={r} />
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Left items with letter-pill selectors */}
                            <div className="space-y-2">
                                {left.map((l, i) => {
                                    const selectedJ = matchSelections[i];
                                    const hasSelection = typeof selectedJ === "number";
                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 transition-colors duration-100 ${hasSelection ? "border-[var(--primary-200)]" : "border-[var(--base-200)]"}`}
                                        >
                                            <span
                                                className="w-6 h-6 rounded-full text-[12px] font-bold shrink-0 flex items-center justify-center"
                                                style={{ backgroundColor: "var(--base-100)", color: "var(--base-500)" }}
                                            >
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0 text-[14px] text-[var(--base-800)]" style={{ fontFamily: "var(--font-inter)" }}>
                                                <RichLine text={l} />
                                            </div>
                                            <div className="flex gap-1.5 shrink-0">
                                                {right.map((_, j) => {
                                                    const letter = String.fromCharCode(65 + j);
                                                    const isPicked = selectedJ === j;
                                                    return (
                                                        <button
                                                            key={j}
                                                            type="button"
                                                            disabled={revealed}
                                                            onClick={() => setMatchSelections((m) => ({ ...m, [i]: j }))}
                                                            className={`w-8 h-8 rounded-full text-[13px] font-bold transition-all duration-100 flex items-center justify-center ${revealed ? "cursor-default" : "cursor-pointer"} ${isPicked ? "text-white shadow-sm" : "border border-[var(--base-200)] bg-[var(--base-100)] text-[var(--base-500)] hover:border-[var(--base-300)] hover:text-[var(--base-700)]"}`}
                                                            style={isPicked ? { backgroundColor: "var(--primary-400)" } : undefined}
                                                        >
                                                            {letter}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ),
                    footer: footerActions(
                        handleMatchSubmit,
                        "Submit answer",
                        !left.every((_, i) => typeof matchSelections[i] === "number"),
                    ),
                };
            }
            case "short_ans":
                return {
                    body: (
                        <textarea
                            value={textAnswer}
                            onChange={(e) => setTextAnswer(clampToMaxWords(e.target.value, SHORT_ANS_MAX_WORDS))}
                            disabled={revealed}
                            placeholder="Type your answer here..."
                            className="study-textarea-scroll w-full rounded-xl px-5 py-4 text-[14px] sm:text-[16px] font-normal outline-none bg-[var(--base-100)] border-2 border-[var(--base-200)] placeholder:text-[var(--base-300)] focus:border-[var(--base-300)] transition-[border-color] duration-150 resize-none h-32 lg:h-40 overflow-y-auto"
                            style={{ fontFamily: "var(--font-inter)" }}
                        />
                    ),
                    footer: footerActions(handleRevealAndSelfAssess, "Submit answer", !textAnswer.trim(), true),
                };
            case "long_ans":
            case "case_study": {
                const parts = q.sub_parts ?? [];
                if (parts.length > 0) {
                    const anyFilled = parts.some((_, i) => (subAnswers[i] ?? "").trim());
                    return {
                        body: (
                            <div className="space-y-4">
                                {parts.map((part, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex items-start gap-2">
                                            <span
                                                className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                                                style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-500)" }}
                                            >
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <MarkdownRenderer
                                                    content={part.question_text}
                                                    bodyClassName="text-[14px] font-medium leading-relaxed [&_p]:mb-1 [&_p:last-child]:mb-0"
                                                />
                                            </div>
                                            <span
                                                className="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded"
                                                style={{ backgroundColor: "var(--base-100)", color: "var(--base-500)" }}
                                            >
                                                {part.marks}m
                                            </span>
                                        </div>
                                        <textarea
                                            value={subAnswers[i] ?? ""}
                                            onChange={(e) => setSubAnswers((s) => ({ ...s, [i]: clampToMaxWords(e.target.value, LONG_ANS_MAX_WORDS) }))}
                                            disabled={revealed}
                                            placeholder="Type your answer here..."
                                            className="study-textarea-scroll w-full rounded-xl px-5 py-4 text-[14px] sm:text-[16px] font-normal outline-none bg-[var(--base-100)] border-2 border-[var(--base-200)] placeholder:text-[var(--base-300)] focus:border-[var(--base-300)] transition-[border-color] duration-150 resize-none h-28 overflow-y-auto"
                                            style={{ fontFamily: "var(--font-inter)" }}
                                        />
                                    </div>
                                ))}
                            </div>
                        ),
                        footer: footerActions(handleRevealAndSelfAssess, "Submit answer", !anyFilled),
                    };
                }
                return {
                    body: (
                        <textarea
                            value={textAnswer}
                            onChange={(e) => setTextAnswer(clampToMaxWords(e.target.value, LONG_ANS_MAX_WORDS))}
                            disabled={revealed}
                            placeholder="Type your answer here..."
                            className="study-textarea-scroll w-full rounded-xl px-5 py-4 text-[14px] sm:text-[16px] font-normal outline-none bg-[var(--base-100)] border-2 border-[var(--base-200)] placeholder:text-[var(--base-300)] focus:border-[var(--base-300)] transition-[border-color] duration-150 resize-none h-48 overflow-y-auto"
                            style={{ fontFamily: "var(--font-inter)" }}
                        />
                    ),
                    footer: footerActions(handleRevealAndSelfAssess, "Submit answer", !textAnswer.trim()),
                };
            }
            case "mcq":
            case "assertion_reasoning":
            default:
                return {
                    body: q.options && q.options.length > 0 ? (
                        renderOptions()
                    ) : (
                        <p className="text-sm text-rose-600" style={{ fontFamily: "var(--font-inter)" }}>
                            Missing options for this question.
                        </p>
                    ),
                    footer: footerActions(handleMcqSubmit, "Submit answer", !selected),
                };
        }
    };

    /** Desktop: body + footer together (existing split-scroll layout). */
    const core = () => {
        const { body, footer } = coreParts();
        return <>{body}{footer}</>;
    };

    // ─── Back-face computed values ─────────────────────────────────────────────

    const backFaceResult = (() => {
        if (!revealed) return null;
        if (wasSkipped) return { label: "Skipped", cls: "bg-slate-100 text-slate-700 border border-slate-200" };
        if (q.question_type === "mcq" || q.question_type === "assertion_reasoning" || q.question_type === "true_false") {
            const win = q.options?.find((o) => o.id === selected)?.is_correct ?? false;
            return win
                ? { label: "Correct", cls: "bg-emerald-50 text-emerald-900 border border-emerald-200" }
                : { label: "Incorrect", cls: "bg-rose-50 text-rose-900 border border-rose-200" };
        }
        if (q.question_type === "fill_blank") {
            return checkFillBlank(q, textAnswer)
                ? { label: "Correct", cls: "bg-emerald-50 text-emerald-900 border border-emerald-200" }
                : { label: "Incorrect", cls: "bg-rose-50 text-rose-900 border border-rose-200" };
        }
        if (q.question_type === "match_following") {
            return checkMatch(q, matchSelections)
                ? { label: "Correct", cls: "bg-emerald-50 text-emerald-900 border border-emerald-200" }
                : { label: "Incorrect", cls: "bg-rose-50 text-rose-900 border border-rose-200" };
        }
        if (q.question_type === "short_ans") {
            if (aiChecking) return { label: "Grading…", cls: "bg-[var(--base-100)] text-[var(--base-600)] border border-[var(--base-200)]" };
            if (aiCheckResult) {
                const ratio = aiCheckResult.max_marks > 0 ? aiCheckResult.marks / aiCheckResult.max_marks : 0;
                if (ratio >= 1) return { label: `${aiCheckResult.marks}/${aiCheckResult.max_marks} marks`, cls: "bg-emerald-50 text-emerald-900 border border-emerald-200" };
                if (ratio >= 0.4) return { label: `${aiCheckResult.marks}/${aiCheckResult.max_marks} marks`, cls: "bg-amber-50 text-amber-900 border border-amber-200" };
                return { label: `${aiCheckResult.marks}/${aiCheckResult.max_marks} marks`, cls: "bg-rose-50 text-rose-900 border border-rose-200" };
            }
            return null;
        }
        if (q.question_type === "long_ans" || q.question_type === "case_study") {
            if (!selfAssessResult) return null;
            if (selfAssessResult === "correct") return { label: "Got it", cls: "bg-emerald-50 text-emerald-900 border border-emerald-200" };
            if (selfAssessResult === "partial") return { label: "Partial", cls: "bg-amber-50 text-amber-900 border border-amber-200" };
            return { label: "Didn't know", cls: "bg-rose-50 text-rose-900 border border-rose-200" };
        }
        return null;
    })();


    // ─── Shared card header (used on both faces) ───────────────────────────────

    const cardHeaderJsx = (
        <div className="shrink-0 px-3 sm:px-4 pt-2 sm:pt-3.5 pb-2 sm:pb-3.5 flex items-center gap-2 justify-between border-b border-[var(--base-200)] min-w-0 overflow-hidden">
            {/* Left: subject (lg only) + chapter (truncated) + source */}
            <div className="flex flex-1 min-w-0 items-center gap-x-1.5 sm:gap-x-2 overflow-hidden">
                <span className="hidden lg:inline shrink-0 text-[13px] font-medium text-[var(--base-800)]">
                    {formatSubject(q.subject)}
                </span>
                <span className="hidden lg:inline text-[var(--base-400)] select-none shrink-0" aria-hidden>·</span>
                {/* Chapter — strict single-line truncation, takes remaining space */}
                <span
                    className="min-w-0 shrink truncate text-[12px] sm:text-[13px] font-medium text-[var(--base-700)] lg:font-normal lg:text-[var(--base-600)]"
                    title={q.chapter_name}
                >
                    {q.chapter_name}
                </span>
                {/* Source — always shown, small, never wraps */}
                {sourceLabel && (
                    <span className="shrink-0 text-[11px] sm:text-[12px] text-[var(--base-400)] whitespace-nowrap">
                        · {sourceLabel}
                    </span>
                )}
            </div>
            {/* Right: share + marks + difficulty — always compact */}
            <div className="flex items-center gap-1.5 shrink-0">
                <ShareButton resourceType="question" resourceId={q.id} variant="icon" />
                <span className="text-[11px] tabular-nums font-medium text-[var(--base-400)]">
                    {formatMarksLabelShort(q.marks)}
                </span>
                <DifficultyBadge d={q.difficulty} />
            </div>
        </div>
    );

    return (
        <div
            className="h-full min-h-0 max-h-full w-full"
            style={{ perspective: "900px", fontFamily: "var(--font-inter)" }}
        >
            <motion.div
                className="relative h-full w-full"
                style={{ transformStyle: "preserve-3d", willChange: "transform" }}
                animate={{ rotateY: showBack ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
            >
                {/* ── FRONT FACE ─────────────────────────────────────────────── */}
                <div
                    className="absolute inset-0 flex flex-col rounded-xl border border-[var(--base-300)] bg-white shadow-sm overflow-hidden"
                    style={{ backfaceVisibility: "hidden" }}
                >
                    {cardHeaderJsx}
                    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                        {/* ── Mobile: no inner scroll — only the snap feed scrolls between cards ── */}
                        {(() => {
                            const { body: mBody, footer: mFooter } = coreParts();
                            return (
                                <div className="lg:hidden flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden overflow-x-hidden">
                                    <div className="flex min-h-0 flex-1 flex-col">
                                        {/* Question + interaction — flex fills card; overflow clips (snap feed scrolls only) */}
                                        <div className="min-h-0 flex-1 space-y-5 overflow-hidden px-4 pt-6 pb-3 sm:px-6 sm:pt-8 min-w-0">
                                            {hintsShown.length > 0 && (
                                                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-3">
                                                    {hintsShown.map((h, i) => (
                                                        <div key={i} className="flex gap-2.5 items-center">
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                fill="none"
                                                                viewBox="0 0 24 24"
                                                                strokeWidth={1.5}
                                                                stroke="currentColor"
                                                                className="w-4 h-4 shrink-0 text-amber-500"
                                                                aria-hidden
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                                                                />
                                                            </svg>
                                                            <div className="text-[15px] text-amber-950 leading-relaxed min-w-0">
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm, remarkMath]}
                                                                    rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
                                                                    components={{ p: ({ children }) => <span>{children}</span> }}
                                                                >
                                                                    {h}
                                                                </ReactMarkdown>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="max-w-none text-[var(--base-800)]">
                                                <MarkdownRenderer
                                                    content={questionMarkdownForCard}
                                                    bodyClassName={STUDY_QUESTION_MARKDOWN_BODY}
                                                />
                                            </div>
                                            {hasQuestionDiagram && (
                                                <div className="flex justify-center w-full">
                                                    {/* eslint-disable-next-line @next/next/no-img-element -- Supabase storage */}
                                                    <img
                                                        src={q.question_image_url!}
                                                        alt=""
                                                        className="w-auto h-auto max-w-full object-contain select-none"
                                                        style={{ maxHeight: "clamp(140px, 35dvh, 360px)" }}
                                                    />
                                                </div>
                                            )}
                                            {/* Interaction body (options, inputs, match, etc.) */}
                                            <div className="space-y-3 min-w-0">{mBody}</div>
                                        </div>
                                        {/* Footer — mt-auto keeps submit at bottom when content is short */}
                                        <div className="mt-auto px-4 sm:px-6 pt-4 pb-6 sm:pb-8 min-w-0">
                                            {mFooter}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        {/* ── Desktop: split scroll containers (question / options) ── */}
                        <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
                            <div className="study-feed-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                                <div className="space-y-5 px-8 pt-8 pb-4 min-w-0">
                                    {hintsShown.length > 0 && (
                                        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-3">
                                            {hintsShown.map((h, i) => (
                                                <div key={i} className="flex gap-2.5 items-center">
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        strokeWidth={1.5}
                                                        stroke="currentColor"
                                                        className="w-4 h-4 shrink-0 text-amber-500"
                                                        aria-hidden
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                                                        />
                                                    </svg>
                                                    <div className="text-[15px] text-amber-950 leading-relaxed min-w-0">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm, remarkMath]}
                                                            rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
                                                            components={{ p: ({ children }) => <span>{children}</span> }}
                                                        >
                                                            {h}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="max-w-none text-[var(--base-800)]">
                                        <MarkdownRenderer
                                            content={questionMarkdownForCard}
                                            bodyClassName={STUDY_QUESTION_MARKDOWN_BODY}
                                        />
                                    </div>
                                    {hasQuestionDiagram && (
                                        <div className="flex justify-center w-full">
                                            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase storage */}
                                            <img
                                                src={q.question_image_url!}
                                                alt=""
                                                className="w-auto h-auto max-w-full object-contain select-none"
                                                style={{
                                                    maxHeight: "clamp(160px, calc(100dvh - 50px - min(448px, 48dvh) - 120px), 520px)",
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="study-feed-scroll shrink-0 max-h-[min(28rem,48vh)] min-h-0 overflow-y-auto overflow-x-hidden px-8 pt-3 pb-6 space-y-3 min-w-0">
                                {core()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── BACK FACE ──────────────────────────────────────────────── */}
                {(() => {
                    const isMcqType = q.question_type === "mcq" || q.question_type === "assertion_reasoning" || q.question_type === "true_false";
                    const isFillBlank = q.question_type === "fill_blank";
                    const isMatch = q.question_type === "match_following";
                    const hasSubPartsBack = (q.sub_parts?.length ?? 0) > 0;
                    const isInstantGrade = isMcqType || isFillBlank || isMatch;
                    const hasSolution = !!(q.solution_text || (isInstantGrade && q.model_answer));
                    const hasMistakes = !!(q.common_mistakes && q.common_mistakes.length > 0);

                    // Display options for T/F which may have no q.options
                    const displayOpts = (q.question_type === "true_false" && !q.options?.length)
                        ? [
                              { id: "a", text: "True", is_correct: q.correct_option === "a", image_url: null },
                              { id: "b", text: "False", is_correct: q.correct_option === "b", image_url: null },
                          ]
                        : (q.options ?? []);

                    return (
                        <div
                            className="absolute inset-0 flex flex-col rounded-xl border border-[var(--base-300)] bg-white shadow-sm overflow-hidden"
                            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                        >
                            {cardHeaderJsx}
                            <div className="study-feed-scroll flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-hidden lg:overflow-y-auto lg:overscroll-contain">
                                <div className="space-y-6 px-4 pt-5 pb-4 sm:px-6 lg:px-8 min-w-0">

                                    {/* ── MCQ: options review (slightly smaller than front: −2px type, −1 padding step) ── */}
                                    {isMcqType && displayOpts.length > 0 && (
                                        <div className={optionGridClass}>
                                            {displayOpts.map((o) => {
                                                const imgOpts = hasOptionImages(q);
                                                return (
                                                    <button
                                                        key={o.id}
                                                        type="button"
                                                        disabled
                                                        className={`mcq-btn relative w-full h-[5rem] sm:h-[5.25rem] px-3 rounded-2xl text-center text-[14px] font-semibold select-none flex items-center justify-center overflow-hidden ${mcqStateClass(selected === o.id, true, o.is_correct ?? false)} ${imgOpts && o.image_url ? "!h-auto aspect-square" : ""}`}
                                                        style={{ fontFamily: "var(--font-inter)" }}
                                                    >
                                                        {o.image_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={o.image_url} alt={o.text ?? ""} className="absolute inset-0 w-full h-full object-contain p-2" />
                                                        ) : (
                                                            <span className="line-clamp-3 w-full"><OptionContent text={o.text ?? ""} /></span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* ── Fill blank: answer review ── */}
                                    {isFillBlank && (() => {
                                        const correct = checkFillBlank(q, textAnswer);
                                        return (
                                            <div className="space-y-2.5">
                                                {/* User answer */}
                                                <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${correct ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                                                    <div className="min-w-0">
                                                        <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${correct ? "text-emerald-600" : "text-rose-600"}`}>Your Answer</p>
                                                        <p className={`text-[15px] font-semibold ${correct ? "text-emerald-900" : "text-rose-900"}`}>{textAnswer || "—"}</p>
                                                    </div>
                                                    <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${correct ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-rose-100 border-rose-300 text-rose-800"}`} style={{ fontFamily: "var(--font-inter)" }}>
                                                        {correct ? "Correct" : "Incorrect"}
                                                    </span>
                                                </div>
                                                {/* Correct answer — always shown when wrong */}
                                                {!correct && q.blank_answer && (
                                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 mb-1">Correct Answer</p>
                                                        <div className="text-[15px] font-semibold text-emerald-900">
                                                            <RichLine text={q.blank_answer} />
                                                        </div>
                                                        {q.blank_answers_alt && q.blank_answers_alt.length > 0 && (
                                                            <p className="text-[12px] text-emerald-700 mt-1.5">
                                                                Also accepted:{" "}
                                                                {q.blank_answers_alt.map((a, i) => (
                                                                    <React.Fragment key={i}>
                                                                        {i > 0 && ", "}
                                                                        <RichLine text={a} />
                                                                    </React.Fragment>
                                                                ))}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* ── Match following: per-row answer review ── */}
                                    {isMatch && (() => {
                                        const left = q.match_left ?? [];
                                        const right = q.match_right ?? [];
                                        const correct = q.match_correct ?? {};
                                        return (
                                            <div className="space-y-2">
                                                {left.map((l, i) => {
                                                    const correctJ = correct[String(i)];
                                                    const userJ = matchSelections[i];
                                                    const rowOk = typeof correctJ === "number" && userJ === correctJ;
                                                    return (
                                                        <div key={i} className={`rounded-xl border px-4 py-3 ${rowOk ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                                                            <div className="flex items-start gap-3">
                                                                <span
                                                                    className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                                                                    style={{ backgroundColor: rowOk ? "#d1fae5" : "#ffe4e6", color: rowOk ? "#065f46" : "#9f1239" }}
                                                                >
                                                                    {i + 1}
                                                                </span>
                                                                <div className="flex-1 min-w-0 space-y-1" style={{ fontFamily: "var(--font-inter)" }}>
                                                                    <p className="text-[13px] font-medium text-[var(--base-800)]">
                                                                        <RichLine text={l} />
                                                                    </p>
                                                                    {/* Correct answer */}
                                                                    {typeof correctJ === "number" && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span
                                                                                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                                                style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-500)" }}
                                                                            >
                                                                                {String.fromCharCode(65 + correctJ)}
                                                                            </span>
                                                                            <span className="text-[12px] text-emerald-800 leading-snug">
                                                                                <RichLine text={right[correctJ] ?? ""} />
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {/* Wrong pick */}
                                                                    {!rowOk && typeof userJ === "number" && (
                                                                        <p className="text-[11px] text-rose-500 flex items-center gap-1 flex-wrap">
                                                                            <span>You picked {String.fromCharCode(65 + userJ)}:</span>
                                                                            <RichLine text={right[userJ] ?? "—"} />
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                {rowOk ? (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0 mt-0.5" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                                                                ) : (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-rose-400 shrink-0 mt-0.5" aria-hidden><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {/* ── MCQ + Fill blank + Match: Solution + Common Mistakes side-by-side ── */}
                                    {isInstantGrade && (hasSolution || hasMistakes) && (
                                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start pt-1 min-w-0">
                                            {/* Solution container */}
                                            {hasSolution && (
                                                <div className="flex-1 min-w-0 rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-3">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-2">Solution</p>
                                                    <div className="max-w-none text-[var(--base-800)] space-y-3">
                                                        {q.solution_text && <MarkdownRenderer content={q.solution_text} bodyClassName={STUDY_COMPACT_MD} />}
                                                        {q.model_answer && <MarkdownRenderer content={q.model_answer} bodyClassName={STUDY_COMPACT_MD} />}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Common Mistakes container */}
                                            {hasMistakes && (
                                                <div className={`rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 min-w-0 ${hasSolution ? "w-full sm:w-[38%] shrink-0" : "flex-1"}`}>
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="13"
                                                            height="13"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth={2}
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="text-rose-500 shrink-0"
                                                            aria-hidden
                                                        >
                                                            <circle cx="12" cy="12" r="10" />
                                                            <path d="M4.929 4.929 19.07 19.071" />
                                                        </svg>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">Common Mistakes</p>
                                                    </div>
                                                    <ul className="space-y-3">
                                                        {q.common_mistakes!.map((m, i) => (
                                                            <li key={i} className="flex gap-2 items-start">
                                                                <span className="w-2 h-2 rounded-full bg-rose-400 mt-1.5 shrink-0" aria-hidden />
                                                                <div className="min-w-0 flex-1">
                                                                    <MarkdownRenderer content={m} inheritColor bodyClassName={STUDY_COMPACT_MD_ROSE} />
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Non-MCQ (short_ans / long_ans): two-column revealed layout ── */}
                                    {!isInstantGrade && !hasSubPartsBack && (
                                        <div className="flex flex-col lg:flex-row gap-5 items-stretch lg:items-start min-w-0">

                                            {/* LEFT: user answer → solution → steps → model answer → self-assess */}
                                            <div className="flex-1 min-w-0 space-y-4">

                                                {/* User answer + result badge */}
                                                {textAnswer.trim() ? (
                                                    <div className="rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-3">
                                                        <div className="flex items-center justify-between gap-2 mb-2">
                                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)]">Your Answer</p>
                                                            {backFaceResult && !aiChecking && !aiCheckResult && (
                                                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${backFaceResult.cls}`}>
                                                                    {backFaceResult.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[14px] text-[var(--base-700)] leading-relaxed whitespace-pre-wrap">{textAnswer.trim()}</p>
                                                    </div>
                                                ) : (backFaceResult && !aiChecking && !aiCheckResult) ? (
                                                    <div className={`px-4 py-3 rounded-xl text-[15px] font-semibold ${backFaceResult.cls}`}>
                                                        {backFaceResult.label}
                                                    </div>
                                                ) : null}

                                                {/* short_ans: AI grade result — shown prominently right after user answer */}
                                                {q.question_type === "short_ans" && (aiChecking || aiCheckResult) && (
                                                    <AiGradeCard checking={aiChecking} result={aiCheckResult} maxMarks={q.marks} />
                                                )}
                                                {/* AI check error (e.g. rate limited) */}
                                                {aiCheckError && !aiChecking && !aiCheckResult && (
                                                    <div
                                                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px]"
                                                        style={{
                                                            color: "var(--yellow-200)",
                                                            backgroundColor: "var(--yellow-10)",
                                                            border: "1px solid rgba(255, 219, 67, 0.2)",
                                                            fontFamily: "var(--font-inter)",
                                                        }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                        <span>{aiCheckError}</span>
                                                    </div>
                                                )}

                                                {/* Solution */}
                                                {q.solution_text && (
                                                    <div className="rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-2">Solution</p>
                                                        <div className="max-w-none text-[var(--base-800)]">
                                                            <MarkdownRenderer content={q.solution_text} bodyClassName={STUDY_COMPACT_MD} />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Solution steps */}
                                                {q.solution_steps && q.solution_steps.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-2">Solution Steps</p>
                                                        <div className="space-y-2">
                                                            {q.solution_steps.map((s, i) => (
                                                                <div key={i} className="flex gap-3 items-start rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-3">
                                                                    <span
                                                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                                                                        style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-500)" }}
                                                                    >
                                                                        {s.step}
                                                                    </span>
                                                                    <div className="min-w-0 flex-1 space-y-1">
                                                                        <MarkdownRenderer content={s.text} bodyClassName={STUDY_COMPACT_MD} />
                                                                        {s.explanation && (
                                                                            <p className="text-[12px] text-[var(--base-500)] italic">{s.explanation}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Model answer */}
                                                {q.model_answer && (
                                                    <div className="rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-2">Model Answer</p>
                                                        <div className="max-w-none text-[var(--base-800)]">
                                                            <MarkdownRenderer content={q.model_answer} bodyClassName={STUDY_COMPACT_MD} />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* self-assessment: short_ans (no AI check) + long_ans */}
                                                {(q.question_type === "short_ans" || q.question_type === "long_ans") && !selfAssessResult && !aiChecking && !aiCheckResult && (
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        <span className="text-[13px] text-[var(--base-600)] w-full" style={{ fontFamily: "var(--font-inter)" }}>How did you do?</span>
                                                        <button type="button" disabled={busy} onClick={() => handleSelfAssess("correct")} className="flex items-center gap-2 h-10 px-4 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[14px] font-semibold cursor-pointer hover:bg-emerald-100 transition-colors duration-100 disabled:opacity-50" style={{ fontFamily: "var(--font-inter)" }}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>
                                                            Got it
                                                        </button>
                                                        <button type="button" disabled={busy} onClick={() => handleSelfAssess("partial")} className="flex items-center gap-2 h-10 px-4 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[14px] font-semibold cursor-pointer hover:bg-amber-100 transition-colors duration-100 disabled:opacity-50" style={{ fontFamily: "var(--font-inter)" }}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                                                            Partial
                                                        </button>
                                                        <button type="button" disabled={busy} onClick={() => handleSelfAssess("incorrect")} className="flex items-center gap-2 h-10 px-4 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[14px] font-semibold cursor-pointer hover:bg-rose-100 transition-colors duration-100 disabled:opacity-50" style={{ fontFamily: "var(--font-inter)" }}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                                                            Didn&apos;t know
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* RIGHT: common mistakes → marking scheme → key points */}
                                            <div className="w-full lg:w-[38%] shrink-0 space-y-3 min-w-0">

                                                {/* Common mistakes */}
                                                {q.common_mistakes && q.common_mistakes.length > 0 && (
                                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                                                        <div className="flex items-center gap-1.5 mb-2">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-rose-500 shrink-0" aria-hidden>
                                                                <circle cx="12" cy="12" r="10" />
                                                                <path d="M4.929 4.929 19.07 19.071" />
                                                            </svg>
                                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">Common Mistakes</p>
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {q.common_mistakes.map((m, i) => (
                                                                <li key={i} className="flex gap-2 items-start">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" aria-hidden />
                                                                    <div className="min-w-0 flex-1">
                                                                        <MarkdownRenderer content={m} inheritColor bodyClassName={STUDY_COMPACT_MD_ROSE} />
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Marking scheme */}
                                                {q.marking_scheme && q.marking_scheme.length > 0 && (
                                                    <div className="rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-3">Marking Scheme</p>
                                                        <div className="space-y-2.5">
                                                            {q.marking_scheme.map((m, i) => (
                                                                <div key={i} className="flex gap-2 items-start">
                                                                    <div className="min-w-0 flex-1">
                                                                        <MarkdownRenderer content={m.point} bodyClassName={`${STUDY_COMPACT_MD} text-[var(--base-800)]`} />
                                                                    </div>
                                                                    <span
                                                                        className="shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                                                                        style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-500)" }}
                                                                    >
                                                                        {m.marks}m
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Key points */}
                                                {q.key_points && q.key_points.length > 0 && (
                                                    <div className="rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-2">Key Points</p>
                                                        <ul className="space-y-1.5">
                                                            {q.key_points.map((k, i) => (
                                                                <li key={i} className="flex gap-2 items-start">
                                                                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--primary-400)" }} aria-hidden />
                                                                    <div className="min-w-0 flex-1">
                                                                        <MarkdownRenderer content={k} bodyClassName={STUDY_COMPACT_MD} />
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Multi-part (case study / long_ans with sub_parts): per-sub-part revealed layout ── */}
                                    {hasSubPartsBack && (
                                        <div className="space-y-4">
                                            {(q.sub_parts ?? []).map((part, i) => {
                                                const userAns = (subAnswers[i] ?? "").trim();
                                                return (
                                                    <div key={i} className="rounded-xl border border-[var(--base-200)] bg-[var(--base-50)] px-4 py-4 space-y-3">
                                                        {/* Sub-part header */}
                                                        <div className="flex items-start gap-2">
                                                            <span
                                                                className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                                                                style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-500)" }}
                                                            >
                                                                {i + 1}
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <MarkdownRenderer
                                                                    content={part.question_text}
                                                                    bodyClassName="text-[14px] font-medium leading-relaxed [&_p]:mb-1 [&_p:last-child]:mb-0"
                                                                />
                                                            </div>
                                                            <span
                                                                className="shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                                                                style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-500)" }}
                                                            >
                                                                {part.marks}m
                                                            </span>
                                                        </div>
                                                        {/* User answer */}
                                                        {userAns && (
                                                            <div className="rounded-lg border border-[var(--base-200)] bg-white px-3 py-2.5">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-1">Your Answer</p>
                                                                <p className="text-[13px] text-[var(--base-700)] leading-relaxed whitespace-pre-wrap">{userAns}</p>
                                                            </div>
                                                        )}
                                                        {/* Solution */}
                                                        {part.solution_text && (
                                                            <div className="rounded-lg border border-[var(--base-200)] bg-white px-3 py-2.5">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-1">Solution</p>
                                                                <MarkdownRenderer content={part.solution_text} bodyClassName={STUDY_COMPACT_MD} />
                                                            </div>
                                                        )}
                                                        {/* Solution steps */}
                                                        {part.solution_steps && part.solution_steps.length > 0 && (
                                                            <div className="space-y-1.5">
                                                                {part.solution_steps.map((s, si) => (
                                                                    <div key={si} className="flex gap-2.5 items-start rounded-lg border border-[var(--base-200)] bg-white px-3 py-2.5">
                                                                        <span
                                                                            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                                                                            style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-500)" }}
                                                                        >
                                                                            {s.step}
                                                                        </span>
                                                                        <div className="min-w-0 flex-1 space-y-0.5">
                                                                            <MarkdownRenderer content={s.text} bodyClassName={STUDY_COMPACT_MD} />
                                                                            {s.explanation && (
                                                                                <p className="text-[12px] text-[var(--base-500)] italic">{s.explanation}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {/* Model answer */}
                                                        {part.model_answer && (
                                                            <div className="rounded-lg border border-[var(--base-200)] bg-white px-3 py-2.5">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--base-500)] mb-1">Model Answer</p>
                                                                <MarkdownRenderer content={part.model_answer} bodyClassName={STUDY_COMPACT_MD} />
                                                            </div>
                                                        )}
                                                        {/* Key points */}
                                                        {part.key_points && part.key_points.length > 0 && (
                                                            <ul className="space-y-1.5">
                                                                {part.key_points.map((k, ki) => (
                                                                    <li key={ki} className="flex gap-2 items-start">
                                                                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--primary-400)" }} aria-hidden />
                                                                        <div className="min-w-0 flex-1">
                                                                            <MarkdownRenderer content={k} bodyClassName={STUDY_COMPACT_MD} />
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Self-check */}
                                            {!selfAssessResult && (
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    <span className="text-[13px] text-[var(--base-600)] w-full" style={{ fontFamily: "var(--font-inter)" }}>How did you do?</span>
                                                    <button type="button" disabled={busy} onClick={() => handleSelfAssess("correct")} className="flex items-center gap-2 h-10 px-4 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[14px] font-semibold cursor-pointer hover:bg-emerald-100 transition-colors duration-100 disabled:opacity-50" style={{ fontFamily: "var(--font-inter)" }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>
                                                        Got it
                                                    </button>
                                                    <button type="button" disabled={busy} onClick={() => handleSelfAssess("partial")} className="flex items-center gap-2 h-10 px-4 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[14px] font-semibold cursor-pointer hover:bg-amber-100 transition-colors duration-100 disabled:opacity-50" style={{ fontFamily: "var(--font-inter)" }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                                                        Partial
                                                    </button>
                                                    <button type="button" disabled={busy} onClick={() => handleSelfAssess("incorrect")} className="flex items-center gap-2 h-10 px-4 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[14px] font-semibold cursor-pointer hover:bg-rose-100 transition-colors duration-100 disabled:opacity-50" style={{ fontFamily: "var(--font-inter)" }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                                                        Didn&apos;t know
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Back + Next footer */}
                            <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-3 pb-4 sm:pb-6 flex flex-col-reverse sm:flex-row items-stretch gap-2 sm:gap-3 min-w-0">
                                {/* Back — hint-style, flips to front */}
                                <button
                                    type="button"
                                    onClick={() => setShowBack(false)}
                                    className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-[16px] font-semibold transition-opacity duration-75 cursor-pointer hover:opacity-80"
                                    style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-400)" }}
                                    aria-label="Back to question"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="m12 19-7-7 7-7" />
                                        <path d="M19 12H5" />
                                    </svg>
                                </button>

                                {/* Next question */}
                                <button
                                    type="button"
                                    onClick={onNext}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[16px] font-semibold text-white hover:opacity-90 transition-opacity duration-75 cursor-pointer"
                                    style={{ backgroundColor: "var(--primary-400)" }}
                                >
                                    Next question
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </motion.div>
        </div>
    );
}

// ─── Main feed ────────────────────────────────────────────────────────────────

export default function StudyFeed() {
    const { grade: contextGrade, selectedSubjects: contextSelectedSubjects } = useDashboardGrade();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [queue, setQueue] = useState<StudyQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [feedMeta, setFeedMeta] = useState<StudyFeedMeta | null>(null);
    const [sessionStats, setSessionStats] = useState<SessionStats>({
        questions_attempted: 0,
        questions_correct: 0,
        streak_peak: 0,
    });
    const sessionStatsRef = useRef<SessionStats>({ questions_attempted: 0, questions_correct: 0, streak_peak: 0 });
    const [streak, setStreak] = useState(0);
    const sessionIdRef = useRef<string | null>(null);
    const sessionStartMs = useRef<number>(Date.now());
    const cardStartMs = useRef<number>(Date.now());
    const scrollRef = useRef<HTMLDivElement>(null);
    const loadingMoreRef = useRef(false);
    const visibleIndexRef = useRef(0);
    const [visibleIndex, setVisibleIndex] = useState(0);
    // Bumped each time the user applies new filters — causes the session-start effect to re-run
    const [sessionKey, setSessionKey] = useState(0);
    const [questionStateById, setQuestionStateById] = useState<Record<string, PersistedQuestionState>>({});
    const searchParams = useSearchParams();
    const shareQuestionId = searchParams.get("question");
    const shareLinkHydratedRef = useRef(false);

    const [elapsed, setElapsed] = useState(0);

    const { setShellMetrics, appliedFilters, setFilters, registerRefreshFeed, setAllowedStudySubjects, allowedStudySubjects } = useStudyFeedShellHeaderWriter();
    // Stable ref so fetchBatch (useCallback with no deps) can always read current filters
    const appliedFiltersRef = useRef<StudyFeedFilters>(appliedFilters);
    useEffect(() => { appliedFiltersRef.current = appliedFilters; }, [appliedFilters]);
    const allowedStudySubjectsRef = useRef<string[]>(allowedStudySubjects);
    useEffect(() => { allowedStudySubjectsRef.current = allowedStudySubjects; }, [allowedStudySubjects]);

    // Derive allowed study subjects from the layout-provided context (no extra round-trip).
    useEffect(() => {
        const gradeForSubjects = contextGrade === 11 ? 11 : 10;
        const profileSubjects: string[] =
            contextSelectedSubjects.length > 0
                ? contextSelectedSubjects
                : getAiTutorSubjectOptionsForGrade(gradeForSubjects).map((s) => s.id);

        const studyFeedAllowed = getStudyFeedSubjectLabelsForGrade(gradeForSubjects);
        const allowedFromProfile = profileSubjects
            .map((id) => SUBJECT_LABELS[id] ?? id)
            .filter((s, i, arr) => arr.indexOf(s) === i)
            .filter((s) => studyFeedAllowed.includes(s));

        const resolvedAllowed = allowedFromProfile.length > 0 ? allowedFromProfile : studyFeedAllowed;

        setAllowedStudySubjects(resolvedAllowed);
        if (resolvedAllowed.length < studyFeedAllowed.length && resolvedAllowed.length > 0) {
            setFilters({ subjects: resolvedAllowed, chapters: [], difficulties: [], questionTypes: [], marks: [], sources: [] });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contextGrade, contextSelectedSubjects]);

    useEffect(() => {
        if (!allowedStudySubjects.includes("Physics")) return;
        if (appliedFilters.sources.length === 0) return;
        setFilters({
            ...appliedFilters,
            sources: [],
        });
    }, [allowedStudySubjects, appliedFilters, setFilters]);

    // Apply prefilled filters from learn-mode "Practice" button (via sessionStorage)
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem("studyFeedPrefillFilter");
            if (!raw) return;
            sessionStorage.removeItem("studyFeedPrefillFilter");
            const parsed = JSON.parse(raw) as { subject?: string; chapter_index?: number };
            if (parsed.subject || parsed.chapter_index != null) {
                setFilters({
                    subjects: parsed.subject ? [parsed.subject] : [],
                    chapters: parsed.chapter_index != null ? [parsed.chapter_index] : [],
                    difficulties: [],
                    questionTypes: [],
                    marks: [],
                    sources: [],
                });
            }
        } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const t = setInterval(() => {
            setElapsed(Math.floor((Date.now() - sessionStartMs.current) / 1000));
        }, 1000);
        return () => clearInterval(t);
    }, []);

    const endSession = useCallback(() => {
        const id = sessionIdRef.current;
        if (!id) return;
        const secs = Math.floor((Date.now() - sessionStartMs.current) / 1000);
        const stats = sessionStatsRef.current;
        track("study_session_ended", {
            questions_attempted: stats?.questions_attempted ?? 0,
            questions_correct: stats?.questions_correct ?? 0,
            duration_secs: secs,
        });
        const body = JSON.stringify({ session_id: id, time_active_secs: secs });
        fetch("/api/study/session/end", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body,
            keepalive: true,
        }).catch(() => {});
    }, []);

    const bufferStarvedRef = useRef(false);
    const queueRef = useRef<StudyQuestion[]>([]);
    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    useEffect(() => {
        let cancelled = false;
        sessionIdRef.current = null;
        sessionStartMs.current = Date.now();

        (async () => {
            // Only use the warm prefetch cache on initial load with no filters applied
            const hasFilters = appliedFiltersRef.current.subjects.length > 0 ||
                appliedFiltersRef.current.chapters.length > 0 ||
                appliedFiltersRef.current.difficulties.length > 0 ||
                appliedFiltersRef.current.questionTypes.length > 0 ||
                appliedFiltersRef.current.marks.length > 0 ||
                appliedFiltersRef.current.sources.length > 0;

            if (sessionKey === 0 && !hasFilters) {
                const warm = takeStudyFeedPrefetchIfFresh(PREFETCH_TTL_MS);
                if (warm?.sessionId && warm.questions.length > 0) {
                    if (cancelled) return;
                    sessionIdRef.current = warm.sessionId;
                    setSessionId(warm.sessionId);
                    setQueue(normaliseStudyFeedQuestions(warm.questions));
                    setFeedMeta(warm.meta);
                    setLoading(false);
                    setFetchError(null);
                    bufferStarvedRef.current = false;
                    return;
                }
            }

            try {
                const start = await fetch("/api/study/session/start", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        filters_applied: appliedFiltersRef.current,
                        entry_source: "sidebar",
                    }),
                });
                if (!start.ok) throw new Error("Failed to start session");
                const { session_id } = (await start.json()) as { session_id: string };
                if (cancelled) return;
                sessionIdRef.current = session_id;
                setSessionId(session_id);
                track("study_session_started", {
                    subject: appliedFiltersRef.current.subjects[0] ?? undefined,
                });
            } catch (e) {
                if (!cancelled) setFetchError("Could not start study session.");
                console.error(e);
            }
        })();
        return () => {
            cancelled = true;
            endSession();
        };
        // sessionKey changes when the user applies new filters — triggers a full restart
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endSession, sessionKey]);

    // When the user applies new filters, reset all feed state and bump sessionKey to restart
    const isFirstFilterApply = useRef(true);
    useEffect(() => {
        if (isFirstFilterApply.current) { isFirstFilterApply.current = false; return; }
        setQueue([]);
        setQuestionStateById({});
        visibleIndexRef.current = 0;
        setVisibleIndex(0);
        setStreak(0);
        setFeedMeta(null);
        setFetchError(null);
        bufferStarvedRef.current = false;
        loadingMoreRef.current = false;
        setLoading(true);
        setSessionKey(k => k + 1);
    // appliedFilters reference changes only when the user presses Apply in the panel
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedFilters]);

    const triggerRefresh = useCallback(() => {
        setQueue([]);
        setQuestionStateById({});
        visibleIndexRef.current = 0;
        setVisibleIndex(0);
        setStreak(0);
        setFeedMeta(null);
        setFetchError(null);
        bufferStarvedRef.current = false;
        loadingMoreRef.current = false;
        setLoading(true);
        setSessionKey(k => k + 1);
    }, []);

    useEffect(() => {
        registerRefreshFeed(triggerRefresh);
    }, [registerRefreshFeed, triggerRefresh]);

    const persistQuestionState = useCallback((questionId: string, next: PersistedQuestionState) => {
        setQuestionStateById((prev) => {
            const current = prev[questionId];
            if (current && JSON.stringify(current) === JSON.stringify(next)) return prev;
            return { ...prev, [questionId]: next };
        });
    }, []);

    const fetchBatch = useCallback(async (sid: string, excludeIds: string[], batchSize: number) => {
        const params = new URLSearchParams();
        params.set("session_id", sid);
        params.set("batch_size", String(batchSize));
        for (const id of excludeIds) params.append("exclude", id);
        // Read current filters from ref (always fresh, no stale-closure issue)
        const f = appliedFiltersRef.current;
        for (const s of f.subjects) params.append("subject", s);
        for (const c of f.chapters) params.append("chapter", String(c));
        for (const d of f.difficulties) params.append("difficulty", d);
        for (const t of f.questionTypes) params.append("question_type", t);
        for (const m of f.marks) params.append("marks", String(m));
        const isGrade11Feed = allowedStudySubjectsRef.current.includes("Physics");
        if (!isGrade11Feed) {
            for (const src of f.sources) params.append("source", src);
        }
        const res = await fetch(`/api/study/feed?${params.toString()}`, { credentials: "include" });
        const data = (await res.json()) as {
            questions?: unknown[];
            error?: string;
            meta?: StudyFeedMeta;
        };
        if (!res.ok) {
            throw new Error(data.error ?? "Feed failed");
        }
        return {
            questions: normaliseStudyFeedQuestions(data.questions ?? []),
            meta: data.meta ?? null,
        };
    }, []);

    useEffect(() => {
        if (!sessionId) return;
        if (queue.length > 0) return;
        let cancelled = false;
        setLoading(true);
        setFetchError(null);
        fetchBatch(sessionId, [], FETCH_CHUNK)
            .then(({ questions, meta }) => {
                if (cancelled) return;
                setQueue(questions);
                setFeedMeta(meta);
                bufferStarvedRef.current = false;
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    const msg = err instanceof Error ? err.message : "Could not load questions.";
                    setFetchError(msg);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [sessionId, queue.length, fetchBatch]);

    useEffect(() => {
        shareLinkHydratedRef.current = false;
    }, [shareQuestionId]);

    useEffect(() => {
        if (!sessionId || !shareQuestionId || shareLinkHydratedRef.current) return;
        if (loading) return;

        let cancelled = false;

        const stripQuestionParam = () => {
            try {
                const u = new URL(window.location.href);
                if (!u.searchParams.has("question")) return;
                u.searchParams.delete("question");
                const next = u.pathname + (u.search ? u.search : "") + u.hash;
                window.history.replaceState({}, "", next);
            } catch {
                /* ignore */
            }
        };

        (async () => {
            const qid = shareQuestionId;
            const existingIdx = queueRef.current.findIndex((q) => q.id === qid);
            if (existingIdx >= 0) {
                setVisibleIndex(existingIdx);
                visibleIndexRef.current = existingIdx;
                shareLinkHydratedRef.current = true;
                stripQuestionParam();
                return;
            }
            try {
                const res = await fetch(`/api/study/question/${encodeURIComponent(qid)}`, { credentials: "include" });
                if (cancelled) return;
                if (!res.ok) {
                    shareLinkHydratedRef.current = true;
                    stripQuestionParam();
                    return;
                }
                const data = (await res.json()) as { question?: unknown };
                const [norm] = normaliseStudyFeedQuestions(data.question ? [data.question] : []);
                if (!norm) {
                    shareLinkHydratedRef.current = true;
                    stripQuestionParam();
                    return;
                }
                setQueue((prev) => (prev.some((p) => p.id === norm.id) ? prev : [norm, ...prev]));
                setVisibleIndex(0);
                visibleIndexRef.current = 0;
            } finally {
                if (!cancelled) {
                    shareLinkHydratedRef.current = true;
                    stripQuestionParam();
                }
            }
        })().catch(() => {
            shareLinkHydratedRef.current = true;
            stripQuestionParam();
        });

        return () => {
            cancelled = true;
        };
    }, [sessionId, shareQuestionId, loading, queue.length]);

    const ensureBuffer = useCallback(async () => {
        if (!sessionId || loadingMoreRef.current || bufferStarvedRef.current) return;
        const idx = visibleIndexRef.current;
        const prev = queueRef.current;
        const ahead = prev.length - idx - 1;
        if (ahead >= AHEAD_BUFFER) return;
        loadingMoreRef.current = true;
        try {
            const excludeIds = prev.map((q) => q.id);
            const { questions: incoming, meta } = await fetchBatch(sessionId, excludeIds, FETCH_CHUNK);
            if (meta) setFeedMeta(meta);
            const prevIds = new Set(prev.map((q) => q.id));
            const added = incoming.filter((q) => !prevIds.has(q.id)).length;
            setQueue((p) => mergeQuestionsDedupe(p, incoming));
            if (incoming.length > 0 && added === 0) {
                bufferStarvedRef.current = true;
            }
        } catch (e) {
            console.error(e);
        } finally {
            loadingMoreRef.current = false;
        }
    }, [sessionId, fetchBatch]);

    useEffect(() => {
        if (!sessionId || queueRef.current.length === 0) return;
        const idx = visibleIndexRef.current;
        const len = queueRef.current.length;
        if (len - idx - 1 < AHEAD_BUFFER) {
            void ensureBuffer();
        }
    }, [sessionId, queue.length, ensureBuffer]);

    const preloadImages = useCallback((questions: StudyQuestion[], from: number) => {
        const slice = questions.slice(from, from + IMAGE_PRELOAD_AHEAD);
        for (const q of slice) {
            if (showQuestionDiagram(q) && q.question_image_url) {
                const img = new window.Image();
                img.src = q.question_image_url;
            }
            if (hasOptionImages(q)) {
                for (const o of q.options ?? []) {
                    if (o.image_url) {
                        const img = new window.Image();
                        img.src = o.image_url;
                    }
                }
            }
        }
    }, []);

    useEffect(() => {
        preloadImages(queue, 0);
    }, [queue, preloadImages]);

    const onScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const h = el.clientHeight;
        if (h <= 0) return;
        const idx = Math.round(el.scrollTop / h);
        if (idx !== visibleIndexRef.current) {
            visibleIndexRef.current = idx;
            setVisibleIndex(idx);
        }
        if (queue.length - idx - 1 < AHEAD_BUFFER) void ensureBuffer();
        preloadImages(queue, idx + 1);
    }, [queue, ensureBuffer, preloadImages]);

    const scrollToNext = useCallback(() => {
        const el = scrollRef.current;
        if (el && queue.length > 0) {
            const h = el.clientHeight;
            const nextIdx = Math.min(visibleIndexRef.current + 1, queue.length - 1);
            el.scrollTo({ top: nextIdx * h, behavior: "smooth" });
        }
        void ensureBuffer();
    }, [queue.length, ensureBuffer]);

    const handleAttemptLogged = useCallback(
        (
            stats: SessionStats | null,
            streakDelta?: number,
            opts?: { statsOnly?: boolean; scroll?: boolean },
        ) => {
            if (opts?.statsOnly) {
                if (stats) { setSessionStats(stats); sessionStatsRef.current = stats; }
                return;
            }
            if (stats) { setSessionStats(stats); sessionStatsRef.current = stats; }
            if (streakDelta !== undefined) {
                setStreak((s) => {
                    const next = streakDelta > 0 ? s + 1 : 0;
                    if (next > 0 && (next === 5 || next === 10 || next === 20 || next === 50)) {
                        track("study_streak_milestone", { streak: next });
                    }
                    return next;
                });
            }
            if (opts?.scroll === true) {
                scrollToNext();
            }
            void ensureBuffer();
        },
        [ensureBuffer, scrollToNext]
    );

    useEffect(() => {
        setShellMetrics({
            elapsedSec: elapsed,
            streak,
        });
    }, [elapsed, streak, setShellMetrics]);

    if (fetchError && !sessionId) {
        return (
            <div className="flex items-center justify-center h-48 text-[var(--base-600)] text-[14px]" style={{ fontFamily: "var(--font-inter)" }}>
                {fetchError}
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full">
            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="study-feed-scroll flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain snap-y snap-mandatory scroll-smooth touch-pan-y bg-[var(--base-100)] shadow-inner"
                style={{ scrollSnapType: "y mandatory" }}
            >
                {loading && queue.length === 0 && !fetchError && (
                    <div className="h-full flex items-center justify-center text-[var(--base-500)] text-[14px]" style={{ fontFamily: "var(--font-inter)" }}>
                        Loading feed…
                    </div>
                )}
                {!loading && queue.length === 0 && fetchError && (
                    <div
                        className="h-full flex flex-col items-center justify-center gap-2 text-rose-700 text-[14px] px-6 text-center max-w-md mx-auto"
                        style={{ fontFamily: "var(--font-inter)" }}
                    >
                        <p className="font-medium">Could not load the feed</p>
                        <p className="text-[13px] text-[var(--base-600)]">{fetchError}</p>
                    </div>
                )}
                {!loading && queue.length === 0 && !fetchError && (
                    <div
                        className="h-full flex flex-col items-center justify-center gap-5 px-6 text-center"
                        style={{ fontFamily: "var(--font-inter)" }}
                    >
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ backgroundColor: "var(--base-100)", color: "var(--base-400)" }}
                        >
                            <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                                <path d="M11 8v6M8 11h6" />
                            </svg>
                        </div>
                        <div className="flex flex-col gap-1.5 max-w-[260px]">
                            <p
                                className="text-[17px] font-bold tracking-tight"
                                style={{ color: "var(--base-800)" }}
                            >
                                No questions found
                            </p>
                            <p
                                className="text-[13px] leading-relaxed"
                                style={{ color: "var(--base-500)" }}
                            >
                                {appliedFilters.subjects.length > 0 ||
                                 appliedFilters.chapters.length > 0 ||
                                 appliedFilters.difficulties.length > 0 ||
                                 appliedFilters.questionTypes.length > 0 ||
                                 appliedFilters.marks.length > 0 ||
                                 appliedFilters.sources.length > 0
                                    ? "Try adjusting your filters — nothing matched your current selection."
                                    : "Nothing to show right now. Check back soon."}
                            </p>
                        </div>
                    </div>
                )}
                <AnimatePresence mode="popLayout">
                    {queue.map((q, i) => {
                        const inWindow = i >= visibleIndex - RENDER_WINDOW_BEHIND && i <= visibleIndex + RENDER_WINDOW_AHEAD;
                        return (
                            <motion.div
                                key={`${q.id}-${i}`}
                                initial={i < 3 ? { opacity: 0, y: 12 } : false}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: i < 3 ? 0.2 : 0, ease: [0.22, 1, 0.36, 1] }}
                                className="h-full min-h-0 snap-start snap-always shrink-0 box-border p-2 min-[480px]:p-4 flex justify-center items-stretch min-w-0"
                                data-study-slide
                                style={{ minHeight: "100%" }}
                            >
                                {inWindow && sessionId && (
                                    <div className="w-full h-full min-h-0 max-h-full flex flex-col">
                                        <QuestionCard
                                            q={q}
                                            sessionId={sessionId}
                                            persistedState={questionStateById[q.id]}
                                            onPersistState={persistQuestionState}
                                            onAttemptLogged={handleAttemptLogged}
                                            onNext={scrollToNext}
                                            startTimeRef={cardStartMs}
                                        />
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
