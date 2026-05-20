// components/ask/DocumentPreviewPanel.tsx
// Full-screen modal popup — renders notes or summary with markdown + KaTeX.
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type {
  GeneratedDocument,
  NotesDocument,
  SummaryDocument,
  NoteItemType,
} from "@/lib/ai/doc-types";

async function lazyDownloadPDF(doc: GeneratedDocument) {
  const { downloadAsPDF } = await import("@/lib/pdf/lerno-pdf");
  await downloadAsPDF(doc);
}

async function lazyDownloadDocx(doc: GeneratedDocument) {
  const { downloadAsDocx } = await import("@/lib/docx/lerno-docx");
  await downloadAsDocx(doc);
}

// ── Markdown renderer (shared for note text fields) ──────────────────────────

function Prose({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span>{children}</span>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="font-mono bg-black/5 rounded px-1 py-0.5 text-[0.9em]">{children}</code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

// ── Note item renderers ───────────────────────────────────────────────────────

function NoteItemView({ item }: { item: NoteItemType }) {
  switch (item.type) {
    case "definition":
      return (
        <div className="relative pl-4 mb-3" style={{ borderLeft: "2.5px solid #3b82f6" }}>
          <div className="absolute left-0 top-0 bottom-0 w-[2.5px] rounded-full" />
          <div className="bg-blue-50/70 rounded-r-xl px-3.5 py-3">
            <p className="font-semibold text-blue-900 text-[13.5px] mb-1 leading-snug">
              <Prose>{item.term}</Prose>
            </p>
            <p className="text-blue-800 text-[13px] leading-relaxed">
              <Prose>{item.text}</Prose>
            </p>
          </div>
        </div>
      );

    case "subheading":
      return (
        <p
          className="text-[10.5px] font-bold uppercase tracking-[0.1em] mt-5 mb-2.5"
          style={{ color: "#94a3b8" }}
        >
          {item.text}
        </p>
      );

    case "points":
      return (
        <div className="mb-3">
          {item.heading && (
            <p className="font-semibold text-[13.5px] mb-2" style={{ color: "#334155" }}>
              <Prose>{item.heading}</Prose>
            </p>
          )}
          <ul className="space-y-2">
            {item.items.map((pt, i) => (
              <li key={i} className="flex gap-2.5 text-[13px]" style={{ color: "#475569" }}>
                <span
                  className="shrink-0 mt-[5px] rounded-full"
                  style={{ width: 5, height: 5, background: "#93c5fd", flexShrink: 0 }}
                />
                <span className="leading-relaxed"><Prose>{pt}</Prose></span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "formula":
      return (
        <div className="relative pl-4 mb-3" style={{ borderLeft: "2.5px solid #22c55e" }}>
          <div className="bg-green-50/70 rounded-r-xl px-3.5 py-3">
            {item.label && (
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-green-600 mb-1.5">
                {item.label}
              </p>
            )}
            <p
              className="font-mono text-[13.5px] font-semibold leading-snug"
              style={{ color: "#15803d" }}
            >
              <Prose>{item.expression}</Prose>
            </p>
            {item.note && (
              <p className="text-[12px] mt-2 leading-relaxed" style={{ color: "#16a34a" }}>
                <Prose>{item.note}</Prose>
              </p>
            )}
          </div>
        </div>
      );

    case "remember":
      return (
        <div className="relative pl-4 mb-3" style={{ borderLeft: "2.5px solid #f59e0b" }}>
          <div className="bg-amber-50/70 rounded-r-xl px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-600 mb-1.5">
              Remember
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: "#92400e" }}>
              <Prose>{item.text}</Prose>
            </p>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ── Summary section renderer ──────────────────────────────────────────────────

function SummaryView({ doc }: { doc: SummaryDocument }) {
  return (
    <div>
      {doc.sections.map((section) => (
        <div key={section.topic_index} className="mb-8">
          <h2
            className="text-[15px] font-semibold pb-2.5 mb-4"
            style={{
              color: "#0f172a",
              borderBottom: "1px solid #f1f5f9",
              fontFamily: "var(--font-inter)",
            }}
          >
            {section.topic_index}. {section.topic_name}
          </h2>
          <ul className="space-y-2.5">
            {section.bullets.map((bullet, i) => (
              <li key={i} className="flex gap-3 text-[13.5px]" style={{ color: "#475569" }}>
                <span
                  className="shrink-0 mt-[6px] rounded-full"
                  style={{ width: 5, height: 5, background: "#93c5fd", flexShrink: 0 }}
                />
                <span className="leading-relaxed"><Prose>{bullet}</Prose></span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconNotes() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconSummary() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  document: GeneratedDocument;
  regenerating_topics?: string[];
  onClose?: () => void;
}

export function DocumentPreviewPanel({ document: doc, regenerating_topics = [], onClose }: Props) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      await lazyDownloadPDF(doc);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadDocx = async () => {
    setDownloadingDocx(true);
    try {
      await lazyDownloadDocx(doc);
    } finally {
      setDownloadingDocx(false);
    }
  };

  const isNotes = doc.type === "notes";

  return (
    <div
      className="flex flex-col w-full bg-white rounded-2xl overflow-hidden"
      style={{
        maxHeight: "90vh",
        boxShadow: "0 24px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)",
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid #f1f5f9" }}
      >
        {/* Icon + titles */}
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{
            width: 34,
            height: 34,
            background: isNotes ? "#eff6ff" : "#f0fdf4",
            color: isNotes ? "#3b82f6" : "#22c55e",
          }}
        >
          {isNotes ? <IconNotes /> : <IconSummary />}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-0.5"
            style={{ color: "#94a3b8", fontFamily: "var(--font-inter)" }}
          >
            {isNotes ? "Study Notes" : "Chapter Summary"}
          </p>
          <p
            className="text-[14px] font-semibold truncate leading-snug"
            style={{ color: "#0f172a", fontFamily: "var(--font-inter)" }}
          >
            {doc.chapter_name}
          </p>
        </div>

        {/* Download buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf || downloadingDocx}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-white text-[13px] font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{
              background: downloadingPdf ? "#6b7280" : "var(--primary-500, #3b82f6)",
              fontFamily: "var(--font-inter)",
            }}
          >
            {downloadingPdf ? (
              <span>Preparing...</span>
            ) : (
              <>
                <IconDownload />
                <span>PDF</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownloadDocx}
            disabled={downloadingPdf || downloadingDocx}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{
              background: downloadingDocx ? "#6b7280" : "#f1f5f9",
              color: downloadingDocx ? "#ffffff" : "#334155",
              border: "1px solid #e2e8f0",
              fontFamily: "var(--font-inter)",
            }}
          >
            {downloadingDocx ? (
              <span>Preparing...</span>
            ) : (
              <>
                <IconDownload />
                <span>DOCX</span>
              </>
            )}
          </button>
        </div>

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-slate-100 active:scale-95 cursor-pointer shrink-0"
            style={{ width: 36, height: 36, color: "#94a3b8" }}
            aria-label="Close"
          >
            <IconClose />
          </button>
        )}
      </div>

      {/* ── Document body ── */}
      <div className="flex-1 overflow-y-auto px-7 py-6" style={{ fontFamily: "var(--font-inter)" }}>
        {/* Document title block */}
        <div className="mb-7">
          <h1
            className="text-[22px] font-bold leading-snug mb-1"
            style={{ color: "#0f172a", fontFamily: "var(--font-crimson-pro, var(--font-inter))" }}
          >
            {doc.title}
          </h1>
          <p className="text-[12px]" style={{ color: "#94a3b8" }}>
            {doc.subject.charAt(0).toUpperCase() + doc.subject.slice(1)} · NCERT · lerno.in
          </p>
        </div>

        {isNotes ? (
          (doc as NotesDocument).sections.map((section) => {
            const isRegenerating = regenerating_topics.includes(section.topic_index);
            return (
              <div
                key={section.topic_index}
                className="mb-9 transition-opacity duration-200"
                style={{ opacity: isRegenerating ? 0.4 : 1, pointerEvents: isRegenerating ? "none" : undefined }}
              >
                {isRegenerating && (
                  <div className="flex items-center gap-2 mb-2 text-[12px]" style={{ color: "#3b82f6" }}>
                    <div className="size-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                    <span>Regenerating...</span>
                  </div>
                )}
                <h2
                  className="text-[15px] font-semibold pb-2.5 mb-4"
                  style={{
                    color: "#0f172a",
                    borderBottom: "1px solid #f1f5f9",
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  {section.topic_index}. {section.topic_name}
                </h2>
                {section.items.map((item, i) => (
                  <NoteItemView key={i} item={item} />
                ))}
              </div>
            );
          })
        ) : (
          <SummaryView doc={doc as SummaryDocument} />
        )}
      </div>

      {/* ── Footer ── */}
      <div
        className="px-6 py-3 shrink-0"
        style={{ borderTop: "1px solid #f1f5f9" }}
      >
        <p
          className="text-[11px] text-center"
          style={{ color: "#cbd5e1", fontFamily: "var(--font-inter)" }}
        >
          Generated from NCERT · lerno.in
        </p>
      </div>
    </div>
  );
}
