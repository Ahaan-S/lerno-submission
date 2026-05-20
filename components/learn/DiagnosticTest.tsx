"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type Phase = "intro" | "loading" | "questions" | "done" | "empty";

interface GeneratedQuestion {
  id: string;
  question_text: string;
  options: Array<{ id: string; text: string; is_correct: boolean }>;
  topic_hint: string;
  topic_name?: string;
}

interface DiagnosticAnswer {
  question_id: string;
  topic_index: string;
  topic_name: string;
  is_correct: boolean;
}

const QUESTION_COUNT = 6;

function shuffleOptions<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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

const QUESTION_MD_CLASS =
  "text-left text-[16px] sm:text-[18px] font-medium leading-relaxed [&_p]:text-[16px] [&_p]:sm:text-[18px] [&_p]:font-medium [&_p]:leading-relaxed [&_p]:mb-3 [&_p]:last:mb-0 [&_li]:text-[16px] [&_li]:sm:text-[18px] [&_li]:font-medium [&_ul]:my-2 [&_ol]:my-2";

const OPTION_GRID_CLASS = "grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3 w-full min-w-0";

const MCQ_BTN_BASE =
  "mcq-btn relative w-full min-h-[3.25rem] lg:min-h-[5.5rem] px-3 sm:px-4 py-3 rounded-2xl text-center text-[15px] sm:text-[16px] font-semibold select-none flex items-center justify-center min-w-0";

function OptionContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
      components={{ p: ({ children }) => <span className="leading-snug break-words">{children}</span> }}
    >
      {text.trim()}
    </ReactMarkdown>
  );
}

function CenteredPhase({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-0 px-6 py-12">
      <div className="w-full max-w-[520px]">
        {children}
      </div>
    </div>
  );
}

