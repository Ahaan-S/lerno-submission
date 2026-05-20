"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChunkPreview {
  chunk_id: string;
  chapter_name?: string;
  chapter_index?: string;
  topic_name?: string;
  page_start?: number;
  page_end?: number;
  preview: string;
}

export type StepEvent =
  | { type: "step:thinking"; label: string }
  | { type: "step:subject"; label: string }
  | { type: "step:query"; label: string; query: string }
  | { type: "step:searching"; label: string }
  | { type: "step:search_skipped"; label: string }
  | { type: "step:chunks"; label: string; chunks: ChunkPreview[] }
  | { type: "step:attachments"; label: string }
  | { type: "step:generating"; label: string };

interface ProcessingStepsProps {
  steps: StepEvent[];
  isStreaming: boolean;
  isDone: boolean;
  elapsed?: number;
  sourcesCount?: number;
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin flex-shrink-0"
      style={{ color: "var(--primary-400)" }}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Check icon ────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 flex-shrink-0"
      style={{ color: "var(--primary-400)" }}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// ── Chunk preview card ────────────────────────────────────────────────────────

function ChunkCard({ chunk, index }: { chunk: ChunkPreview; index: number }) {
  const pageStr = chunk.page_start
    ? chunk.page_end && chunk.page_end !== chunk.page_start
      ? `pp. ${chunk.page_start}–${chunk.page_end}`
      : `p. ${chunk.page_start}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.22, ease: "easeOut" }}
      className="flex-shrink-0 w-[172px] rounded-xl p-3 flex flex-col gap-1"
      style={{
        background: "var(--base-50)",
        border: "1px solid var(--base-150)",
      }}
    >
      <div
        className="text-[11px] font-semibold truncate"
        style={{ color: "var(--primary-500)" }}
      >
        {chunk.chapter_name ?? `Chapter ${chunk.chapter_index ?? "?"}`}
      </div>
      {chunk.topic_name && (
        <div
          className="text-[11px] truncate"
          style={{ color: "var(--base-500)" }}
        >
          {chunk.topic_name}
        </div>
      )}
      <div
        className="text-[11px] leading-[1.5] mt-0.5"
        style={{
          color: "var(--base-400)",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {chunk.preview}
      </div>
      {pageStr && (
        <div
          className="text-[10px] mt-auto pt-1"
          style={{ color: "var(--base-350)" }}
        >
          {pageStr}
        </div>
      )}
    </motion.div>
  );
}

// ── Single step row ───────────────────────────────────────────────────────────

function StepRow({
  step,
  isActive,
}: {
  step: StepEvent;
  isActive: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col gap-2"
    >
      {/* Label row */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 flex items-center justify-center">
          {isActive ? <Spinner /> : <CheckIcon />}
        </div>

        {step.type === "step:query" ? (
          <span className="text-[13px]" style={{ color: "var(--base-500)" }}>
            Searching for:{" "}
            <span
              className="px-1.5 py-0.5 rounded text-[12px] font-mono"
              style={{
                background: "var(--base-100)",
                color: "var(--base-700)",
              }}
            >
              {step.query}
            </span>
          </span>
        ) : (
          <span
            className="text-[13px]"
            style={{
              color: isActive ? "var(--base-700)" : "var(--base-400)",
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {step.label}
          </span>
        )}
      </div>

      {/* Chunk cards for step:chunks */}
      {step.type === "step:chunks" && step.chunks.length > 0 && (
        <div className="ml-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {step.chunks.map((chunk, i) => (
            <ChunkCard key={chunk.chunk_id} chunk={chunk} index={i} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Live timer ────────────────────────────────────────────────────────────────

function LiveTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 100);
    return () => clearInterval(id);
  }, [startTime]);
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{elapsed.toFixed(1)}s</span>;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ProcessingSteps({
  steps,
  isStreaming,
  isDone,
  elapsed,
  sourcesCount,
}: ProcessingStepsProps) {
  const [expanded, setExpanded] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Collapsed summary pill — shown after done
  if (isDone && !expanded) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-lg mb-3"
        style={{ color: "var(--base-400)" }}
      >
        {/* search icon */}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        Searched NCERT
        {sourcesCount != null && ` · ${sourcesCount} source${sourcesCount !== 1 ? "s" : ""}`}
        {elapsed != null && ` · ${elapsed.toFixed(1)}s`}
        {/* chevron down */}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </motion.button>
    );
  }

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Collapse button when expanded post-done */}
      {isDone && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1 text-[12px] self-start"
          style={{ color: "var(--base-400)" }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
          Collapse
        </button>
      )}

      {/* Live timer while in progress */}
      {!isDone && (
        <div className="text-[12px] self-end" style={{ color: "var(--base-350)" }}>
          <LiveTimer startTime={startTimeRef.current} />
        </div>
      )}

      {/* Step rows */}
      <AnimatePresence initial={false}>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          // A step is "active" (spinner) if it's the last one and we're not done yet
          // Exception: step:generating stays active while isStreaming is true
          const isActive =
            isLast &&
            !isDone &&
            (step.type !== "step:generating" || isStreaming);
          return (
            <StepRow
              key={`${step.type}-${i}`}
              step={step}
              isActive={isActive}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
