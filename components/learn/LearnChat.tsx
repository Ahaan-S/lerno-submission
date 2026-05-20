"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { startTopLoader } from "@/components/ui/TopLoader";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { useStreamDisplayBuffer } from "@/lib/use-stream-display-buffer";
import { useTTS } from "@/lib/use-tts";
import { useSTT } from "@/lib/use-stt";
import { useMicDevices } from "@/lib/use-mic-devices";
import { VoiceRecordingBar, DictateButton } from "@/components/ui/VoiceRecordingBar";
import { TooltipHint } from "@/components/ui/tooltip-hint";
import { useTutoringSession } from "@/lib/tutoring-session-context";
import { ThinkingBlock, type StepEvent, type ThinkingData } from "@/components/ui/ThinkingBlock";
import type { TopicEntry } from "./TopicProgressSidebar";
import type { InlineCitation, AttachmentMeta } from "@/lib/database.types";
import type { GraphArtifact } from "@/lib/graphs/types";
import type { GeneratedDocument } from "@/lib/ai/doc-types";
import { DocumentPreviewPanel } from "@/components/ask/DocumentPreviewPanel";
import { celebrateChapterComplete } from "@/lib/learn/chapter-confetti";
import { track } from "@/lib/analytics";
import { refreshStreakAfterActivity } from "@/lib/streak-client";

// ─── Icons (same as DashboardContent) ──────────────────────────────────────

const IconMic = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
  </svg>
);
const IconSend = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
  </svg>
);
const IconCopy = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);
const IconThumbsUp = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </svg>
);
const IconThumbsDown = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
  </svg>
);
const IconCircleStop = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" /><rect x="9" y="9" width="6" height="6" rx="1" />
  </svg>
);
const IconVolume2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
    <path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
  </svg>
);
const IconSpinner = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ animation: "spin 1s linear infinite" }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
const IconCheck = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconAdd = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IconContinue = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m11.99 7.5 3.75-3.75m0 0 3.75 3.75m-3.75-3.75v16.499H4.49" />
  </svg>
);
const IconSimplify = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h6" />
  </svg>
);
const CONTINUE_MESSAGES = [
  "Got it, continue.",
  "That makes sense, keep going.",
  "Understood! What's next?",
  "I follow — move on.",
  "Clear, continue please.",
  "Makes sense, go ahead.",
  "Okay, I'm with you. Next.",
  "Got it! Keep going.",
];

const SIMPLIFY_MESSAGES = [
  "Please reteach this in simpler steps — I didn't fully understand.",
  "Can you break this down more simply? I'm a bit lost.",
  "I'm struggling with this — can you explain it differently?",
  "Could you slow down and simplify this a bit?",
  "This is confusing me — can you try a simpler explanation?",
  "Can you explain this with an easier example?",
  "I need this explained more simply, please.",
  "Can you go over this again in a clearer way?",
];

const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const IconAttach = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
  </svg>
);
const IconX = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const MESSAGE_ACTION_BUTTON_CLASS =
  "size-8 shrink-0 rounded-md flex items-center justify-center bg-transparent text-[var(--base-500)] transition-all duration-150 hover:bg-slate-200/60 active:scale-95 cursor-pointer";

// ─── KaTeX for MCQ options ──────────────────────────────────────────────────

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

function normalizeMathMarkdown(input: string): string {
  if (!input) return input;
  let out = input;
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr: string) => `$${expr}$`);
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr: string) => `$$${expr}$$`);
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr: string) => `$$${expr.replace(/\\\\/g, "\\")}$$`);
  out = out.replace(/\$([^$\n]+?)\$/g, (_, expr: string) => `$${expr.replace(/\\\\/g, "\\")}$`);
  return out;
}

function OptionContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
      components={{ p: ({ children }) => <span className="leading-tight">{children}</span> }}
    >
      {normalizeMathMarkdown(text.trim())}
    </ReactMarkdown>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  /** Short label shown in the UI instead of the full prompt (for tool-triggered messages) */
  display_content?: string;
  citations?: InlineCitation[] | null;
  graph_artifacts?: GraphArtifact[] | null;
  created_at?: string;
  thinking?: ThinkingData;
  /** Learn Mode: structured notes from `/api/tutor/generate-doc` (PDF + preview), not chat RAG */
  notesArtifact?: {
    status: "generating" | "ready" | "error";
    progressText?: string;
    document?: GeneratedDocument;
    docId?: string | null;
    errorMessage?: string;
  };
}

/** When `display_content` was not stored (older rows), derive the short bubble from the full Learn prompt. */
function learnUserDisplayFromStoredContent(content: string): string | undefined {
  const t = content.trim();
  const moveOn = t.match(/^\s*Move on to the next topic:\s*\*\*([^*]+)\*\*/);
  if (moveOn) return `Let's move on to the next topic — **${moveOn[1].trim()}**`;
  const back = t.match(/^\s*Go back to \*\*[\d.]+\s*:\s*([^*]+)\*\*/);
  if (back) return `← Back to **${back[1].trim()}**`;
  const skip = t.match(/^\s*Skip ahead to \*\*[\d.]+\s*:\s*([^*]+)\*\*/);
  if (skip) return `Skip to **${skip[1].trim()}**`;
  const qz = t.match(/^Give me a \*\*Quick Quiz\*\* on "([^"]+)"/);
  if (qz) return `Quick quiz on **${qz[1]}**`;
  if (t.startsWith("I'd like a **different teaching pattern**")) return "Explain this differently";
  const notesTopic = t.match(/^Generate NCERT study notes only for topic [\d.]+\s*\(([^)]+)\)/);
  if (notesTopic) return `Generate notes for **${notesTopic[1]}**`;
  const notesChapter = t.match(/^Generate NCERT study notes for (.+) for this entire chapter\./);
  if (notesChapter) return `Generate notes for **${notesChapter[1].trim()}**`;
  return undefined;
}

function learnUserBubbleMarkdown(msg: Message): string {
  if (msg.role !== "user") return msg.content;
  const stored = msg.display_content?.trim();
  if (stored) return stored;
  return learnUserDisplayFromStoredContent(msg.content) ?? msg.content;
}

type SsePayload = {
  type?: string;
  token?: string;
  content?: string;
  done?: boolean;
  message_id?: string;
  citations?: unknown;
  graph_artifacts?: unknown;
  error?: string;
};

function feedSseBuffer(
  buffer: string,
  chunk: string,
  onPayload: (p: SsePayload) => void | Promise<void>
): Promise<string> {
  const b = buffer + chunk;
  const lines = b.split("\n");
  const rest = lines.pop() ?? "";
  return (async () => {
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        await onPayload(JSON.parse(line.slice(6)) as SsePayload);
      } catch {
        /* ignore */
      }
    }
    return rest;
  })();
}

function parseCitations(raw: unknown): InlineCitation[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  return raw as InlineCitation[];
}

function parseGraphArtifacts(raw: unknown): GraphArtifact[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  return raw as GraphArtifact[];
}

function parseThinking(raw: unknown): ThinkingData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return raw as ThinkingData;
}

/** Strip common markdown chars before speech (avoid regex literals that confuse TSX parsers). */
function sansSpeechMarkers(text: string): string {
  return text.replace(/#/g, "").replace(/\*/g, "").replace(/`/g, "").replace(/\[/g, "").replace(/\]/g, "");
}

// ─── MCQ ───────────────────────────────────────────────────────────────────

interface MCQOption {
  letter: string;
  text: string;
}

interface MCQQuestion {
  messageIndex: number;
  question: string;
  options: MCQOption[];
  correct: string;
  answered: string | null;
}

function parseOptionLine(line: string): MCQOption | null {
  const cleaned = line.replace(/\*\*/g, "").trim();
  const match = cleaned.match(/^(?:[-*]\s*)?\(?([A-Da-d])\)?(?:[\)\].:：-])?\s+(.+)$/);
  if (!match) return null;
  const letter = match[1].toUpperCase();
  const text = match[2].trim();
  if (!text) return null;
  return { letter, text };
}

function extractMCQ(content: string): { question: string; options: MCQOption[]; correct: string } | null {
  const checkHeader = content.match(/\*\*Quick Check[^*]*\*\*/i);
  if (!checkHeader) return null;
  const afterHeader = content.slice(checkHeader.index! + checkHeader[0].length);
  const correctMatch = afterHeader.match(/(?:\*\*)?\s*Correct answer\s*:\s*([A-D])(?:\*\*)?/i);
  if (!correctMatch) return null;
  const correct = correctMatch[1].toUpperCase();
  const beforeAnswer = afterHeader.slice(0, correctMatch.index ?? afterHeader.length).trim();
  const lines = beforeAnswer.split("\n").map((l) => l.trim()).filter(Boolean);
  const options: MCQOption[] = [];
  const questionLines: string[] = [];

  for (const line of lines) {
    const parsed = parseOptionLine(line);
    if (parsed && options.length < 4) {
      options.push(parsed);
    } else if (options.length === 0) {
      questionLines.push(line.replace(/\*\*/g, "").trim());
    }
  }

  if (options.length < 4) return null;
  const ordered = ["A", "B", "C", "D"]
    .map((letter) => options.find((o) => o.letter === letter))
    .filter(Boolean) as MCQOption[];
  if (ordered.length < 4) return null;
  const questionText = questionLines.join(" ").trim();
  return { question: questionText, options: ordered, correct };
}

function stripMCQFromContent(content: string): string {
  return content.replace(/\n*\*\*Quick Check[^*]*\*\*[\s\S]*$/i, "").trim();
}

function stripQuizFromContent(content: string): string {
  // If there are 2+ correct-answer markers, it's a quiz — strip from Question 1 onwards
  if ((content.match(/\*\*Correct answer:/gi)?.length ?? 0) >= 2) {
    return content.replace(/\n*\*\*Question\s+1[:.]\*\*[\s\S]*$/i, "").trim();
  }
  return content;
}

