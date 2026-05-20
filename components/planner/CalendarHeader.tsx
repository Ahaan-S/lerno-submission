"use client";

import React from "react";
import { format, addDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, startOfDay } from "date-fns";

interface Props {
  viewMode: "day" | "week" | "month";
  setViewMode: (mode: "day" | "week" | "month") => void;
  currentWeekStart: Date;
  setCurrentWeekStart: (date: Date) => void;
  onCreateEvent: () => void;
}

export default function CalendarHeader({
  viewMode,
  setViewMode,
  currentWeekStart,
  setCurrentWeekStart,
  onCreateEvent,
}: Props) {

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
    if (viewMode === "week") {
      setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
    } else {
      setCurrentWeekStart(today);
    }
  };

  const dateLabel = viewMode === "week"
    ? `${format(currentWeekStart, "MMM d")} – ${format(addDays(currentWeekStart, 6), "MMM d, yyyy")}`
    : viewMode === "day"
    ? format(currentWeekStart, "EEEE, MMMM d, yyyy")
    : format(currentWeekStart, "MMMM yyyy");

  return (
    <div
      className="flex flex-col shrink-0 border-b border-[var(--base-200)] bg-white"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      {/* Navigation bar */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* View mode toggle */}
        <div className="flex items-center rounded-full bg-[var(--base-100)] p-0.5 gap-0">
          {(["Day", "Week", "Month"] as const).map((mode) => {
            const val = mode.toLowerCase() as "day" | "week" | "month";
            return (
              <button
                key={mode}
                type="button"
                className={`px-3 h-7 rounded-full text-[13px] font-medium transition-all cursor-pointer ${
                  viewMode === val
                    ? "bg-white text-[var(--base-700)] shadow-sm border border-[var(--base-200)]"
                    : "text-[var(--base-500)] hover:text-[var(--base-700)]"
                }`}
                onClick={() => {
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
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--base-100)] transition-colors cursor-pointer"
            onClick={goBack}
            aria-label="Previous"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          <button
            type="button"
            className="px-3 h-7 rounded-lg text-[13px] font-medium text-[var(--base-600)] hover:bg-[var(--base-100)] transition-colors cursor-pointer"
            onClick={goToday}
          >
            Today
          </button>
          <button
            type="button"
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--base-100)] transition-colors cursor-pointer"
            onClick={goForward}
            aria-label="Next"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
          </button>
        </div>

        {/* Date display */}
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" style={{ color: "var(--base-400)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <span className="text-[13px] font-medium" style={{ color: "var(--base-700)" }}>{dateLabel}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Create event button */}
        <button
          type="button"
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: "var(--primary-400)" }}
          onClick={onCreateEvent}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Event
        </button>

      </div>
    </div>
  );
}
