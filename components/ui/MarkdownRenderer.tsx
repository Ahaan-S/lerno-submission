"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { InteractiveGraphCard } from "@/components/ui/InteractiveGraphCard";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { normalizeCitationChunkMath } from "@/lib/math/citation-math-normalize";
import { GRAPH_PLACEHOLDER_PATTERN, type GraphArtifact } from "@/lib/graphs/types";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CitationData {
  index: number;
  chunk_id?: string;
  chapter_name?: string;
  chapter_index?: string;
  topic_name?: string;
  topic_index?: string;
  subtopic_name?: string;
  subtopic_index?: string;
  page_start?: number;
  page_end?: number;
  content?: string;
  book?: string;
  referenced_figures?: string[];
}

interface MarkdownRendererProps {
  content: string;
  citations?: CitationData[];
  /** Called when user clicks a citation badge. Receives 1-based citation index. */
  onCitationClick?: (index: number) => void;
  /** When set to a number, opens the modal at that citation index. Set to null to close. */
  externalOpenIndex?: number | null;
  /** Replaces default body typography (e.g. study question: larger, medium weight). */
  bodyClassName?: string;
  /** When true, body does not force base-800 — parent `className`/theme controls color (e.g. rose mistakes). */
  inheritColor?: boolean;
  /** Student grade — figures are disabled for grade 11 (not yet available). */
  grade?: number;
  /** Validated graph artifacts referenced by [[graph:id]] placeholders in content. */
  graphArtifacts?: GraphArtifact[] | null;
  /** During streaming, reserve the graph slot as soon as its placeholder arrives. */
  renderPendingGraphs?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pageLabel(c: CitationData): string | null {
  if (c.page_start == null) return null;
  return c.page_end && c.page_end !== c.page_start
    ? `Pages ${c.page_start} – ${c.page_end}`
    : `Page ${c.page_start}`;
}

function subtopicOrNull(c: CitationData): string | null {
  return c.subtopic_name && c.subtopic_name.toLowerCase() !== "introduction"
    ? c.subtopic_name
    : null;
}

// ─── Preprocess: inject <cite> tags for [N] markers ──────────────────────────
function injectCitationTags(text: string): string {
  return text.replace(/\[(\d{1,2})\]/g, '<cite data-index="$1">$1</cite>');
}

/**
 * Keep display equations visually scannable in chat bubbles by forcing
 * $$...$$ blocks onto their own lines before markdown parsing.
 */
function normalizeDisplayMathBlocks(text: string): string {
  return text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) => `\n$$\n${inner.trim()}\n$$\n`);
}

function isEquationOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("\\")) return false;
  if (!/[=+\-*/^]|\\frac|\\sqrt|\\vec|\\hat|\\sin|\\cos|\\tan|\\text|\\left|\\right/.test(trimmed)) return false;

  const proseProbe = trimmed
    .replace(/\$[^$]*\$/g, "")
    .replace(/\\text\{[^{}]*\}/g, "")
    .replace(/_\{?[A-Za-z0-9]+\}?/g, "")
    .replace(/\^\{?[A-Za-z0-9]+\}?/g, "")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[0-9_{}()[\]\\^=+\-*/.,:;$\s]/g, " ");

  return !/[A-Za-z]{2,}/.test(proseProbe);
}

/**
 * Repairs common malformed model output so KaTeX can parse it:
 * - \left($ ... \right$) -> \left( ... \right)
 * - ($...$) wrappers -> $...$
 * - equation-like LaTeX lines without delimiters -> $$...$$
 */
