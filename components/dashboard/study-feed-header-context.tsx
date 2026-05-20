"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    type StudyFeedFilters,
    DEFAULT_FILTERS,
    countActiveFilters,
} from "@/lib/study-feed-shared";

// ─── Context ──────────────────────────────────────────────────────────────────

export type StudyFeedShellMetrics = {
    elapsedSec: number;
    streak: number;
};

type StudyFeedHeaderContextValue = {
    metrics: StudyFeedShellMetrics;
    setShellMetrics: (m: StudyFeedShellMetrics) => void;
    appliedFilters: StudyFeedFilters;
    setFilters: (f: StudyFeedFilters) => void;
    registerRefreshFeed: (fn: () => void) => void;
    refreshFeed: () => void;
    allowedStudySubjects: string[];
    setAllowedStudySubjects: (subjects: string[]) => void;
};

const StudyFeedHeaderContext = createContext<StudyFeedHeaderContextValue | null>(null);

const defaultMetrics: StudyFeedShellMetrics = { elapsedSec: 0, streak: 0 };

export function StudyFeedHeaderMetricsProvider({ children }: { children: ReactNode }) {
    const [metrics, setShellMetrics] = useState<StudyFeedShellMetrics>(defaultMetrics);
    const [appliedFilters, setFilters] = useState<StudyFeedFilters>(DEFAULT_FILTERS);
    const [allowedStudySubjects, setAllowedStudySubjects] = useState<string[]>(["Science", "Mathematics"]);

    const refreshFnRef = useRef<(() => void) | null>(null);
    const registerRefreshFeed = useCallback((fn: () => void) => {
        refreshFnRef.current = fn;
    }, []);
    const refreshFeed = useCallback(() => {
        refreshFnRef.current?.();
    }, []);

    const value = useMemo(
        () => ({ metrics, setShellMetrics, appliedFilters, setFilters, registerRefreshFeed, refreshFeed, allowedStudySubjects, setAllowedStudySubjects }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [metrics, appliedFilters, allowedStudySubjects],
    );

    return (
        <StudyFeedHeaderContext.Provider value={value}>{children}</StudyFeedHeaderContext.Provider>
    );
}

export function useStudyFeedShellHeaderWriter() {
    const ctx = useContext(StudyFeedHeaderContext);
    if (!ctx) throw new Error("useStudyFeedShellHeaderWriter must be inside StudyFeedHeaderMetricsProvider");
    return ctx;
}

// ─── Filter panel data ────────────────────────────────────────────────────────

// Chapter counts per subject (NCERT)
const SUBJECT_CHAPTERS: Record<string, number> = {
    Science: 13,
    Mathematics: 14,
    "Social Science": 21,
    Physics: 14,
    Chemistry: 9,
    Biology: 19,
    Economics: 12,
    Accountancy: 6,
    "Business Studies": 10,
    English: 6,
    Hindi: 3,
    French: 9,
    "Computer Science": 11,
};

const DIFFICULTIES = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
];

const QUESTION_TYPES = [
    { value: "mcq", label: "MCQ" },
    { value: "assertion_reasoning", label: "Assertion Reasoning" },
    { value: "true_false", label: "True / False" },
    { value: "fill_blank", label: "Fill Blank" },
    { value: "match_following", label: "Match" },
    { value: "short_ans", label: "Short Ans" },
    { value: "long_ans", label: "Long Ans" },
];

const MARKS_OPTIONS = [1, 2, 3, 5];

const SOURCES = [
    { value: "pyq", label: "PYQ" },
    { value: "ncert_exercise", label: "NCERT Exercise" },
    { value: "ncert_intext", label: "NCERT Intext" },
    { value: "ncert_exemplar", label: "Exemplar" },
];

// ─── Filter panel sub-components ─────────────────────────────────────────────

