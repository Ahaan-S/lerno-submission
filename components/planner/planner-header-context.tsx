"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfDay,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";

export type PlannerViewMode = "day" | "week" | "month";

type PlannerHeaderContextValue = {
  viewMode: PlannerViewMode;
  setViewMode: (mode: PlannerViewMode) => void;
  currentWeekStart: Date;
  setCurrentWeekStart: (date: Date) => void;
};

const PlannerHeaderCtx = createContext<PlannerHeaderContextValue | null>(null);

export function PlannerHeaderProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<PlannerViewMode>("day");
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfDay(new Date()));

  const value = useMemo(
    () => ({ viewMode, setViewMode, currentWeekStart, setCurrentWeekStart }),
    [viewMode, currentWeekStart],
  );

  return <PlannerHeaderCtx.Provider value={value}>{children}</PlannerHeaderCtx.Provider>;
}

export function usePlannerHeader() {
  const ctx = useContext(PlannerHeaderCtx);
  if (!ctx) throw new Error("usePlannerHeader must be inside PlannerHeaderProvider");
  return ctx;
}

const MODES: { val: PlannerViewMode; label: string; shortcut: string }[] = [
  { val: "day",   label: "Day",   shortcut: "D" },
  { val: "week",  label: "Week",  shortcut: "W" },
  { val: "month", label: "Month", shortcut: "M" },
];

export function PlannerShellNavControls() {
  const ctx = useContext(PlannerHeaderCtx);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        !dropdownRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) setDropdownOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDropdownOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  // D / W / M keyboard shortcuts
  useEffect(() => {
    if (!ctx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d" || e.key === "D") { setDropdownOpen(false); handleSetViewMode("day"); }
      if (e.key === "w" || e.key === "W") { setDropdownOpen(false); handleSetViewMode("week"); }
      if (e.key === "m" || e.key === "M") { setDropdownOpen(false); handleSetViewMode("month"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  if (!ctx) return null;
  const { viewMode, setViewMode, currentWeekStart, setCurrentWeekStart } = ctx;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function handleSetViewMode(val: PlannerViewMode) {
    setDropdownOpen(false);
    if (val === viewMode) return;
    if (val === "day") {
      setViewMode("day");
      setCurrentWeekStart(startOfDay(new Date()));
    } else if (val === "week") {
      setViewMode("week");
      setCurrentWeekStart(startOfWeek(currentWeekStart, { weekStartsOn: 1 }));
    } else {
      setViewMode("month");
    }
  }

  const goBack = () => {
    if (viewMode === "week") setCurrentWeekStart(subWeeks(currentWeekStart, 1));
    else if (viewMode === "day") setCurrentWeekStart(addDays(currentWeekStart, -1));
    else setCurrentWeekStart(subMonths(currentWeekStart, 1));
  };

  const goForward = () => {
    if (viewMode === "week") setCurrentWeekStart(addWeeks(currentWeekStart, 1));
    else if (viewMode === "day") setCurrentWeekStart(addDays(currentWeekStart, 1));
    else setCurrentWeekStart(addMonths(currentWeekStart, 1));
  };

  const goToday = () => {
    const today = startOfDay(new Date());
    setCurrentWeekStart(viewMode === "week" ? startOfWeek(today, { weekStartsOn: 1 }) : today);
  };

  const dateLabel =
    viewMode === "week"
      ? `${format(currentWeekStart, "MMM d")} – ${format(addDays(currentWeekStart, 6), "MMM d, yyyy")}`
      : viewMode === "day"
      ? format(currentWeekStart, "EEEE, MMMM d, yyyy")
      : format(currentWeekStart, "MMMM yyyy");

  const currentLabel = MODES.find((m) => m.val === viewMode)?.label ?? "Day";

  return (
    <div className="flex items-center gap-1 sm:gap-1.5" style={{ fontFamily: "var(--font-inter)" }}>

      {/* View mode dropdown */}
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[13px] font-medium cursor-pointer transition-colors hover:bg-[var(--base-100)]"
          style={{ borderColor: "var(--base-200)", color: "var(--base-700)", backgroundColor: "white" }}
        >
          {currentLabel}
          <svg
            className={`w-3 h-3 shrink-0 transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              ref={dropdownRef}
              role="listbox"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-full left-0 mt-1 z-50 rounded-xl border bg-white p-1 min-w-[120px]"
              style={{
                borderColor: "var(--base-200)",
                boxShadow: "0 8px 24px rgba(15,23,42,0.10), 0 0 0 1px rgba(15,23,42,0.04)",
              }}
            >
              {MODES.map(({ val, label, shortcut }) => (
                <button
                  key={val}
                  type="button"
                  role="option"
                  aria-selected={viewMode === val}
                  onClick={() => handleSetViewMode(val)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{
                    backgroundColor: viewMode === val ? "var(--base-100)" : "transparent",
                    color: viewMode === val ? "var(--base-800)" : "var(--base-600)",
                    fontWeight: viewMode === val ? 500 : 400,
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  <span className="text-[13px]">{label}</span>
                  <span
                    className="hidden sm:inline-block text-[11px] ml-3 px-1.5 py-0.5 rounded font-mono"
                    style={{
                      backgroundColor: "var(--base-100)",
                      color: "var(--base-400)",
                      border: "1px solid var(--base-200)",
                    }}
                  >
                    {shortcut}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Today button */}
      <div className="relative group/today">
        <button
          type="button"
          onClick={goToday}
          className="px-2.5 h-8 rounded-lg text-[13px] font-medium cursor-pointer transition-colors"
          style={{ color: "var(--base-600)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--base-150, #eef0f3)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
        >
          Today
        </button>
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover/today:opacity-100 transition-opacity duration-150"
          style={{ backgroundColor: "var(--base-800)", color: "white", fontFamily: "var(--font-inter)" }}
        >
          {format(new Date(), "EEEE, MMMM d")}
        </div>
      </div>

      {/* Navigation: < > */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={goBack}
          aria-label="Previous"
          className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:bg-[var(--base-100)] transition-colors"
          style={{ color: "var(--base-500)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goForward}
          aria-label="Next"
          className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:bg-[var(--base-100)] transition-colors"
          style={{ color: "var(--base-500)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Calendar icon + date label */}
      <div className="hidden sm:flex items-center gap-1.5 ml-1">
        <svg
          className="w-3.5 h-3.5 shrink-0"
          fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor"
          style={{ color: "var(--base-400)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        <span className="text-[13px] font-medium" style={{ color: "var(--base-600)" }}>
          {dateLabel}
        </span>
      </div>
    </div>
  );
}