export default function DiagnosticTest({
  subject,
  subjectLabel,
  chapterIndex,
  chapterName,
  grade = 10,
}: {
  subject: string;
  subjectLabel: string;
  chapterIndex: number;
  chapterName: string;
  grade?: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [preparedSessionId, setPreparedSessionId] = useState<string | null>(null);
  const [preparingSession, setPreparingSession] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState(false);
  const prewarmStartedRef = useRef(false);

  // Pre-fetch promise fires immediately on mount so questions are ready by the time
  // the student finishes reading the "Before we start" intro and clicks "Let's go".
  const prefetchRef = useRef<Promise<GeneratedQuestion[]> | null>(null);

  const cacheKey = `diag_qs:${grade}:${subject}:${chapterIndex}`;

  /** Fetch AI-generated diagnostic questions from /api/learn/diagnostic/generate. */
  const fetchFromGenerate = async (): Promise<GeneratedQuestion[]> => {
    const res = await fetch("/api/learn/diagnostic/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ subject, chapter_index: chapterIndex, chapter_name: chapterName, grade }),
    });
    const data = (await res.json()) as {
      questions?: Array<{
        id: number;
        question: string;
        options: Record<string, string>;
        correct: string;
        topic_hint: string;
      }>;
    };
    return (data.questions ?? []).map((q) => ({
      id: String(q.id),
      question_text: q.question,
      options: shuffleOptions(
        Object.entries(q.options).map(([key, text]) => ({
          id: key,
          text,
          is_correct: key === q.correct,
        }))
      ),
      topic_hint: q.topic_hint,
    }));
  };

  // Fire the fetch immediately on mount (while student reads the intro screen).
  useEffect(() => {
    const doFetch = async (): Promise<GeneratedQuestion[]> => {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached) as GeneratedQuestion[];
      } catch { /* sessionStorage unavailable */ }

      const qs = await fetchFromGenerate();

      try {
        if (qs.length > 0) sessionStorage.setItem(cacheKey, JSON.stringify(qs));
      } catch { /* ignore quota errors */ }

      return qs;
    };

    prefetchRef.current = doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Topic results helper ───────────────────────────────────────────────────

  const buildTopicResults = (finalAnswers: DiagnosticAnswer[]) => {
    const topicMap: Record<string, { topic_name: string; correct: number; total: number }> = {};
    for (const a of finalAnswers) {
      if (!topicMap[a.topic_index]) topicMap[a.topic_index] = { topic_name: a.topic_name, correct: 0, total: 0 };
      topicMap[a.topic_index].total++;
      if (a.is_correct) topicMap[a.topic_index].correct++;
    }
    return Object.entries(topicMap).map(([topic_index, v]) => ({
      topic_index,
      topic_name: v.topic_name,
      correct: v.correct,
      total: v.total,
    }));
  };

  // ── Session prewarm (fires after questions are answered, before student clicks "Begin") ──

  const prepareSessionAndKickoff = async (topicResults: { topic_index: string; topic_name: string; correct: number; total: number }[]) => {
    if (prewarmStartedRef.current) return;
    prewarmStartedRef.current = true;
    setPreparingSession(true);
    setPrepareFailed(false);
    try {
      const res = await fetch("/api/learn/diagnostic/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject, chapter_index: chapterIndex, chapter_name: chapterName, grade, topic_results: topicResults, skipped: false }),
      });
      const data = (await res.json()) as { session_id?: string };
      if (!data.session_id) throw new Error("missing session_id");
      setPreparedSessionId(data.session_id);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`learn_kickoff_prewarm:${data.session_id}`, "1");
      }

      void (async () => {
        try {
          const kickoffRes = await fetch("/api/learn/kickoff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            keepalive: true,
            body: JSON.stringify({ session_id: data.session_id, subject, chapter_index: chapterIndex, chapter_name: chapterName, grade }),
          });
          if (!kickoffRes.body) return;
          const reader = kickoffRes.body.getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        } catch { /* Non-blocking optimization only. */ }
      })();
    } catch {
      setPrepareFailed(true);
      prewarmStartedRef.current = false;
    } finally {
      setPreparingSession(false);
    }
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const startDiagnostic = async () => {
    // If prefetch already resolved, this is instant. If still in flight, we show the
    // loading spinner for just the remaining wait time (much less than a cold fetch).
    setPhase("loading");
    try {
      const qs = await (prefetchRef.current ?? fetchFromGenerate());
      if (!qs.length) { setPhase("empty"); return; }
      setQuestions(qs.slice(0, QUESTION_COUNT));
      setPhase("questions");
    } catch {
      setPhase("empty");
    }
  };

  const completeAndNavigate = async (
    topicResults: { topic_index: string; topic_name: string; correct: number; total: number }[],
    skipped: boolean,
  ) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/learn/diagnostic/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject, chapter_index: chapterIndex, chapter_name: chapterName, grade, topic_results: topicResults, skipped }),
      });
      const data = (await res.json()) as { session_id?: string };
      if (data.session_id) {
        router.push(`/learn/${subject}/session/${data.session_id}`);
        return;
      }
    } catch { /* non-fatal */ }
    router.push(`/learn/${subject}`);
  };

  const skipAll = (skipped: boolean) => { void completeAndNavigate([], skipped); };

  const recordAnswer = (isCorrect: boolean): DiagnosticAnswer[] => {
    const q = questions[currentIdx];
    const answer: DiagnosticAnswer = {
      question_id: q.id,
      topic_index: q.topic_hint,
      topic_name: q.topic_name ?? q.topic_hint,
      is_correct: isCorrect,
    };
    const updated = [...answers, answer];
    setAnswers(updated);
    return updated;
  };

  const advance = (updatedAnswers: DiagnosticAnswer[]) => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
    } else {
      setPhase("done");
      void prepareSessionAndKickoff(buildTopicResults(updatedAnswers));
    }
  };

  const handleOptionSelect = (optionId: string) => { if (selected) return; setSelected(optionId); };

  const handleNext = () => {
    const q = questions[currentIdx];
    if (!selected || !q?.options) return;
    const correctId = q.options.find((o) => o.is_correct)?.id;
    advance(recordAnswer(selected === correctId));
  };

  const handleNotSure = () => {
    if (selected) return;
    advance(recordAnswer(false));
  };

  const mcqStateClass = (isSel: boolean, showResult: boolean, isCorrectOpt: boolean): string => {
    if (showResult) {
      if (isCorrectOpt) return "mcq-correct";
      if (isSel) return "mcq-wrong";
      return "mcq-dimmed";
    }
    return isSel ? "mcq-selected" : "cursor-pointer";
  };

  // ── Intro ──────────────────────────────────────────────────────────────────

  if (phase === "intro") {
    return (
      <CenteredPhase>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-8 text-center"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <div className="flex flex-col gap-3">
            <h1 className="text-[32px] font-semibold" style={{ fontFamily: "var(--font-crimson-pro)", color: "var(--base-800)" }}>
              Before we start
            </h1>
            <p className="text-[16px] leading-[1.7]" style={{ color: "var(--base-500)" }}>
              It&apos;s your first time with{" "}
              <span style={{ color: "var(--base-700)", fontWeight: 500 }}>{chapterName}</span>.
              Let&apos;s do a quick informal check to see what you already know.
            </p>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--base-400)" }}>
              Answer what you can, tap &ldquo;I&apos;m not sure&rdquo; if you don&apos;t know.
              No pressure, no score — it just helps your tutor personalise the session for you.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={startDiagnostic}
              className="h-12 rounded-xl text-white text-[15px] font-medium transition-opacity hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: "var(--primary-400)" }}>
              Let&apos;s go
            </button>
            <button type="button" onClick={() => skipAll(true)} disabled={submitting}
              className="h-9 text-[13px] cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-40"
              style={{ color: "var(--base-400)" }}>
              Skip, start learning directly
            </button>
          </div>
        </motion.div>
      </CenteredPhase>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <CenteredPhase>
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "var(--primary-400)" }}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <p className="text-[13px]" style={{ color: "var(--base-400)", fontFamily: "var(--font-inter)" }}>
            Getting your questions ready...
          </p>
        </div>
      </CenteredPhase>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (phase === "empty") {
    return (
      <CenteredPhase>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-5 text-center" style={{ fontFamily: "var(--font-inter)" }}>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--base-500)" }}>
            Couldn&apos;t load questions for this chapter. Let&apos;s jump straight into learning.
          </p>
          <button type="button" onClick={() => skipAll(true)} disabled={submitting}
            className="h-11 px-8 rounded-xl text-white text-[15px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: "var(--primary-400)" }}>
            {submitting ? "Starting..." : "Start Learning"}
          </button>
        </motion.div>
      </CenteredPhase>
    );
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  if (phase === "done") {
    const correct = answers.filter((a) => a.is_correct).length;
    const total = answers.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const summaryText =
      pct >= 70
        ? "Solid start. Your tutor will move through the familiar parts faster and spend more time on the trickier topics."
        : pct >= 40
        ? "Good to know where you're starting from. Your tutor will personalise the session based on this."
        : "No worries at all — that's exactly what this is for. Your tutor will start from the beginning and adjust the pace as you go.";

    return (
      <CenteredPhase>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-6"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-[28px] font-semibold" style={{ fontFamily: "var(--font-crimson-pro)", color: "var(--base-800)" }}>
              Quick check done
            </h2>
            {total > 0 && <p className="text-[14px]" style={{ color: "var(--base-400)" }}>{correct} of {total} correct</p>}
          </div>
          <div className="rounded-xl border px-5 py-4" style={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0" }}>
            <p className="text-[14px] leading-[1.65]" style={{ color: "var(--base-600)" }}>{summaryText}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (preparedSessionId) {
                router.push(`/learn/${subject}/session/${preparedSessionId}`);
                return;
              }
              if (preparingSession) return;
              void completeAndNavigate(buildTopicResults(answers), false);
            }}
            disabled={submitting || preparingSession}
            className="w-full h-12 rounded-xl text-white text-[15px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: "var(--primary-400)" }}>
            {submitting || preparingSession ? "Preparing..." : `Begin Chapter ${chapterIndex}`}
          </button>
          {prepareFailed && (
            <p className="text-[12px]" style={{ color: "var(--base-400)" }}>
              Couldn&apos;t pre-load the first tutor message. You can still continue.
            </p>
          )}
        </motion.div>
      </CenteredPhase>
    );
  }

  // ── Questions ──────────────────────────────────────────────────────────────

  const q = questions[currentIdx];
  if (!q?.options) return null;

  const correctId = q.options.find((o) => o.is_correct)?.id;
  const revealed = !!selected;

  const SubmitRow = () => (
    <div className="flex flex-col items-center gap-2 min-w-0">
      {revealed ? (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          type="button"
          onClick={handleNext}
          className="flex w-full min-w-0 items-center justify-center gap-2 px-6 py-3 rounded-xl text-[16px] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
          style={{ backgroundColor: "var(--primary-400)" }}
        >
          {currentIdx < questions.length - 1 ? "Next" : "See summary"}
        </motion.button>
      ) : selected ? (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          type="button"
          onClick={handleNext}
          className="flex w-full min-w-0 items-center justify-center gap-2 px-6 py-3 rounded-xl text-[16px] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
          style={{ backgroundColor: "var(--primary-400)" }}
        >
          Submit answer
        </motion.button>
      ) : (
        <button
          type="button"
          onClick={handleNotSure}
          className="flex w-full min-w-0 items-center justify-center gap-2 px-6 py-3 rounded-xl text-[16px] font-semibold cursor-pointer transition-colors hover:bg-slate-100"
          style={{ backgroundColor: "var(--base-50, #f8fafc)", color: "var(--base-500)", border: "1.5px solid var(--base-200)" }}
        >
          I&apos;m not sure
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full lg:p-4 lg:gap-3" style={{ fontFamily: "var(--font-inter)" }}>
      {/* Progress */}
      <div className="flex flex-col gap-1.5 shrink-0 px-3 sm:px-4 pt-1 pb-2 lg:px-0 lg:pt-0 lg:pb-0">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium" style={{ color: "var(--primary-400)" }}>
            {currentIdx + 1} of {questions.length}
          </p>
          <button
            type="button"
            onClick={() => {
              const current = [...answers];
              setPhase("done");
              void prepareSessionAndKickoff(buildTopicResults(current));
            }}
            className="text-[12px] cursor-pointer hover:opacity-70 transition-opacity"
            style={{ color: "var(--base-300)" }}
          >
            Skip rest
          </button>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--primary-400)" }}
            animate={{ width: `${(currentIdx / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.18 }}
          className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        >
          {/* Card header */}
          <div className="shrink-0 px-3 sm:px-4 pt-2 sm:pt-3.5 pb-2 sm:pb-3.5 flex items-center gap-2 justify-between border-b border-[var(--base-200)] min-w-0 overflow-hidden">
            <span className="text-[13px] font-medium text-[var(--base-700)]">{subjectLabel}</span>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
              style={{ backgroundColor: "var(--primary-50, #f0f4ff)", color: "var(--primary-500, #4f6ef7)", borderColor: "var(--primary-200, #c7d2fe)" }}
            >
              Quick check
            </span>
          </div>

          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            {/* Mobile: single scroll */}
            <div className="study-feed-scroll lg:hidden flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
              <div className="flex flex-col" style={{ minHeight: "100%" }}>
                <div className="flex-1 px-4 sm:px-6 pt-6 sm:pt-8 pb-3 min-w-0 max-w-none text-[var(--base-800)] space-y-5">
                  <MarkdownRenderer content={q.question_text} bodyClassName={QUESTION_MD_CLASS} />
                  <div className={OPTION_GRID_CLASS}>
                    {q.options.map((opt) => {
                      const isSel = selected === opt.id;
                      const isCorrectOpt = opt.id === correctId;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={revealed}
                          onClick={() => handleOptionSelect(opt.id)}
                          className={`${MCQ_BTN_BASE} ${mcqStateClass(isSel, revealed, isCorrectOpt)}`}
                          style={{ fontFamily: "var(--font-inter)" }}
                        >
                          <OptionContent text={opt.text} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-auto px-4 sm:px-6 pt-4 pb-6 sm:pb-8 min-w-0">
                  <SubmitRow />
                </div>
              </div>
            </div>

            {/* Desktop: split scroll */}
            <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
              <div className="study-feed-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="space-y-5 px-8 pt-8 pb-4 min-w-0 max-w-none text-[var(--base-800)]">
                  <MarkdownRenderer content={q.question_text} bodyClassName={QUESTION_MD_CLASS} />
                </div>
              </div>
              <div className="study-feed-scroll shrink-0 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-6 space-y-5 min-w-0">
                <div className={OPTION_GRID_CLASS}>
                  {q.options.map((opt) => {
                    const isSel = selected === opt.id;
                    const isCorrectOpt = opt.id === correctId;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={revealed}
                        onClick={() => handleOptionSelect(opt.id)}
                        className={`${MCQ_BTN_BASE} ${mcqStateClass(isSel, revealed, isCorrectOpt)}`}
                        style={{ fontFamily: "var(--font-inter)" }}
                      >
                        <span className="line-clamp-3 w-full text-center">
                          <OptionContent text={opt.text} />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <SubmitRow />
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