function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="px-2.5 py-[5px] rounded-md text-[12.5px] font-medium transition-all duration-150 cursor-pointer select-none border"
            style={
                active
                    ? {
                          backgroundColor: "var(--primary-400)",
                          color: "#fff",
                          borderColor: "var(--primary-400)",
                      }
                    : {
                          backgroundColor: "#fff",
                          color: "var(--base-600)",
                          borderColor: "var(--base-300)",
                      }
            }
            onMouseEnter={e => {
                if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--base-400)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--base-700)";
                }
            }}
            onMouseLeave={e => {
                if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--base-300)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--base-600)";
                }
            }}
        >
            {label}
        </button>
    );
}

function FilterSection({
    title,
    delay = 0,
    children,
}: {
    title: string;
    delay?: number;
    children: ReactNode;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay }}
        >
            <div
                className="text-[10.5px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--base-400)", fontFamily: "var(--font-inter)" }}
            >
                {title}
            </div>
            <div className="flex flex-wrap gap-1.5">{children}</div>
        </motion.div>
    );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconFilterSliders({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
            strokeLinejoin="round" className={className} aria-hidden
        >
            <path d="M4 21v-7" /><path d="M4 10V3" />
            <path d="M12 21v-9" /><path d="M12 8V3" />
            <path d="M20 21v-5" /><path d="M20 12V3" />
            <path d="M2 14h4" /><path d="M10 8h4" /><path d="M18 16h4" />
        </svg>
    );
}

function IconClockStudy({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden
        >
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    );
}

function IconRefreshCcw({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
            strokeLinejoin="round" className={className} style={style} aria-hidden
        >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
        </svg>
    );
}

function IconFlame({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
            strokeLinejoin="round" className={className} aria-hidden
        >
            <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
        </svg>
    );
}

// ─── Filter button + panel ────────────────────────────────────────────────────