function sanitizeLatexFormatting(text: string): string {
  if (!text) return text;

  let out = text;

  // Fix markdown bullets where the model forgot the space after `*`.
  out = out.replace(/^(\s*)\*([\\$])/gm, "$1- $2");

  // Fix accidental dollar placement inside \left/\right wrappers.
  out = out
    .replace(/\\left\(\$/g, "\\left(")
    .replace(/\$\\right\)/g, "\\right)")
    .replace(/\\right\$\)/g, "\\right)")
    .replace(/\\left\[\$/g, "\\left[")
    .replace(/\$\\right\]/g, "\\right]")
    .replace(/\\right\$\]/g, "\\right]")
    .replace(/\\left\\\{\$/g, "\\left\\{")
    .replace(/\$\\right\\\}/g, "\\right\\}")
    .replace(/\\right\$\\\}/g, "\\right\\}");

  // Collapse `($...$)` / `[$...$]` / `{$...$}` wrappers into normal inline math.
  out = out
    .replace(/\(\s*\$([\s\S]*?)\$\s*\)/g, (_m, inner: string) => `$${inner.trim()}$`)
    .replace(/\[\s*\$([\s\S]*?)\$\s*\]/g, (_m, inner: string) => `$${inner.trim()}$`)
    .replace(/\{\s*\$([\s\S]*?)\$\s*\}/g, (_m, inner: string) => `$${inner.trim()}$`);

  // Promote standalone equation-only rows. Mixed prose stays as markdown text.
  const lines = out.split("\n");
  const normalizedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (!isEquationOnlyLine(trimmed)) return line;
    const equation = trimmed.replace(/\$/g, "").trim();
    return equation ? `$$\n${equation}\n$$` : line;
  });

  return normalizedLines.join("\n");
}

function PendingGraphCard({ placeholder }: { placeholder: string }) {
  return (
    <section
      className="my-5 rounded-xl border border-(--base-200) bg-[color-mix(in_srgb,var(--base-100)_62%,transparent)] p-4 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.35)]"
      style={{ fontFamily: "var(--font-inter)" }}
      aria-label="Preparing graph"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary-400)_10%,transparent)] text-(--primary-500)">
          <BarChart3 size={18} strokeWidth={2.2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--primary-500)">Graph</span>
            <span className="font-mono text-[11px] text-(--base-400)">{placeholder}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[13px] font-medium text-(--base-700)">
            <Loader2 size={14} className="animate-spin text-(--primary-500)" aria-hidden />
            Plotting from the equation...
          </div>
        </div>
      </div>
      <div className="mt-4 grid h-32 grid-cols-4 gap-3 overflow-hidden rounded-lg bg-white/70 p-3">
        <div className="col-span-3 flex flex-col justify-end gap-3">
          <div className="h-px w-full bg-(--base-200)" />
          <div className="h-px w-full bg-(--base-200)" />
          <div className="h-px w-full bg-(--base-200)" />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <div className="h-14 animate-pulse rounded-md bg-[color-mix(in_srgb,var(--primary-400)_20%,transparent)]" />
          <div className="h-20 animate-pulse rounded-md bg-[color-mix(in_srgb,var(--green-200)_34%,transparent)]" />
        </div>
      </div>
    </section>
  );
}

