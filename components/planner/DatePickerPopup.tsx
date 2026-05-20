"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek,
} from "date-fns";

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  selectedDates?: string[];
  onToggleDate?: (date: Date) => void;
  onAdd?: () => void;
  addLabel?: string;
  closeOnSelect?: boolean;
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const W = 268;
const H = 368;

export default function DatePickerPopup({
  value,
  onChange,
  onClose,
  triggerRef,
  selectedDates,
  onToggleDate,
  onAdd,
  addLabel = "Add",
  closeOnSelect = true,
}: Props) {
  const [viewMonth, setViewMonth] = useState(new Date(value));
  const [pos, setPos] = useState<React.CSSProperties>({ opacity: 0 });
  const ref = useRef<HTMLDivElement>(null);

  // Measure position from the trigger element — runs before paint to avoid flash
  useLayoutEffect(() => {
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      let left = rect.left;
      let top = rect.bottom + 4;
      if (top + H > window.innerHeight - 8) top = rect.top - H - 4;
      if (left + W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - W - 8);
      setPos({ left: Math.round(left), top: Math.round(Math.max(8, top)), width: W, opacity: 1 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, triggerRef]);

  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 }),
  });

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      className="fixed z-[10000] bg-white rounded-2xl p-3"
      style={{
        ...pos,
        boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",
        fontFamily: "var(--font-inter)",
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2.5">
        <button type="button" onClick={() => setViewMonth(d => subMonths(d, 1))}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--base-100)] cursor-pointer transition-colors">
          <svg className="w-4 h-4" style={{ color: "var(--base-500)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-[13px] font-semibold" style={{ color: "var(--base-800)" }}>
          {format(viewMonth, "MMMM yyyy")}
        </span>
        <button type="button" onClick={() => setViewMonth(d => addMonths(d, 1))}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--base-100)] cursor-pointer transition-colors">
          <svg className="w-4 h-4" style={{ color: "var(--base-500)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[11px] font-medium py-1" style={{ color: "var(--base-400)" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {calDays.map(day => {
          const selected = selectedDates
            ? selectedDates.includes(format(day, "yyyy-MM-dd"))
            : isSameDay(day, value);
          const today = isToday(day);
          const curMonth = day.getMonth() === viewMonth.getMonth();
          return (
            <button key={day.toISOString()} type="button"
              onClick={() => {
                if (onToggleDate) {
                  onToggleDate(day);
                } else {
                  onChange(day);
                }
                if (closeOnSelect) onClose();
              }}
              className="flex items-center justify-center rounded-full text-[13px] cursor-pointer transition-colors relative"
              style={{
                width: "100%", aspectRatio: "1",
                backgroundColor: selected ? "var(--primary-400)" : "transparent",
                color: selected ? "white" : !curMonth ? "var(--base-300)" : today ? "var(--primary-400)" : "var(--base-800)",
                fontWeight: selected || today ? 600 : 400,
              }}
              onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = "var(--base-100)"; }}
              onMouseLeave={e => { if (!selected) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {day.getDate()}
              {today && !selected && (
                <span className="absolute" style={{ bottom: 3, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", backgroundColor: "var(--primary-400)" }} />
              )}
            </button>
          );
        })}
      </div>

      {onAdd && (
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[var(--base-200)]">
          <span className="text-[11px] font-medium text-[var(--base-400)]">
            {selectedDates?.length ? `${selectedDates.length} selected` : "No dates selected"}
          </span>
          <button
            type="button"
            onClick={onAdd}
            disabled={!selectedDates?.length}
            className="h-8 px-3.5 rounded-full text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
            style={{ backgroundColor: "var(--primary-400)" }}
          >
            {addLabel}
          </button>
        </div>
      )}
    </motion.div>,
    document.body
  );
}