function MCQBlock({ mcq, onAnswer }: { mcq: MCQQuestion; onAnswer: (letter: string) => void }) {
  const isAnswered = !!mcq.answered;
  const isCorrect = mcq.answered === mcq.correct;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4 rounded-2xl border border-[var(--base-200)] overflow-hidden"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="px-4 py-3 bg-[var(--base-50)] border-b border-[var(--base-200)]">
        <p className="text-[13px] font-semibold" style={{ color: "var(--base-600)" }}>Quick Check ✅</p>
        <div className="text-[15px] mt-1" style={{ color: "var(--base-800)" }}>
          <MarkdownRenderer content={normalizeMathMarkdown(mcq.question)} />
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {mcq.options.map((opt, oi) => {
          const isSelected = mcq.answered === opt.letter;
          const isCorrectOpt = opt.letter === mcq.correct;
          let bgColor = "white";
          let borderColor = "var(--base-200)";
          let textColor = "var(--base-700)";
          if (isAnswered) {
            if (isCorrectOpt) { bgColor = "#f0fdf4"; borderColor = "#22c55e"; textColor = "#15803d"; }
            else if (isSelected && !isCorrect) { bgColor = "#fef2f2"; borderColor = "#ef4444"; textColor = "#dc2626"; }
          }
          return (
            <button
              key={`mcq-${oi}-${opt.letter}`}
              type="button"
              onClick={() => !isAnswered && onAnswer(opt.letter)}
              disabled={isAnswered}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer disabled:cursor-default"
              style={{ backgroundColor: bgColor, borderColor, color: textColor }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{
                  backgroundColor: isAnswered && isCorrectOpt ? "#22c55e" : isAnswered && isSelected ? "#ef4444" : "var(--base-100)",
                  color: isAnswered && (isCorrectOpt || (isSelected && !isCorrect)) ? "white" : "var(--base-600)",
                }}
              >
                {opt.letter}
              </span>
              <span className="text-[14px] flex-1 min-w-0"><OptionContent text={opt.text} /></span>
              {isAnswered && isCorrectOpt && <span className="ml-auto text-green-600 font-medium text-[13px] shrink-0">✓ Correct</span>}
              {isAnswered && isSelected && !isCorrect && <span className="ml-auto text-red-500 font-medium text-[13px] shrink-0">✗ Wrong</span>}
            </button>
          );
        })}
      </div>
      {isAnswered && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-3 border-t border-[var(--base-200)]"
          style={{ backgroundColor: isCorrect ? "#f0fdf4" : "#fef2f2" }}
        >
          <p className="text-[14px] font-medium" style={{ color: isCorrect ? "#15803d" : "#dc2626" }}>
            {isCorrect ? "Great job! 🎉 You got it right." : `Not quite! The correct answer is ${mcq.correct}. Your tutor will explain why.`}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Multi-question Quiz ────────────────────────────────────────────────────

interface QuizQuestion {
  question: string;
  options: MCQOption[];
  correct: string;
  answered: string | null;
}

function extractQuizQuestions(content: string): Array<{ question: string; options: MCQOption[]; correct: string }> {
  const results: Array<{ question: string; options: MCQOption[]; correct: string }> = [];
  const pattern = /\*\*Question\s+\d+[:.]\*\*\s*([\s\S]*?)(?:\*\*Correct answer:\s*([A-D])\*\*)/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const block = match[1].replace(/\*\*/g, "").trim();
    const correct = (match[2] ?? "").toUpperCase();
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const options: MCQOption[] = [];
    const questionLines: string[] = [];
    for (const line of lines) {
      const parsed = parseOptionLine(line);
      if (parsed && options.length < 4) options.push(parsed);
      else if (options.length === 0) questionLines.push(line);
    }
    const ordered = ["A", "B", "C", "D"]
      .map((letter) => options.find((o) => o.letter === letter))
      .filter(Boolean) as MCQOption[];
    if (ordered.length === 4 && correct) {
      results.push({ question: questionLines.join(" ").trim(), options: ordered, correct });
    }
  }
  return results;
}

function QuizBlock({
  questions,
  onAnswer,
}: {
  questions: QuizQuestion[];
  onAnswer: (qi: number, letter: string) => void;
}) {
  const answered = questions.filter((q) => q.answered !== null).length;
  const correct = questions.filter((q) => q.answered === q.correct).length;
  const allAnswered = answered === questions.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4 rounded-2xl border border-[var(--base-200)] overflow-hidden"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[var(--base-50)] border-b border-[var(--base-200)] flex items-center justify-between">
        <p className="text-[13px] font-semibold" style={{ color: "var(--base-700)" }}>
          Quick Quiz ⚡
        </p>
        {allAnswered ? (
          <span
            className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: correct === questions.length ? "#f0fdf4" : correct >= questions.length / 2 ? "#fefce8" : "#fef2f2",
              color: correct === questions.length ? "#15803d" : correct >= questions.length / 2 ? "#854d0e" : "#dc2626",
            }}
          >
            {correct}/{questions.length} correct
          </span>
        ) : (
          <span className="text-[12px]" style={{ color: "var(--base-400)" }}>
            {answered}/{questions.length} answered
          </span>
        )}
      </div>

      {/* Questions */}
      {questions.map((q, qi) => {
        const isAnswered = q.answered !== null;
        const isCorrect = q.answered === q.correct;
        return (
          <div key={qi} className={`px-4 py-4 ${qi < questions.length - 1 ? "border-b border-[var(--base-100)]" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--base-400)" }}>
              Question {qi + 1}
            </p>
            <div className="text-[15px] mb-3" style={{ color: "var(--base-800)" }}>
              <MarkdownRenderer content={normalizeMathMarkdown(q.question)} />
            </div>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oi) => {
                const isSelected = q.answered === opt.letter;
                const isCorrectOpt = opt.letter === q.correct;
                let bgColor = "white";
                let borderColor = "var(--base-200)";
                let textColor = "var(--base-700)";
                if (isAnswered) {
                  if (isCorrectOpt) { bgColor = "#f0fdf4"; borderColor = "#22c55e"; textColor = "#15803d"; }
                  else if (isSelected && !isCorrect) { bgColor = "#fef2f2"; borderColor = "#ef4444"; textColor = "#dc2626"; }
                }
                return (
                  <button
                    key={`quiz-q${qi}-o${oi}-${opt.letter}`}
                    type="button"
                    onClick={() => !isAnswered && onAnswer(qi, opt.letter)}
                    disabled={isAnswered}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer disabled:cursor-default"
                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{
                        backgroundColor: isAnswered && isCorrectOpt ? "#22c55e" : isAnswered && isSelected ? "#ef4444" : "var(--base-100)",
                        color: isAnswered && (isCorrectOpt || (isSelected && !isCorrect)) ? "white" : "var(--base-600)",
                      }}
                    >
                      {opt.letter}
                    </span>
                    <span className="text-[13.5px] flex-1 min-w-0"><OptionContent text={opt.text} /></span>
                    {isAnswered && isCorrectOpt && <span className="ml-auto text-green-600 text-[12px] font-semibold shrink-0">✓</span>}
                    {isAnswered && isSelected && !isCorrect && <span className="ml-auto text-red-500 text-[12px] font-semibold shrink-0">✗</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Result footer */}
      {allAnswered && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-3 border-t border-[var(--base-200)]"
          style={{ backgroundColor: correct === questions.length ? "#f0fdf4" : "#fefce8" }}
        >
          <p className="text-[13.5px] font-medium" style={{ color: correct === questions.length ? "#15803d" : "#854d0e" }}>
            {correct === questions.length
              ? "Perfect score! 🎉 Excellent work."
              : `${correct} out of ${questions.length} correct. Keep it up — ask your tutor to explain any you missed!`}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Inline edit ─────────────────────────────────────────────────────────────

function EditMessageInline({
  value,
  onChange,
  onCancel,
  onSend,
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { textareaRef.current?.focus(); }, []);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (value.trim()) onSend(); }
    if (e.key === "Escape") onCancel();
  };
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <div className="w-full flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full resize-none rounded-[16px] px-4 py-3 text-[15px] leading-relaxed outline-none border border-[var(--primary-300)] overflow-hidden"
        style={{
          fontFamily: "var(--font-inter)",
          color: "var(--base-700)",
          background: "linear-gradient(0deg, #F7FAFF 0%, #EDF4FF 100%)",
          boxShadow: "0 0 0 2px var(--primary-200)",
          minHeight: 44,
        }}
        rows={1}
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3 rounded-lg text-[13px] transition-colors hover:bg-[var(--base-100)] cursor-pointer"
          style={{ color: "var(--base-500)", fontFamily: "var(--font-inter)" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => value.trim() && onSend()}
          disabled={!value.trim()}
          className="h-8 px-3 rounded-lg text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
          style={{ backgroundColor: "var(--primary-400)", fontFamily: "var(--font-inter)" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Edit icon ───────────────────────────────────────────────────────────────

const IconEdit = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="m15 5 4 4" />
  </svg>
);

// ─── Timestamp helpers ──────────────────────────────────────────────────────

function formatMessageTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
function formatMessageTimestampTooltip(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ─── Misc ───────────────────────────────────────────────────────────────────

function compareTopicIndex(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

const CHAT_MAX_WIDTH = 720;
const CHAT_COMPOSER_WIDE_MAX = 920;
/** Match DashboardShell: chapter panel overlays chat instead of shrinking it. */
const LEARN_PANEL_MOBILE_MAX_PX = 1023;
const LEARN_MOBILE_SIDEBAR_AUTOSHOWN_KEY = "learn_mobile_sidebar_autoshown_once";

// ─── Component ─────────────────────────────────────────────────────────────

interface LearnChatProps {
  sessionId: string;
  subject: string;
  chapterIndex: number;
  chapterName: string;
  grade: number;
  initialMessages: Message[];
  topics: TopicEntry[];
  topicsCompleted: string[];
  currentTopicIndex: string | null;
  onTopicProgress?: (completedTopic: string, newCurrentTopic: string) => void;
}

export default function LearnChat({
  sessionId,
  subject,
  chapterIndex,
  chapterName,
  grade,
  initialMessages,
  topics,
  topicsCompleted,
  currentTopicIndex,
  onTopicProgress,
}: LearnChatProps) {
  const router = useRouter();
  const { learnSidebarOpen, toggleLearnSidebar, setLearnSidebarOpen, setSessionId } = useTutoringSession();
  const [learnNarrowViewport, setLearnNarrowViewport] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isInputEmpty, setIsInputEmpty] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamDisplay = useStreamDisplayBuffer();
  const [streamingGraphArtifacts, setStreamingGraphArtifacts] = useState<GraphArtifact[]>([]);
  const [kickoffLoading, setKickoffLoading] = useState(false);
  const [mcqState, setMcqState] = useState<Record<number, MCQQuestion>>({});
  const [quizState, setQuizState] = useState<Record<number, QuizQuestion[]>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [topicNavBusy, setTopicNavBusy] = useState(false);
  const [showChapterCelebration, setShowChapterCelebration] = useState(false);
  /** Chapter tools → Generate notes uses document pipeline (not /api/tutor/chat markdown) */
  const [notesGenBusy, setNotesGenBusy] = useState(false);
  const sidebarInitSessionRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia(`(max-width: ${LEARN_PANEL_MOBILE_MAX_PX}px)`);
    const apply = () => setLearnNarrowViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // On mobile: auto-open chapter panel only for the first-ever fresh chapter start.
  // After that, default to closed unless the user opens it manually.
  useEffect(() => {
    if (!learnNarrowViewport) {
      sidebarInitSessionRef.current = null;
      return;
    }
    if (sidebarInitSessionRef.current === sessionId) return;
    sidebarInitSessionRef.current = sessionId;

    const hasAutoOpenedOnce =
      typeof window !== "undefined" &&
      window.localStorage.getItem(LEARN_MOBILE_SIDEBAR_AUTOSHOWN_KEY) === "1";
    const shouldAutoOpen = initialMessages.length === 0 && !hasAutoOpenedOnce;

    setLearnSidebarOpen(shouldAutoOpen);
    if (shouldAutoOpen && typeof window !== "undefined") {
      window.localStorage.setItem(LEARN_MOBILE_SIDEBAR_AUTOSHOWN_KEY, "1");
    }
  }, [initialMessages.length, learnNarrowViewport, sessionId, setLearnSidebarOpen]);

  /** Collapse the chapter drawer after sidebar actions (overlay layout only — matches `learnNarrowViewport`). */
  const closeLearnChapterPanelOnMobile = useCallback(() => {
    if (learnNarrowViewport) setLearnSidebarOpen(false);
  }, [learnNarrowViewport, setLearnSidebarOpen]);

  useEffect(() => {
    track("learn_session_started", { subject, chapter_index: chapterIndex });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Live thinking block state
  const [liveThinking, setLiveThinking] = useState<{
    steps: StepEvent[];
    isTokenStreaming: boolean; // true once first token arrives → freezes timer
    isKickoff: boolean;
  } | null>(null);
  const liveThinkingStepsRef = useRef<StepEvent[]>([]);

  // Message action state (mirrors DashboardContent)
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [copiedAiMessageIndex, setCopiedAiMessageIndex] = useState<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedAiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiFeedback, setAiFeedback] = useState<Record<number, "up" | "down" | null>>({});
  const { speak: speakTTS, speakingId, isLoading: ttsLoading } = useTTS();
  const [sourcesOpen, setSourcesOpen] = useState<{ msgIndex: number; citationIndex: number } | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [wideComposerLayout, setWideComposerLayout] = useState(false);

  // ── File attachments ──────────────────────────────────────────────────────
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentMeta[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ uid: string; name: string; progress: "uploading" | "done" | "error" }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const dragCounterRef = useRef(0);

  // ── STT (Voice input / Dictate) ───────────────────────────────────────────
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const { devices: micDevices, enumerate: enumerateMics } = useMicDevices();

  const { isRecording, isTranscribing, startRecording, stopRecording, cancelRecording, error: sttError, stream: sttStream } = useSTT({
    onTranscript: useCallback((text: string) => {
      const ta = inputRef.current;
      if (!ta) return;
      const current = ta.value;
      const joined = current.trim() ? `${current} ${text}` : text;
      ta.value = joined;
      setIsInputEmpty(!joined.trim());
    }, []),
    deviceId: selectedDeviceId,
  });

  const [sttErrorVisible, setSttErrorVisible] = useState<string | null>(null);
  useEffect(() => {
    if (!sttError) return;
    setSttErrorVisible(sttError);
    const t = setTimeout(() => setSttErrorVisible(null), 5000);
    return () => clearTimeout(t);
  }, [sttError]);

  const handleDictate = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      track("learn_message_sent", { subject, input_method: "voice" });
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording, subject]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uploadErrorMsg) return;
    const t = setTimeout(() => setUploadErrorMsg(null), 4000);
    return () => clearTimeout(t);
  }, [uploadErrorMsg]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsAtBottom(distFromBottom < 220);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);
  const abortRef = useRef<AbortController | null>(null);
  const kickoffAbortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const kickoffOnceRef = useRef(false);
  /** When set, skip duplicate resets (Strict Mode / re-renders with same session id). */
  const prevLearnSessionIdRef = useRef<string | null>(null);

  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => compareTopicIndex(a.topic_index, b.topic_index)),
    [topics]
  );

  /** Normalised for DB/UI parity (Social Science indices sometimes had stray whitespace). */
  const currentTopicKey = useMemo(
    () => (currentTopicIndex != null && String(currentTopicIndex).trim() !== "" ? String(currentTopicIndex).trim() : null),
    [currentTopicIndex]
  );

  const nextTopic = useMemo(() => {
    if (!currentTopicKey || sortedTopics.length === 0) return null;
    const idx = sortedTopics.findIndex((t) => String(t.topic_index).trim() === currentTopicKey);
    if (idx < 0 || idx >= sortedTopics.length - 1) return null;
    return sortedTopics[idx + 1];
  }, [sortedTopics, currentTopicKey]);

  const isOnLastTopic = useMemo(() => {
    if (!currentTopicKey || sortedTopics.length === 0) return false;
    const idx = sortedTopics.findIndex((t) => String(t.topic_index).trim() === currentTopicKey);
    return idx === sortedTopics.length - 1;
  }, [sortedTopics, currentTopicKey]);


  // Page-weighted progress (falls back to count-based if no page data)
  const completedTopicSet = useMemo(
    () => new Set(topicsCompleted.map((x) => String(x).trim())),
    [topicsCompleted]
  );

  const chapterProgress = useMemo(() => {
    const pageCount = (t: (typeof sortedTopics)[0]) =>
      t.page_start != null && t.page_end != null ? Math.max(1, t.page_end - t.page_start + 1) : 1;
    const isPageBased = sortedTopics.some((t) => t.page_start != null && t.page_end != null);
    const total = sortedTopics.reduce((sum, t) => sum + pageCount(t), 0);
    const done = sortedTopics
      .filter((t) => completedTopicSet.has(String(t.topic_index).trim()))
      .reduce((sum, t) => sum + pageCount(t), 0);
    return { pct: total > 0 ? Math.round((done / total) * 100) : 0, isPageBased };
  }, [sortedTopics, completedTopicSet]);
  const lastMcqMessageIndex = useMemo(() => {
    let m = -1;
    for (const key of Object.keys(mcqState)) {
      const i = Number(key);
      if (!Number.isNaN(i) && mcqState[i]) m = Math.max(m, i);
    }
    return m;
  }, [mcqState]);

  const showDifferentPatternCta =
    lastMcqMessageIndex >= 0 &&
    mcqState[lastMcqMessageIndex]?.answered != null &&
    !isStreaming &&
    !kickoffLoading &&
    !notesGenBusy;

  const TEXTAREA_MAX_HEIGHT = 40;
  const resizeTextarea = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.overflowY = "hidden";
    const rawScroll = ta.scrollHeight;
    const h = Math.min(rawScroll, TEXTAREA_MAX_HEIGHT);
    ta.style.height = `${h}px`;
    ta.style.overflowY = h >= TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 24;
    setWideComposerLayout(ta.value.includes("\n") || rawScroll > lineHeight * 1.65);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => { scrollToBottom(false); }, [messages, scrollToBottom]);

  const hydrateKickoffFromSession = useCallback(async () => {
    const res = await fetch(`/api/tutor/messages?session_id=${encodeURIComponent(sessionId)}&limit=10`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return false;
    const payload = await res.json() as {
      messages?: Array<{
        id?: string;
        role?: "user" | "assistant";
        content?: string;
        citations?: unknown;
        graph_artifacts?: unknown;
        created_at?: string;
        thinking?: unknown;
      }>;
    };
    const rows = (payload.messages ?? []).filter((m) => m.role === "assistant" && typeof m.content === "string");
    if (rows.length === 0) return false;
    setMessages(rows.map((m) => ({
      id: m.id,
      role: "assistant",
      content: m.content ?? "",
      citations: parseCitations(m.citations),
      graph_artifacts: parseGraphArtifacts(m.graph_artifacts),
      created_at: m.created_at,
      thinking: parseThinking(m.thinking),
    })));
    return true;
  }, [sessionId]);

  const waitForPrewarmedKickoff = useCallback(async (maxWaitMs = 2200) => {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      try {
        const hydrated = await hydrateKickoffFromSession();
        if (hydrated) return true;
      } catch {
        // Keep trying until timeout, then fallback to live kickoff.
      }
      await new Promise((resolve) => setTimeout(resolve, 320));
    }
    return false;
  }, [hydrateKickoffFromSession]);

  // Client navigations (recents, shared fork links) reuse this instance; sync shell context and
  // reopen the chapter panel so Framer + layout state match a full reload.
  useEffect(() => {
    if (prevLearnSessionIdRef.current === sessionId) return;
    prevLearnSessionIdRef.current = sessionId;

    setSessionId(sessionId);
    setLearnSidebarOpen(true);
    setMessages(initialMessages);
    kickoffOnceRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
    setIsInputEmpty(true);
    resizeTextarea();
    setMcqState({});
    setQuizState({});
    setKickoffLoading(false);
    setIsStreaming(false);
    setStreamingGraphArtifacts([]);
    setLiveThinking(null);
    liveThinkingStepsRef.current = [];
    streamDisplay.reset();
    abortRef.current?.abort();
    kickoffAbortRef.current?.abort();
    abortRef.current = null;
    kickoffAbortRef.current = null;
    setPendingAttachments([]);
    setUploadingFiles([]);
    setUploadErrorMsg(null);
    setIsDragging(false);
    dragCounterRef.current = 0;
    setSourcesOpen(null);
    setEditingIndex(null);
    setEditingValue("");
    setShowChapterCelebration(false);
    setAiFeedback({});
    setCopiedMessageIndex(null);
    setCopiedAiMessageIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session route change only; initialMessages + streamDisplay.reset() are intentional snapshots
  }, [sessionId, setSessionId, setLearnSidebarOpen, resizeTextarea]);

  useEffect(() => {
    if (initialMessages.length > 0 || kickoffOnceRef.current) return;
    kickoffOnceRef.current = true;
    let canceled = false;
    void (async () => {
      const prewarmKey = `learn_kickoff_prewarm:${sessionId}`;
      const shouldWaitPrewarm = typeof window !== "undefined" && sessionStorage.getItem(prewarmKey) === "1";
      if (shouldWaitPrewarm) {
        setKickoffLoading(true);
        const hydrated = await waitForPrewarmedKickoff(2200);
        if (canceled) return;
        sessionStorage.removeItem(prewarmKey);
        if (hydrated) {
          setKickoffLoading(false);
          return;
        }
      }
      if (!canceled) void runKickoff();
    })();
    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages.length, sessionId, waitForPrewarmedKickoff]);

  useEffect(() => {
    if (!kickoffLoading) return;
    if (messages.some((m) => m.role === "assistant" && m.content.trim().length > 0)) return;
    let canceled = false;
    void (async () => {
      for (let i = 0; i < 30; i++) {
        if (canceled) return;
        try {
          const hydrated = await hydrateKickoffFromSession();
          if (hydrated) {
            setKickoffLoading(false);
            return;
          }
        } catch {
          // Keep polling while kickoff is in flight.
        }
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      if (!canceled) setKickoffLoading(false);
    })();
    return () => { canceled = true; };
  }, [kickoffLoading, messages, hydrateKickoffFromSession]);

  useEffect(() => {
    const newMcqState: Record<number, MCQQuestion> = { ...mcqState };
    const newQuizState: Record<number, QuizQuestion[]> = { ...quizState };
    let changed = false;
    messages.forEach((msg, i) => {
      if (msg.role === "assistant" && !newMcqState[i] && !newQuizState[i]) {
        // Try multi-question quiz first
        const quizQs = extractQuizQuestions(msg.content);
        if (quizQs.length >= 2) {
          newQuizState[i] = quizQs.map((q) => ({ ...q, answered: null }));
          changed = true;
          return;
        }
        // Fallback: single Quick Check
        const parsed = extractMCQ(msg.content);
        if (parsed) {
          newMcqState[i] = { ...parsed, messageIndex: i, answered: null };
          changed = true;
        }
      }
    });
    if (changed) { setMcqState(newMcqState); setQuizState(newQuizState); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const runKickoff = async () => {
    setKickoffLoading(true);
    const kickoffController = new AbortController();
    kickoffAbortRef.current = kickoffController;
    let kickoffContent = "";
    let kickoffGraphArtifacts: GraphArtifact[] = [];
    setStreamingGraphArtifacts([]);
    try {
      const res = await fetch("/api/learn/kickoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: kickoffController.signal,
        body: JSON.stringify({ session_id: sessionId, subject, chapter_index: chapterIndex, chapter_name: chapterName, grade }),
      });
      if (res.status === 409) {
        await hydrateKickoffFromSession();
        setKickoffLoading(false);
        return;
      }
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setKickoffLoading(false);
      // Start kickoff thinking block
      liveThinkingStepsRef.current = [];
      const thinkingStartMs = Date.now();
      setLiveThinking({ steps: [], isTokenStreaming: false, isKickoff: true });
      streamDisplay.start();
      let sseBuf = "";
      const processKickoffPayload = async (data: SsePayload) => {
        if (data.error) throw new Error(String(data.error));
        if (data.type?.startsWith("step:")) {
          const step = data as unknown as StepEvent;
          liveThinkingStepsRef.current = [...liveThinkingStepsRef.current, step];
          setLiveThinking((prev) => prev ? { ...prev, steps: liveThinkingStepsRef.current } : prev);
          return;
        }
        if (data.type === "graphs") {
          kickoffGraphArtifacts = parseGraphArtifacts(data.graph_artifacts) ?? [];
          setStreamingGraphArtifacts(kickoffGraphArtifacts);
          return;
        }
        const tok = data.token ?? "";
        if (tok) {
          if (kickoffContent === "") {
            setLiveThinking((prev) => prev ? { ...prev, isTokenStreaming: true } : prev);
          }
          kickoffContent += tok;
          streamDisplay.setTarget(kickoffContent);
        }
        if (data.done) {
          await streamDisplay.finish();
          const finalContent = kickoffContent || (typeof data.content === "string" ? data.content : "");
          kickoffGraphArtifacts = parseGraphArtifacts(data.graph_artifacts) ?? kickoffGraphArtifacts;
          setStreamingGraphArtifacts(kickoffGraphArtifacts);
          const thinkingData: ThinkingData = {
            steps: liveThinkingStepsRef.current,
            elapsed: (Date.now() - thinkingStartMs) / 1000,
            sourcesCount: 0,
          };
          if (finalContent.trim()) {
            setMessages((prev) => [
              ...prev,
              {
                id: data.message_id as string | undefined,
                role: "assistant",
                content: finalContent,
                citations: parseCitations(data.citations),
                graph_artifacts: kickoffGraphArtifacts,
                thinking: thinkingData,
              },
            ]);
          } else {
            await hydrateKickoffFromSession();
          }
          streamDisplay.reset();
          setStreamingGraphArtifacts([]);
          setLiveThinking(null);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf = await feedSseBuffer(sseBuf, decoder.decode(value, { stream: true }), processKickoffPayload);
      }
      const tail = sseBuf.trim();
      if (tail.startsWith("data: ")) {
        try { await processKickoffPayload(JSON.parse(tail.slice(6)) as SsePayload); } catch { /* ignore */ }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        // User stopped kickoff — clean up silently
      } else {
        console.error("[LearnChat] Kickoff failed:", err);
      }
      setKickoffLoading(false);
      streamDisplay.reset();
      setStreamingGraphArtifacts([]);
      setLiveThinking(null);
      kickoffAbortRef.current = null;
    }
  };

  const handleMCQAnswer = async (msgIndex: number, letter: string) => {
    const mcq = mcqState[msgIndex];
    if (!mcq || mcq.answered) return;
    setMcqState((prev) => ({ ...prev, [msgIndex]: { ...prev[msgIndex], answered: letter } }));
    const isCorrect = letter === mcq.correct;
    const answerText = isCorrect
      ? `My answer is ${letter}) ${mcq.options.find((o) => o.letter === letter)?.text ?? ""}`
      : `I think ${letter}) ${mcq.options.find((o) => o.letter === letter)?.text ?? ""}`;
    await sendMessage(answerText);
  };

  const handleQuizAnswer = (msgIndex: number, questionIndex: number, letter: string) => {
    setQuizState((prev) => {
      const questions = prev[msgIndex];
      if (!questions || questions[questionIndex]?.answered) return prev;
      const updated = questions.map((q, qi) => qi === questionIndex ? { ...q, answered: letter } : q);
      return { ...prev, [msgIndex]: updated };
    });
  };

  const handleEditSubmit = (idx: number, newContent: string) => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    setEditingIndex(null);
    setEditingValue("");
    setMessages((prev) => prev.slice(0, idx));
    void sendMessage(trimmed);
  };

  const sendMessage = async (text: string, attachments?: AttachmentMeta[], displayContent?: string) => {
    if (isStreaming || notesGenBusy) return;
    const trimmed = text.trim();
    if (!trimmed && !attachments?.length) return;
    track("learn_message_sent", {
      subject,
      has_attachment: (attachments?.length ?? 0) > 0,
      input_method: "text",
    });
    if (inputRef.current) inputRef.current.value = "";
    setIsInputEmpty(true);
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "user", content: trimmed, display_content: displayContent, created_at: new Date().toISOString() }]);
    // Start live thinking block
    liveThinkingStepsRef.current = [];
    const thinkingStartMs = Date.now();
    setLiveThinking({ steps: [], isTokenStreaming: false, isKickoff: false });
    let assistantContent = "";
    let finalGraphArtifacts: GraphArtifact[] = [];
    setStreamingGraphArtifacts([]);
    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message: trimmed,
          session_id: sessionId,
          subject,
          chapter_index: String(chapterIndex),
          grade,
          ...(attachments?.length ? { attachments } : {}),
          ...(displayContent?.trim() ? { display_content: displayContent.trim() } : {}),
        }),
      });
      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      streamDisplay.start();
      let sseBuf = "";
      // step:query and step:thinking/generating are hidden; filter step:query specifically for learn mode
      const SKIP_STEP_TYPES = new Set(["step:query", "step:thinking", "step:generating"]);
      const processPayload = async (data: SsePayload) => {
        if (data.type === "error" || data.error) throw new Error(typeof data.error === "string" ? data.error : "Chat error");
        if (data.type?.startsWith("step:") && !SKIP_STEP_TYPES.has(data.type)) {
          // Relabel "Searching NCERT*" → "Reading NCERT" for learn mode
          const step = (data.type === "step:searching"
            ? { ...data, label: "Reading NCERT" }
            : data) as unknown as StepEvent;
          liveThinkingStepsRef.current = [...liveThinkingStepsRef.current, step];
          setLiveThinking((prev) => prev ? { ...prev, steps: liveThinkingStepsRef.current } : prev);
          return;
        }
        const tok = data.token ?? "";
        if (data.type === "token" || tok) {
          if (tok) {
            if (assistantContent === "") {
              // First token — freeze the thinking timer
              setLiveThinking((prev) => prev ? { ...prev, isTokenStreaming: true } : prev);
            }
            assistantContent += tok;
            streamDisplay.setTarget(assistantContent);
          }
        }
        if (data.type === "graphs") {
          finalGraphArtifacts = parseGraphArtifacts(data.graph_artifacts) ?? [];
          setStreamingGraphArtifacts(finalGraphArtifacts);
        }
        if (data.type === "done" || data.done) {
          await streamDisplay.finish();
          const parsedCites = parseCitations(data.citations);
          finalGraphArtifacts = parseGraphArtifacts(data.graph_artifacts) ?? finalGraphArtifacts;
          setStreamingGraphArtifacts(finalGraphArtifacts);
          track("learn_ai_response_completed", {
            has_citations: (parsedCites?.length ?? 0) > 0,
          });
          const thinkingData: ThinkingData = {
            steps: liveThinkingStepsRef.current,
            elapsed: (Date.now() - thinkingStartMs) / 1000,
            sourcesCount: 0,
          };
          setMessages((prev) => [
            ...prev,
            {
              id: data.message_id as string | undefined,
              role: "assistant",
              content: assistantContent,
              citations: parsedCites,
              graph_artifacts: finalGraphArtifacts,
              thinking: thinkingData,
            },
          ]);
          streamDisplay.reset();
          setStreamingGraphArtifacts([]);
          setLiveThinking(null);
          const topicMatch = assistantContent.match(/moving\s+(?:on\s+)?to\s+(?:topic\s+)?(\d+\.\d+)/i);
          if (topicMatch && onTopicProgress) onTopicProgress("", topicMatch[1]);
          void refreshStreakAfterActivity();
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf = await feedSseBuffer(sseBuf, decoder.decode(value, { stream: true }), processPayload);
      }
      const tail = sseBuf.trim();
      if (tail.startsWith("data: ")) {
        try { await processPayload(JSON.parse(tail.slice(6)) as SsePayload); } catch { /* ignore */ }
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") {
        console.error("[LearnChat] Send failed:", err);
      }
      streamDisplay.reset();
      setStreamingGraphArtifacts([]);
      setLiveThinking(null);
    } finally {
      setIsStreaming(false);
    }
  };

  /** Chapter tools: generate notes through the document pipeline. */
  const generateStructuredNotesForTopic = async (topicLabel: string) => {
    if (notesGenBusy || isStreaming || kickoffLoading) return;
    closeLearnChapterPanelOnMobile();
    const scopeMessage = currentTopicKey
      ? `Generate NCERT study notes only for topic ${currentTopicKey} (${topicLabel}). Do not include other topics in this chapter.`
      : `Generate NCERT study notes for ${topicLabel} for this entire chapter.`;

    setNotesGenBusy(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: scopeMessage,
        display_content: `Generate notes for **${topicLabel}**`,
        created_at: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        notesArtifact: { status: "generating", progressText: "Preparing your document…" },
      },
    ]);

    const updateArtifact = (patch: Partial<NonNullable<Message["notesArtifact"]>>) => {
      setMessages((prev) => {
        let last = prev.length - 1;
        while (last >= 0 && (prev[last].role !== "assistant" || !prev[last].notesArtifact)) last--;
        if (last < 0) return prev;
        const m = prev[last];
        const na = m.notesArtifact!;
        return [...prev.slice(0, last), { ...m, notesArtifact: { ...na, ...patch } }, ...prev.slice(last + 1)];
      });
    };

    try {
      const res = await fetch("/api/tutor/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: scopeMessage,
          session_id: sessionId,
          subject,
          chapter_index: String(chapterIndex),
          task_type: "notes",
          grade,
          display_content: `Generate notes for **${topicLabel}**`,
        }),
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        updateArtifact({ status: "error", errorMessage: err.error ?? "Could not start notes generation." });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sawComplete = false;
      const handleDocSseEvent = (event: Record<string, unknown>) => {
        if (event.type === "complete" && !sawComplete) {
          sawComplete = true;
          const doc = event.document as GeneratedDocument;
          updateArtifact({
            status: "ready",
            document: doc,
            docId: (event.doc_id as string | null) ?? null,
            progressText: undefined,
          });
          void (async () => {
            try {
              const { downloadAsPDF } = await import("@/lib/pdf/lerno-pdf");
              await downloadAsPDF(doc);
            } catch (e) {
              console.error("[LearnChat] PDF download failed:", e);
            }
          })();
        } else if (event.type === "error") {
          updateArtifact({
            status: "error",
            errorMessage: String(event.message ?? "Something went wrong."),
          });
        } else if (event.type === "progress" && typeof event.label === "string") {
          updateArtifact({ progressText: event.label });
        } else if (event.type === "step" && typeof event.label === "string") {
          updateArtifact({ progressText: event.label });
        } else if (event.type === "scope_confirmed" && typeof event.message === "string") {
          updateArtifact({ progressText: event.message as string });
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            handleDocSseEvent(JSON.parse(line.slice(6)) as Record<string, unknown>);
          } catch {
            /* ignore malformed SSE */
          }
        }
      }
      const tail = buf.trim();
      if (tail.startsWith("data: ")) {
        try {
          handleDocSseEvent(JSON.parse(tail.slice(6)) as Record<string, unknown>);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error("[LearnChat] generate-doc failed:", e);
      updateArtifact({
        status: "error",
        errorMessage: e instanceof Error ? e.message : "Notes generation failed.",
      });
    } finally {
      setNotesGenBusy(false);
    }
  };

  const patchTopicProgress = useCallback(
    async (body: { completed_topic_index?: string; current_topic_index: string; is_chapter_complete?: boolean; topics_completed_override?: string[] }) => {
      const res = await fetch("/api/learn/progress/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session_id: sessionId, subject, chapter_index: chapterIndex, chapter_name: chapterName, grade, ...body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[LearnChat] progress update failed:", err);
        return false;
      }
      router.refresh();
      return true;
    },
    [sessionId, subject, chapterIndex, chapterName, grade, router]
  );

  async function handleAdvanceNextTopic() {
    if (!nextTopic || topicNavBusy || isStreaming || kickoffLoading || notesGenBusy) return;
    closeLearnChapterPanelOnMobile();
    setTopicNavBusy(true);
    try {
      const ok = await patchTopicProgress({
        completed_topic_index: currentTopicKey ?? undefined,
        current_topic_index: String(nextTopic.topic_index).trim(),
      });
      if (!ok) return;
      await sendMessage(
        `Move on to the next topic: **${nextTopic.topic_index}: ${nextTopic.topic_name}**. Teach it using only NCERT textbook content retrieved for that topic. Follow the pacing rules — start with the first subtopic or opening concept, not the whole topic at once.`,
        undefined,
        `Let's move on to the next topic — **${nextTopic.topic_index}: ${nextTopic.topic_name}**`
      );
      if (onTopicProgress && currentTopicKey) onTopicProgress(currentTopicKey, String(nextTopic.topic_index).trim());
    } finally {
      setTopicNavBusy(false);
    }
  }

  async function handleJumpToTopic(targetTopic: TopicEntry) {
    const targetKey = String(targetTopic.topic_index).trim();
    if (targetKey === currentTopicKey || topicNavBusy || isStreaming || kickoffLoading || notesGenBusy) return;
    closeLearnChapterPanelOnMobile();

    const currentIdx = sortedTopics.findIndex((t) => String(t.topic_index).trim() === currentTopicKey);
    const targetIdx = sortedTopics.findIndex((t) => String(t.topic_index).trim() === targetKey);
    const isPrevious = targetIdx < currentIdx;
    const isNextImmediate = targetIdx === currentIdx + 1;

    // Compute the new topics_completed set for the override
    const existingCompleted = new Set(topicsCompleted.map((t) => String(t).trim()).filter(Boolean));
    let topics_completed_override: string[];

    if (isPrevious) {
      // Going back: unmark everything at or after the target (target itself becomes the new "current")
      const keepKeys = new Set(sortedTopics.slice(0, targetIdx).map((t) => String(t.topic_index).trim()));
      topics_completed_override = [...existingCompleted].filter((k) => keepKeys.has(k));
    } else {
      // Going forward: mark all topics before the target as completed
      const allBeforeTarget = sortedTopics.slice(0, targetIdx).map((t) => String(t.topic_index).trim());
      topics_completed_override = [...new Set([...existingCompleted, ...allBeforeTarget])];
    }

    setTopicNavBusy(true);
    try {
      const ok = await patchTopicProgress({
        current_topic_index: targetKey,
        topics_completed_override,
      });
      if (!ok) return;

      let fullPrompt: string;
      let displayMsg: string;

      if (isPrevious) {
        fullPrompt = `Go back to **${targetTopic.topic_index}: ${targetTopic.topic_name}**. Re-teach this topic from the beginning using only NCERT textbook content. Follow the pacing rules — start with the first subtopic or opening concept.`;
        displayMsg = `← Back to **${targetTopic.topic_name}**`;
      } else if (isNextImmediate) {
        fullPrompt = `Move on to the next topic: **${targetTopic.topic_index}: ${targetTopic.topic_name}**. Teach it using only NCERT textbook content retrieved for that topic. Follow the pacing rules — start with the first subtopic or opening concept, not the whole topic at once.`;
        displayMsg = `Next topic — **${targetTopic.topic_name}**`;
      } else {
        fullPrompt = `Skip ahead to **${targetTopic.topic_index}: ${targetTopic.topic_name}**. Teach it using only NCERT textbook content for that topic. Follow the pacing rules — start with the first subtopic or opening concept.`;
        displayMsg = `Skip to **${targetTopic.topic_name}**`;
      }

      await sendMessage(fullPrompt, undefined, displayMsg);
      if (onTopicProgress && currentTopicKey) onTopicProgress(currentTopicKey, targetKey);
    } finally {
      setTopicNavBusy(false);
    }
  }

  async function handleCompleteChapter() {
    if (topicNavBusy || isStreaming || kickoffLoading || notesGenBusy) return;
    closeLearnChapterPanelOnMobile();
    setTopicNavBusy(true);
    try {
      const lastTopicIndex = sortedTopics.length > 0 ? String(sortedTopics[sortedTopics.length - 1].topic_index).trim() : "";
      const effectiveTopic =
        currentTopicKey || lastTopicIndex || (sortedTopics[0] ? String(sortedTopics[0].topic_index).trim() : "") || "1.0";
      const ok = await patchTopicProgress({
        completed_topic_index: currentTopicKey || lastTopicIndex || undefined,
        current_topic_index: effectiveTopic,
        is_chapter_complete: true,
      });
      if (!ok) return;
      setShowChapterCelebration(true);
      celebrateChapterComplete();
      track("learn_chapter_completed", { subject, chapter_index: chapterIndex });
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 2800);
      });
      setShowChapterCelebration(false);
      router.push(`/learn/${subject}`);
    } finally {
      setTopicNavBusy(false);
    }
  }

  async function handleDifferentPattern() {
    if (isStreaming || kickoffLoading || notesGenBusy) return;
    closeLearnChapterPanelOnMobile();
    await sendMessage(
      "I'd like a **different teaching pattern** for this topic. Please re-explain using only the textbook passages (with [N] citations), with a clearly different structure or analogies than before. End with exactly one new Quick Check.",
      undefined,
      "Explain this differently"
    );
  }

  // ── File upload helpers ───────────────────────────────────────────────────
  const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
  const MAX_ATTACHMENTS = 3;

  const uploadFiles = async (files: File[]) => {
    const remaining = MAX_ATTACHMENTS - pendingAttachments.length;
    if (remaining <= 0) { setUploadErrorMsg("You can attach at most 3 files per message."); return; }
    const validType = files.filter((f) => ALLOWED_MIME.includes(f.type));
    if (!validType.length) { setUploadErrorMsg("Unsupported file type. Use JPG, PNG, WEBP, GIF, or PDF."); return; }
    const allowed = validType.slice(0, remaining);
    if (validType.length > remaining) {
      setUploadErrorMsg(`Only ${remaining} more file${remaining === 1 ? "" : "s"} allowed per message.`);
    }
    for (const file of allowed) {
      if (file.size > 10 * 1024 * 1024) { setUploadErrorMsg(`"${file.name}" is too large (max 10 MB).`); continue; }
      const uid = `${file.name}-${Date.now()}-${Math.random()}`;
      setUploadingFiles((prev) => [...prev, { uid, name: file.name, progress: "uploading" }]);
      try {
        let fileToUpload: File | Blob = file;
        if (file.type.startsWith("image/")) {
          const { default: imageCompression } = await import("browser-image-compression");
          fileToUpload = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
        }
        const formData = new FormData();
        formData.append("file", fileToUpload, file.name);
        formData.append("session_id", sessionId ?? "new");
        const res = await fetch("/api/tutor/upload", { method: "POST", credentials: "include", body: formData });
        if (!res.ok) { const e = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string }; throw new Error(e.error ?? "Upload failed"); }
        const meta = await res.json() as AttachmentMeta;
        setPendingAttachments((prev) => [...prev, meta]);
        setUploadingFiles((prev) => prev.map((f) => f.uid === uid ? { ...f, progress: "done" } : f));
      } catch (err) {
        setUploadErrorMsg(err instanceof Error ? err.message : "Upload failed");
        setUploadingFiles((prev) => prev.map((f) => f.uid === uid ? { ...f, progress: "error" } : f));
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    await uploadFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const fileItems = Array.from(e.clipboardData.items).filter((i) => i.kind === "file");
    if (!fileItems.length) return;
    const files = fileItems.map((i) => i.getAsFile()).filter(Boolean) as File[];
    if (!files.length) return;
    e.preventDefault();
    await uploadFiles(files);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items?.length > 0) setIsDragging(true);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false); dragCounterRef.current = 0;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) await uploadFiles(files);
  };

  const handleSend = () => {
    const trimmed = (inputRef.current?.value ?? "").trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    if (isStreaming || notesGenBusy) return;
    const attachmentsToSend = [...pendingAttachments];
    setPendingAttachments([]);
    setUploadingFiles([]);
    void sendMessage(trimmed || " ", attachmentsToSend.length > 0 ? attachmentsToSend : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && !notesGenBusy) handleSend();
    }
  };

  // Index of the last AI message (utility bar always visible for it)
  const lastAiIdx = messages.reduce((found, m, i) => m.role === "assistant" ? i : found, -1);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);

  const learnSidebarMotion = learnNarrowViewport
    ? {
        initial: { x: "100%" as const, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "100%" as const, opacity: 0 },
        transition: { type: "spring" as const, stiffness: 380, damping: 38 },
      }
    : {
        initial: { width: 0, opacity: 0 },
        animate: { width: 272, opacity: 1 },
        exit: { width: 0, opacity: 0 },
        transition: { type: "spring" as const, stiffness: 380, damping: 38 },
      };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row">
      <AnimatePresence>
        {showChapterCelebration && (
          <motion.div
            key="chapter-celebration-banner"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-[22%] z-[100095] w-[min(92vw,380px)] -translate-x-1/2 pointer-events-none px-4"
          >
            <div
              className="rounded-2xl border border-slate-200/90 bg-white px-7 py-7 text-center shadow-[0_8px_30px_-8px_rgba(15,23,42,0.08)]"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              <p className="text-[21px] font-medium tracking-tight text-slate-800">
                You&apos;ve done it.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                This chapter is finished — that takes consistency. When you&apos;re ready, pick your next one and keep the streak.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    {/* ── Chat column ── */}
    <div className="flex flex-1 flex-col min-h-0 min-w-0 bg-[#fcfcfc] relative">
      {/* Message area */}
      <div
        ref={scrollRef}
        className="scrollbar-chat flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y"
      >
        <div className="flex flex-col justify-end min-h-full">
          <div className="mx-auto w-full px-3 min-[480px]:px-6 pt-6 min-[480px]:pt-8 pb-24 min-[480px]:pb-30 min-w-0" style={{ maxWidth: CHAT_MAX_WIDTH }}>

            {/* Messages */}
            {messages.map((msg, i) => {
              const prevRole = i > 0 ? messages[i - 1]?.role : null;
              const gapTop =
                prevRole === "user" ? "mt-6" :
                prevRole === "assistant" ? "mt-8" :
                (i === 0 && msg.role === "assistant") ? "mt-4" :
                "";
              const mcq = mcqState[i];
              const quizQuestions = quizState[i];
              const hasParsedAssessment = Boolean(mcq) || Boolean(quizQuestions && quizQuestions.length > 0);
              const displayContent =
                msg.role === "assistant"
                  ? hasParsedAssessment
                    ? stripQuizFromContent(stripMCQFromContent(msg.content))
                    : msg.content
                  : msg.content;

              return (
                <motion.div
                  key={`${msg.role}-${i}`}
                  ref={msg.role === "user" ? lastUserMsgRef : undefined}
                  className={`flex ${msg.role === "user" ? "justify-end group w-full" : "justify-start"} ${gapTop}`}
                  initial={msg.role === "user" ? { opacity: 0, y: 18 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {msg.role === "user" ? (
                    <div className="relative flex flex-col items-end max-w-[85%]">
                      {editingIndex === i ? (
                        <div className="w-full">
                          <EditMessageInline
                            value={editingValue}
                            onChange={setEditingValue}
                            onCancel={() => { setEditingIndex(null); setEditingValue(""); }}
                            onSend={() => handleEditSubmit(i, editingValue)}
                          />
                        </div>
                      ) : (
                        <>
                          <div
                            className="rounded-[20px] px-[16px] py-[10px] text-[16px] leading-relaxed"
                            style={{
                              fontFamily: "var(--font-inter)",
                              color: "var(--base-500)",
                              background: "linear-gradient(0deg, #F7FAFF 0%, #EDF4FF 100%)",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.10)",
                            }}
                          >
                            <MarkdownRenderer content={learnUserBubbleMarkdown(msg)} />
                          </div>
                          {/* Hover buttons */}
                          <div
                            className="absolute left-0 right-0 flex items-center justify-end gap-0.5 pt-1 opacity-0 transition-opacity duration-150 ease-in-out group-hover:opacity-100"
                            style={{ top: "100%" }}
                          >
                            {msg.created_at && (
                              <TooltipHint label={formatMessageTimestampTooltip(msg.created_at)}>
                                <span
                                  suppressHydrationWarning
                                  className="text-[12px] mr-1.5"
                                  style={{ fontFamily: "var(--font-inter)", color: "var(--base-400)" }}
                                >
                                  {formatMessageTimestamp(msg.created_at)}
                                </span>
                              </TooltipHint>
                            )}
                            <TooltipHint label="Edit">
                              <button
                                type="button"
                                onClick={() => { setEditingIndex(i); setEditingValue(msg.content); }}
                                className={MESSAGE_ACTION_BUTTON_CLASS}
                                aria-label="Edit"
                              >
                                <IconEdit className="w-4 h-4" />
                              </button>
                            </TooltipHint>
                            <TooltipHint label={copiedMessageIndex === i ? "Copied!" : "Copy"}>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content);
                                  if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
                                  setCopiedMessageIndex(i);
                                  copiedTimeoutRef.current = setTimeout(() => { setCopiedMessageIndex(null); copiedTimeoutRef.current = null; }, 2500);
                                }}
                                className={MESSAGE_ACTION_BUTTON_CLASS}
                                aria-label="Copy"
                              >
                                {copiedMessageIndex === i ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
                              </button>
                            </TooltipHint>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="w-full group/aimsg" style={{ fontFamily: "var(--font-inter)" }}>
                      {msg.notesArtifact ? (
                        <div
                          className="w-full max-w-[min(100%,720px)] rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] overflow-hidden"
                          style={{ minHeight: msg.notesArtifact.status === "ready" && msg.notesArtifact.document ? 320 : undefined }}
                        >
                          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                              Study notes
                            </span>
                            {msg.notesArtifact.status === "ready" && msg.notesArtifact.document && (
                              <span className="text-[11px] text-slate-400 truncate max-w-[55%]">
                                {msg.notesArtifact.document.title}
                              </span>
                            )}
                          </div>
                          {msg.notesArtifact.status === "generating" && (
                            <div className="flex items-center gap-3 p-5">
                              <div className="size-5 shrink-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                              <p className="text-sm text-slate-600">{msg.notesArtifact.progressText ?? "Working on your notes…"}</p>
                            </div>
                          )}
                          {msg.notesArtifact.status === "error" && (
                            <div className="p-5 text-sm text-red-700 bg-red-50/60">
                              {msg.notesArtifact.errorMessage ?? "Could not generate notes."}
                            </div>
                          )}
                          {msg.notesArtifact.status === "ready" && msg.notesArtifact.document && (
                            <div className="max-h-[min(70vh,560px)] overflow-y-auto">
                              <DocumentPreviewPanel
                                document={msg.notesArtifact.document}
                                regenerating_topics={[]}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                      {msg.thinking && msg.thinking.steps.length > 0 && (
                        <ThinkingBlock
                          steps={msg.thinking.steps}
                          isDone={true}
                          isStreaming={false}
                          elapsed={msg.thinking.elapsed}
                        />
                      )}
                      <MarkdownRenderer
                        content={displayContent}
                        citations={msg.citations && msg.citations.length > 0 ? msg.citations : undefined}
                        graphArtifacts={msg.graph_artifacts ?? undefined}
                        externalOpenIndex={sourcesOpen?.msgIndex === i ? sourcesOpen.citationIndex : null}
                        grade={grade}
                      />
                      {mcq && <MCQBlock mcq={mcq} onAnswer={(letter) => handleMCQAnswer(i, letter)} />}
                      {quizQuestions && <QuizBlock questions={quizQuestions} onAnswer={(qi, letter) => handleQuizAnswer(i, qi, letter)} />}
                        </>
                      )}
                      {/* AI utility bar */}
                      {!msg.notesArtifact && (
                      <div className={`flex items-center justify-between mt-4 transition-opacity duration-150 ease-in-out cursor-default ${i === lastAiIdx ? "opacity-100" : "opacity-0 group-hover/aimsg:opacity-100"}`}>
                        <div className="flex items-center gap-0.5">
                          {/* Copy */}
                          <TooltipHint label={copiedAiMessageIndex === i ? "Copied!" : "Copy"}>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                if (copiedAiTimeoutRef.current) clearTimeout(copiedAiTimeoutRef.current);
                                setCopiedAiMessageIndex(i);
                                copiedAiTimeoutRef.current = setTimeout(() => { setCopiedAiMessageIndex(null); copiedAiTimeoutRef.current = null; }, 2500);
                                track("learn_response_copied");
                              }}
                              className={MESSAGE_ACTION_BUTTON_CLASS}
                              aria-label="Copy"
                            >
                              {copiedAiMessageIndex === i ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
                            </button>
                          </TooltipHint>
                          {/* Thumbs up */}
                          <TooltipHint label="Helpful">
                            <button
                              type="button"
                              onClick={() => {
                                if (aiFeedback[i] === "up") {
                                  setAiFeedback(f => ({ ...f, [i]: null }));
                                  if (msg.id) fetch("/api/tutor/feedback", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: msg.id }) });
                                } else {
                                  setAiFeedback(f => ({ ...f, [i]: "up" }));
                                  if (msg.id) fetch("/api/tutor/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: msg.id, type: "up" }) });
                                  track("learn_feedback_given", { sentiment: "positive" });
                                }
                              }}
                              className={MESSAGE_ACTION_BUTTON_CLASS}
                              aria-label="Helpful"
                              style={aiFeedback[i] === "up" ? { color: "var(--primary-400)" } : undefined}
                            >
                              <IconThumbsUp className="w-4 h-4" />
                            </button>
                          </TooltipHint>
                          {/* Thumbs down */}
                          <TooltipHint label="Not helpful">
                            <button
                              type="button"
                              onClick={() => {
                                if (aiFeedback[i] === "down") {
                                  setAiFeedback(f => ({ ...f, [i]: null }));
                                  if (msg.id) fetch("/api/tutor/feedback", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: msg.id }) });
                                } else {
                                  setAiFeedback(f => ({ ...f, [i]: "down" }));
                                  if (msg.id) fetch("/api/tutor/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: msg.id, type: "down" }) });
                                  track("learn_feedback_given", { sentiment: "negative" });
                                }
                              }}
                              className={MESSAGE_ACTION_BUTTON_CLASS}
                              aria-label="Not helpful"
                              style={aiFeedback[i] === "down" ? { color: "var(--destructive, #ef4444)" } : undefined}
                            >
                              <IconThumbsDown className="w-4 h-4" />
                            </button>
                          </TooltipHint>
                          {/* Read aloud — powered by Sarvam Bulbul TTS */}
                          <TooltipHint label={speakingId === String(i) ? "Stop" : "Read aloud"}>
                            <button
                              type="button"
                              onClick={() => { if (speakingId !== String(i)) track("learn_tts_played"); speakTTS(String(i), msg.content); }}
                              className="h-8 px-1.5 sm:px-2.5 shrink-0 rounded-md flex items-center gap-[5px] bg-transparent transition-all duration-150 hover:bg-slate-200/60 active:scale-95 cursor-pointer"
                              style={{ color: speakingId === String(i) ? "var(--primary-400)" : "var(--base-500)" }}
                              aria-label={speakingId === String(i) ? "Stop" : "Read aloud"}
                            >
                              {ttsLoading && speakingId === String(i)
                                ? <IconSpinner className="w-4 h-4" />
                                : speakingId === String(i)
                                  ? <IconCircleStop className="w-4 h-4" />
                                  : <IconVolume2 className="w-4 h-4" />}
                              <span className="hidden sm:inline" style={{ fontSize: 14, fontWeight: 400 }}>
                                {speakingId === String(i) ? "Stop" : "Read aloud"}
                              </span>
                            </button>
                          </TooltipHint>
                        </div>
                        {/* Sources */}
                        {msg.citations && msg.citations.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const firstIdx = [...msg.citations!].sort((a, b) => a.index - b.index)[0].index;
                              setSourcesOpen({ msgIndex: i, citationIndex: firstIdx });
                            }}
                            className="h-8 px-2.5 shrink-0 rounded-md flex items-center gap-[5px] bg-transparent transition-all duration-150 hover:bg-slate-200/60 active:scale-95 cursor-pointer"
                            style={{ color: "var(--base-500)" }}
                            aria-label="View sources"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
                            </svg>
                            <span style={{ fontSize: 14, fontWeight: 400 }}>
                              {msg.citations.length} {msg.citations.length === 1 ? "Source" : "Sources"}
                            </span>
                          </button>
                        )}
                      </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* Live thinking block + streaming */}
            {(liveThinking || streamDisplay.displayText) && (
              <div className="flex justify-start mt-10">
                <div className="w-full" style={{ fontFamily: "var(--font-inter)" }}>
                  {liveThinking && (
                    <ThinkingBlock
                      steps={liveThinking.steps}
                      isDone={false}
                      isStreaming={liveThinking.isTokenStreaming}
                      loadingLabel={liveThinking.isKickoff ? "Setting up your session..." : "Thinking..."}
                    />
                  )}
                  {streamDisplay.displayText && (() => {
                    const hasStreamingQuiz = extractQuizQuestions(streamDisplay.displayText).length >= 2;
                    const hasStreamingMcq = !!extractMCQ(streamDisplay.displayText);
                    const fullText = (hasStreamingQuiz || hasStreamingMcq)
                      ? stripQuizFromContent(stripMCQFromContent(streamDisplay.displayText))
                      : streamDisplay.displayText;
                    // Find the last safe split point: paragraph break, or newline before a
                    // markdown block element (list item, heading, blockquote, code fence).
                    // These all produce separate DOM elements so the split is visually seamless.
                    let splitAt = 0;
                    const lastPara = fullText.lastIndexOf("\n\n");
                    if (lastPara >= 0) {
                      splitAt = lastPara + 2;
                    } else {
                      // e.g. "\n- item", "\n## Heading", "\n```"
                      const blockRe = /\n(?=[-*+>]|\d+\.\s|#{1,6}\s|```)/g;
                      let m: RegExpExecArray | null;
                      let lastBlock = -1;
                      while ((m = blockRe.exec(fullText)) !== null) lastBlock = m.index + 1;
                      if (lastBlock > 10 && fullText.length - lastBlock > 5) splitAt = lastBlock;
                    }
                    const settled = fullText.slice(0, splitAt);
                    const fresh = fullText.slice(splitAt);
                    return (
                      <div className="w-full text-[16px] leading-8" style={{ color: "var(--base-800)" }}>
                        {settled && (
                          <MarkdownRenderer
                            content={settled}
                            graphArtifacts={streamingGraphArtifacts}
                            renderPendingGraphs
                          />
                        )}
                        {fresh && (
                          <motion.div
                            key={`learn-fresh-${splitAt}`}
                            initial={{ opacity: 0, filter: "blur(8px)", y: 4 }}
                            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <MarkdownRenderer
                              content={fresh}
                              graphArtifacts={streamingGraphArtifacts}
                              renderPendingGraphs
                            />
                          </motion.div>
                        )}
                        <span
                          className="inline-block w-[2px] h-[1em] ml-[1px] animate-pulse align-middle"
                          style={{ background: "var(--base-500)" }}
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Spacer while streaming */}
            {(isStreaming || kickoffLoading || notesGenBusy) && <div style={{ minHeight: "20vh" }} />}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.button
            key="scroll-to-bottom"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
            style={{
              position: "absolute",
              bottom: 160,
              left: "calc(50% - 18px)",
              zIndex: 20,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.85)",
              border: "0.5px solid #d1d5db",
              boxShadow: "0 2px 8px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backdropFilter: "blur(6px)",
            }}
            aria-label="Scroll to bottom"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="shrink-0 px-3 min-[480px]:px-6 pb-4 min-[480px]:pb-6 pt-0 border-t border-[var(--base-100)] bg-[#fcfcfc]">
        <div
          className="mx-auto w-full min-w-0 transition-[max-width] duration-200 ease-out"
          style={{ maxWidth: CHAT_MAX_WIDTH }}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => void handleFileSelect(e)}
          />

          {/* Upload error toast */}
          <AnimatePresence>
            {uploadErrorMsg && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-2 px-3 py-2 rounded-xl text-[13px] bg-red-50 border border-red-200 text-red-600"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {uploadErrorMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* STT (Dictate) error toast */}
          <AnimatePresence>
            {sttErrorVisible && (
              <motion.div
                key="stt-error"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-2 px-3 py-2 rounded-xl text-[13px] bg-red-50 border border-red-200 text-red-600"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {sttErrorVisible}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            layout
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => void handleDrop(e)}
            className={`relative w-full overflow-x-clip overflow-y-visible rounded-[24px] bg-white min-h-0 transition-[border-color,background-color,box-shadow] duration-300 ease-out ${
              isDragging
                ? "border border-[var(--primary-300)] shadow-[0_0_0_2px_rgba(99,102,241,0.15)]"
                : isFocused
                ? "border border-[var(--base-300)] shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_8px_-2px_rgba(0,0,0,0.04)]"
                : "border border-[var(--base-200)] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.03)]"
            }`}
          >
            {/* Drag overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-[24px] bg-white pointer-events-none">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--primary-50, #EEF4FF)" }}>
                  <IconAttach className="w-5 h-5 text-[var(--primary-400)]" />
                </div>
                <p className="text-[14px] font-medium" style={{ fontFamily: "var(--font-inter)", color: "var(--primary-400)" }}>
                  Drop to attach
                </p>
              </div>
            )}
            <AnimatePresence mode="wait" initial={false}>
              {(isRecording || isTranscribing) ? (
                <motion.div
                  key="voice-recording"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <VoiceRecordingBar
                    stream={sttStream}
                    isTranscribing={isTranscribing}
                    onStop={stopRecording}
                    onCancel={cancelRecording}
                    devices={micDevices}
                    selectedDeviceId={selectedDeviceId}
                    onDeviceChange={setSelectedDeviceId}
                    onPickerOpen={enumerateMics}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="text-input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  layout
                  className="flex flex-col p-3 gap-3"
                >
                  {/* Attachment previews */}
                  {(pendingAttachments.length > 0 || uploadingFiles.some((f) => f.progress === "uploading")) && (
                    <div className="flex flex-wrap gap-2 px-1">
                      {uploadingFiles.filter((f) => f.progress === "uploading").map((f) => (
                        <div key={f.uid} className="flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-100 text-[13px] text-slate-500" style={{ fontFamily: "var(--font-inter)" }}>
                          <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          <span className="max-w-[120px] truncate">{f.name}</span>
                        </div>
                      ))}
                      {pendingAttachments.map((att, idx) => (
                        <div key={att.path} className="flex items-center gap-2 h-9 pl-2 pr-1 rounded-xl bg-slate-100 text-[13px] text-slate-700" style={{ fontFamily: "var(--font-inter)" }}>
                          {att.type.startsWith("image/") ? (
                            <img src={att.url} alt={att.name} className="w-6 h-6 rounded-md object-cover shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold text-red-600">PDF</span>
                            </div>
                          )}
                          <span className="max-w-[100px] truncate">{att.name}</span>
                          <button
                            type="button"
                            onClick={() => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            className="ml-0.5 p-1 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
                            aria-label={`Remove ${att.name}`}
                          >
                            <IconX className="w-3 h-3 text-slate-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Textarea row */}
                  <div className="flex flex-1 min-w-0 items-center gap-0">
                    <div className="relative flex-1 min-w-0 flex min-h-0">
                      <textarea
                        ref={inputRef}
                        onChange={(e) => {
                          resizeTextarea();
                          const empty = !e.target.value.trim();
                          if (empty !== isInputEmpty) setIsInputEmpty(empty);
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        onPaste={(e) => void handlePaste(e)}
                        placeholder={kickoffLoading ? "Your tutor is preparing..." : "Reply to your tutor..."}
                        disabled={kickoffLoading || notesGenBusy}
                        rows={1}
                        className="flex-1 min-w-0 py-2 px-3 text-[16px] leading-[1.5] placeholder:text-slate-400 resize-none border-none outline-none bg-transparent scrollbar-subtle-y disabled:opacity-60"
                        style={{ fontFamily: "var(--font-inter)", maxHeight: TEXTAREA_MAX_HEIGHT }}
                      />
                    </div>
                  </div>
                  {/* Bottom row */}
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-1 shrink-0">
                      <TooltipHint label="Add photos or files">
                        <motion.button
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="size-10 shrink-0 rounded-full flex items-center justify-center bg-transparent text-[var(--base-500)] transition-all duration-150 hover:bg-slate-200/60 active:scale-95 cursor-pointer"
                          aria-label="Add photos or files"
                        >
                          <IconAdd className="w-5 h-5" />
                        </motion.button>
                      </TooltipHint>
                    </div>

                    {/* Centre: Continue + Simplify — shown when idle with messages */}
                    <AnimatePresence mode="wait">
                      {isInputEmpty && !isStreaming && !kickoffLoading && !notesGenBusy && messages.length > 0 && pendingAttachments.length === 0 ? (
                        <motion.div
                          key="quick-actions"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                          className="flex items-center gap-2 flex-1 justify-end min-w-0"
                        >
                          {/* Dictate — always visible, left of Simplify */}
                          <DictateButton
                            isRecording={isRecording}
                            isTranscribing={isTranscribing}
                            onDictate={handleDictate}
                            devices={micDevices}
                            selectedDeviceId={selectedDeviceId}
                            onDeviceChange={setSelectedDeviceId}
                            onPickerOpen={enumerateMics}
                          />
                          {/* Simplify */}
                          <button
                            type="button"
                            onClick={() => { track("learn_simplify_clicked"); void sendMessage(pickRandom(SIMPLIFY_MESSAGES)); }}
                            className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-[var(--base-200)] bg-white text-[var(--base-600)] text-[13px] font-medium transition-all duration-150 hover:bg-[var(--base-100)] active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
                            style={{ fontFamily: "var(--font-inter)" }}
                          >
                            <IconSimplify className="w-3.5 h-3.5 shrink-0" />
                            <span>Simplify</span>
                          </button>
                          {/* Continue */}
                          <button
                            type="button"
                            onClick={() => { track("learn_continue_clicked"); void sendMessage(pickRandom(CONTINUE_MESSAGES)); }}
                            className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] font-medium transition-all duration-150 hover:opacity-90 active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
                            style={{ backgroundColor: "var(--primary-400)", color: "#fff", fontFamily: "var(--font-inter)" }}
                          >
                            <span>Continue</span>
                            <IconContinue className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="send-btn"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                          className="flex items-center gap-2"
                        >
                          {/* Dictate (STT) */}
                          <DictateButton
                            isRecording={isRecording}
                            isTranscribing={isTranscribing}
                            onDictate={handleDictate}
                            devices={micDevices}
                            selectedDeviceId={selectedDeviceId}
                            onDeviceChange={setSelectedDeviceId}
                            onPickerOpen={enumerateMics}
                          />
                          <button
                            type="button"
                            disabled={(!isStreaming && !kickoffLoading && isInputEmpty && pendingAttachments.length === 0) || notesGenBusy || isRecording || isTranscribing}
                            onClick={(isStreaming || kickoffLoading) ? () => { abortRef.current?.abort(); kickoffAbortRef.current?.abort(); } : handleSend}
                            className="size-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden transition-all duration-150 hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50 disabled:active:scale-100"
                            style={{ backgroundColor: (isStreaming || kickoffLoading) ? "#EEF4FF" : "var(--primary-400)" }}
                            aria-label={(isStreaming || kickoffLoading) ? "Stop" : "Send"}
                          >
                            <AnimatePresence mode="popLayout" initial={false}>
                              {(isStreaming || kickoffLoading) ? (
                                <motion.span
                                  key="stop"
                                  initial={{ opacity: 0, y: 16 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -16 }}
                                  transition={{ duration: 0.18, ease: "easeInOut" }}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1e3a5f" stroke="none">
                                    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                                  </svg>
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="send"
                                  initial={{ opacity: 0, y: 16 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -16 }}
                                  transition={{ duration: 0.18, ease: "easeInOut" }}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  <IconSend className="w-5 h-5 text-white" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <p className="text-[12px] text-center mb-[-16px] mt-2" style={{ fontFamily: "var(--font-inter)", color: "var(--base-400)" }}>
            Lessons use your NCERT textbook from our library.
          </p>
        </div>
      </div>
    </div>

    {/* ── Right sidebar (in-flow on large screens, overlay drawer on phones) ── */}
    <AnimatePresence initial={false}>
      {learnSidebarOpen && learnNarrowViewport && (
        <motion.button
          key={`learn-sidebar-backdrop-${sessionId}`}
          type="button"
          aria-label="Close chapter panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[85] bg-slate-900/35 border-0 p-0 cursor-default"
          onClick={() => toggleLearnSidebar()}
        />
      )}
      {learnSidebarOpen && (
        <motion.aside
          key={`learn-right-sidebar-${sessionId}`}
          initial={learnSidebarMotion.initial}
          animate={learnSidebarMotion.animate}
          exit={learnSidebarMotion.exit}
          transition={learnSidebarMotion.transition}
          className={
            learnNarrowViewport
              ? "fixed right-0 top-0 bottom-0 z-[86] flex flex-col border-l border-[var(--base-100)] bg-white overflow-hidden shadow-[-4px_0_28px_rgba(15,23,42,0.12)]"
              : "shrink-0 flex flex-col border-l border-[var(--base-100)] bg-white overflow-hidden"
          }
          style={learnNarrowViewport ? { width: "min(272px, calc(100vw - 20px))" } : { minWidth: 0 }}
        >
          <div className="flex flex-col h-full w-full" style={{ width: learnNarrowViewport ? "100%" : 272 }}>
            {/* Header */}
            <div className="shrink-0 px-5 pt-6 pb-4 mb-4 border-b border-[var(--base-200)]">
              <div className="flex items-baseline justify-between mb-3">
                <h2
                  className="text-[17px] font-semibold leading-tight tracking-[-0.02em]"
                  style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}
                >
                  Chapter progress
                </h2>
                <span
                  className="text-[13px] font-semibold tabular-nums"
                  style={{ fontFamily: "var(--font-inter)", color: chapterProgress.pct === 100 ? "var(--primary-500)" : "var(--base-500)" }}
                >
                  {chapterProgress.pct}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-[5px] rounded-full bg-[var(--base-100)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: chapterProgress.pct === 100
                      ? "var(--primary-400)"
                      : "linear-gradient(90deg, var(--primary-300) 0%, var(--primary-500) 100%)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${chapterProgress.pct}%` }}
                  transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </div>
            </div>

            {/* Topic timeline */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col scrollbar-chat">
              {(() => {
                const currentIdxForNav = sortedTopics.findIndex((t) => String(t.topic_index).trim() === currentTopicKey);
                return sortedTopics.map((topic, i) => {
                const ti = String(topic.topic_index).trim();
                const isCompleted = completedTopicSet.has(ti);
                const isCurrent = currentTopicKey != null && ti === currentTopicKey;
                const isIntro = ti.endsWith(".0");
                const isLast = i === sortedTopics.length - 1;
                const topicNavLocked = topicNavBusy || isStreaming || kickoffLoading || notesGenBusy;
                const navDir = !isCurrent
                  ? i < currentIdxForNav ? "prev" : i === currentIdxForNav + 1 ? "next" : "skip"
                  : null;
                const topicLabel = isIntro ? "Introduction" : topic.topic_name;

                return (
                  <div key={ti} className="flex items-stretch gap-3">
                    {/* Timeline dot + connector — purely decorative */}
                    <div className="flex w-4 shrink-0 flex-col items-center">
                      <div className="mt-[4px] shrink-0 relative z-10">
                        {isCompleted ? (
                          <div className="w-[13px] h-[13px] rounded-full bg-[var(--primary-400)] flex items-center justify-center">
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </div>
                        ) : isCurrent ? (
                          <div className="w-[13px] h-[13px] rounded-full border-2 border-[var(--primary-400)] flex items-center justify-center bg-white">
                            <div className="w-[5px] h-[5px] rounded-full bg-[var(--primary-400)]" />
                          </div>
                        ) : (
                          <div className="w-[13px] h-[13px] rounded-full border-2 border-[var(--base-300)] bg-white" />
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className="flex-1 min-h-[10px] mt-[3px]"
                          style={{ width: "1.5px", backgroundColor: isCompleted ? "var(--primary-300)" : "var(--base-200)" }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 min-w-0 pt-0.5 ${!isLast ? "pb-3" : ""}`}>
                      {isCurrent ? (
                        <p
                          className="text-[13px] leading-snug font-semibold"
                          style={{ color: "var(--base-800)", fontFamily: "var(--font-inter)" }}
                        >
                          {topicLabel}
                        </p>
                      ) : (
                        <button
                          type="button"
                          disabled={topicNavLocked}
                          onClick={() => void handleJumpToTopic(topic)}
                          title={
                            navDir === "prev" ? `Go back to ${topicLabel}`
                              : navDir === "next" ? `Move to ${topicLabel}`
                              : `Skip to ${topicLabel}`
                          }
                          className="group text-left w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ fontFamily: "var(--font-inter)" }}
                        >
                          <span
                            className={`text-[13px] leading-snug font-normal transition-colors duration-100 ${
                              isCompleted
                                ? "text-[var(--base-300)] group-hover:text-[var(--base-600)]"
                                : "text-[var(--base-500)] group-hover:text-[var(--base-800)]"
                            }`}
                          >
                            {topicLabel}
                          </span>
                        </button>
                      )}
                      {isCurrent && (
                        <span
                          className="inline-block mt-1 text-[10.5px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-md"
                          style={{ fontFamily: "var(--font-inter)", color: "var(--primary-500)", backgroundColor: "var(--primary-50, #eef4ff)" }}
                        >
                          Now
                        </span>
                      )}
                    </div>
                  </div>
                );
              });
              })()}
            </div>

            {/* Chapter tools */}
            <div className="shrink-0 px-4 pb-3 border-t border-[var(--base-100)] pt-3 flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--base-400)", fontFamily: "var(--font-inter)" }}>
                Chapter tools
              </p>
              {/* Practice — not shown for SST or G11 Economics (no questions in study feed yet) */}
              {!subject.startsWith("social") && subject !== "economics" && subject !== "business_studies" && subject !== "accountancy" && (
                <button
                  type="button"
                  onClick={() => {
                    closeLearnChapterPanelOnMobile();
                    const subjectLabel = subject === "science" ? "Science" : subject === "math" ? "Mathematics" : subject;
                    sessionStorage.setItem("studyFeedPrefillFilter", JSON.stringify({ subject: subjectLabel, chapter_index: chapterIndex }));
                    startTopLoader();
                    router.push("/study");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors duration-100 hover:bg-[var(--base-100)] cursor-pointer"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary-400)", flexShrink: 0 }}>
                    <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                  </svg>
                  <span className="text-[13px]" style={{ color: "var(--base-600)" }}>Practice questions</span>
                </button>
              )}
              {/* Quick Quiz */}
              <button
                type="button"
                disabled={isStreaming || kickoffLoading || notesGenBusy}
                onClick={() => {
                  closeLearnChapterPanelOnMobile();
                  const topicLabel = currentTopicKey
                    ? topics.find((t) => String(t.topic_index).trim() === currentTopicKey)?.topic_name ?? chapterName
                    : chapterName;
                  void sendMessage(
                    `Give me a **Quick Quiz** on "${topicLabel}" based strictly on NCERT content.\n\nFormat each question EXACTLY like this (no extra text between questions):\n\n**Question 1:** [question text]\nA) [option]\nB) [option]\nC) [option]\nD) [option]\n**Correct answer: X**\n\n**Question 2:** [question text]\nA) [option]\nB) [option]\nC) [option]\nD) [option]\n**Correct answer: X**\n\n**Question 3:** [question text]\nA) [option]\nB) [option]\nC) [option]\nD) [option]\n**Correct answer: X**`,
                    undefined,
                    `Quick quiz on **${topicLabel}**`
                  );
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors duration-100 hover:bg-[var(--base-100)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary-400)", flexShrink: 0 }}>
                  <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-[13px]" style={{ color: "var(--base-600)" }}>Quick quiz</span>
              </button>
              {/* Generate Notes */}
              <button
                type="button"
                disabled={isStreaming || kickoffLoading || notesGenBusy}
                onClick={() => {
                  const topicLabel = currentTopicKey
                    ? topics.find((t) => String(t.topic_index).trim() === currentTopicKey)?.topic_name ?? chapterName
                    : chapterName;
                  void generateStructuredNotesForTopic(topicLabel);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors duration-100 hover:bg-[var(--base-100)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary-400)", flexShrink: 0 }}>
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" />
                </svg>
                <span className="text-[13px]" style={{ color: "var(--base-600)" }}>Generate notes</span>
              </button>
            </div>

            {/* Bottom actions */}
            <div className="shrink-0 px-4 py-4 border-t border-[var(--base-100)] flex flex-col gap-2">
              {nextTopic ? (
                <button
                  type="button"
                  onClick={() => void handleAdvanceNextTopic()}
                  disabled={topicNavBusy || isStreaming || kickoffLoading || notesGenBusy}
                  className="w-full flex items-center justify-between gap-2 pl-3.5 pr-3 py-2.5 rounded-xl transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--primary-400)", fontFamily: "var(--font-inter)" }}
                >
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-white/60 leading-none mb-1">
                      Next topic
                    </span>
                    <span className="text-[13px] font-semibold text-white truncate leading-snug">
                      {topicNavBusy ? "Updating…" : nextTopic.topic_name}
                    </span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ) : isOnLastTopic ? (
                <button
                  type="button"
                  onClick={() => void handleCompleteChapter()}
                  disabled={topicNavBusy || isStreaming || kickoffLoading || notesGenBusy}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--primary-400)", color: "white", fontFamily: "var(--font-inter)" }}
                >
                  {topicNavBusy ? "Finishing…" : "Complete chapter"}
                </button>
              ) : null}
              {showDifferentPatternCta && (
                <button
                  type="button"
                  onClick={() => void handleDifferentPattern()}
                  disabled={isStreaming || kickoffLoading || notesGenBusy}
                  className="w-full px-4 py-2 rounded-xl text-[12.5px] font-medium transition-all duration-150 hover:bg-[var(--base-50)] active:scale-[0.99] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed border border-[var(--base-150,#ebebeb)] text-[var(--base-500)]"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  Try a different teaching style
                </button>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
    </div>
  );
}