// ─── Citation Modal ───────────────────────────────────────────────────────────
function CitationModal({
  citations,
  currentIndex,
  onClose,
  onNavigate,
}: {
  citations: CitationData[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const sorted = [...citations].sort((a, b) => a.index - b.index);
  const pos = sorted.findIndex((c) => c.index === currentIndex);
  const total = sorted.length;
  const citation = sorted[pos];

  const canPrev = pos > 0;
  const canNext = pos < total - 1;
  const goPrev = () => canPrev && onNavigate(sorted[pos - 1].index);
  const goNext = () => canNext && onNavigate(sorted[pos + 1].index);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!citation) return null;

  const label = pageLabel(citation);
  const subtopic = subtopicOrNull(citation);

  const chapterLabel = [
    citation.chapter_index ? `${citation.chapter_index}.` : "",
    citation.chapter_name ?? "",
  ].filter(Boolean).join(" ");

  const topicLabel = [
    citation.topic_index ?? "",
    citation.topic_name ?? "",
  ].filter(Boolean).join(" ");

  const subtopicLabel = subtopic
    ? [citation.subtopic_index ?? "", subtopic].filter(Boolean).join(" ")
    : null;

  const navBtn: React.CSSProperties = {
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    transition: "background 120ms",
  };

  return createPortal(
    // ── Backdrop (padded on small screens so the card reads as a modal, not edge-to-edge) ──
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto overscroll-contain p-4 min-[400px]:p-5 sm:p-6 box-border"
      style={{
        background: "rgba(0,0,0,0.60)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      onClick={onClose}
    >
      {/* ── Card ────────────────────────────────────────────────────────────── */}
      <div
        className="relative my-auto flex w-full max-w-[700px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--base-200)] bg-[var(--base-100)]"
        style={{
          maxHeight: "min(550px, calc(100dvh - 3rem))",
          boxShadow:
            "0px 10px 15px -3px rgba(43,127,255,0.10), 0px 4px 6px -4px rgba(43,127,255,0.10)",
          fontFamily: "var(--font-inter)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--base-200)] bg-white px-4 py-3 sm:px-6 sm:py-4"
        >
          {/* Page label */}
          <span
            className="min-w-0 flex-1 truncate text-left text-[15px] font-medium sm:text-[18px]"
            style={{ color: "var(--base-600)", lineHeight: 1 }}
            title={label ?? undefined}
          >
            {label ?? "—"}
          </span>

          {/* Pagination */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              style={{ ...navBtn, opacity: canPrev ? 1 : 0.3, cursor: canPrev ? "pointer" : "default" }}
              aria-label="Previous citation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--base-600)" }}>
                <path d="M10 12L6 8l4-4" />
              </svg>
            </button>

            <span
              className="min-w-9 text-center text-[14px] sm:text-base"
              style={{ color: "var(--base-600)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
            >
              {pos + 1}/{total}
            </span>

            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              style={{ ...navBtn, opacity: canNext ? 1 : 0.3, cursor: canNext ? "pointer" : "default" }}
              aria-label="Next citation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--base-600)" }}>
                <path d="M6 12l4-4-4-4" />
              </svg>
            </button>
          </div>

          {/* Close */}
          <div className="flex shrink-0 justify-end">
            <button
              type="button"
              onClick={onClose}
              style={{ ...navBtn, cursor: "pointer" }}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--base-500)" }}>
                <path d="M15 5L5 15M5 5l10 10" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Main ────────────────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 px-4 pb-0 pt-5 sm:px-8 sm:pt-8 sm:pb-0">
          <div
            className="flex flex-col gap-4 rounded-[14px] border border-[var(--base-200)] bg-white p-4 sm:gap-4 sm:p-5 md:px-6"
          >
            {/* Row 1 — source header */}
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              {/* Index circle */}
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-full sm:size-[50px]"
                style={{ background: "var(--primary-400)" }}
              >
                <span className="text-base font-semibold leading-none text-white sm:text-[18px]">
                  {currentIndex}
                </span>
              </div>

              {/* Book + chapter stack */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[14px] font-normal leading-snug sm:text-base" style={{ color: "var(--base-600)" }}>
                  {citation.book ?? "NCERT"}
                </span>
                <span
                  className="line-clamp-2 text-[15px] font-medium leading-snug sm:text-[18px]"
                  style={{ color: "var(--base-600)" }}
                  title={chapterLabel || undefined}
                >
                  {chapterLabel || "—"}
                </span>
              </div>
            </div>

            {/* Row 2 — content */}
            {citation.content && (
              <div
                style={{
                  maxHeight: 155,
                  overflowY: "auto",
                  fontSize: 14,
                  fontWeight: 400,
                  color: "var(--base-400)",
                  lineHeight: "1.7",
                  scrollbarWidth: "thin",
                  scrollbarColor: "var(--base-200) transparent",
                  whiteSpace: "pre-wrap",
                }}
              >
                <MarkdownContent content={citation.content} />
              </div>
            )}

            {/* Row 3 — metadata footer */}
            {(citation.book || topicLabel || subtopicLabel) && (
              <div
                style={{
                  paddingTop: 16,
                  borderTop: "1px solid var(--base-200)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {citation.book && (
                  <span style={{ fontSize: 12, lineHeight: 1.4 }}>
                    <span style={{ color: "#6A7282" }}>Book: </span>
                    <span style={{ color: "var(--base-600)" }}>{citation.book}</span>
                  </span>
                )}
                {citation.book && topicLabel && (
                  <span style={{ fontSize: 16, color: "var(--base-300)", lineHeight: 1 }}>|</span>
                )}
                {topicLabel && (
                  <span style={{ fontSize: 12, lineHeight: 1.4 }}>
                    <span style={{ color: "#6A7282" }}>Topic: </span>
                    <span style={{ color: "var(--base-600)" }}>{topicLabel}</span>
                  </span>
                )}
                {topicLabel && subtopicLabel && (
                  <span style={{ fontSize: 16, color: "var(--base-300)", lineHeight: 1 }}>|</span>
                )}
                {subtopicLabel && (
                  <span style={{ fontSize: 12, lineHeight: 1.4 }}>
                    <span style={{ color: "#6A7282" }}>Subtopic: </span>
                    <span style={{ color: "var(--base-600)" }}>{subtopicLabel}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div
          className="mt-6 flex items-center justify-center border-t border-[var(--base-200)] bg-white px-4 py-4 sm:mt-10 sm:px-6 sm:py-5"
        >
          <span className="text-center text-[12px] font-normal text-[var(--base-400)] sm:text-sm">
            Source verified from NCERT curriculum
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Citation Badge with hover tooltip ───────────────────────────────────────
function CitationBadge({
  index,
  citation,
  onOpen,
}: {
  index: number;
  citation?: CitationData;
  onOpen: (index: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);

  const CARD_WIDTH = 470;
  const CARD_HEIGHT_ESTIMATE = 290;
  const GAP = 8;

  const label = citation ? pageLabel(citation) : null;
  const subtopic = citation ? subtopicOrNull(citation) : null;

  const hasTable = citation?.content?.includes("|---");
  const truncatedContent = citation?.content && !hasTable
    ? citation.content.length > 320
      ? citation.content.slice(0, 320).trimEnd() + "…"
      : citation.content
    : null;

  const hasMetadata = !!(citation?.chapter_name || citation?.topic_name || subtopic);

  function handleMouseEnter() {
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 12));
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const fitsBelow = spaceBelow >= CARD_HEIGHT_ESTIMATE + GAP;

      if (fitsBelow || spaceBelow >= spaceAbove) {
        setTooltipPos({ top: rect.bottom + GAP, left });
      } else {
        setTooltipPos({ bottom: window.innerHeight - rect.top + GAP, left });
      }
    }
    setHovered(true);
  }

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        onClick={() => onOpen(index)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { setHovered(false); setTooltipPos(null); }}
        className="citation-badge"
        aria-label={`Source ${index}`}
      >
        {index}
      </button>

      {hovered && tooltipPos && citation && createPortal(
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            top: tooltipPos.top,
            bottom: tooltipPos.bottom,
            left: tooltipPos.left,
          }}
        >
          <div
            style={{
              width: `${CARD_WIDTH}px`,
              background: "var(--base-100)",
              border: "1px solid var(--base-200)",
              borderRadius: "16px",
              boxShadow: "0px 22.5px 45px rgba(0,0,0,0.08), 0px 2.25px 4.5px rgba(0,0,0,0.04)",
              backdropFilter: "blur(33.75px)",
              WebkitBackdropFilter: "blur(33.75px)",
              overflow: "hidden",
            }}
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "17px 14px 13px",
                borderBottom: "1px solid var(--base-200)",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--base-600)", lineHeight: 1 }}>
                {label ?? "—"}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--base-400)", lineHeight: 1, textAlign: "right" }}>
                {citation.book ?? "NCERT"}
              </span>
            </div>

            {/* ── Content + metadata ─────────────────────────────────── */}
            <div style={{ padding: "13px 14px" }}>
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid var(--base-200)",
                  padding: "21px 25px",
                }}
              >
                {hasMetadata && (
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--base-600)",
                      lineHeight: 1.5,
                      margin: 0,
                      marginBottom: truncatedContent ? "13px" : 0,
                    }}
                  >
                    {citation.chapter_name && (
                      <>{citation.chapter_index ? `${citation.chapter_index}. ` : ""}{citation.chapter_name}</>
                    )}
                    {citation.topic_name && (
                      <><span style={{ color: "var(--base-500)", margin: "0 5px" }}>|</span>{citation.topic_index ? `${citation.topic_index} ` : ""}{citation.topic_name}</>
                    )}
                    {subtopic && (
                      <><span style={{ color: "var(--base-500)", margin: "0 5px" }}>|</span>{citation.subtopic_index ? `${citation.subtopic_index} ` : ""}{subtopic}</>
                    )}
                  </p>
                )}
                {hasTable && (
                  <p style={{ fontSize: "12px", fontWeight: 400, color: "var(--base-400)", lineHeight: "1.65", margin: 0, fontStyle: "italic" }}>
                    Contains a table — click to view
                  </p>
                )}
                {truncatedContent && (
                  <p style={{ fontSize: "12px", fontWeight: 400, color: "var(--base-400)", lineHeight: "1.65", margin: 0, whiteSpace: "pre-wrap" }}>
                    {truncatedContent}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Figure helpers ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function parseFigureKey(fig: string): string {
  return fig.replace(/^Fig\.?\s*/i, "").trim();
}

function buildFigureUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/ncert-textbook/mathematics/g10/${key}.webp`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MarkdownRenderer({
  content,
  citations,
  graphArtifacts,
  renderPendingGraphs = false,
  onCitationClick,
  externalOpenIndex,
  bodyClassName,
  inheritColor = false,
  grade,
}: MarkdownRendererProps) {
  const processed = injectCitationTags(
    normalizeDisplayMathBlocks(
      sanitizeLatexFormatting(
        normalizeCitationChunkMath(content)
      )
    )
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const graphByPlaceholder = useMemo(() => {
    const map = new Map<string, GraphArtifact>();
    for (const graph of graphArtifacts ?? []) map.set(graph.placeholder.toLowerCase(), graph);
    return map;
  }, [graphArtifacts]);

  // Allow parent to open the modal programmatically (e.g. Sources button)
  useEffect(() => {
    if (externalOpenIndex == null) return;
    const raf = requestAnimationFrame(() => setOpenIndex(externalOpenIndex));
    return () => cancelAnimationFrame(raf);
  }, [externalOpenIndex]);

  // Collect unique figure keys from all cited citations (disabled for grade 11)
  const figureKeys = useMemo(() => {
    if (!citations?.length || grade === 11) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of citations) {
      for (const fig of (c.referenced_figures ?? [])) {
        const key = parseFigureKey(fig);
        if (key && !seen.has(key)) { seen.add(key); out.push(key); }
      }
    }
    return out;
  }, [citations, grade]);

  const handleOpen = useCallback(
    (index: number) => {
      setOpenIndex(index);
      onCitationClick?.(index);
    },
    [onCitationClick],
  );

  const handleClose = useCallback(() => {
    setOpenIndex(null);
  }, []);

  const components: Components = useMemo(
    () => ({
    // ── Citation badge ──────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cite: ({ node }: { node?: any }) => {
      const index = Number(node?.properties?.dataIndex ?? node?.properties?.["data-index"] ?? 0);
      if (!index) return null;
      const citation = citations?.find((c) => c.index === index);
      return (
        <CitationBadge
          index={index}
          citation={citation}
          onOpen={handleOpen}
        />
      );
    },

    // ── Paragraphs ──────────────────────────────────────────────────────────
    p: ({ children }) => (
      <p className="mb-4 last:mb-0 leading-7">{children}</p>
    ),

    // ── Headings ────────────────────────────────────────────────────────────
    h1: ({ children }) => (
      <h3 className="text-[17px] font-semibold mt-5 mb-2" style={{ color: "var(--base-800)" }}>
        {children}
      </h3>
    ),
    h2: ({ children }) => (
      <h3 className="text-[16px] font-semibold mt-4 mb-2" style={{ color: "var(--base-800)" }}>
        {children}
      </h3>
    ),
    h3: ({ children }) => (
      <h3 className="text-[15px] font-semibold mt-4 mb-1.5" style={{ color: "var(--base-800)" }}>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-[14px] font-semibold mt-3 mb-1" style={{ color: "var(--base-700)" }}>
        {children}
      </h4>
    ),

    // ── Lists ────────────────────────────────────────────────────────────────
    ul: ({ children }) => (
      <ul className="mb-5 space-y-2 pl-5" style={{ listStyleType: "disc" }}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-5 space-y-2 pl-5" style={{ listStyleType: "decimal" }}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-8 pl-1">{children}</li>
    ),

    // ── Tables ───────────────────────────────────────────────────────────────
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-lg" style={{ border: "1px solid #d8dfe8" }}>
        <table className="w-full text-[14px] border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead style={{ background: "var(--base-100)" }}>{children}</thead>
    ),
    th: ({ children }) => (
      <th
        className="px-4 py-2.5 text-left font-semibold text-[13px]"
        style={{ color: "var(--base-800)", borderBottom: "2px solid var(--base-300)", borderRight: "1px solid var(--base-300)" }}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className="px-4 py-2.5 align-top"
        style={{ color: "var(--base-700)", borderBottom: "1px solid #d8dfe8", borderRight: "1px solid var(--base-200)" }}
      >
        {children}
      </td>
    ),
    tr: ({ children }) => (
      <tr className="transition-colors hover:bg-[var(--base-50)] last:[&>td]:border-b-0">{children}</tr>
    ),

    // ── Inline code ──────────────────────────────────────────────────────────
    code: ({ children, className, ...props }) => {
      const inline = (props as { inline?: boolean }).inline ?? false;
      if (!inline) {
        const language = className?.startsWith("language-")
          ? className.replace(/^language-/, "")
          : "";
        return (
          <code
            className="block p-4 rounded-lg text-[13px] leading-6 font-mono"
            style={{ background: "var(--base-50)", color: "var(--base-700)", border: "1px solid var(--base-200)" }}
            data-language={language || undefined}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          className="px-1.5 py-0.5 rounded text-[13px] font-mono"
          style={{ background: "var(--base-100)", color: "var(--base-700)" }}
        >
          {children}
        </code>
      );
    },

    pre: ({ children }) => <pre className="my-3 overflow-x-auto">{children}</pre>,

    blockquote: ({ children }) => (
      <blockquote
        className="pl-4 my-3 italic text-[15px]"
        style={{ borderLeft: "3px solid var(--primary-300)", color: "var(--base-500)" }}
      >
        {children}
      </blockquote>
    ),

    strong: ({ children }) => (
      <strong className="font-semibold" style={{ color: "var(--base-900)" }}>
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic" style={{ color: "var(--base-600)" }}>
        {children}
      </em>
    ),

    hr: () => (
      <hr className="my-4" style={{ borderColor: "var(--base-200)" }} />
    ),
    }),
    [citations, handleOpen],
  );

  const renderedContent = useMemo(() => {
    function renderMarkdownSegment(segment: string, key: string) {
      if (!segment.trim()) return null;
      return (
        <ReactMarkdown
          key={key}
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, [rehypeKatex, {
            throwOnError: false,
            strict: "ignore",
            errorColor: "var(--base-800)",
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
          }]]}
          components={components}
        >
          {segment}
        </ReactMarkdown>
      );
    }

    const parts: React.ReactNode[] = [];
    const graphPattern = new RegExp(GRAPH_PLACEHOLDER_PATTERN.source, "gi");
    let lastIndex = 0;
    let partIndex = 0;
    let sawPlaceholder = false;
    let match: RegExpExecArray | null;
    while ((match = graphPattern.exec(processed)) !== null) {
      sawPlaceholder = true;
      const before = processed.slice(lastIndex, match.index);
      const segment = renderMarkdownSegment(before, `md-${partIndex++}`);
      if (segment) parts.push(segment);
      const graph = graphByPlaceholder.get(match[1].toLowerCase());
      if (graph) parts.push(<InteractiveGraphCard key={`graph-${graph.id}`} graph={graph} />);
      else if (renderPendingGraphs) {
        parts.push(<PendingGraphCard key={`pending-graph-${match[1]}-${match.index}`} placeholder={match[1]} />);
      }
      lastIndex = match.index + match[0].length;
    }
    const rest = renderMarkdownSegment(processed.slice(lastIndex), `md-${partIndex++}`);
    if (rest) parts.push(rest);
    return parts.length ? parts : sawPlaceholder ? null : renderMarkdownSegment(processed, "md-all");
  }, [processed, graphByPlaceholder, components, renderPendingGraphs]);

  return (
    <>
      <div
        className={cn("markdown-body leading-7", bodyClassName ?? "text-[16px]")}
        style={inheritColor ? undefined : { color: "var(--base-800)" }}
      >
        {renderedContent}
      </div>

      {figureKeys.length > 0 && (
        <div
          className="mt-4 flex gap-3 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "thin", scrollbarColor: "var(--base-200) transparent" }}
        >
          {figureKeys.map((key: string) => (
            <img
              key={key}
              src={buildFigureUrl(key)}
              alt={`Fig. ${key}`}
              className="rounded-lg border object-contain bg-white flex-shrink-0"
              style={{ maxHeight: 220, maxWidth: 320, borderColor: "var(--base-200)" }}
            />
          ))}
        </div>
      )}

      {openIndex !== null && citations && citations.length > 0 && (
        <CitationModal
          citations={citations}
          currentIndex={openIndex}
          onClose={handleClose}
          onNavigate={setOpenIndex}
        />
      )}
    </>
  );
}
