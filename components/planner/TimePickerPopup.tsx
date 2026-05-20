"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";

export function minutesToDisplay(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const period = h24 < 12 ? "am" : "pm";
  return `${h}:${String(m).padStart(2, "0")}${period}`;
}

export function formatDuration(mins: number): string {
  if (mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// Parse digit/colon input: "9"→9:00, "930"→9:30, "9:30"→9:30, "14:30"→14:30
export function parseDigitTime(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  if (s.includes(":")) {
    const [hStr, mStr] = s.split(":");
    const h = parseInt(hStr.replace(/\D/g, "") || "0");
    const m = parseInt((mStr ?? "").replace(/\D/g, "") || "0");
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m < 60) return h * 60 + m;
    return null;
  }

  const d = s.replace(/\D/g, "").slice(0, 4);
  if (!d) return null;
  let h: number, m: number;
  if (d.length <= 2) { h = parseInt(d); m = 0; }
  else if (d.length === 3) { h = parseInt(d[0]); m = parseInt(d.slice(1)); }
  else { h = parseInt(d.slice(0, 2)); m = parseInt(d.slice(2)); }
  if (h >= 0 && h <= 23 && m >= 0 && m < 60) return h * 60 + m;
  return null;
}

const TIME_OPTIONS: number[] = Array.from({ length: 24 * 4 }, (_, i) => i * 15);
const LIST_H = 276;

interface Props {
  value: number;
  onChange: (minutes: number) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>; // position anchor + click-outside exclusion
  startMinutes?: number;     // show duration labels (end time picker)
  minValue?: number;
  highlightMinutes?: number; // live preview while typing
}

export default function TimePickerPopup({
  value, onChange, onClose, triggerRef, startMinutes, minValue, highlightMinutes,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const showDuration = startMinutes !== undefined;
  const popupW = showDuration ? 208 : 172;

  const [pos, setPos] = useState<React.CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      let left = rect.left;
      let top = rect.bottom + 4;
      if (top + LIST_H > window.innerHeight - 8) top = rect.top - LIST_H - 4;
      if (left + popupW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popupW - 8);
      setPos({ left: Math.round(left), top: Math.round(Math.max(8, top)), width: popupW, opacity: 1 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredOptions = minValue !== undefined
    ? TIME_OPTIONS.filter(t => t >= minValue)
    : TIME_OPTIONS;

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

  // Scroll to current value on open
  useEffect(() => {
    if (!listRef.current) return;
    const idx = filteredOptions.findIndex(t => t >= value);
    if (idx >= 0) (listRef.current.children[idx] as HTMLElement)?.scrollIntoView({ block: "center" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to highlight as user types
  useEffect(() => {
    if (highlightMinutes === undefined || !listRef.current) return;
    const idx = filteredOptions.findIndex(t => t >= highlightMinutes);
    if (idx >= 0) (listRef.current.children[idx] as HTMLElement)?.scrollIntoView({ block: "nearest" });
  }, [highlightMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
      className="fixed z-[10000] bg-white rounded-2xl overflow-hidden"
      style={{
        ...pos,
        boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",
        fontFamily: "var(--font-inter)",
      }}
      onClick={e => e.stopPropagation()}
    >
      <div ref={listRef} className="overflow-y-auto py-1" style={{ maxHeight: LIST_H }}>
        {filteredOptions.map(mins => {
          const isSelected = mins === value;
          const isLive = highlightMinutes !== undefined && mins === highlightMinutes && !isSelected;
          const dur = showDuration ? mins - startMinutes! : undefined;
          return (
            <button
              key={mins}
              type="button"
              onMouseDown={e => e.preventDefault()} // keep inline input focused
              onClick={() => { onChange(mins); onClose(); }}
              className="w-full flex items-center justify-between px-3.5 cursor-pointer"
              style={{
                paddingTop: 8,
                paddingBottom: 8,
                backgroundColor: isSelected ? "var(--primary-400)" : isLive ? "rgba(0,119,237,0.07)" : "transparent",
                color: isSelected ? "white" : "var(--base-800)",
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--base-100)"; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = isLive ? "rgba(0,119,237,0.07)" : "transparent"; }}
            >
              <span className="text-[13px]" style={{ fontWeight: isSelected ? 600 : 400 }}>
                {minutesToDisplay(mins)}
              </span>
              {dur !== undefined && dur > 0 && (
                <span className="text-[11px]" style={{ color: isSelected ? "rgba(255,255,255,0.55)" : "var(--base-400)" }}>
                  {formatDuration(dur)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>,
    document.body
  );
}
