"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Keyframes + custom scrollbar ──────────────────────────────────────────────
const SHIMMER_CSS = `
@keyframes tb-text-shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@keyframes tb-icon-pulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1;   }
}
.tb-chunks::-webkit-scrollbar          { height: 3px; }
.tb-chunks::-webkit-scrollbar-track    { background: transparent; }
.tb-chunks::-webkit-scrollbar-thumb    { background: #e2e8f0; border-radius: 9999px; }
.tb-chunks::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
`;

// Grey palette
const G = {
  800: "#1f2937",
  700: "#374151",
  600: "#4b5563",
  500: "#6b7280",
  400: "#9ca3af",
  300: "#d1d5db",
  200: "#e5e7eb",
  100: "#f3f4f6",
  50:  "#f9fafb",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChunkPreview {
  chunk_id: string;
  chapter_name?: string;
  chapter_index?: string;
  topic_name?: string;
  topic_index?: string;
  page_start?: number;
  page_end?: number;
  preview: string;
}

export type StepEvent =
  | { type: "step:thinking";      label: string }
  | { type: "step:attachments";   label: string }
  | { type: "step:query";         label: string; query: string }
  | { type: "step:searching";     label: string }
  | { type: "step:search_skipped"; label: string }
  | { type: "step:chunks";        label: string; chunks: ChunkPreview[] }
  | { type: "step:generating";    label: string };

export interface ThinkingData {
  steps: StepEvent[];
  elapsed: number;
  sourcesCount: number;
}

export interface ThinkingBlockProps {
  steps: StepEvent[];
  isDone: boolean;
  isStreaming: boolean;
  elapsed?: number;
  sourcesCount?: number;
  /** Custom label shown while loading (default: "Thinking...") */
  loadingLabel?: string;
}

// ── Shimmer helpers ───────────────────────────────────────────────────────────

function ShimmerLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        background: `linear-gradient(90deg, ${G[700]} 0%, ${G[500]} 35%, ${G[400]} 50%, ${G[500]} 65%, ${G[700]} 100%)`,
        backgroundSize: "250% auto",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: "tb-text-shimmer 2.2s linear infinite",
        display: "inline",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function PulseIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        animation: "tb-icon-pulse 2.2s ease-in-out infinite",
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
    </span>
  );
}

// ── Icons (15 × 15) ───────────────────────────────────────────────────────────

type IconProps = { color?: string };

function IconSearch({ color }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke={color ?? "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  );
}

function IconLayers({ color }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke={color ?? "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </svg>
  );
}

function IconWandSparkles({ color }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke={color ?? "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
      <path d="m14 7 3 3" />
      <path d="M5 6v4" />
      <path d="M19 14v4" />
      <path d="M10 2v2" />
      <path d="M7 8H3" />
      <path d="M21 16h-4" />
      <path d="M11 3H9" />
    </svg>
  );
}

function IconEye({ color }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke={color ?? "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconSearchOff({ color }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke={color ?? "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
      <path d="m8 8 6 6" />
      <path d="m14 8-6 6" />
    </svg>
  );
}

function IconCheckCircle({ color }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconChevronDown({ color }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke={color ?? "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ── Step icons map ────────────────────────────────────────────────────────────

const STEP_ICONS: Partial<Record<StepEvent["type"], React.FC<IconProps>>> = {
  "step:attachments":    IconEye,
  "step:query":          IconWandSparkles,
  "step:searching":      IconSearch,
  "step:search_skipped": IconSearchOff,
  "step:chunks":         IconLayers,
};

// Steps that are implicit — never shown in the visual list
const HIDDEN_STEP_TYPES = new Set<StepEvent["type"]>(["step:thinking", "step:generating"]);

// ── Chunk card ────────────────────────────────────────────────────────────────

function ChunkCard({ chunk, index }: { chunk: ChunkPreview; index: number }) {
  const pageStr = chunk.page_start
    ? chunk.page_end && chunk.page_end !== chunk.page_start
      ? `pp. ${chunk.page_start}–${chunk.page_end}`
      : `p. ${chunk.page_start}`
    : null;

  const chapterLabel = [chunk.chapter_index && `${chunk.chapter_index}.`, chunk.chapter_name]
    .filter(Boolean)
    .join(" ") || null;

  const topicLabel = [chunk.topic_index, chunk.topic_name]
    .filter(Boolean)
    .join(" ") || null;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.2, ease: "easeOut" }}
      className="flex-shrink-0"
      style={{
        width: 200,
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "white",
        border: `1px solid ${G[200]}`,
      }}
    >
      {chapterLabel && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--primary-500, #3b82f6)",
          }}
        >
          {chapterLabel}
        </div>
      )}
      {topicLabel && (
        <div
          style={{
            fontSize: 11.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: G[500],
          }}
        >
          {topicLabel}
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          lineHeight: 1.5,
          marginTop: 2,
          color: G[400],
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {chunk.preview}
      </div>
      {pageStr && (
        <div style={{ fontSize: 10.5, marginTop: "auto", paddingTop: 4, color: G[400] }}>
          {pageStr}
        </div>
      )}
    </motion.div>
  );
}

// ── Live timer — pauses when streaming starts ─────────────────────────────────