export function StudyFeedShellFilterButton() {
    const ctx = useContext(StudyFeedHeaderContext);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<StudyFeedFilters>(DEFAULT_FILTERS);
    const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const activeCount = ctx ? countActiveFilters(ctx.appliedFilters) : 0;

    const openPanel = () => {
        if (open) { setOpen(false); return; }
        setDraft(ctx?.appliedFilters ?? DEFAULT_FILTERS);
        if (btnRef.current && typeof window !== "undefined") {
            const rect = btnRef.current.getBoundingClientRect();
            const panelW = Math.min(336, window.innerWidth - 24);
            const left = Math.max(12, Math.min(rect.left, window.innerWidth - panelW - 12));
            const top = Math.min(rect.bottom + 8, window.innerHeight - 80);
            setPanelPos({ top: Math.max(12, top), left });
        }
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)
            ) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const apply = () => { ctx?.setFilters({ ...draft }); setOpen(false); };
    const clearAll = () => setDraft(DEFAULT_FILTERS);

    // String array toggle — when subjects change, prune out-of-range chapters
    const toggleStr = (
        key: keyof Pick<StudyFeedFilters, "subjects" | "difficulties" | "questionTypes" | "sources">,
        val: string,
    ) => {
        setDraft(d => {
            const arr = d[key] as string[];
            const next =
                key === "subjects"
                    ? (arr.includes(val) ? [] : [val]) // max one subject
                    : (arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
            if (key !== "subjects") return { ...d, [key]: next };
            // Prune chapters that no longer exist in the new subject selection
            const newSubjects = next as string[];
            const isGrade11 = (ctx?.allowedStudySubjects ?? []).includes("Physics");
            const chapterCountFor = (subject: string) => {
                if (subject === "Physics") return 7;
                if (subject === "Chemistry") return 6;
                if (subject === "Mathematics") return isGrade11 ? 9 : 14;
                return SUBJECT_CHAPTERS[subject] ?? 14;
            };
            const maxCh = newSubjects.length === 0 ? 0 : Math.max(...newSubjects.map(chapterCountFor));
            return { ...d, subjects: newSubjects, chapters: d.chapters.filter(c => c <= maxCh) };
        });
    };

    const toggleNum = (key: keyof Pick<StudyFeedFilters, "chapters" | "marks">, val: number) => {
        setDraft(d => ({
            ...d,
            [key]: (d[key] as number[]).includes(val)
                ? (d[key] as number[]).filter(x => x !== val)
                : [...(d[key] as number[]), val],
        }));
    };

    // Determine available chapters based on selected subjects in draft
    const chapterCount =
        draft.subjects.length === 0
            ? 0
            : draft.subjects.length === 1
                ? (() => {
                    const only = draft.subjects[0];
                    const isGrade11 = (ctx?.allowedStudySubjects ?? []).includes("Physics");
                    if (only === "Physics") return 7;
                    if (only === "Chemistry") return 6;
                    if (only === "Mathematics") return isGrade11 ? 9 : 14;
                    return SUBJECT_CHAPTERS[only] ?? 14;
                })()
                : Math.max(...draft.subjects.map(s => SUBJECT_CHAPTERS[s] ?? 14));

    const draftCount = countActiveFilters(draft);
    const hasChanges = JSON.stringify(draft) !== JSON.stringify(ctx?.appliedFilters ?? DEFAULT_FILTERS);

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={openPanel}
                aria-label={activeCount > 0 ? `Filter questions, ${activeCount} active` : "Filter questions"}
                aria-expanded={open}
                className="relative flex items-center justify-center gap-2 shrink-0 rounded-full border text-[14px] font-medium transition-all duration-150 hover:opacity-90 active:scale-95 cursor-pointer my-[7px] size-9 p-0 lg:h-9 lg:w-auto lg:px-4 lg:gap-2"
                style={
                    activeCount > 0
                        ? {
                              backgroundColor: "var(--primary-10)",
                              borderColor: "var(--primary-400)",
                              color: "var(--primary-500)",
                              fontFamily: "var(--font-inter)",
                          }
                        : {
                              backgroundColor: "#fff",
                              borderColor: "#e2e8f0",
                              color: "var(--base-800)",
                              fontFamily: "var(--font-inter)",
                          }
                }
            >
                <IconFilterSliders className="w-4 h-4 shrink-0" />
                {activeCount > 0 && (
                    <span
                        className="lg:hidden absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10px] font-semibold tabular-nums leading-none text-white"
                        style={{ backgroundColor: "var(--primary-400)" }}
                        aria-hidden
                    >
                        {activeCount > 99 ? "99+" : activeCount}
                    </span>
                )}
                <span className="hidden lg:inline">
                    {activeCount > 0 ? `Filter · ${activeCount}` : "Filter"}
                </span>
            </button>

            {open && typeof window !== "undefined" && createPortal(
                <AnimatePresence>
                    <motion.div
                        ref={panelRef}
                        key="filter-panel"
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed z-[9999] flex flex-col rounded-xl border bg-white"
                        style={{
                            top: panelPos.top,
                            left: panelPos.left,
                            width: "min(336px, calc(100vw - 24px))",
                            maxHeight: "min(540px, calc(100dvh - 80px))",
                            borderColor: "var(--base-200)",
                            boxShadow: "0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
                            fontFamily: "var(--font-inter)",
                        }}
                    >
                        {/* Header */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.18, delay: 0.02 }}
                            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
                            style={{ borderColor: "var(--base-200)" }}
                        >
                            <span
                                className="text-[13px] font-semibold"
                                style={{ color: "var(--base-700)" }}
                            >
                                Filter Questions
                            </span>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="w-6 h-6 flex items-center justify-center rounded-md transition-colors cursor-pointer"
                                style={{ color: "var(--base-400)" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--base-200)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--base-700)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--base-400)"; }}
                                aria-label="Close"
                            >
                                <svg width={13} height={13} viewBox="0 0 13 13" fill="none" aria-hidden>
                                    <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
                                </svg>
                            </button>
                        </motion.div>

                        {/* Scrollable body */}
                        <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-5">
                            <FilterSection title="Subject" delay={0.06}>
                                {(ctx?.allowedStudySubjects ?? []).map(s => (
                                    <Chip key={s} label={s} active={draft.subjects.includes(s)} onToggle={() => toggleStr("subjects", s)} />
                                ))}
                            </FilterSection>

                            <FilterSection title="Chapter" delay={0.10}>
                                {chapterCount === 0 ? (
                                    <p
                                        className="text-[12px] italic"
                                        style={{ color: "var(--base-400)" }}
                                    >
                                        Select a subject first
                                    </p>
                                ) : (
                                    Array.from({ length: chapterCount }, (_, i) => i + 1).map(n => (
                                        <Chip key={n} label={String(n)} active={draft.chapters.includes(n)} onToggle={() => toggleNum("chapters", n)} />
                                    ))
                                )}
                            </FilterSection>

                            <FilterSection title="Difficulty" delay={0.14}>
                                {DIFFICULTIES.map(d => (
                                    <Chip key={d.value} label={d.label} active={draft.difficulties.includes(d.value)} onToggle={() => toggleStr("difficulties", d.value)} />
                                ))}
                            </FilterSection>

                            <FilterSection title="Type" delay={0.18}>
                                {QUESTION_TYPES.map(t => (
                                    <Chip key={t.value} label={t.label} active={draft.questionTypes.includes(t.value)} onToggle={() => toggleStr("questionTypes", t.value)} />
                                ))}
                            </FilterSection>

                            <FilterSection title="Marks" delay={0.22}>
                                {MARKS_OPTIONS.map(m => (
                                    <Chip key={m} label={String(m)} active={draft.marks.includes(m)} onToggle={() => toggleNum("marks", m)} />
                                ))}
                            </FilterSection>

                            {!((ctx?.allowedStudySubjects ?? []).includes("Physics")) && (
                                <FilterSection title="Source" delay={0.26}>
                                    {SOURCES.map(s => (
                                        <Chip key={s.value} label={s.label} active={draft.sources.includes(s.value)} onToggle={() => toggleStr("sources", s.value)} />
                                    ))}
                                </FilterSection>
                            )}
                        </div>

                        {/* Footer */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: 0.28 }}
                            className="flex items-center justify-between px-4 py-3 border-t shrink-0"
                            style={{ borderColor: "var(--base-200)" }}
                        >
                            <button
                                type="button"
                                onClick={clearAll}
                                disabled={draftCount === 0}
                                className="text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                style={{ color: "var(--base-400)" }}
                                onMouseEnter={e => { if (draftCount > 0) (e.currentTarget as HTMLButtonElement).style.color = "var(--base-700)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--base-400)"; }}
                            >
                                Clear all
                            </button>
                            <button
                                type="button"
                                onClick={apply}
                                disabled={!hasChanges}
                                className="px-4 py-1.5 rounded-full text-white text-[13px] font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ backgroundColor: "var(--primary-400)", cursor: !hasChanges ? "not-allowed" : "pointer" }}
                                onMouseEnter={e => { if (hasChanges) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--primary-500)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--primary-400)"; }}
                            >
                                Apply
                            </button>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body,
            )}
        </>
    );
}

