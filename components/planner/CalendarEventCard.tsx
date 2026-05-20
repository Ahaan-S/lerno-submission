"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getMinutes, getHours } from "date-fns";
import type { StudyEvent } from "@/lib/planner/types";
import { isPlannerTask } from "@/lib/planner/is-planner-task";
import { isExamEvent } from "@/lib/planner/is-exam-event";
import { getSubjectColor } from "@/lib/planner/subject-colors";
import { SUBJECT_LABELS } from "@/lib/chapters";
import RecurringActionDialog, { type RecurringScope } from "./RecurringActionDialog";

interface Props {
  event: StudyEvent;
  onEdit: (event: StudyEvent) => void;
  onComplete: (id: string) => void;
  onUndo: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteRecurring?: (id: string, scope: "following" | "all", groupId: string, fromTime: string) => void;
  onUpdateTiming: (id: string, startTimeIso: string, durationMinutes: number) => void;
  hourHeight: number;
  totalHeightPx: number;
  style?: React.CSSProperties;
  overlapCol?: number;
  overlapColCount?: number;
}

function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sMins = getMinutes(s);
  const eMins = getMinutes(e);
  const sH = getHours(s);
  const eH = getHours(e);
  const sPeriod = sH < 12 ? "am" : "pm";
  const ePeriod = eH < 12 ? "am" : "pm";
  const fmtH = (h: number) => (h === 0 ? 12 : h > 12 ? h - 12 : h);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startStr = sMins === 0 ? `${fmtH(sH)}` : `${fmtH(sH)}:${pad(sMins)}`;
  const endStr = eMins === 0 ? `${fmtH(eH)}${ePeriod}` : `${fmtH(eH)}:${pad(eMins)}${ePeriod}`;
  const startFull = sPeriod !== ePeriod ? `${startStr}${sPeriod}` : startStr;
  return `${startFull} – ${endStr}`;
}

