"use client";

import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import type { StudyEvent } from "@/lib/planner/types";
import { getSubjectColor } from "@/lib/planner/subject-colors";
import { SUBJECT_LABELS } from "@/lib/chapters";

interface Props {
  event: StudyEvent;
  onComplete: (id: string) => void;
  onUndo?: (id: string) => void;
  onEdit?: (event: StudyEvent) => void;
  isCompleting?: boolean;
  isCompleted?: boolean;
}

export default function TodayFocusEventItem({ event, onComplete, onUndo, onEdit, isCompleting = false, isCompleted = false }: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ x: 0, y: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);
  const colors = getSubjectColor(event.subject || null);
  const subjectLabel = event.subject ? (SUBJECT_LABELS[event.subject] ?? event.subject) : null;
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const isAllDay = event.duration_minutes >= 1440;
  const timeLabel = isAllDay ? "All day" : `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
  const checked = isCompleting || isCompleted;
  const badgeLabel = checked ? "Done" : (subjectLabel ?? "Scheduled");
  const badgeStyle = checked
    ? { backgroundColor: "#ECFDF3", color: "#166534" }
    : subjectLabel
      ? { backgroundColor: colors.bg, color: colors.text }
      : { backgroundColor: "#EFF6FF", color: "#2563EB" };

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
        className={`flex items-start gap-2.5 py-2.5 border-b border-[var(--base-200)] last:border-0 overflow-hidden ${
          !isCompleting ? "cursor-pointer" : ""
        }`}
        style={{ fontFamily: "var(--font-inter)" }}
        aria-label={
          isCompleting
            ? undefined
            : isCompleted
              ? `Mark undone: ${event.title}`
              : `Mark complete: ${event.title}`
        }
        onClick={() => {
          if (isCompleting) return;
          if (isCompleted) onUndo?.(event.id);
          else onComplete(event.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuPos({ x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 96) });
          setMenuOpen(true);
        }}
      >
      <span
        className="mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 transition-colors flex items-center justify-center pointer-events-none"
        style={{
          borderColor: checked ? "var(--primary-400)" : "var(--base-300)",
          backgroundColor: checked ? "var(--primary-400)" : "transparent",
        }}
        aria-hidden
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
      </span>
      <div className="flex-1 min-w-0 text-left">
        <p
          className={`text-[13px] font-medium text-[var(--base-700)] truncate transition-colors ${onEdit ? "hover:text-[var(--primary-400)] cursor-pointer" : ""}`}
          style={{ textDecoration: checked ? "line-through" : "none", color: checked ? "var(--base-400)" : undefined }}
          onClick={(e) => {
            if (!onEdit) return;
            e.stopPropagation();
            onEdit(event);
          }}
          onKeyDown={(e) => {
            if (!onEdit || (e.key !== "Enter" && e.key !== " ")) return;
            e.preventDefault();
            e.stopPropagation();
            onEdit(event);
          }}
          role={onEdit ? "button" : undefined}
          tabIndex={onEdit ? 0 : undefined}
        >
          {event.title}
        </p>
        <div
          className="flex items-center gap-2 mt-0.5 flex-wrap pointer-events-none"
        >
          <span className="text-[11px]" style={{ color: "var(--base-400)" }}>
            {!isAllDay && <svg className="w-2.5 h-2.5 inline mr-0.5 mb-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
            {timeLabel}
          </span>
        </div>
      </div>
      <span
        className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full pointer-events-none"
        style={badgeStyle}
      >
        {badgeLabel}
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
              <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium hover:bg-[var(--base-100)]" onClick={() => { setMenuOpen(false); onUndo?.(event.id); }}>
                Mark undone
              </button>
            ) : (
              <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium hover:bg-[var(--base-100)]" onClick={() => { setMenuOpen(false); onComplete(event.id); }}>
                Mark complete
              </button>
            )}
            <div className="h-px mx-3 bg-[var(--base-200)]" />
            <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium hover:bg-[var(--base-100)]" onClick={() => { setMenuOpen(false); onEdit?.(event); }}>
              Edit event
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
