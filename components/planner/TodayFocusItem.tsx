"use client";

import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { BacklogItem } from "@/lib/planner/types";
import { getSubjectColor } from "@/lib/planner/subject-colors";
import { SUBJECT_LABELS } from "@/lib/chapters";

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: "#FEF2F2", text: "#DC2626", label: "High" },
  medium: { bg: "#FFF7ED", text: "#D97706", label: "Medium" },
  low:    { bg: "#F0FDF4", text: "#16A34A", label: "Low" },
};

interface Props {
  item: BacklogItem;
  onComplete: (id: string) => void;
  onUndo?: (id: string) => void;
  isCompleting?: boolean;
  isCompleted?: boolean;
}

export default function TodayFocusItem({ item, onComplete, onUndo, isCompleting = false, isCompleted = false }: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ x: 0, y: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);
  const colors = getSubjectColor(item.subject);
  const priority = PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.medium;
  const subjectLabel = SUBJECT_LABELS[item.subject] ?? item.subject;
  const checked = isCompleting || isCompleted;

  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{
          opacity: isCompleting ? 0 : 1,
          x: isCompleting ? 12 : 0,
          scale: isCompleting ? 0.98 : 1,
        }}
        exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start gap-2.5 py-2.5 border-b border-[var(--base-200)] last:border-0 overflow-hidden"
        style={{ fontFamily: "var(--font-inter)" }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuPos({ x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 96) });
          setMenuOpen(true);
        }}
      >
      <button
        type="button"
        className="mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 transition-colors cursor-pointer hover:border-[var(--primary-400)] hover:bg-blue-50 flex items-center justify-center"
        style={{
          borderColor: checked ? "var(--primary-400)" : "var(--base-300)",
          backgroundColor: checked ? "var(--primary-400)" : "transparent",
        }}
        onClick={() => onComplete(item.id)}
        disabled={checked}
        aria-label={`Complete: ${item.title}`}
      >
        <motion.svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <motion.path
            d="m5 12.5 4.2 4.2L19 7"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          />
        </motion.svg>
      </button>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium text-[var(--base-700)] truncate transition-colors"
          style={{ textDecoration: checked ? "line-through" : "none", color: checked ? "var(--base-400)" : undefined }}
        >
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px]" style={{ color: colors.text }}>{subjectLabel}</span>
          <span className="text-[11px]" style={{ color: "var(--base-400)" }}>·</span>
          <span className="text-[11px]" style={{ color: "var(--base-400)" }}>
            <svg className="w-2.5 h-2.5 inline mr-0.5 mb-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            {item.estimated_minutes} min
          </span>
        </div>
      </div>
      <span
        className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ backgroundColor: priority.bg, color: priority.text }}
      >
        {priority.label}
      </span>
      </motion.div>
      {menuOpen && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[9999] rounded-2xl overflow-hidden bg-white border border-[var(--base-200)] shadow-lg"
            style={{ left: menuPos.x, top: menuPos.y, minWidth: 172, fontFamily: "var(--font-inter)" }}
          >
            {checked ? (
              <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium hover:bg-[var(--base-100)]" onClick={() => { setMenuOpen(false); onUndo?.(item.id); }}>
                Mark undone
              </button>
            ) : (
              <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium hover:bg-[var(--base-100)]" onClick={() => { setMenuOpen(false); onComplete(item.id); }}>
                Mark complete
              </button>
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
