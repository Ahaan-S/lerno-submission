"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  endOfWeek,
  getHours,
  getMinutes,
} from "date-fns";
import type { StudyEvent } from "@/lib/planner/types";
import { isPlannerTask } from "@/lib/planner/is-planner-task";
import { isExamEvent } from "@/lib/planner/is-exam-event";
import CalendarEventCard from "./CalendarEventCard";
import { getSubjectColor } from "@/lib/planner/subject-colors";
import { SUBJECT_LABELS } from "@/lib/chapters";

function getCalendarEventLabel(event: StudyEvent): string {
  const subjectLabel = event.subject ? (SUBJECT_LABELS[event.subject] ?? event.subject) : "";
  if (isExamEvent(event) && subjectLabel) return `${event.title}, ${subjectLabel}`;
  return event.title || "All day event";
}

function layoutOverlappingEvents(dayEvents: StudyEvent[]) {
  return dayEvents.map((e) => {
    const es = new Date(e.start_time).getTime();
    const ee = es + e.duration_minutes * 60_000;
    const simultaneous = dayEvents
      .filter((o) => {
        const os = new Date(o.start_time).getTime();
        const oe = os + o.duration_minutes * 60_000;
        return os < ee && es < oe;
      })
      .sort((a, b) => {
        const ds = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        if (ds !== 0) return ds;
        return a.id.localeCompare(b.id);
      });
    const col = simultaneous.findIndex((o) => o.id === e.id);
    return { event: e, overlapCol: col, overlapColCount: simultaneous.length };
  });
}

function isAllDayEvent(event: StudyEvent): boolean {
  return event.duration_minutes >= 1440;
}

const GRID_START_HOUR = 0;
const GRID_END_HOUR = 24;
const TOTAL_GRID_HOURS = GRID_END_HOUR - GRID_START_HOUR;
const HOURS = Array.from({ length: TOTAL_GRID_HOURS }, (_, i) => GRID_START_HOUR + i);