export default function CalendarEventCard({
  event,
  onEdit,
  onComplete,
  onUndo,
  onDelete,
  onDeleteRecurring,
  onUpdateTiming,
  hourHeight,
  totalHeightPx,
  style,
  overlapCol = 0,
  overlapColCount = 1,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const [previewRect, setPreviewRect] = useState<{ top: number; height: number } | null>(null);
  const [recurringDeleteOpen, setRecurringDeleteOpen] = useState(false);

  // Always-fresh ref so drag closure never calls a stale onUpdateTiming
  const onUpdateTimingRef = useRef(onUpdateTiming);
  useEffect(() => { onUpdateTimingRef.current = onUpdateTiming; });

  const colors = getSubjectColor(event.subject || null);
  const subjectLabel = event.subject ? (SUBJECT_LABELS[event.subject] ?? event.subject) : null;
  const isExam = isExamEvent(event);
  const displayTitle = isExam && subjectLabel ? `${event.title}, ${subjectLabel}` : event.title;
  const timeRange = formatTimeRange(event.start_time, event.end_time);

  const isTask = isPlannerTask(event);
  const isCompleted = isTask && event.status === "completed";
  const isSkipped = event.status === "skipped";

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const bgColor = event.color ?? colors.bg;
  const baseTop = typeof style?.top === "number" ? style.top : 0;
  const baseHeight = typeof style?.height === "number" ? style.height : 48;
  const minHeightPx = Math.max(16, (15 / 60) * hourHeight);

  const rectTop = previewRect?.top ?? baseTop;
  const rectHeight = previewRect?.height ?? baseHeight;
  const isDragging = previewRect !== null;

  // Live height for compact layout — updates in real time while resizing
  const liveHeight = rectHeight;
  const isInline = liveHeight < 44;
  const isTiny = liveHeight < 28;
  const showSubject = liveHeight >= 56 && !!subjectLabel && !isExam;

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const roundToStep = (v: number, step: number) => Math.round(v / step) * step;

  const commitTiming = (topPx: number, heightPx: number) => {
    const startMinutes = clamp(roundToStep((topPx / hourHeight) * 60, 15), 0, 24 * 60 - 15);
    const durationMinutes = clamp(roundToStep((heightPx / hourHeight) * 60, 15), 15, 24 * 60 - startMinutes);
    const day = new Date(event.start_time);
    day.setHours(0, 0, 0, 0);
    day.setMinutes(startMinutes, 0, 0);
    onUpdateTimingRef.current(event.id, day.toISOString(), durationMinutes);
  };

  const startDrag = (type: "move" | "resize-top" | "resize-bottom", pointerId: number, startClientY: number) => {
    const card = cardRef.current;
    if (!card) return;

    // Capture on the card element — pointer events redirect here even when cursor leaves
    card.setPointerCapture(pointerId);

    const startY = startClientY;
    const origTop = baseTop;
    const origHeight = baseHeight;
    const gridHeight = totalHeightPx;
    const minH = minHeightPx;

    let moved = false;
    let currentRect = { top: origTop, height: origHeight };

    const onMove = (ev: PointerEvent) => {
      const deltaY = ev.clientY - startY;
      if (Math.abs(deltaY) > 3) moved = true;

      let next: { top: number; height: number };
      if (type === "move") {
        next = { top: clamp(origTop + deltaY, 0, gridHeight - origHeight), height: origHeight };
      } else if (type === "resize-top") {
        const top = clamp(origTop + deltaY, 0, origTop + origHeight - minH);
        next = { top, height: Math.max(minH, origHeight + (origTop - top)) };
      } else {
        next = { top: origTop, height: clamp(origHeight + deltaY, minH, gridHeight - origTop) };
      }

      currentRect = next;
      setPreviewRect(next);
    };

    const onUp = (ev: PointerEvent) => {
      card.releasePointerCapture(ev.pointerId);
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerup", onUp);
      card.removeEventListener("pointercancel", onUp);

      if (moved) {
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
        commitTiming(currentRect.top, currentRect.height);
        setTimeout(() => setPreviewRect(null), 60);
      } else {
        setPreviewRect(null);
      }
    };

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onUp);
  };

  const n = Math.max(1, overlapColCount);
  const horizontalStyle: React.CSSProperties =
    n <= 1
      ? { left: 4, right: 4 }
      : {
          left: `calc(${overlapCol} * (100% / ${n}) + 4px)`,
          width: `calc(100% / ${n} - 8px)`,
        };

  return (
    <>
      <div
        ref={cardRef}
        className="absolute rounded-lg select-none overflow-hidden"
        style={{
          ...horizontalStyle,
          top: rectTop,
          height: rectHeight,
          backgroundColor: bgColor,
          borderTop: `1px solid ${colors.border}`,
          borderRight: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          borderLeft: `3px solid ${colors.dot}`,
          opacity: isCompleted ? 0.72 : isSkipped ? 0.45 : 1,
          transform: isCompleted ? "scale(0.985)" : undefined,
          zIndex: isDragging ? 50 : 10,
          cursor: isDragging ? "grabbing" : "grab",
          boxShadow: isDragging
            ? "0 8px 24px rgba(0,0,0,0.20), 0 2px 8px rgba(0,0,0,0.10)"
            : "0 1px 3px rgba(0,0,0,0.06)",
          transition: isDragging ? "none" : "box-shadow 0.15s ease, opacity 0.16s ease",
          touchAction: "none",
        }}
        onClick={() => {
          if (!menuOpen && !suppressClickRef.current) onEdit(event);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || menuOpen) return;
          e.stopPropagation();
          startDrag("move", e.pointerId, e.clientY);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuPos({
            x: Math.min(e.clientX, window.innerWidth - 172),
            y: Math.min(e.clientY, window.innerHeight - 80),
          });
          setMenuOpen(true);
        }}
      >
        {/* Top resize zone */}
        <div
          className="absolute left-0 right-0 top-0 z-30"
          style={{ height: 10, cursor: "ns-resize" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            startDrag("resize-top", e.pointerId, e.clientY);
          }}
        />

        {/* Bottom resize zone — no visible pill */}
        <div
          className="absolute left-0 right-0 bottom-0 z-30"
          style={{ height: 10, cursor: "ns-resize" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            startDrag("resize-bottom", e.pointerId, e.clientY);
          }}
        />

        {/* Content */}
        <div
          className={`px-2 h-full flex flex-col justify-start min-h-0 relative pointer-events-none ${isTiny ? "py-0.5" : liveHeight < 40 ? "py-[5px]" : "py-1"}`}
        >
          <AnimatePresence>
            {isCompleted && (
              <motion.span
                initial={{ scale: 0.35, opacity: 0, rotate: -18 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.35, opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className={`absolute right-1 top-1 rounded-full flex items-center justify-center ${isTiny ? "w-3 h-3" : "w-4 h-4"}`}
                style={{ backgroundColor: colors.dot }}
                aria-hidden="true"
              >
                <motion.svg className={isTiny ? "w-2 h-2" : "w-3 h-3"} viewBox="0 0 24 24" fill="none">
                  <motion.path
                    d="m5 12.5 4.2 4.2L19 7"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                  />
                </motion.svg>
              </motion.span>
            )}
          </AnimatePresence>

          {isInline ? (
            <p
              className="truncate leading-tight"
              style={{
                fontSize: isTiny ? 11 : 12,
                fontWeight: 600,
                lineHeight: 1.15,
                color: colors.text,
                fontFamily: "var(--font-inter)",
                textDecoration: isCompleted ? "line-through" : "none",
              }}
            >
              {displayTitle}
              <span style={{ fontWeight: 500, opacity: 0.72, fontSize: "0.92em" }}>
                {", "}
                {new Date(event.start_time)
                  .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                  .toLowerCase()
                  .replace(" ", "")}
              </span>
            </p>
          ) : (
            <>
              <p
                className="text-[12px] font-semibold leading-tight truncate pr-4"
                style={{
                  color: colors.text,
                  fontFamily: "var(--font-inter)",
                  textDecoration: isCompleted ? "line-through" : "none",
                }}
              >
                {displayTitle}
              </p>
              <p
                className="text-[11px] leading-tight truncate tabular-nums mt-[1px]"
                style={{ color: colors.text, opacity: 0.65, fontFamily: "var(--font-inter)" }}
              >
                {timeRange}
              </p>
              {showSubject && (
                <p
                  className="text-[11px] leading-tight truncate font-medium mt-px"
                  style={{ color: colors.dot, fontFamily: "var(--font-inter)" }}
                >
                  {subjectLabel}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <RecurringActionDialog
        open={recurringDeleteOpen}
        mode="delete"
        onClose={() => setRecurringDeleteOpen(false)}
        onConfirm={(scope: RecurringScope) => {
          setRecurringDeleteOpen(false);
          if (scope === "this") {
            onDelete(event.id);
          } else {
            onDeleteRecurring?.(event.id, scope, event.recurrence_group_id!, event.start_time);
          }
        }}
      />

      {/* Context menu */}
      {menuOpen && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[9999]"
            style={{ left: menuPos.x, top: menuPos.y, fontFamily: "var(--font-inter)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: "white",
                border: "1px solid var(--base-200)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
                minWidth: 168,
              }}
            >
              {isTask ? (
                isCompleted ? (
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium cursor-pointer transition-colors rounded-t-2xl"
                    style={{ color: "var(--base-700)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--base-100)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    onClick={() => { setMenuOpen(false); onUndo(event.id); }}
                  >
                    <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14 4 9m0 0 5-5M4 9h10a6 6 0 0 1 0 12h-1" />
                    </svg>
                    Mark undone
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium cursor-pointer transition-colors rounded-t-2xl"
                    style={{ color: "var(--base-700)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--base-100)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    onClick={() => { setMenuOpen(false); onComplete(event.id); }}
                  >
                    <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Mark complete
                  </button>
                )
              ) : null}

              {isTask ? (
                <div style={{ height: 1, backgroundColor: "var(--base-200)", margin: "0 12px" }} />
              ) : null}

              <button
                type="button"
                className={`w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium cursor-pointer transition-colors ${isTask ? "rounded-b-2xl" : "rounded-2xl"}`}
                style={{ color: "var(--red-100)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--red-10)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                onClick={() => {
                  setMenuOpen(false);
                  if (event.recurrence_group_id) {
                    setRecurringDeleteOpen(true);
                  } else {
                    onDelete(event.id);
                  }
                }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                Delete
              </button>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