// ─── Refresh button (left header, next to filter) ────────────────────────────

export function StudyFeedShellRefreshButton() {
    const ctx = useContext(StudyFeedHeaderContext);
    const [refreshCooling, setRefreshCooling] = useState(false);
    const [spinning, setSpinning] = useState(false);
    const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const spinRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleRefresh = useCallback(() => {
        if (!ctx || refreshCooling) return;
        ctx.refreshFeed();
        setRefreshCooling(true);
        setSpinning(true);
        cooldownRef.current = setTimeout(() => setRefreshCooling(false), 10000);
        spinRef.current = setTimeout(() => setSpinning(false), 700);
    }, [ctx, refreshCooling]);

    useEffect(() => () => {
        if (cooldownRef.current) clearTimeout(cooldownRef.current);
        if (spinRef.current) clearTimeout(spinRef.current);
    }, []);

    if (!ctx) return null;

    return (
        <button
            type="button"
            disabled={refreshCooling}
            onClick={handleRefresh}
            aria-label="Refresh feed"
            title={refreshCooling ? "Please wait…" : "Refresh feed"}
            className="max-lg:hidden lg:inline-flex lg:items-center lg:justify-center p-1.5 my-[7px] rounded-md transition-colors shrink-0 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: "var(--base-500)", cursor: refreshCooling ? "not-allowed" : "pointer" }}
            onMouseEnter={e => { if (!refreshCooling) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--base-200)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
        >
            <IconRefreshCcw
                className="w-5 h-5"
                style={{
                    transition: "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: spinning ? "rotate(-360deg)" : "rotate(0deg)",
                }}
            />
        </button>
    );
}

// ─── Right header cluster ─────────────────────────────────────────────────────

export function StudyFeedShellHeaderRight() {
    const ctx = useContext(StudyFeedHeaderContext);
    const [timerBlurred, setTimerBlurred] = useState(false);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearPendingBlur = useCallback(() => {
        if (blurTimerRef.current) { clearTimeout(blurTimerRef.current); blurTimerRef.current = null; }
    }, []);

    const armBlur = useCallback(() => {
        clearPendingBlur();
        blurTimerRef.current = setTimeout(() => setTimerBlurred(true), 5000);
    }, [clearPendingBlur]);

    useEffect(() => {
        armBlur();
        return () => clearPendingBlur();
    }, [armBlur, clearPendingBlur]);

    if (!ctx) return null;

    const { metrics } = ctx;
    const mm = String(Math.floor(metrics.elapsedSec / 60)).padStart(2, "0");
    const ss = String(metrics.elapsedSec % 60).padStart(2, "0");

    return (
        <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Streak pill */}
            <div
                className="flex items-center justify-center gap-2 h-9 px-4 my-[7px] rounded-full text-[14px] font-medium cursor-default border bg-[#FAF6E7] text-amber-900 border-amber-300/80"
                style={{ fontFamily: "var(--font-inter)" }}
                title="Current streak"
            >
                <IconFlame className="w-4 h-4 shrink-0 text-amber-800" />
                <span
                    style={{
                        display: "inline-flex",
                        overflow: "hidden",
                        height: "1.25em",
                        alignItems: "center",
                        minWidth: `${String(metrics.streak).length * 0.62 + 0.1}em`,
                        justifyContent: "center",
                    }}
                >
                    <AnimatePresence initial={false} mode="popLayout">
                        <motion.span
                            key={metrics.streak}
                            className="tabular-nums text-amber-900 font-semibold"
                            style={{ display: "block", lineHeight: 1 }}
                            initial={{ y: "110%", opacity: 0 }}
                            animate={{ y: "0%", opacity: 1 }}
                            exit={{ y: "-110%", opacity: 0 }}
                            transition={{ duration: 0.5, ease: [0.45, 0, 0.55, 1] }}
                        >
                            {metrics.streak}
                        </motion.span>
                    </AnimatePresence>
                </span>
            </div>

            {/* Timer — desktop only; mobile header stays compact */}
            <div
                role="timer"
                className="max-lg:hidden lg:flex items-center gap-2 px-2 py-1 my-[7px] rounded-md min-w-[5.5rem] justify-center cursor-default select-none"
                onMouseEnter={() => { setTimerBlurred(false); clearPendingBlur(); }}
                onMouseLeave={() => armBlur()}
                style={{ fontFamily: "var(--font-inter)" }}
            >
                <span
                    className="transition-[filter,opacity] duration-300 ease-out"
                    style={{ filter: timerBlurred ? "blur(5px)" : "blur(0px)", opacity: timerBlurred ? 0.88 : 1 }}
                >
                    <IconClockStudy className="w-5 h-5 shrink-0 text-[var(--base-600)]" />
                </span>
                <span
                    className="text-[15px] tabular-nums transition-[filter,opacity] duration-300 ease-out"
                    style={{
                        color: "var(--base-700)",
                        filter: timerBlurred ? "blur(6px)" : "blur(0px)",
                        opacity: timerBlurred ? 0.9 : 1,
                    }}
                >
                    {mm}:{ss}
                </span>
            </div>

            {/* Right panel toggle — hidden until wired up */}
        </div>
    );
}
