"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import type { BacklogItem as BacklogItemType, AiSuggestion, StudyEvent } from "@/lib/planner/types";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { getSubjectColor } from "@/lib/planner/subject-colors";

const SubjectIcon = ({ subjectId, className }: { subjectId: string; className?: string }) => {
  const props = { className, xmlns: "http://www.w3.org/2000/svg", width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (subjectId === "science" || subjectId === "chemistry") return (
    <svg {...props}>
      <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
      <path d="M6.453 15h11.094" /><path d="M8.5 2h7" />
    </svg>
  );
  if (subjectId === "physics") return (
    <svg {...props} strokeWidth="2">
      <circle cx="12" cy="12" r="1" />
      <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" />
      <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" />
    </svg>
  );
  if (subjectId === "math") return (
    <svg {...props}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" />
      <path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" />
    </svg>
  );
  if (subjectId === "social" || subjectId === "social_civics") return (
    <svg {...props}>
      <path d="m20.893 13.393-1.135-1.135a2.252 2.252 0 0 1-.421-.585l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 0 1-1.81 1.025 1.055 1.055 0 0 1-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 0 1-1.383-2.46l.007-.042a2.25 2.25 0 0 1 .29-.787l.09-.15a2.25 2.25 0 0 1 2.37-1.048l1.178.236a1.125 1.125 0 0 0 1.302-.795l.208-.73a1.125 1.125 0 0 0-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 0 1-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 0 1-1.458-1.137l1.411-2.353a2.25 2.25 0 0 0 .286-.76m11.928 9.869A9 9 0 0 0 8.965 3.525m11.928 9.868A9 9 0 1 1 8.965 3.525" />
    </svg>
  );
  if (subjectId === "social_history") return (
    <svg {...props} strokeWidth="2">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <path d="m8 13 4-7 4 7" /><path d="M9.1 11h5.7" />
    </svg>
  );
  if (subjectId === "social_geography") return (
    <svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
  if (subjectId === "social_economics") return (
    <svg {...props} strokeWidth="2">
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" />
    </svg>
  );
  if (subjectId === "biology") return (
    <svg {...props}>
      <path d="M12 22s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
      <path d="M9 10c2 0 2-2 4-2" /><path d="M8 14c2 0 2-2 4-2" />
    </svg>
  );
  if (subjectId === "english") return (
    <svg {...props} strokeWidth="2">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <path d="m8 13 4-7 4 7" /><path d="M9.1 11h5.7" />
    </svg>
  );
  if (subjectId === "hindi") return (
    <svg {...props} strokeWidth="2">
      <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" /><path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
    </svg>
  );
  if (subjectId === "french") return (
    <svg {...props} strokeWidth="2">
      <path d="M10 13h4" /><path d="M12 6v7" /><path d="M16 8V6H8v2" />
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  );
  return (
    <svg {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5v-13A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
};
import TodayFocusItem from "./TodayFocusItem";
import TodayFocusEventItem from "./TodayFocusEventItem";
import BacklogItemComponent from "./BacklogItem";
import AiSuggestionCard from "./AiSuggestionCard";

const IconEdit = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="m15 5 4 4" />
  </svg>
);

const IconGo = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 17 17 7" />
    <path d="M9 7h8v8" />
  </svg>
);

interface Props {
  backlog: BacklogItemType[];
  calendarFocusItems: StudyEvent[];
  backlogFocusItems: BacklogItemType[];
  focusTotalCount: number;
  completedCalendarItems: StudyEvent[];
  completedBacklogItems: BacklogItemType[];
  upcomingExamEvents: StudyEvent[];
  aiSuggestion: AiSuggestion | null;
  aiSuggestionLoading: boolean;
  aiChatOpen: boolean;
  onAiChatOpen: () => void;
  onAiChatClose: () => void;
  activeSubjectFilter: string[];
  setActiveSubjectFilter: (subjects: string[]) => void;
  selectedSubjects: string[];
  onCompleteBacklog: (id: string) => void;
  onCompleteCalendarEvent: (id: string) => void;
  onUndoBacklog: (id: string) => void;
  onUndoCalendarEvent: (id: string) => void;
  onEditCalendarEvent: (event: StudyEvent) => void;
  onPlanExam: (event: StudyEvent) => void;
  onDeleteBacklog: (id: string) => void;
  completingBacklogIds?: Set<string>;
  completingEventIds?: Set<string>;
  onScheduleNow: (subject: string, durationMinutes: number) => void;
  onCreateEvent: () => void;
  onCreateAssessment: () => void;
}

function formatExamTime(event: StudyEvent): string | null {
  if (event.duration_minutes >= 1440) return null;
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  return `${format(start, "h:mma").toLowerCase()}-${format(end, "h:mma").toLowerCase()}`;
}

function UpcomingExamItem({
  event,
  onEdit,
  onPlan,
}: {
  event: StudyEvent;
  onEdit: (event: StudyEvent) => void;
  onPlan: (event: StudyEvent) => void;
}) {
  const date = new Date(event.start_time);
  const subjectLabel = event.subject ? (SUBJECT_LABELS[event.subject] ?? event.subject) : "None";
  const colors = getSubjectColor(event.subject || null);
  const daysAway = differenceInCalendarDays(startOfDay(date), startOfDay(new Date()));
  const timeLabel = formatExamTime(event);
  const urgencyLabel = daysAway === 0 ? "Today" : daysAway === 1 ? "1 day" : `${daysAway} days`;

  return (
    <div
      className="group relative min-h-[82px] w-full overflow-hidden rounded-xl border border-[var(--base-200)] bg-white text-left transition-[background-color,border-color] hover:border-[var(--base-300)] hover:bg-[var(--base-50)] focus-within:border-[var(--base-300)] focus-within:bg-[var(--base-50)]"
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5 transition-all duration-150 group-hover:pointer-events-none group-hover:opacity-0 group-hover:scale-[0.985] group-focus-within:pointer-events-none group-focus-within:opacity-0 group-focus-within:scale-[0.985]">
        <div
          className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border"
          style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
        >
          <span className="text-[10px] font-bold uppercase leading-none">{format(date, "MMM")}</span>
          <span className="mt-0.5 text-[17px] font-bold leading-none tabular-nums">{format(date, "d")}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(event)}
              className="min-w-0 truncate text-left text-[13px] font-semibold text-[var(--base-800)] hover:text-[var(--primary-400)] cursor-pointer"
              title={event.title}
            >
              {event.title}
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--base-500)]">
            <span className="truncate font-semibold" style={{ color: colors.text }}>{subjectLabel}</span>
            {timeLabel && (
              <>
                <span className="h-1 w-1 rounded-full bg-[var(--base-300)]" />
                <span>{timeLabel}</span>
              </>
            )}
          </div>
        </div>
        <span
          className="mt-0.5 shrink-0 rounded-full px-2 py-1 text-[10px] font-bold"
          style={{
            backgroundColor: daysAway <= 3 ? "rgba(239,68,68,0.08)" : "var(--base-100)",
            color: daysAway <= 3 ? "var(--red-100)" : "var(--base-500)",
          }}
        >
          {urgencyLabel}
        </span>
      </div>
      <div className="absolute inset-0 flex items-center gap-2 p-3 opacity-0 transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(event)}
          className="flex h-full min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-white text-[13px] font-semibold text-[var(--base-700)] ring-1 ring-[var(--base-200)] hover:text-[var(--primary-400)] cursor-pointer transition-colors"
        >
          <IconEdit className="h-4 w-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onPlan(event)}
          className="flex h-full min-w-0 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white hover:opacity-90 cursor-pointer transition-opacity"
          style={{ backgroundColor: "var(--primary-400)" }}
        >
          <IconGo className="h-3.5 w-3.5" />
          Plan
        </button>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--base-200)]" style={{ fontFamily: "var(--font-inter)" }}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--base-100)] transition-colors cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-[12px] font-semibold text-[var(--base-600)] uppercase tracking-wide flex items-center gap-2">
          {title}
          {badge !== undefined && badge > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: "var(--primary-400)", minWidth: 18, textAlign: "center" }}
            >
              {badge}
            </span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
          style={{ color: "var(--base-400)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PlannerSidebar({
  backlog,
  calendarFocusItems,
  backlogFocusItems,
  focusTotalCount,
  completedCalendarItems,
  completedBacklogItems,
  upcomingExamEvents,
  aiSuggestion,
  aiSuggestionLoading,
  aiChatOpen,
  onAiChatOpen,
  onAiChatClose,
  activeSubjectFilter,
  setActiveSubjectFilter,
  selectedSubjects,
  onCompleteBacklog,
  onCompleteCalendarEvent,
  onUndoBacklog,
  onUndoCalendarEvent,
  onEditCalendarEvent,
  onPlanExam,
  onDeleteBacklog,
  completingBacklogIds = new Set(),
  completingEventIds = new Set(),
  onScheduleNow,
  onCreateEvent,
  onCreateAssessment,
}: Props) {
  const toggleSubjectFilter = (subject: string) => {
    if (activeSubjectFilter.includes(subject)) {
      setActiveSubjectFilter(activeSubjectFilter.filter((s) => s !== subject));
    } else {
      setActiveSubjectFilter([...activeSubjectFilter, subject]);
    }
  };
  const hasFocusItems = calendarFocusItems.length > 0 || backlogFocusItems.length > 0;
  const focusCount = focusTotalCount;
  const completedCount = completedCalendarItems.length + completedBacklogItems.length;

  return (
    <div
      className="flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-l border-[var(--base-200)] bg-white"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      {/* Top action bar */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-[var(--base-200)]"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <button
          type="button"
          onClick={onCreateAssessment}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: "var(--primary-400)" }}
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 15h5" />
          </svg>
          Add exam / test
        </button>
        <button
          type="button"
          onClick={onCreateEvent}
          aria-label="New event"
          title="New event"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-opacity hover:opacity-90 cursor-pointer shrink-0"
          style={{ backgroundColor: "var(--primary-400)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      {aiChatOpen ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AiSuggestionCard
            suggestion={aiSuggestion}
            loading={aiSuggestionLoading}
            expanded={true}
            onExpand={onAiChatOpen}
            onCollapse={onAiChatClose}
            onScheduleNow={onScheduleNow}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {/* Today's Focus */}
            {hasFocusItems && (
            <SidebarSection title="Today's Focus" badge={focusCount} defaultOpen={true}>
              <div className="rounded-xl overflow-hidden">
                <AnimatePresence initial={false}>
                  {calendarFocusItems.map((ev) => (
                    <TodayFocusEventItem
                      key={ev.id}
                      event={ev}
                      onComplete={onCompleteCalendarEvent}
                      onUndo={onUndoCalendarEvent}
                      onEdit={onEditCalendarEvent}
                      isCompleting={completingEventIds.has(ev.id)}
                    />
                  ))}
                  {backlogFocusItems.map((item) => (
                    <TodayFocusItem
                      key={item.id}
                      item={item}
                      onComplete={onCompleteBacklog}
                      onUndo={onUndoBacklog}
                      isCompleting={completingBacklogIds.has(item.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SidebarSection>
          )}

          {completedCount > 0 && (
            <SidebarSection title="Completed" defaultOpen={false}>
              <div className="rounded-xl overflow-hidden">
                <AnimatePresence initial={false}>
                  {completedCalendarItems.map((ev) => (
                    <TodayFocusEventItem
                      key={`completed-event-${ev.id}`}
                      event={ev}
                      onComplete={onCompleteCalendarEvent}
                      onUndo={onUndoCalendarEvent}
                      onEdit={onEditCalendarEvent}
                      isCompleted
                    />
                  ))}
                  {completedBacklogItems.map((item) => (
                    <TodayFocusItem
                      key={`completed-backlog-${item.id}`}
                      item={item}
                      onComplete={onCompleteBacklog}
                      onUndo={onUndoBacklog}
                      isCompleted
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SidebarSection>
          )}

          {upcomingExamEvents.length > 0 && (
            <SidebarSection title="Upcoming Tests" badge={upcomingExamEvents.length} defaultOpen={true}>
              <div className="flex flex-col gap-2 pt-1">
                {upcomingExamEvents.slice(0, 5).map((event) => (
                  <UpcomingExamItem
                    key={event.id}
                    event={event}
                    onEdit={onEditCalendarEvent}
                    onPlan={onPlanExam}
                  />
                ))}
                {upcomingExamEvents.length > 5 && (
                  <p className="px-1 pt-0.5 text-[11px] font-medium text-[var(--base-400)]">
                    +{upcomingExamEvents.length - 5} more scheduled
                  </p>
                )}
              </div>
            </SidebarSection>
          )}

          {/* My Subjects */}
          <SidebarSection title="My Subjects" defaultOpen={true}>
            <div className="flex flex-col gap-0.5 pt-1">
              {selectedSubjects.map((subject) => {
                const label = SUBJECT_LABELS[subject] ?? subject;
                const colors = getSubjectColor(subject);
                const isActive = activeSubjectFilter.includes(subject);
                return (
                  <button
                    key={subject}
                    type="button"
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2.5 py-2 transition-all text-left w-full"
                    style={
                      isActive
                        ? { backgroundColor: colors.bg, outline: `1.5px solid ${colors.border}` }
                        : { backgroundColor: "transparent" }
                    }
                    onClick={() => toggleSubjectFilter(subject)}
                  >
                    {/* Colored dot */}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: colors.dot }}
                    />
                    {/* Icon */}
                    <span style={{ color: isActive ? colors.text : "var(--base-500)" }}>
                      <SubjectIcon subjectId={subject} />
                    </span>
                    <span
                      className="text-[12px] truncate font-medium"
                      style={{ color: isActive ? colors.text : "var(--base-600)" }}
                    >
                      {label}
                    </span>
                    {isActive && (
                      <svg className="w-3 h-3 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ color: colors.text }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            {activeSubjectFilter.length > 0 && (
              <button
                type="button"
                className="mt-2 text-[11px] text-[var(--primary-400)] hover:opacity-75 transition-opacity cursor-pointer"
                onClick={() => setActiveSubjectFilter([])}
              >
                Clear filter
              </button>
            )}
          </SidebarSection>

          {/* Backlog */}
          {backlog.length > 0 && (
            <SidebarSection title="Backlog" badge={backlog.length} defaultOpen={backlog.length > 0}>
              <AnimatePresence initial={false}>
                {backlog.map((item) => (
                  <BacklogItemComponent
                    key={item.id}
                    item={item}
                    onComplete={onCompleteBacklog}
                    onDelete={onDeleteBacklog}
                    isCompleting={completingBacklogIds.has(item.id)}
                  />
                ))}
              </AnimatePresence>
            </SidebarSection>
          )}
          </div>

          {/* Pinned below the scroll area so the section list keeps a real viewport. */}
          <div className="shrink-0 border-t border-[var(--base-200)] bg-white pt-1">
            <AiSuggestionCard
              suggestion={aiSuggestion}
              loading={aiSuggestionLoading}
              expanded={false}
              onExpand={onAiChatOpen}
              onCollapse={onAiChatClose}
              onScheduleNow={onScheduleNow}
            />
          </div>
        </div>
      )}
    </div>
  );
}
