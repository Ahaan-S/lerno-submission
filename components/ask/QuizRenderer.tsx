// components/ask/QuizRenderer.tsx
// Interactive quiz rendered inline in the chat thread.
// Design: Lerno aesthetic — follows StudyFeed card patterns.
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import type {
  QuizDocument,
  QuizQuestion,
  QuizAnswerState,
  QuizOption,
} from "@/lib/ai/doc-types";

// ── Markdown + LaTeX renderer ─────────────────────────────────────────────────

const KATEX_OPTIONS = { strict: false, trust: true };

/**
 * Inline renderer — wraps text in a <span> so it flows naturally inside
 * paragraphs, list items, option labels, etc. Supports $…$ and $$…$$.
 */
function QuizMd({ children, className }: { children: string; className?: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
      components={{
        // Render paragraphs as spans so they don't break flex/block layout
        p: ({ children }) => <span className={className}>{children}</span>,
        // Preserve list styling inside answers
        ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // Bold / italic pass-through
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        // Inline code
        code: ({ children }) => (
          <code className="px-1 py-0.5 rounded text-[12px] font-mono bg-slate-100 text-slate-700">
            {children}
          </code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

/**
 * Block renderer — renders as a full <div> with block-level elements.
 * Use for model answers and key points where paragraphs should stack.
 */
function QuizMdBlock({ children, className }: { children: string; className?: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
      components={{
        p: ({ children }) => <p className={`leading-relaxed ${className ?? ""}`}>{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        code: ({ children }) => (
          <code className="px-1 py-0.5 rounded text-[12px] font-mono bg-slate-100 text-slate-700">
            {children}
          </code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

// ── Source formatting (mirrors StudyFeed logic) ───────────────────────────────

function formatSourceLabel(q: QuizQuestion): string | null {
  const src = (q.source ?? "").trim();
  if (!src || src === "unknown") return null;
  if (src === "sqp") {
    const parts = ["SQP"];
    const year = (q as any).sqp_year ?? (q as any).pyq_year;
    if (year != null) parts.push(String(year));
    const rawCode = ((q as any).sqp_set_code ?? (q as any).pyq_set_code)?.trim();
    if (rawCode) {
      const match = rawCode.match(/set[\s\-_]*(\w+)/i);
      parts.push(match ? `Set ${match[1]}` : rawCode);
    }
    return parts.join(" · ");
  }
  if (src === "pyq") {
    const parts = ["PYQ"];
    const year = (q as any).pyq_year;
    if (year != null) parts.push(String(year));
    return parts.join(" · ");
  }
  const ncert: Record<string, string> = {
    ncert_exercise: "NCERT Exercise",
    ncert_intext: "NCERT Intext",
    ncert_exemplar: "NCERT Exemplar",
  };
  if (ncert[src]) return ncert[src];
  if (src === "ai_generated") return null;
  return src.replace(/_/g, " ");
}

function DifficultyBadge({ d }: { d: string }) {
  const tone =
    d === "easy"   ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
    d === "hard"   ? "bg-rose-50 text-rose-800 border-rose-200" :
                     "bg-amber-50 text-amber-900 border-amber-200";
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize shrink-0 ${tone}`}
      style={{ fontFamily: "var(--font-inter)" }}>
      {d}
    </span>
  );
}

// ── Shared card chrome (header + wrapper) ─────────────────────────────────────

function QuestionCard({
  question,
  globalNumber,
  typeLabel,
  children,
}: {
  question: QuizQuestion;
  globalNumber: number;
  typeLabel: string;
  children: React.ReactNode;
}) {
  const sourceLabel = formatSourceLabel(question);

  return (
    <div
      className="rounded-2xl overflow-hidden bg-white"
      style={{
        border: "1px solid var(--base-200, #e2e8f0)",
        fontFamily: "var(--font-inter)",
      }}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--base-100, #f1f5f9)", background: "#fafafa" }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <span
            className="shrink-0 font-semibold tabular-nums"
            style={{ fontSize: 12, color: "var(--base-400, #94a3b8)" }}
          >
            Q{globalNumber}
          </span>
          <span style={{ color: "var(--base-300, #cbd5e1)" }} aria-hidden>·</span>
          <span
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: "var(--base-100, #f1f5f9)", color: "var(--base-500, #64748b)" }}
          >
            {typeLabel}
          </span>
          {question.topic_name && (
            <>
              <span style={{ color: "var(--base-300, #cbd5e1)" }} aria-hidden>·</span>
              <span
                className="truncate text-[12px] min-w-0"
                style={{ color: "var(--base-500, #64748b)" }}
              >
                {question.topic_name}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sourceLabel && (
            <span
              className="text-[11px] font-medium whitespace-nowrap"
              style={{ color: "var(--base-400, #94a3b8)" }}
            >
              {sourceLabel}
            </span>
          )}
          <span
            className="text-[11px] tabular-nums whitespace-nowrap"
            style={{ color: "var(--base-400, #94a3b8)" }}
          >
            {question.marks} {question.marks === 1 ? "mark" : "marks"}
          </span>
          <DifficultyBadge d={question.difficulty} />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Option button (MCQ) ───────────────────────────────────────────────────────

function OptionButton({
  option,
  isSelected,
  isRevealed,
  onClick,
}: {
  option: QuizOption;
  isSelected: boolean;
  isRevealed: boolean;
  onClick: () => void;
}) {
  let bg = "bg-white";
  let border = "border-[var(--base-200,#e2e8f0)]";
  let textColor = "text-[var(--base-700,#334155)]";
  let letterBg = "bg-[var(--base-100,#f1f5f9)] text-[var(--base-500,#64748b)]";
  let cursor = "cursor-pointer hover:border-[var(--primary-300,#93c5fd)] hover:bg-[var(--primary-50,#eff6ff)] active:scale-[0.99]";

  if (isRevealed) {
    cursor = "cursor-default";
    if (option.is_correct) {
      bg = "bg-emerald-50"; border = "border-emerald-300"; textColor = "text-emerald-900";
      letterBg = "bg-emerald-100 text-emerald-700";
    } else if (isSelected) {
      bg = "bg-red-50"; border = "border-red-300"; textColor = "text-red-900";
      letterBg = "bg-red-100 text-red-700";
    } else {
      bg = "bg-[#fafafa]"; border = "border-[var(--base-100)]"; textColor = "text-[var(--base-400)]";
      letterBg = "bg-[var(--base-100)] text-[var(--base-400)]";
    }
  } else if (isSelected) {
    bg = "bg-[var(--primary-50,#eff6ff)]"; border = "border-[var(--primary-400,#60a5fa)]";
    textColor = "text-[var(--primary-900,#1e3a8a)]";
    letterBg = "bg-[var(--primary-100,#dbeafe)] text-[var(--primary-700,#1d4ed8)]";
    cursor = "cursor-default";
  }

  return (
    <button
      type="button"
      onClick={isRevealed ? undefined : onClick}
      disabled={isRevealed}
      className={`w-full text-left px-4 py-3 rounded-xl border text-[13.5px] flex gap-3 items-start transition-all duration-150 ${bg} ${border} ${textColor} ${cursor}`}
    >
      <span className={`shrink-0 size-[22px] rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5 uppercase ${letterBg}`}>
        {option.id}
      </span>
      <span className="flex-1 leading-relaxed">
        <QuizMd>{option.text}</QuizMd>
      </span>
      {isRevealed && option.is_correct && (
        <svg className="shrink-0 mt-0.5 text-emerald-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      )}
      {isRevealed && isSelected && !option.is_correct && (
        <svg className="shrink-0 mt-0.5 text-red-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      )}
    </button>
  );
}

// ── MCQ Card ──────────────────────────────────────────────────────────────────

function MCQCard({
  question,
  globalNumber,
  answerState,
  onAnswer,
}: {
  question: QuizQuestion;
  globalNumber: number;
  answerState: QuizAnswerState[string] | undefined;
  onAnswer: (questionId: string, optionId: string, isCorrect: boolean) => void;
}) {
  const isRevealed = !!answerState?.selected_option;
  const typeLabel =
    question.question_type === "assertion_reasoning" ? "Assertion & Reason" :
    question.question_type === "true_false" ? "True / False" :
    "MCQ";

  return (
    <QuestionCard question={question} globalNumber={globalNumber} typeLabel={typeLabel}>
      {/* Question text */}
      <div className="text-[14px] leading-relaxed mb-4" style={{ color: "var(--base-800, #1e293b)" }}>
        <QuizMdBlock>{question.question_text}</QuizMdBlock>
      </div>

      <div className="space-y-2">
        {(question.options ?? []).map((opt) => (
          <OptionButton
            key={opt.id}
            option={opt}
            isSelected={answerState?.selected_option === opt.id}
            isRevealed={isRevealed}
            onClick={() => onAnswer(question.id, opt.id, opt.is_correct)}
          />
        ))}
      </div>

      {isRevealed && (
        <div className={`mt-3 px-4 py-3 rounded-xl text-[13px] leading-relaxed flex items-start gap-2.5 ${
          answerState?.is_correct ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
        }`}>
          {answerState?.is_correct ? (
            <svg className="shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg className="shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          )}
          <span className="flex-1">
            {answerState?.is_correct
              ? "Correct!"
              : `Incorrect — the right answer is (${(question.correct_option ?? "").toUpperCase()})`}
            {!answerState?.is_correct && question.hints?.[0] && (
              <>
                {" · "}
                <span style={{ opacity: 0.75 }}>
                  <QuizMd>{question.hints[0]}</QuizMd>
                </span>
              </>
            )}
          </span>
        </div>
      )}
    </QuestionCard>
  );
}

// ── Short Answer Card ─────────────────────────────────────────────────────────

function ShortAnswerCard({
  question,
  globalNumber,
  revealed,
  onReveal,
}: {
  question: QuizQuestion;
  globalNumber: number;
  revealed: boolean;
  onReveal: () => void;
}) {
  const [value, setValue] = useState("");

  return (
    <QuestionCard question={question} globalNumber={globalNumber} typeLabel="Short Answer">
      {/* Question text */}
      <div className="text-[14px] leading-relaxed mb-4" style={{ color: "var(--base-800, #1e293b)" }}>
        <QuizMdBlock>{question.question_text}</QuizMdBlock>
      </div>

      {!revealed ? (
        <div className="space-y-3">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Write your answer here..."
            rows={3}
            className="w-full resize-none rounded-xl px-4 py-3 text-[13.5px] leading-relaxed outline-none transition-all duration-150"
            style={{
              border: "1.5px solid var(--base-200, #e2e8f0)",
              fontFamily: "var(--font-inter)",
              color: "var(--base-700, #334155)",
              background: "#fafafa",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--primary-400, #60a5fa)")}
            onBlur={e => (e.currentTarget.style.borderColor = "var(--base-200, #e2e8f0)")}
          />
          <button
            type="button"
            onClick={onReveal}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
            style={{ background: "var(--primary-500, #3b82f6)", color: "#fff", fontFamily: "var(--font-inter)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#2563eb")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--primary-500, #3b82f6)")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
            Check model answer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {value.trim() && (
            <div className="rounded-xl px-4 py-3" style={{ background: "var(--base-50, #f8fafc)", border: "1px solid var(--base-200, #e2e8f0)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--base-400, #94a3b8)" }}>Your answer</p>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-line" style={{ color: "var(--base-600, #475569)" }}>{value}</p>
            </div>
          )}
          <div className="rounded-xl px-4 py-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#16a34a" }}>Model answer</p>
            <div className="text-[13.5px] space-y-1" style={{ color: "#14532d" }}>
              <QuizMdBlock>{question.model_answer ?? ""}</QuizMdBlock>
            </div>
          </div>
          {(question.key_points ?? []).length > 0 && (
            <div className="rounded-xl px-4 py-3" style={{ background: "#fafafa", border: "1px solid var(--base-200)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--base-400)" }}>Key points to include</p>
              <ul className="space-y-1.5">
                {question.key_points!.map((pt, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px]" style={{ color: "var(--base-600)" }}>
                    <span className="shrink-0 mt-[5px] rounded-full" style={{ width: 5, height: 5, background: "#93c5fd", flexShrink: 0 }} />
                    <span className="leading-relaxed flex-1">
                      <QuizMd>{pt}</QuizMd>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </QuestionCard>
  );
}

// ── Long Answer Card ──────────────────────────────────────────────────────────

function LongAnswerCard({
  question,
  globalNumber,
  revealed,
  onReveal,
}: {
  question: QuizQuestion;
  globalNumber: number;
  revealed: boolean;
  onReveal: () => void;
}) {
  const [value, setValue] = useState("");

  return (
    <QuestionCard question={question} globalNumber={globalNumber} typeLabel="Long Answer">
      {/* Question text */}
      <div className="text-[14px] leading-relaxed mb-4" style={{ color: "var(--base-800, #1e293b)" }}>
        <QuizMdBlock>{question.question_text}</QuizMdBlock>
      </div>

      {!revealed ? (
        <div className="space-y-3">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Write your answer here in detail..."
            rows={5}
            className="w-full resize-none rounded-xl px-4 py-3 text-[13.5px] leading-relaxed outline-none transition-all duration-150"
            style={{
              border: "1.5px solid var(--base-200, #e2e8f0)",
              fontFamily: "var(--font-inter)",
              color: "var(--base-700, #334155)",
              background: "#fafafa",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--primary-400, #60a5fa)")}
            onBlur={e => (e.currentTarget.style.borderColor = "var(--base-200, #e2e8f0)")}
          />
          <button
            type="button"
            onClick={onReveal}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
            style={{ background: "var(--primary-500, #3b82f6)", color: "#fff", fontFamily: "var(--font-inter)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#2563eb")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--primary-500, #3b82f6)")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
            View model answer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {value.trim() && (
            <div className="rounded-xl px-4 py-3" style={{ background: "var(--base-50, #f8fafc)", border: "1px solid var(--base-200, #e2e8f0)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--base-400, #94a3b8)" }}>Your answer</p>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-line" style={{ color: "var(--base-600, #475569)" }}>{value}</p>
            </div>
          )}
          <div className="rounded-xl px-4 py-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#16a34a" }}>Model answer</p>
            <div className="text-[13.5px] space-y-1" style={{ color: "#14532d" }}>
              <QuizMdBlock>{question.model_answer ?? ""}</QuizMdBlock>
            </div>
          </div>
          {(question.key_points ?? []).length > 0 && (
            <div className="rounded-xl px-4 py-3" style={{ background: "#fafafa", border: "1px solid var(--base-200)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--base-400)" }}>Marking points</p>
              <ul className="space-y-1.5">
                {question.key_points!.map((pt, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px]" style={{ color: "var(--base-600)" }}>
                    <span className="shrink-0 mt-[5px] rounded-full" style={{ width: 5, height: 5, background: "#93c5fd", flexShrink: 0 }} />
                    <span className="leading-relaxed flex-1">
                      <QuizMd>{pt}</QuizMd>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </QuestionCard>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1" style={{ background: "var(--base-200, #e2e8f0)" }} />
      <span
        className="text-[10px] font-bold uppercase tracking-[0.1em] whitespace-nowrap"
        style={{ color: "var(--base-400, #94a3b8)", fontFamily: "var(--font-inter)" }}
      >
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: "var(--base-200, #e2e8f0)" }} />
    </div>
  );
}

// ── Main QuizRenderer ─────────────────────────────────────────────────────────

export function QuizRenderer({ quiz }: { quiz: QuizDocument }) {
  const [answers, setAnswers] = useState<QuizAnswerState>({});
  const [revealedShort, setRevealedShort] = useState<Set<string>>(new Set());
  const [revealedLong, setRevealedLong] = useState<Set<string>>(new Set());

  const handleMCQAnswer = (questionId: string, optionId: string, isCorrect: boolean) => {
    setAnswers(prev => ({ ...prev, [questionId]: { selected_option: optionId, revealed: true, is_correct: isCorrect } }));
  };

  const answeredMCQs = quiz.mcq_questions.filter(q => answers[q.id]?.selected_option);
  const correctMCQs  = answeredMCQs.filter(q => answers[q.id]?.is_correct);
  const allMCQsAnswered = quiz.mcq_questions.length > 0 && answeredMCQs.length === quiz.mcq_questions.length;

  const totalQuestions = quiz.mcq_questions.length + quiz.short_questions.length + quiz.long_questions.length;

  return (
    <div className="w-full max-w-2xl space-y-3" style={{ fontFamily: "var(--font-inter)" }}>

      {/* ── Quiz header card ── */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{
          background: "linear-gradient(135deg, var(--primary-600, #2563eb) 0%, var(--primary-500, #3b82f6) 100%)",
          color: "#fff",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1 opacity-70"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {quiz.subject} · {quiz.scope_label}
            </p>
            <h3 className="font-bold text-[15px] leading-snug mb-3">{quiz.chapter_name}</h3>
            <div className="flex flex-wrap gap-1.5">
              {quiz.mcq_questions.length > 0 && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.18)" }}>
                  {quiz.mcq_questions.length} MCQ
                </span>
              )}
              {quiz.short_questions.length > 0 && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.18)" }}>
                  {quiz.short_questions.length} Short
                </span>
              )}
              {quiz.long_questions.length > 0 && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.18)" }}>
                  {quiz.long_questions.length} Long
                </span>
              )}
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.18)" }}>
                {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[28px] font-bold leading-none">{quiz.total_marks}</p>
            <p className="text-[10px] opacity-60 mt-0.5 font-medium">marks</p>
          </div>
        </div>
      </div>

      {/* ── Section A — MCQ ── */}
      {quiz.mcq_questions.length > 0 && (
        <div className="space-y-3">
          <SectionDivider label="Section A — Multiple Choice" />
          {quiz.mcq_questions.map((q, i) => (
            <MCQCard
              key={q.id}
              question={q}
              globalNumber={i + 1}
              answerState={answers[q.id]}
              onAnswer={handleMCQAnswer}
            />
          ))}
          {allMCQsAnswered && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: correctMCQs.length === quiz.mcq_questions.length ? "#f0fdf4" : "var(--base-50, #f8fafc)",
                border: `1px solid ${correctMCQs.length === quiz.mcq_questions.length ? "#bbf7d0" : "var(--base-200)"}`,
              }}
            >
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  width: 36, height: 36,
                  background: correctMCQs.length === quiz.mcq_questions.length ? "#dcfce7" : "var(--base-100)",
                  color: correctMCQs.length === quiz.mcq_questions.length ? "#16a34a" : "var(--base-500)",
                }}
              >
                <span className="text-[18px] font-bold tabular-nums leading-none">
                  {correctMCQs.length}/{quiz.mcq_questions.length}
                </span>
              </div>
              <div>
                <p className="font-semibold text-[13.5px]" style={{ color: "var(--base-800)" }}>
                  {correctMCQs.length === quiz.mcq_questions.length ? "All correct!" : `${correctMCQs.length} of ${quiz.mcq_questions.length} correct`}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--base-400)" }}>
                  {correctMCQs.length === quiz.mcq_questions.length
                    ? "Great work — full marks on MCQ."
                    : `Review ${quiz.mcq_questions.length - correctMCQs.length} incorrect answer${quiz.mcq_questions.length - correctMCQs.length !== 1 ? "s" : ""}.`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section B — Short Answer ── */}
      {quiz.short_questions.length > 0 && (
        <div className="space-y-3">
          <SectionDivider label="Section B — Short Answer" />
          {quiz.short_questions.map((q, i) => (
            <ShortAnswerCard
              key={q.id}
              question={q}
              globalNumber={quiz.mcq_questions.length + i + 1}
              revealed={revealedShort.has(q.id)}
              onReveal={() => setRevealedShort(prev => new Set([...prev, q.id]))}
            />
          ))}
        </div>
      )}

      {/* ── Section C — Long Answer ── */}
      {quiz.long_questions.length > 0 && (
        <div className="space-y-3">
          <SectionDivider label="Section C — Long Answer" />
          {quiz.long_questions.map((q, i) => (
            <LongAnswerCard
              key={q.id}
              question={q}
              globalNumber={quiz.mcq_questions.length + quiz.short_questions.length + i + 1}
              revealed={revealedLong.has(q.id)}
              onReveal={() => setRevealedLong(prev => new Set([...prev, q.id]))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