function useHourHeight() {
  const [h, setH] = useState(48);
  useEffect(() => {
    const update = () => setH(window.innerWidth < 640 ? 40 : 48);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return h;
}

function eventTopPx(startTime: string, hourHeight: number): number {
  const d = new Date(startTime);
  const minutesFromGridStart = getHours(d) * 60 + getMinutes(d);
  return Math.max(0, (minutesFromGridStart / 60) * hourHeight);
}

function eventHeightPx(durationMinutes: number, hourHeight: number): number {
  return Math.max(22, (durationMinutes / 60) * hourHeight - 2);
}

// Slide variants — direction: 1 = forward, -1 = back
const slideVariants = {
  enter: (dir: number) => ({ x: dir * 14, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.14, ease: "easeOut" as const } },
  exit: (dir: number) => ({ x: dir * -14, opacity: 0, transition: { duration: 0.1, ease: "easeIn" as const } }),
};

interface Props {
  viewMode: "day" | "week" | "month";
  currentWeekStart: Date;
  events: StudyEvent[];
  activeSubjectFilter: string[];
  onSlotClick: (date: Date, hour: number, minutes?: number) => void;
  onAllDayClick: (date: Date) => void;
  /** Week/month: jump to this calendar day in day view (date number control). */
  onGoToDate: (day: Date) => void;
  onEdit: (event: StudyEvent) => void;
  onComplete: (id: string) => void;
  onUndo: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteRecurring?: (id: string, scope: "following" | "all", groupId: string, fromTime: string) => void;
  onUpdateTiming: (id: string, startTimeIso: string, durationMinutes: number) => void;
}

export default function CalendarGrid({
  viewMode,
  currentWeekStart,
  events,
  activeSubjectFilter,
  onSlotClick,
  onAllDayClick,
  onGoToDate,
  onEdit,
  onComplete,
  onUndo,
  onDelete,
  onDeleteRecurring,
  onUpdateTiming,
}: Props) {
  const [expandedAllDayDate, setExpandedAllDayDate] = useState<string | null>(null);
  const [allDayMenuEvent, setAllDayMenuEvent] = useState<StudyEvent | null>(null);
  const [allDayMenuPos, setAllDayMenuPos] = useState({ x: 0, y: 0 });
  const allDayMenuRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const hourHeight = useHourHeight();
  const totalHeightPx = TOTAL_GRID_HOURS * hourHeight;

  // Track navigation direction for slide animation
  const prevWeekStart = useRef(currentWeekStart);
  const [slideDir, setSlideDir] = useState(1);
  useEffect(() => {
    let timer: number | undefined;
    if (currentWeekStart.getTime() !== prevWeekStart.current.getTime()) {
      const nextDir = currentWeekStart > prevWeekStart.current ? 1 : -1;
      timer = window.setTimeout(() => setSlideDir(nextDir), 0);
    }
    prevWeekStart.current = currentWeekStart;
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [currentWeekStart]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!allDayMenuEvent) return;
    const onDown = (e: MouseEvent) => {
      if (!allDayMenuRef.current?.contains(e.target as Node)) setAllDayMenuEvent(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAllDayMenuEvent(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [allDayMenuEvent]);

  // Auto-scroll to center current time
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const totalMinutes = getHours(now) * 60 + getMinutes(now);
      const currentTimePx = (totalMinutes / 60) * hourHeight;
      const containerHeight = scrollRef.current.clientHeight;
      scrollRef.current.scrollTop = Math.max(0, currentTimePx - containerHeight / 2);
    }
  }, [hourHeight]);

  const filteredEvents = activeSubjectFilter.length > 0
    ? events.filter((e) => activeSubjectFilter.includes(e.subject))
    : events;
  const allDayEvents = filteredEvents.filter(isAllDayEvent);
  const timedEvents = filteredEvents.filter((event) => !isAllDayEvent(event));

  const minutesSinceGridStart = getHours(currentTime) * 60 + getMinutes(currentTime);
  const currentTimeTopPct = (minutesSinceGridStart / (TOTAL_GRID_HOURS * 60)) * 100;

  if (viewMode === "month") {
    return (
      <MonthView
        currentWeekStart={currentWeekStart}
        events={filteredEvents}
        onEdit={onEdit}
        onGoToDate={onGoToDate}
      />
    );
  }

  const days = viewMode === "week"
    ? Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
    : [currentWeekStart];

  const isDayMode = viewMode === "day";
  const animKey = currentWeekStart.toISOString() + viewMode;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="flex bg-white shrink-0 overflow-hidden" style={{ fontFamily: "var(--font-inter)" }}>
        <div className="w-14 shrink-0" />
        <AnimatePresence mode="popLayout" custom={slideDir} initial={false}>
          <motion.div
            key={animKey}
            custom={slideDir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-1 min-w-0"
          >
            {days.map((day) => {
              const isCurrentDay = isToday(day);
              const dateLabel = format(day, "EEEE, MMMM d, yyyy");
              const dateNumber = format(day, "d");
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onAllDayClick(day)}
                  className={`flex-1 min-w-0 flex flex-col pt-2.5 pb-2 cursor-pointer hover:bg-[var(--base-50)] transition-colors ${isDayMode ? "pl-4 items-start" : "items-center"}`}
                >
                  <div className="flex flex-col items-center gap-0 pointer-events-none">
                    <span
                      className="text-[11px] font-medium uppercase tracking-wide pointer-events-none"
                      style={{ color: isCurrentDay ? "var(--primary-400)" : "var(--base-400)" }}
                    >
                      {format(day, "EEE")}
                    </span>
                    {viewMode === "week" ? (
                      <button
                        type="button"
                        aria-label={`Open ${dateLabel}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onGoToDate(day);
                        }}
                        className={`pointer-events-auto border-0 p-0 leading-none flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-400)] focus-visible:ring-offset-2 ${
                          isCurrentDay ? "text-white" : "text-[var(--base-700)]"
                        }`}
                        style={{
                          fontSize: 25,
                          fontWeight: 380,
                          width: 46,
                          height: 46,
                          ...(isCurrentDay ? { backgroundColor: "var(--primary-400)" } : {}),
                        }}
                      >
                        {dateNumber}
                      </button>
                    ) : (
                      <span
                        className={`leading-none flex items-center justify-center rounded-full ${
                          isCurrentDay ? "text-white" : "text-[var(--base-700)]"
                        }`}
                        style={{
                          fontSize: 25,
                          fontWeight: 380,
                          width: 46,
                          height: 46,
                          ...(isCurrentDay ? { backgroundColor: "var(--primary-400)" } : {}),
                        }}
                      >
                        {dateNumber}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* All-day strip — inner `flex flex-1 min-w-0` matches day header + time grid so columns line up */}
      <div className="flex shrink-0 border-b border-[var(--base-200)] bg-white" style={{ fontFamily: "var(--font-inter)" }}>
        <div className="w-14 shrink-0 min-h-7 text-[10px] text-[var(--base-500)] flex items-start justify-center pt-1.5 select-none">
          All day
        </div>
        <div className="flex flex-1 min-w-0 min-h-0">
          {days.map((day, dayIndex) => {
          const dayAllDayEvents = allDayEvents.filter((e) => isSameDay(new Date(e.start_time), day));
          const dayKey = format(day, "yyyy-MM-dd");
          const isExpanded = expandedAllDayDate === dayKey;
          const visibleEvents = isExpanded ? dayAllDayEvents : dayAllDayEvents.slice(0, 2);
          const hiddenCount = Math.max(0, dayAllDayEvents.length - visibleEvents.length);
          return (
            <div
              key={`all-day-${day.toISOString()}`}
              className={`flex-1 min-w-0 px-1 py-1 ${dayIndex > 0 ? "border-l border-[var(--base-200)]" : ""}`}
            >
              <div
                className="w-full rounded-md hover:bg-[var(--base-100)] transition-colors cursor-pointer px-1 py-0.5 flex flex-col items-stretch gap-1"
                onClick={() => {
                  if (dayAllDayEvents.length > 2) {
                    setExpandedAllDayDate((prev) => (prev === dayKey ? null : dayKey));
                  }
                }}
              >
                {dayAllDayEvents.length > 0 ? (
                  <>
                    {visibleEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className="w-full min-w-0 text-left text-[11px] truncate px-2 py-0.5 rounded-md"
                        style={{
                          color: getSubjectColor(event.subject).text,
                          backgroundColor: getSubjectColor(event.subject).bg,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(event);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const x = Math.min(e.clientX, window.innerWidth - 176);
                          const y = Math.min(e.clientY, window.innerHeight - 96);
                          setAllDayMenuPos({ x, y });
                          setAllDayMenuEvent(event);
                        }}
                        title={getCalendarEventLabel(event)}
                      >
                        {getCalendarEventLabel(event)}
                      </button>
                    ))}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className="w-fit text-[11px] text-[var(--base-500)] shrink-0 hover:text-[var(--base-700)] cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedAllDayDate((prev) => (prev === dayKey ? null : dayKey));
                        }}
                      >
                        +{hiddenCount}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-[var(--base-400)]"> </span>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* All-day context menu */}
      {allDayMenuEvent && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          <motion.div
            ref={allDayMenuRef}
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[9999] rounded-2xl overflow-hidden"
            style={{
              left: allDayMenuPos.x,
              top: allDayMenuPos.y,
              backgroundColor: "white",
              border: "1px solid var(--base-200)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
              minWidth: 168,
              fontFamily: "var(--font-inter)",
            }}
          >
            {isPlannerTask(allDayMenuEvent) ? (
              allDayMenuEvent.status === "completed" ? (
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium hover:bg-[var(--base-100)]"
                  onClick={() => { const id = allDayMenuEvent.id; setAllDayMenuEvent(null); onUndo(id); }}
                >
                  Mark undone
                </button>
              ) : (
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium hover:bg-[var(--base-100)]"
                  onClick={() => { const id = allDayMenuEvent.id; setAllDayMenuEvent(null); onComplete(id); }}
                >
                  Mark complete
                </button>
              )
            ) : null}
            {isPlannerTask(allDayMenuEvent) ? (
            <div style={{ height: 1, backgroundColor: "var(--base-200)", margin: "0 12px" }} />
            ) : null}
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium hover:bg-[var(--red-10)]"
              style={{ color: "var(--red-100)" }}
              onClick={() => { const id = allDayMenuEvent.id; setAllDayMenuEvent(null); onDelete(id); }}
            >
              Delete
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Scrollable grid */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
        style={{
          scrollbarGutter: "stable",
          scrollbarWidth: "thin",
          scrollbarColor: "#dde3ec transparent",
        }}
      >
        <div className="flex" style={{ minHeight: totalHeightPx }}>
          {/* Time gutter — static, never animates */}
          <div className="w-14 shrink-0 relative" style={{ height: totalHeightPx }}>
            {HOURS.map((hour, i) => (
              <div
                key={hour}
                className="absolute left-0 right-0 flex items-start justify-end pr-2"
                style={{ top: i * hourHeight, height: hourHeight }}
              >
                <span
                  className="text-[11px] leading-none -mt-[7px]"
                  style={{ color: "var(--base-400)", fontFamily: "var(--font-inter)" }}
                >
                  {hour === 0 ? "" : hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns — animate on navigation */}
          <AnimatePresence mode="popLayout" custom={slideDir} initial={false}>
            <motion.div
              key={animKey}
              custom={slideDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-1 min-w-0"
              style={{ minHeight: totalHeightPx }}
            >
              {days.map((day, dayIndex) => {
                const dayEvents = timedEvents.filter((e) => isSameDay(new Date(e.start_time), day));
                const laidOut = layoutOverlappingEvents(dayEvents);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`flex-1 min-w-0 relative ${dayIndex > 0 ? "border-l border-[var(--base-200)]" : ""}`}
                    style={{ height: totalHeightPx }}
                  >
                    {/* Hour + half-hour click areas */}
                    {HOURS.map((hour, i) => (
                      <React.Fragment key={hour}>
                        {/* :00 half */}
                        <div
                          className="absolute left-0 right-0 border-t border-[var(--base-200)] cursor-pointer"
                          style={{ top: i * hourHeight, height: hourHeight / 2 }}
                          onClick={() => onSlotClick(day, hour, 0)}
                        />
                        {/* :30 half */}
                        <div
                          className="absolute left-0 right-0 cursor-pointer"
                          style={{ top: i * hourHeight + hourHeight / 2, height: hourHeight / 2 }}
                          onClick={() => onSlotClick(day, hour, 30)}
                        />
                      </React.Fragment>
                    ))}

                    {/* Current time indicator */}
                    {isCurrentDay && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                        style={{ top: `${currentTimeTopPct}%` }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                        <div className="flex-1 h-[1.5px] bg-red-500" />
                      </div>
                    )}

                    {/* Events */}
                    {laidOut.map(({ event, overlapCol, overlapColCount }) => {
                      const top = eventTopPx(event.start_time, hourHeight);
                      const height = eventHeightPx(event.duration_minutes, hourHeight);
                      return (
                        <CalendarEventCard
                          key={event.id}
                          event={event}
                          onEdit={onEdit}
                          onComplete={onComplete}
                          onUndo={onUndo}
                          onDelete={onDelete}
                          onDeleteRecurring={onDeleteRecurring}
                          onUpdateTiming={onUpdateTiming}
                          hourHeight={hourHeight}
                          totalHeightPx={totalHeightPx}
                          overlapCol={overlapCol}
                          overlapColCount={overlapColCount}
                          style={{ top, height }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function MonthView({
  currentWeekStart,
  events,
  onEdit,
  onGoToDate,
}: {
  currentWeekStart: Date;
  events: StudyEvent[];
  onEdit: (event: StudyEvent) => void;
  onGoToDate: (day: Date) => void;
}) {
  const monthStart = startOfMonth(currentWeekStart);
  const monthEnd = endOfMonth(currentWeekStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2" style={{ fontFamily: "var(--font-inter)" }}>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wide py-1" style={{ color: "var(--base-400)" }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.start_time), day));
          const isCurrentMonth = day.getMonth() === currentWeekStart.getMonth();
          const isCurrentDay = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[80px] rounded-lg p-1.5 border ${isCurrentMonth ? "border-[var(--base-200)] bg-white" : "border-transparent bg-[var(--base-100)]"}`}
            >
              <button
                type="button"
                aria-label={`Open ${format(day, "EEEE, MMMM d, yyyy")}`}
                onClick={() => onGoToDate(day)}
                className={`border-0 p-0 text-[13px] font-medium w-6 h-6 flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-400)] focus-visible:ring-offset-2 ${
                  isCurrentDay ? "text-white" : isCurrentMonth ? "text-[var(--base-700)]" : "text-[var(--base-300)]"
                }`}
                style={isCurrentDay ? { backgroundColor: "var(--primary-400)" } : {}}
              >
                {format(day, "d")}
              </button>
              <div className="flex flex-col gap-0.5 mt-0.5 min-w-0">
                {dayEvents.slice(0, 2).map((event) => {
                  const colors = getSubjectColor(event.subject);
                  const label = getCalendarEventLabel(event);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="text-left rounded px-1 py-0.5 text-[10px] font-medium truncate w-full min-w-0 cursor-pointer"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                      onClick={() => onEdit(event)}
                      title={label}
                    >
                      {label}
                    </button>
                  );
                })}
                {dayEvents.length > 2 && (
                  <button
                    type="button"
                    onClick={() => onGoToDate(day)}
                    className="text-left w-full rounded px-1 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors hover:bg-[var(--base-100)]"
                    style={{ color: "var(--base-500)" }}
                    aria-label={`${dayEvents.length - 2} more on ${format(day, "MMMM d")} — open day`}
                  >
                    +{dayEvents.length - 2} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
