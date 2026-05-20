"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays } from "date-fns";

export type RecurrenceEndType = "never" | "on" | "after";
export type RecurrenceFreq = "day" | "week" | "month" | "year";

export interface CustomRecurrence {
  interval: number;
  freq: RecurrenceFreq;
  daysOfWeek: number[];
  endType: RecurrenceEndType;
  endDate: string;
  endAfter: number;
}

export type RecurrenceOption =
  | "none" | "daily" | "weekly" | "monthly"
  | "annually" | "weekdays" | "custom";

export interface RecurrenceValue {
  option: RecurrenceOption;
  custom?: CustomRecurrence;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
function weekOfMonth(d: Date): number {
  return Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
}
function buildOptions(dateStr: string): { value: RecurrenceOption; label: string }[] {
  const d = new Date(`${dateStr}T12:00:00`);
  return [
    { value: "none",     label: "Does not repeat" },
    { value: "daily",    label: "Daily" },
    { value: "weekly",   label: `Weekly on ${format(d, "EEEE")}` },
    { value: "monthly",  label: `Monthly on the ${ordinal(weekOfMonth(d))} ${format(d, "EEEE")}` },
    { value: "annually", label: `Annually on ${format(d, "MMMM d")}` },
    { value: "weekdays", label: "Every weekday (Mon – Fri)" },
    { value: "custom",   label: "Custom…" },
  ];
}

// Sensible default occurrences per preset type
const PRESET_CAPS: Record<RecurrenceOption, number> = {
  none: 1,
  daily: 30,        // ~1 month
  weekdays: 60,     // ~3 months of weekdays
  weekly: 52,       // 1 year
  monthly: 12,      // 1 year
  annually: 5,      // 5 years
  custom: 52,       // overridden by custom end rule
};

// ─── Generate recurring dates ────────────────────────────────────────────────
export function generateRecurrenceDates(
  baseStartIso: string,
  _durationMinutes: number,
  value: RecurrenceValue,
): string[] {
  if (value.option === "none") return [baseStartIso];
  const base = new Date(baseStartIso);
  const results: string[] = [baseStartIso];
  const c = value.custom;

  // Determine cap: custom rules use their own end condition; presets use sensible defaults
  const maxDate = c?.endType === "on" && c.endDate ? new Date(`${c.endDate}T23:59:59`) : null;
  const cap = value.option === "custom" && c
    ? (c.endType === "after" ? c.endAfter : 365)
    : PRESET_CAPS[value.option];

  let occurrences = 1;
  let cur = base;
  while (occurrences < cap) {
    let next: Date | null = null;
    if (value.option === "daily") next = addDays(cur, 1);
    else if (value.option === "weekdays") {
      next = addDays(cur, 1);
      while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
    } else if (value.option === "weekly") next = addDays(cur, 7);
    else if (value.option === "monthly") { next = new Date(cur); next.setMonth(next.getMonth() + 1); }
    else if (value.option === "annually") { next = new Date(cur); next.setFullYear(next.getFullYear() + 1); }
    else if (value.option === "custom" && c) {
      next = new Date(cur);
      if (c.freq === "day") next.setDate(next.getDate() + c.interval);
      else if (c.freq === "week") next = addDays(cur, 7 * c.interval);
      else if (c.freq === "month") next.setMonth(next.getMonth() + c.interval);
      else if (c.freq === "year") next.setFullYear(next.getFullYear() + c.interval);
    }
    if (!next) break;
    if (maxDate && next > maxDate) break;
    results.push(next.toISOString());
    cur = next;
    occurrences++;
  }
  return results;
}

// ─── Dropdown — portalled to body, positioned via getBoundingClientRect ──────
function RecurrenceDropdown({
  anchorEl,
  options,
  selected,
  onSelect,
  onClose,
}: {
  anchorEl: HTMLElement;
  options: { value: RecurrenceOption; label: string }[];
  selected: RecurrenceOption;
  onSelect: (v: RecurrenceOption) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const r = anchorEl.getBoundingClientRect();
    const menuW = 232;
    // Estimate menu height: 7 options × 38px + 8px padding
    const menuH = 7 * 38 + 8;
    const gap = 6;
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;

    let left = r.left;
    if (left + menuW > window.innerWidth - 12) left = window.innerWidth - menuW - 12;
    left = Math.max(12, left);

    if (spaceBelow >= menuH || spaceBelow >= spaceAbove) {
      // Show below
      setPos({ top: r.bottom + gap, left, width: menuW });
    } else {
      // Flip above — anchor to bottom of menu = top of button
      setPos({ bottom: window.innerHeight - r.top + gap, left, width: menuW });
    }
  }, [anchorEl]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && e.target !== anchorEl) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [anchorEl, onClose]);

  const opensUpward = pos.bottom !== undefined;
  const slideY = opensUpward ? 4 : -4;

  return createPortal(
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.97, y: slideY }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: slideY }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed",
        top: pos.top,
        bottom: pos.bottom,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
        fontFamily: "var(--font-inter)",
        backgroundColor: "white",
        border: "1px solid var(--base-150, #E8EDF5)",
        borderRadius: 16,
        boxShadow: "0 12px 40px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)",
        overflow: "hidden",
        padding: "4px 0",
      }}
    >
      {options.map((opt) => {
        const isSelected = selected === opt.value;
        const isCustom = opt.value === "custom";
        return (
          <button
            key={opt.value}
            type="button"
            className="w-full text-left px-4 transition-colors cursor-pointer"
            style={{
              height: 38,
              fontSize: 13,
              fontWeight: isSelected ? 500 : 400,
              color: isSelected
                ? "var(--primary-400)"
                : isCustom
                ? "var(--base-500)"
                : "var(--base-700)",
              backgroundColor: isSelected ? "rgba(0,119,237,0.06)" : "transparent",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--base-50, #F8FAFC)"; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </motion.div>,
    document.body
  );
}

// ─── Custom Recurrence Modal ─────────────────────────────────────────────────
function CustomRecurrenceModal({
  initial,
  baseDate,
  onDone,
  onCancel,
}: {
  initial: CustomRecurrence;
  baseDate: string;
  onDone: (c: CustomRecurrence) => void;
  onCancel: () => void;
}) {
  const [interval, setIntervalVal] = useState(initial.interval);
  const [freq, setFreq] = useState<RecurrenceFreq>(initial.freq);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initial.daysOfWeek);
  const [endType, setEndType] = useState<RecurrenceEndType>(initial.endType);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [endAfter, setEndAfter] = useState(initial.endAfter);

  const dayOfBase = new Date(`${baseDate}T12:00:00`).getDay();

  useEffect(() => {
    if (freq === "week" && !daysOfWeek.includes(dayOfBase)) setDaysOfWeek([dayOfBase]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freq]);

  const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
  const freqLabel = (f: RecurrenceFreq, n: number) =>
    ({ day: n === 1 ? "Day" : "Days", week: n === 1 ? "Week" : "Weeks", month: n === 1 ? "Month" : "Months", year: n === 1 ? "Year" : "Years" })[f];

  const toggleDay = (day: number) =>
    setDaysOfWeek(prev => prev.includes(day) ? (prev.length > 1 ? prev.filter(d => d !== day) : prev) : [...prev, day]);

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 10000, fontFamily: "var(--font-inter)" }}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 cursor-pointer"
        style={{ backgroundColor: "rgba(15,23,42,0.32)", backdropFilter: "blur(3px)" }}
        onClick={onCancel}
      />

      {/* Sheet */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full"
        style={{
          maxWidth: 388,
          backgroundColor: "white",
          borderRadius: 24,
          boxShadow: "0 24px 64px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.05)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--base-100, #F1F5FB)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--base-800)", margin: 0 }}>Custom recurrence</h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            style={{ color: "var(--base-400)" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--base-100)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Repeat every */}
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--base-400)" }}>
              Repeat every
            </label>
            <div className="flex items-center gap-2">
              {/* Stepper */}
              <div className="flex items-center gap-0 rounded-xl overflow-hidden" style={{ border: "1px solid var(--base-200)", height: 38 }}>
                <button type="button" onClick={() => setIntervalVal(v => Math.max(1, v - 1))}
                  className="flex items-center justify-center transition-colors cursor-pointer select-none"
                  style={{ width: 36, height: "100%", fontSize: 17, color: "var(--base-400)", borderRight: "1px solid var(--base-200)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--base-50, #F8FAFC)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >−</button>
                <span style={{ width: 36, textAlign: "center", fontSize: 14, fontWeight: 600, color: "var(--base-800)", fontVariantNumeric: "tabular-nums" }}>{interval}</span>
                <button type="button" onClick={() => setIntervalVal(v => Math.min(99, v + 1))}
                  className="flex items-center justify-center transition-colors cursor-pointer select-none"
                  style={{ width: 36, height: "100%", fontSize: 17, color: "var(--base-400)", borderLeft: "1px solid var(--base-200)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--base-50, #F8FAFC)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >+</button>
              </div>

              {/* Freq pills */}
              <div className="flex items-center gap-1">
                {(["day","week","month","year"] as RecurrenceFreq[]).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFreq(f)}
                    className="h-[38px] px-3.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer"
                    style={
                      freq === f
                        ? { backgroundColor: "var(--primary-400)", color: "white", border: "1px solid var(--primary-400)" }
                        : { backgroundColor: "white", color: "var(--base-500)", border: "1px solid var(--base-200)" }
                    }
                  >
                    {freqLabel(f, interval)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Repeat on (weekly only) */}
          {freq === "week" && (
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--base-400)" }}>
                Repeat on
              </label>
              <div className="flex items-center gap-1.5">
                {DAY_LABELS.map((lbl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className="rounded-full text-[12px] font-semibold transition-all cursor-pointer flex items-center justify-center"
                    style={{
                      width: 34, height: 34,
                      backgroundColor: daysOfWeek.includes(i) ? "var(--primary-400)" : "var(--base-100)",
                      color: daysOfWeek.includes(i) ? "white" : "var(--base-500)",
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ends */}
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--base-400)" }}>
              Ends
            </label>
            <div className="flex flex-col gap-0 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--base-150, #E8EDF5)" }}>
              {/* Never */}
              <EndRow
                active={endType === "never"}
                onClick={() => setEndType("never")}
                label="Never"
                last={false}
              />

              {/* On date */}
              <EndRow
                active={endType === "on"}
                onClick={() => setEndType("on")}
                label="On"
                last={false}
              >
                <input
                  type="date"
                  value={endDate}
                  min={baseDate}
                  onChange={e => { setEndDate(e.target.value); setEndType("on"); }}
                  className="outline-none cursor-pointer"
                  style={{
                    height: 30, padding: "0 10px",
                    fontSize: 12, color: "var(--base-700)",
                    backgroundColor: "var(--base-50, #F8FAFC)",
                    border: "1px solid var(--base-200)",
                    borderRadius: 10,
                    colorScheme: "light",
                  }}
                  onClick={e => e.stopPropagation()}
                />
              </EndRow>

              {/* After */}
              <EndRow
                active={endType === "after"}
                onClick={() => setEndType("after")}
                label="After"
                last
              >
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-0 rounded-lg overflow-hidden" style={{ border: "1px solid var(--base-200)", height: 30 }}>
                    <button type="button"
                      onClick={() => { setEndAfter(v => Math.max(1, v - 1)); setEndType("after"); }}
                      className="flex items-center justify-center cursor-pointer select-none"
                      style={{ width: 28, fontSize: 15, color: "var(--base-400)", borderRight: "1px solid var(--base-200)" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--base-50, #F8FAFC)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >−</button>
                    <span style={{ width: 28, textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--base-800)", fontVariantNumeric: "tabular-nums" }}>{endAfter}</span>
                    <button type="button"
                      onClick={() => { setEndAfter(v => Math.min(999, v + 1)); setEndType("after"); }}
                      className="flex items-center justify-center cursor-pointer select-none"
                      style={{ width: 28, fontSize: 15, color: "var(--base-400)", borderLeft: "1px solid var(--base-200)" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--base-50, #F8FAFC)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >+</button>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--base-400)" }}>occurrences</span>
                </div>
              </EndRow>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-full text-[13px] transition-colors cursor-pointer"
            style={{ color: "var(--base-600)", border: "1px solid var(--base-200)" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--base-50, #F8FAFC)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDone({ interval, freq, daysOfWeek, endType, endDate, endAfter })}
            className="h-9 px-5 rounded-full text-[13px] font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: "var(--primary-400)" }}
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function EndRow({
  active,
  onClick,
  label,
  last,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  last: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 cursor-pointer transition-colors"
      style={{
        height: 46,
        backgroundColor: active ? "rgba(0,119,237,0.04)" : "transparent",
        borderBottom: last ? "none" : "1px solid var(--base-100, #F1F5FB)",
      }}
      onClick={onClick}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-50, #F8FAFC)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      {/* Radio dot */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full transition-all"
        style={{
          width: 16, height: 16,
          border: `2px solid ${active ? "var(--primary-400)" : "var(--base-300)"}`,
        }}
      >
        {active && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary-400)" }} />}
      </div>
      <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? "var(--base-800)" : "var(--base-600)", flex: 1 }}>{label}</span>
      {children}
    </div>
  );
}

// ─── Public component ────────────────────────────────────────────────────────
export default function RecurrenceSelector({
  value,
  onChange,
  date,
}: {
  value: RecurrenceValue;
  onChange: (v: RecurrenceValue) => void;
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const options = buildOptions(date);
  const isActive = value.option !== "none";
  const selectedLabel = value.option === "custom" && value.custom
    ? `Every ${value.custom.interval === 1 ? value.custom.freq : `${value.custom.interval} ${value.custom.freq}s`}`
    : (options.find(o => o.value === value.option)?.label ?? "Does not repeat");

  const defaultCustom: CustomRecurrence = {
    interval: 1, freq: "week",
    daysOfWeek: [new Date(`${date}T12:00:00`).getDay()],
    endType: "never",
    endDate: format(addDays(new Date(`${date}T12:00:00`), 90), "yyyy-MM-dd"),
    endAfter: 13,
  };

  const handleSelect = (opt: RecurrenceOption) => {
    if (opt === "custom") { setOpen(false); setShowCustom(true); return; }
    onChange({ option: opt });
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer select-none"
        style={{
          height: 28,
          color: isActive ? "var(--primary-400)" : "var(--base-500)",
          backgroundColor: isActive ? "rgba(0,119,237,0.07)" : open ? "var(--base-100)" : "transparent",
          border: isActive ? "1px solid rgba(0,119,237,0.2)" : "1px solid transparent",
          fontFamily: "var(--font-inter)",
        }}
        onMouseEnter={e => { if (!isActive && !open) e.currentTarget.style.backgroundColor = "var(--base-100)"; }}
        onMouseLeave={e => { if (!isActive && !open) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
        </svg>
        <span className="max-w-[156px] truncate">{selectedLabel}</span>
        <svg
          className={`w-2.5 h-2.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && btnRef.current && (
          <RecurrenceDropdown
            anchorEl={btnRef.current}
            options={options}
            selected={value.option}
            onSelect={handleSelect}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCustom && (
          <CustomRecurrenceModal
            initial={value.custom ?? defaultCustom}
            baseDate={date}
            onDone={c => { onChange({ option: "custom", custom: c }); setShowCustom(false); }}
            onCancel={() => setShowCustom(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