function LiveTimer({ startTime, paused }: { startTime: number; paused?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 100);
    return () => clearInterval(id);
  }, [startTime, paused]);

  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>{elapsed.toFixed(1)}s</span>
  );
}

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({
  step,
  isActive,
  isLast,
}: {
  step: StepEvent;
  isActive: boolean;
  isLast: boolean;
}) {
  const Icon = STEP_ICONS[step.type];
  // Same colour for icon and label — dark when active, muted when done
  const iconColor = isActive ? G[700] : G[500];
  const labelColor = isActive ? G[700] : G[500];

  const labelText =
    step.type === "step:query"
      ? null
      : step.label;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      style={{ display: "flex", alignItems: "stretch", gap: 14 }}
    >
      {/* Left rail: icon + connecting line */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 16,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 22,
          }}
        >
          {Icon &&
            (isActive ? (
              <PulseIcon><Icon color={iconColor} /></PulseIcon>
            ) : (
              <Icon color={iconColor} />
            ))}
        </div>
        {!isLast && (
          <div
            style={{
              flex: 1,
              width: 1.5,
              marginTop: 3,
              marginBottom: 3,
              background: G[200],
              minHeight: 8,
            }}
          />
        )}
      </div>

      {/* Right: label + optional chunk cards */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          paddingBottom: isLast ? 0 : 20,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", minHeight: 22 }}>
          {step.type === "step:query" ? (
            <span style={{ fontSize: 14, color: labelColor, lineHeight: "20px" }}>
              {step.label === "Query" ? "Query:" : "Rephrased:"}{" "}
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  background: G[100],
                  color: G[700],
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                {step.query}
              </span>
            </span>
          ) : isActive && labelText ? (
            <ShimmerLabel style={{ fontSize: 14, lineHeight: "20px" }}>
              {labelText}
            </ShimmerLabel>
          ) : labelText ? (
            <span style={{ fontSize: 14, color: labelColor, lineHeight: "20px" }}>
              {labelText}
            </span>
          ) : null}
        </div>

        {step.type === "step:chunks" && step.chunks.length > 0 && (
          <div
            className="tb-chunks"
            style={{
              marginTop: 8,
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 6,
            }}
          >
            {step.chunks.map((chunk, i) => (
              <ChunkCard key={chunk.chunk_id} chunk={chunk} index={i} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const STORAGE_KEY = "lerno_thinking_expanded";

export function ThinkingBlock({
  steps = [],
  isDone,
  isStreaming,
  elapsed,
  loadingLabel = "Thinking...",
}: ThinkingBlockProps) {
  // Must match SSR: never read localStorage in useState — server is always "default expanded"
  const [isExpanded, setIsExpanded] = useState(true);
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsExpanded(stored === "true");
    }
  }, []);
  const [headerHovered, setHeaderHovered] = useState(false);

  // Was this component already done when it first mounted?
  // If yes, it's a historical message — use the server-provided elapsed prop directly.
  // If no, it's a live thinking session — use our local timer.
  const mountedAsDoneRef = useRef(isDone);

  const startTimeRef = useRef(Date.now());
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null);

  useEffect(() => {
    // Only run the local timer logic for live sessions (not historical re-mounts)
    if (mountedAsDoneRef.current) return;
    if ((isStreaming || isDone) && thinkingDuration === null) {
      setThinkingDuration((Date.now() - startTimeRef.current) / 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, isDone]);

  const toggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  const visibleSteps = steps.filter((s) => !HIDDEN_STEP_TYPES.has(s.type));
  // Historical messages: use server elapsed. Live sessions: use local timer.
  const elapsedInt = Math.round(
    mountedAsDoneRef.current ? (elapsed ?? 0) : (thinkingDuration ?? elapsed ?? 0)
  );

  const headerTextColor = headerHovered ? G[800] : isDone ? G[500] : G[700];
  const chevronColor = headerHovered ? G[600] : G[400];

  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div
        style={{
          marginBottom: 16,
          fontFamily: "var(--font-inter)",
        }}
      >
        {/* ── Header ── */}
        <button
          type="button"
          onClick={toggle}
          onMouseEnter={() => setHeaderHovered(true)}
          onMouseLeave={() => setHeaderHovered(false)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            padding: "4px 6px",
            gap: 4,
            background: headerHovered ? G[100] : "transparent",
            borderRadius: 6,
            cursor: "pointer",
            transition: "background 120ms",
          }}
        >
          {!isDone ? (
            <ShimmerLabel style={{ fontSize: 14, fontWeight: 430, lineHeight: "20px" }}>
              {loadingLabel}
            </ShimmerLabel>
          ) : (
            <span
              style={{
                fontSize: 14,
                fontWeight: 430,
                color: headerTextColor,
                lineHeight: "20px",
                transition: "color 120ms",
              }}
            >
              {`Thought for ${elapsedInt}s`}
            </span>
          )}

          <motion.span
            initial={false}
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <IconChevronDown color={chevronColor} />
          </motion.span>

          {!isDone && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 12,
                color: G[400],
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <LiveTimer startTime={startTimeRef.current} paused={mountedAsDoneRef.current || thinkingDuration !== null} />
            </span>
          )}
        </button>

        {/* ── Body ── */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="body"
              initial={false}
              animate={{ maxHeight: 2000, opacity: 1 }}
              exit={{ maxHeight: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ paddingTop: 10, paddingLeft: 2 }}>
                <AnimatePresence initial={false}>
                  {visibleSteps.map((step, i) => {
                    // When isDone, the Done row is last — so no step is ever "last" for line purposes
                    const isLast = isDone ? false : i === visibleSteps.length - 1;
                    const isActive = !isDone && i === visibleSteps.length - 1;
                    return (
                      <StepRow
                        key={`${step.type}-${i}`}
                        step={step}
                        isActive={isActive}
                        isLast={isLast}
                      />
                    );
                  })}

                  {/* Done row — appears once all steps complete */}
                  {isDone && visibleSteps.length > 0 && (
                    <motion.div
                      key="done-row"
                      initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      style={{ display: "flex", alignItems: "center", gap: 14 }}
                    >
                      <div style={{ width: 16, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                        <IconCheckCircle color={G[500]} />
                      </div>
                      <span style={{ fontSize: 14, color: G[500], lineHeight: "20px" }}>Done</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
