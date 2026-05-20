"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  startOfWeek,
  addDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  format,
} from "date-fns";
import type { StudyEvent, BacklogItem, DailyStats, AiSuggestion } from "@/lib/planner/types";
import { isPlannerTask } from "@/lib/planner/is-planner-task";
import { isExamEvent } from "@/lib/planner/is-exam-event";
import { usePlannerHeader } from "./planner-header-context";
import CalendarGrid from "./CalendarGrid";
import PlannerSidebar from "./PlannerSidebar";
import CreateEventModal from "./CreateEventModal";
import ExamPlanPanel from "./ExamPlanPanel";

interface Props {
  selectedSubjects: string[];
}

const COMPLETION_EXIT_MS = 320;

export default function PlannerPage({ selectedSubjects }: Props) {
  const { viewMode, currentWeekStart, setViewMode, setCurrentWeekStart } = usePlannerHeader();

  const handleGoToDate = useCallback(
    (day: Date) => {
      if (viewMode !== "week" && viewMode !== "month") return;
      setViewMode("day");
      setCurrentWeekStart(startOfDay(day));
    },
    [viewMode, setViewMode, setCurrentWeekStart],
  );

  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [upcomingExamEvents, setUpcomingExamEvents] = useState<StudyEvent[]>([]);
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [completedBacklogToday, setCompletedBacklogToday] = useState<BacklogItem[]>([]);
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalDefaults, setCreateModalDefaults] = useState<Partial<StudyEvent> | null>(null);
  const [createModalIntent, setCreateModalIntent] = useState<"event" | "assessment">("event");
  const [editingEvent, setEditingEvent] = useState<StudyEvent | null>(null);
  const [planningExamEvent, setPlanningExamEvent] = useState<StudyEvent | null>(null);
  const [isDraftEdit, setIsDraftEdit] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [examEventsLoaded, setExamEventsLoaded] = useState(false);
  const [isOnboardingModal, setIsOnboardingModal] = useState(false);
  const [completingEventIds, setCompletingEventIds] = useState<Set<string>>(() => new Set());
  const [completingBacklogIds, setCompletingBacklogIds] = useState<Set<string>>(() => new Set());
  const eventCompletionTimers = useRef<Map<string, number>>(new Map());
  const backlogCompletionTimers = useRef<Map<string, number>>(new Map());
  const onboardingChecked = useRef(false);

  const openCreateModal = useCallback(() => {
    setCreateModalIntent("event");
    setCreateModalDefaults(null);
    setEditingEvent(null);
    setIsDraftEdit(false);
    setCreateModalOpen(true);
  }, []);

  const openAssessmentModal = useCallback(() => {
    const start = startOfDay(new Date());
    setCreateModalIntent("assessment");
    setCreateModalDefaults({
      title: "",
      related_exam: "",
      start_time: start.toISOString(),
      duration_minutes: 24 * 60,
      is_task: false,
    });
    setEditingEvent(null);
    setIsDraftEdit(false);
    setCreateModalOpen(true);
  }, []);

  useEffect(() => {
    const eventTimers = eventCompletionTimers.current;
    const backlogTimers = backlogCompletionTimers.current;
    return () => {
      eventTimers.forEach((timer) => window.clearTimeout(timer));
      backlogTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  // Fetch events for current view range
  const fetchEvents = useCallback(async (weekStart: Date, mode: "day" | "week" | "month") => {
    setLoadingEvents(true);
    let rangeStart: Date;
    let rangeEnd: Date;
    if (mode === "week") {
      rangeStart = startOfDay(weekStart);
      rangeEnd = endOfDay(addDays(weekStart, 6));
    } else if (mode === "day") {
      rangeStart = startOfDay(weekStart);
      rangeEnd = endOfDay(weekStart);
    } else {
      const monthStart = startOfMonth(weekStart);
      const monthEnd = endOfMonth(weekStart);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      rangeStart = startOfDay(gridStart);
      rangeEnd = endOfDay(gridEnd);
    }
    const qs = new URLSearchParams({
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
    });
    try {
      const res = await fetch(`/api/planner/events?${qs.toString()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { events: StudyEvent[] };
        setEvents(data.events);
      }
    } catch { /* ignore */ }
    setLoadingEvents(false);
    setHasLoaded(true);
  }, []);

  const fetchUpcomingExamEvents = useCallback(async () => {
    const rangeStart = startOfDay(new Date());
    const rangeEnd = addDays(rangeStart, 365);
    const qs = new URLSearchParams({
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
    });
    try {
      const res = await fetch(`/api/planner/events?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) { setExamEventsLoaded(true); return; }
      const data = await res.json() as { events: StudyEvent[] };
      const exams = data.events
        .filter((event) => isExamEvent(event) && event.status !== "skipped" && new Date(event.end_time) >= rangeStart)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setUpcomingExamEvents(exams);
    } catch { /* ignore */ }
    setExamEventsLoaded(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchEvents(currentWeekStart, viewMode);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentWeekStart, viewMode, fetchEvents]);

  // Fetch backlog
  const fetchBacklog = useCallback(async () => {
    try {
      const res = await fetch("/api/planner/backlog", { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { items: BacklogItem[] };
        setBacklog(data.items);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchCompletedBacklogToday = useCallback(async () => {
    try {
      const now = new Date();
      const dayStart = startOfDay(now);
      const qs = new URLSearchParams({
        completed: "true",
        completedStart: dayStart.toISOString(),
        completedEnd: addDays(dayStart, 1).toISOString(),
      });
      const res = await fetch(`/api/planner/backlog?${qs.toString()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { items: BacklogItem[] };
        setCompletedBacklogToday(data.items);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch today stats
  const fetchStats = useCallback(async () => {
    try {
      const now = new Date();
      const date = format(now, "yyyy-MM-dd");
      const dayStart = startOfDay(now).toISOString();
      const dayEnd = endOfDay(now).toISOString();
      const qs = new URLSearchParams({ date, dayStart, dayEnd });
      const res = await fetch(`/api/planner/stats?${qs.toString()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as DailyStats;
        setTodayStats(data);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch AI suggestion
  const fetchAiSuggestion = useCallback(async () => {
    setAiSuggestionLoading(true);
    try {
      const res = await fetch("/api/planner/ai-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ current_date: new Date().toISOString().slice(0, 10) }),
      });
      if (res.ok) {
        const data = await res.json() as AiSuggestion;
        setAiSuggestion(data);
      }
    } catch { /* ignore */ }
    setAiSuggestionLoading(false);
  }, []);

  // Update stats locally after mutations — avoids an extra fetchStats() roundtrip
  const updateStatsLocally = useCallback((delta: {
    minutesDelta?: number;
    eventsDelta?: number;
    subject?: string;
    backlogDelta?: number;
  }) => {
    setTodayStats(prev => {
      if (!prev) return prev;
      const { minutesDelta = 0, eventsDelta = 0, subject, backlogDelta = 0 } = delta;
      const addingCompletion = eventsDelta > 0;
      const newSubjects = addingCompletion && subject && !prev.subjects_covered.includes(subject)
        ? [...prev.subjects_covered, subject]
        : prev.subjects_covered;
      return {
        ...prev,
        total_minutes: Math.max(0, prev.total_minutes + minutesDelta),
        events_completed: Math.max(0, prev.events_completed + eventsDelta),
        subjects_covered: newSubjects,
        backlog_reduced: Math.max(0, prev.backlog_reduced + backlogDelta),
      };
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchBacklog();
      void fetchCompletedBacklogToday();
      void fetchStats();
      void fetchAiSuggestion();
      void fetchUpcomingExamEvents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchBacklog, fetchCompletedBacklogToday, fetchStats, fetchAiSuggestion, fetchUpcomingExamEvents]);

  // Planner onboarding: auto-open exam modal on first visit until exam added or skipped
  useEffect(() => {
    if (!hasLoaded || !examEventsLoaded || onboardingChecked.current) return;
    onboardingChecked.current = true;
    const skipped = localStorage.getItem("lerno_planner_onboarding_skipped");
    if (!skipped && upcomingExamEvents.length === 0) {
      window.setTimeout(() => {
        const start = startOfDay(new Date());
        setCreateModalIntent("assessment");
        setCreateModalDefaults({
          title: "",
          related_exam: "",
          start_time: start.toISOString(),
          duration_minutes: 24 * 60,
          is_task: false,
        });
        setEditingEvent(null);
        setIsDraftEdit(false);
        setIsOnboardingModal(true);
        setCreateModalOpen(true);
      }, 0);
    }
  }, [hasLoaded, examEventsLoaded, upcomingExamEvents]);

  const handleSkipOnboarding = useCallback(() => {
    localStorage.setItem("lerno_planner_onboarding_skipped", "1");
    setIsOnboardingModal(false);
    setCreateModalOpen(false);
    setCreateModalDefaults(null);
    setCreateModalIntent("event");
  }, []);

  const { calendarFocusItems, backlogFocusItems, focusTotalCount } = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = addDays(dayStart, 1);
    const activeTodayTasks = events
      .filter(
        (e) =>
          isPlannerTask(e) &&
          (e.status === "scheduled" || e.status === "in_progress" || completingEventIds.has(e.id)) &&
          new Date(e.start_time) < dayEnd &&
          new Date(e.end_time) > dayStart
      )
      .sort((a, b) => {
        const aAllDay = a.duration_minutes >= 1440 ? 1 : 0;
        const bAllDay = b.duration_minutes >= 1440 ? 1 : 0;
        if (aAllDay !== bAllDay) return aAllDay - bAllDay;
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      });
    const cal = activeTodayTasks.slice(0, 3);
    const rest = 3 - cal.length;
    const bl = rest > 0 ? backlog.slice(0, rest) : [];
    return {
      calendarFocusItems: cal,
      backlogFocusItems: bl,
      focusTotalCount: activeTodayTasks.length + backlog.length,
    };
  }, [events, backlog, completingEventIds]);

  const completedCalendarItems = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    return events
      .filter((event) => {
        if (!isPlannerTask(event) || event.status !== "completed" || !event.completed_at) return false;
        const completedAt = new Date(event.completed_at);
        return completedAt >= dayStart && completedAt < dayEnd;
      })
      .sort((a, b) => {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [events]);

  // Create/Edit event — optimistic: close modal + update state immediately
  const handleSaveEvent = async (eventData: Partial<StudyEvent>) => {
    const savedEditing = editingEvent;
    const wasDraft = isDraftEdit;
    // Close modal instantly before any network request
    setCreateModalOpen(false);
    setEditingEvent(null);
    setCreateModalDefaults(null);
    setCreateModalIntent("event");
    setIsDraftEdit(false);
    setIsOnboardingModal(false);

    // True edit = editing a real (non-draft) existing event
    if (savedEditing && eventData.id && !wasDraft) {
      // Optimistic edit
      const optimistic: StudyEvent = { ...savedEditing, ...eventData } as StudyEvent;
      setEvents(prev => prev.map(e => e.id === eventData.id ? optimistic : e));
      if (isExamEvent(optimistic)) {
        setUpcomingExamEvents(prev => prev.map(e => e.id === optimistic.id ? optimistic : e));
      }
      const res = await fetch(`/api/planner/events/${eventData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(eventData),
      });
      if (res.ok) {
        const data = await res.json() as { event: StudyEvent };
        setEvents(prev => prev.map(e => e.id === data.event.id ? data.event : e));
        if (isExamEvent(data.event)) {
          setUpcomingExamEvents(prev =>
            prev.some(e => e.id === data.event.id)
              ? prev.map(e => e.id === data.event.id ? data.event : e)
              : [...prev, data.event].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          );
        }
      } else {
        // Rollback
        setEvents(prev => prev.map(e => e.id === savedEditing.id ? savedEditing : e));
        if (isExamEvent(savedEditing)) {
          setUpcomingExamEvents(prev => prev.map(e => e.id === savedEditing.id ? savedEditing : e));
        }
      }
    } else {
      // New event — or a draft slot-click being saved for real
      // Reuse the draft's temp ID if one exists, so we update the existing calendar block in-place
      const tempId = (wasDraft && savedEditing?.id) ? savedEditing.id : `__temp_${Date.now()}`;
      const dur = eventData.duration_minutes ?? 60;
      const optimistic: StudyEvent = {
        id: tempId,
        user_id: "",
        title: eventData.title ?? "Untitled",
        subject: eventData.subject ?? "",
        chapter_index: eventData.chapter_index,
        chapter_name: eventData.chapter_name,
        topic: eventData.topic,
        related_exam: eventData.related_exam,
        difficulty: eventData.difficulty,
        notes: eventData.notes,
        start_time: eventData.start_time!,
        end_time: new Date(new Date(eventData.start_time!).getTime() + dur * 60_000).toISOString(),
        duration_minutes: dur,
        color: eventData.color,
        status: "scheduled",
        is_task: eventData.is_task !== false,
        recurrence_group_id: eventData.recurrence_group_id ?? null,
        plan_run_id: eventData.plan_run_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (wasDraft && savedEditing?.id) {
        // Update the draft block already on the calendar with the filled-in form data
        setEvents(prev => prev.map(e => e.id === tempId ? optimistic : e));
      } else {
        setEvents(prev => [...prev, optimistic]);
      }
      if (isExamEvent(optimistic)) {
        setUpcomingExamEvents(prev =>
          [...prev, optimistic].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        );
      }
      const res = await fetch("/api/planner/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(eventData),
      });
      if (res.ok) {
        const data = await res.json() as { event: StudyEvent };
        setEvents(prev => prev.map(e => e.id === tempId ? data.event : e));
        if (isExamEvent(optimistic)) {
          setUpcomingExamEvents(prev => prev.map(e => e.id === tempId ? data.event : e));
        }
      } else {
        // Rollback
        setEvents(prev => prev.filter(e => e.id !== tempId));
        if (isExamEvent(optimistic)) {
          setUpcomingExamEvents(prev => prev.filter(e => e.id !== tempId));
        }
      }
    }
  };

  const handleSaveEvents = async (eventItems: Partial<StudyEvent>[]) => {
    // Close modal instantly, add optimistic events, then reconcile
    setCreateModalOpen(false);
    setEditingEvent(null);
    setCreateModalDefaults(null);
    setCreateModalIntent("event");
    setIsDraftEdit(false);
    setIsOnboardingModal(false);

    const tempIds: string[] = [];
    const optimisticEvents: StudyEvent[] = eventItems.map((eventData, i) => {
      if (eventData.id) return { ...eventData } as StudyEvent; // existing draft (PATCH case)
      const tempId = `__temp_${Date.now()}_${i}`;
      tempIds.push(tempId);
      const dur = eventData.duration_minutes ?? 60;
      return {
        id: tempId,
        user_id: "",
        title: eventData.title ?? "Untitled",
        subject: eventData.subject ?? "",
        chapter_index: eventData.chapter_index,
        chapter_name: eventData.chapter_name,
        topic: eventData.topic,
        related_exam: eventData.related_exam,
        difficulty: eventData.difficulty,
        notes: eventData.notes,
        start_time: eventData.start_time!,
        end_time: new Date(new Date(eventData.start_time!).getTime() + dur * 60_000).toISOString(),
        duration_minutes: dur,
        color: eventData.color,
        status: "scheduled" as const,
        is_task: eventData.is_task !== false,
        recurrence_group_id: eventData.recurrence_group_id ?? null,
        plan_run_id: eventData.plan_run_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    setEvents(prev => {
      const existingIds = new Set(prev.map(e => e.id));
      const updates = new Map(optimisticEvents.filter(e => existingIds.has(e.id)).map(e => [e.id, e]));
      const brandNew = optimisticEvents.filter(e => !existingIds.has(e.id));
      return [...prev.map(e => updates.get(e.id) ?? e), ...brandNew];
    });
    const hasOptimisticExam = optimisticEvents.some(isExamEvent);
    if (hasOptimisticExam) {
      setUpcomingExamEvents(prev =>
        [...prev, ...optimisticEvents.filter(isExamEvent)]
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      );
    }

    const results = await Promise.all(
      eventItems.map((eventData, i) => {
        if (eventData.id) {
          return fetch(`/api/planner/events/${eventData.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(eventData),
          }).then(res => res.ok ? res.json() as Promise<{ event: StudyEvent }> : null);
        }
        return fetch("/api/planner/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(eventData),
        }).then(res => res.ok
          ? (res.json() as Promise<{ event: StudyEvent }>).then(d => ({ ...d, _tempId: tempIds[tempIds.indexOf(`__temp_${Date.now()}_${i}`)] ?? optimisticEvents[i]?.id }))
          : null
        );
      })
    );

    // Reconcile temp IDs with real server-assigned IDs
    setEvents(prev => {
      let next = [...prev];
      results.forEach((result, i) => {
        if (!result) {
          // Rollback this specific optimistic event
          const tempId = optimisticEvents[i]?.id;
          if (tempId?.startsWith("__temp_")) next = next.filter(e => e.id !== tempId);
          return;
        }
        const realEvent = (result as { event: StudyEvent }).event;
        const tempId = optimisticEvents[i]?.id;
        next = next.map(e => e.id === tempId ? realEvent : e);
      });
      return next;
    });
    if (hasOptimisticExam) {
      const savedExamEvents = results
        .filter(Boolean)
        .map(d => (d as { event: StudyEvent }).event)
        .filter(isExamEvent);
      if (savedExamEvents.length > 0) {
        setUpcomingExamEvents(prev => {
          let next = prev;
          results.forEach((result, i) => {
            if (!result) return;
            const realEvent = (result as { event: StudyEvent }).event;
            const tempId = optimisticEvents[i]?.id;
            if (tempId?.startsWith("__temp_")) {
              next = next.map(e => e.id === tempId ? realEvent : e);
            }
          });
          return next;
        });
      }
    }
  };

  const handleCompleteEvent = async (id: string) => {
    if (completingEventIds.has(id)) return;
    const previous = events.find((event) => event.id === id);
    if (previous && !isPlannerTask(previous)) return;
    const completedAt = new Date().toISOString();
    setCompletingEventIds((prev) => new Set(prev).add(id));
    setEvents((prev) =>
      prev.map((event) =>
        event.id === id ? { ...event, status: "completed", completed_at: completedAt } : event
      )
    );
    const exitTimer = window.setTimeout(() => {
      setCompletingEventIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      eventCompletionTimers.current.delete(id);
    }, COMPLETION_EXIT_MS);
    eventCompletionTimers.current.set(id, exitTimer);

    let res: Response | null = null;
    try {
      res = await fetch(`/api/planner/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed" }),
      });
    } catch {
      res = null;
    }
    if (res?.ok) {
      const data = await res.json() as { event: StudyEvent };
      setEvents((prev) => prev.map((e) => e.id === id ? data.event : e));
      // Update stats locally — no extra network roundtrip
      if (previous) updateStatsLocally({ minutesDelta: previous.duration_minutes, eventsDelta: 1, subject: previous.subject });
    } else if (previous) {
      const pendingTimer = eventCompletionTimers.current.get(id);
      if (pendingTimer !== undefined) window.clearTimeout(pendingTimer);
      eventCompletionTimers.current.delete(id);
      setEvents((prev) => prev.map((event) => event.id === id ? previous : event));
      setCompletingEventIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleUndoEvent = async (id: string) => {
    const previous = events.find((event) => event.id === id);
    if (!previous || !isPlannerTask(previous)) return;

    setEvents((prev) =>
      prev.map((event) =>
        event.id === id ? { ...event, status: "scheduled", completed_at: undefined } : event
      )
    );

    let res: Response | null = null;
    try {
      res = await fetch(`/api/planner/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "scheduled" }),
      });
    } catch {
      res = null;
    }

    if (res?.ok) {
      const data = await res.json() as { event: StudyEvent };
      setEvents((prev) => prev.map((event) => event.id === id ? data.event : event));
      // Update stats locally — undo completion
      updateStatsLocally({ minutesDelta: -(previous.duration_minutes ?? 0), eventsDelta: -1 });
      if (isExamEvent(data.event)) {
        setUpcomingExamEvents(prev =>
          prev.some(e => e.id === data.event.id)
            ? prev.map(e => e.id === data.event.id ? data.event : e)
            : [...prev, data.event].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        );
      }
    } else {
      setEvents((prev) => prev.map((event) => event.id === id ? previous : event));
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const event = events.find(e => e.id === id);
    // Optimistic: remove from state immediately, fire-and-forget the delete
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setUpcomingExamEvents(prev => prev.filter(e => e.id !== id));
    // If this event was completed today, decrement stats locally
    if (event?.status === "completed" && event.completed_at) {
      const today = new Date().toDateString();
      if (new Date(event.completed_at).toDateString() === today) {
        updateStatsLocally({ minutesDelta: -(event.duration_minutes ?? 0), eventsDelta: -1 });
      }
    }
    void fetch(`/api/planner/events/${id}`, { method: "DELETE", credentials: "include" });
  };

  const handleDeleteRecurring = async (
    id: string,
    scope: "following" | "all",
    groupId: string,
    fromTime: string
  ) => {
    // Optimistic removal
    if (scope === "all") {
      const removed = events.filter(e => e.recurrence_group_id === groupId);
      setEvents((prev) => prev.filter((e) => e.recurrence_group_id !== groupId));
      setUpcomingExamEvents(prev => prev.filter(e => e.recurrence_group_id !== groupId));
      const today = new Date().toDateString();
      removed.forEach(ev => {
        if (ev.status === "completed" && ev.completed_at && new Date(ev.completed_at).toDateString() === today) {
          updateStatsLocally({ minutesDelta: -(ev.duration_minutes ?? 0), eventsDelta: -1 });
        }
      });
    } else {
      const removed = events.filter(e => e.recurrence_group_id === groupId && e.start_time >= fromTime);
      setEvents((prev) => prev.filter(
        (e) => !(e.recurrence_group_id === groupId && e.start_time >= fromTime)
      ));
      setUpcomingExamEvents(prev => prev.filter(
        e => !(e.recurrence_group_id === groupId && e.start_time >= fromTime)
      ));
      const today = new Date().toDateString();
      removed.forEach(ev => {
        if (ev.status === "completed" && ev.completed_at && new Date(ev.completed_at).toDateString() === today) {
          updateStatsLocally({ minutesDelta: -(ev.duration_minutes ?? 0), eventsDelta: -1 });
        }
      });
    }

    const params = new URLSearchParams({ scope, group_id: groupId });
    if (scope === "following") params.set("from_time", fromTime);
    void fetch(`/api/planner/events/${id}?${params.toString()}`, { method: "DELETE", credentials: "include" });
  };

  const handleSaveAllInGroup = async (groupId: string, fields: Partial<StudyEvent>) => {
    const res = await fetch(`/api/planner/events/group`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ group_id: groupId, fields }),
    });
    if (res.ok) {
      setEvents((prev) => prev.map((e) =>
        e.recurrence_group_id === groupId ? { ...e, ...fields } : e
      ));
    }
  };

  const handleUpdateEventTiming = async (id: string, startTimeIso: string, durationMinutes: number) => {
    const previous = events.find((event) => event.id === id);
    if (!previous) return;
    const endTimeIso = new Date(new Date(startTimeIso).getTime() + durationMinutes * 60_000).toISOString();

    setEvents((prev) =>
      prev.map((event) =>
        event.id === id
          ? { ...event, start_time: startTimeIso, end_time: endTimeIso, duration_minutes: durationMinutes }
          : event
      )
    );

    let res: Response | null = null;
    try {
      res = await fetch(`/api/planner/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start_time: startTimeIso, duration_minutes: durationMinutes, end_time: endTimeIso }),
      });
    } catch {
      res = null;
    }

    if (res?.ok) {
      const data = await res.json() as { event: StudyEvent };
      setEvents((prev) => prev.map((event) => event.id === id ? data.event : event));
    } else {
      setEvents((prev) => prev.map((event) => event.id === id ? previous : event));
    }
  };

  const handleCompleteBacklog = async (id: string) => {
    if (completingBacklogIds.has(id)) return;
    const previous = backlog.find((item) => item.id === id);
    const completedAt = new Date().toISOString();
    if (previous) {
      const optimisticCompleted: BacklogItem = { ...previous, completed: true, completed_at: completedAt };
      setCompletedBacklogToday((prev) =>
        prev.some((item) => item.id === id) ? prev : [optimisticCompleted, ...prev]
      );
    }
    setCompletingBacklogIds((prev) => new Set(prev).add(id));
    const exitTimer = window.setTimeout(() => {
      setBacklog((prev) => prev.filter((item) => item.id !== id));
      setCompletingBacklogIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      backlogCompletionTimers.current.delete(id);
    }, COMPLETION_EXIT_MS);
    backlogCompletionTimers.current.set(id, exitTimer);

    let res: Response | null = null;
    try {
      res = await fetch(`/api/planner/backlog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ completed: true }),
      });
    } catch {
      res = null;
    }
    if (res?.ok) {
      const data = await res.json() as { item: BacklogItem };
      setCompletedBacklogToday((prev) =>
        prev.map((item) => item.id === id ? data.item : item)
      );
      updateStatsLocally({ backlogDelta: 1 });
    } else if (previous) {
      const pendingTimer = backlogCompletionTimers.current.get(id);
      if (pendingTimer !== undefined) window.clearTimeout(pendingTimer);
      backlogCompletionTimers.current.delete(id);
      setCompletedBacklogToday((prev) => prev.filter((item) => item.id !== id));
      setBacklog((prev) => prev.some((item) => item.id === id) ? prev : [previous, ...prev]);
      setCompletingBacklogIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleUndoBacklog = async (id: string) => {
    const previous = completedBacklogToday.find((item) => item.id === id);
    if (!previous) return;

    const undone: BacklogItem = { ...previous, completed: false, completed_at: undefined };
    setCompletedBacklogToday((prev) => prev.filter((item) => item.id !== id));
    setBacklog((prev) => prev.some((item) => item.id === id) ? prev : [undone, ...prev]);

    let res: Response | null = null;
    try {
      res = await fetch(`/api/planner/backlog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ completed: false }),
      });
    } catch {
      res = null;
    }

    if (res?.ok) {
      const data = await res.json() as { item: BacklogItem };
      setBacklog((prev) => prev.map((item) => item.id === id ? data.item : item));
      updateStatsLocally({ backlogDelta: -1 });
    } else {
      setBacklog((prev) => prev.filter((item) => item.id !== id));
      setCompletedBacklogToday((prev) => prev.some((item) => item.id === id) ? prev : [previous, ...prev]);
    }
  };

  const handleDeleteBacklog = (id: string) => {
    setBacklog((prev) => prev.filter((item) => item.id !== id));
    void fetch(`/api/planner/backlog/${id}`, { method: "DELETE", credentials: "include" });
  };

  // Slot click — place a draft block on the calendar immediately, open modal
  const handleSlotClick = useCallback((date: Date, hour: number, minutes = 0) => {
    const start_time = new Date(date);
    start_time.setHours(hour, minutes, 0, 0);
    const tempId = `__temp_${Date.now()}`;
    const draft: StudyEvent = {
      id: tempId, user_id: "", title: "Untitled", subject: "",
      start_time: start_time.toISOString(),
      end_time: new Date(start_time.getTime() + 60 * 60_000).toISOString(),
      duration_minutes: 60, status: "scheduled", is_task: true,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setEvents(prev => [...prev, draft]);
    setEditingEvent(draft);
    setCreateModalDefaults(null);
    setCreateModalIntent("event");
    setIsDraftEdit(true);
    setCreateModalOpen(true);
  }, []);

  const handleAllDayClick = useCallback((date: Date) => {
    const start = startOfDay(date);
    const tempId = `__temp_${Date.now()}`;
    const dur = 24 * 60;
    const draft: StudyEvent = {
      id: tempId, user_id: "", title: "All day event", subject: "",
      start_time: start.toISOString(),
      end_time: new Date(start.getTime() + dur * 60_000).toISOString(),
      duration_minutes: dur, status: "scheduled", is_task: true,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setEvents(prev => [...prev, draft]);
    setEditingEvent(draft);
    setCreateModalDefaults(null);
    setCreateModalIntent("event");
    setIsDraftEdit(true);
    setCreateModalOpen(true);
  }, []);

  const handleEditEvent = (event: StudyEvent) => {
    setCreateModalIntent(isExamEvent(event) ? "assessment" : "event");
    setEditingEvent(event);
    setCreateModalDefaults(null);
    setIsDraftEdit(false);
    setCreateModalOpen(true);
  };

  const handleScheduleNow = (subject: string, durationMinutes: number) => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    setCreateModalDefaults({
      subject,
      start_time: now.toISOString(),
      duration_minutes: durationMinutes,
    });
    setCreateModalIntent("event");
    setEditingEvent(null);
    setCreateModalOpen(true);
  };

  const handlePlanCommitted = (savedEvents: StudyEvent[]) => {
    if (savedEvents.length > 0) {
      setEvents((prev) => {
        const existing = new Set(prev.map((event) => event.id));
        return [...prev, ...savedEvents.filter((event) => !existing.has(event.id))];
      });
    }
    setPlanningExamEvent(null);
    void fetchEvents(currentWeekStart, viewMode);
    void fetchStats();
    void fetchUpcomingExamEvents();
  };

  return (
    <div className="flex h-full min-h-0 max-h-full w-full flex-1 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-full max-h-full min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        {/* Calendar Grid */}
        <div className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
          {!hasLoaded ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full border-2 border-t-[var(--primary-400)] border-[var(--base-200)] animate-spin" />
                <p className="text-[13px] text-[var(--base-400)]" style={{ fontFamily: "var(--font-inter)" }}>
                  Loading your schedule…
                </p>
              </div>
            </div>
          ) : (
            <CalendarGrid
              viewMode={viewMode}
              currentWeekStart={currentWeekStart}
              events={events}
              activeSubjectFilter={activeSubjectFilter}
              onSlotClick={handleSlotClick}
              onAllDayClick={handleAllDayClick}
              onGoToDate={handleGoToDate}
              onEdit={handleEditEvent}
              onComplete={handleCompleteEvent}
              onUndo={handleUndoEvent}
              onDelete={handleDeleteEvent}
              onDeleteRecurring={handleDeleteRecurring}
              onUpdateTiming={handleUpdateEventTiming}
            />
          )}
        </div>

        {/* Right rail */}
        {planningExamEvent ? (
          <ExamPlanPanel
            exam={planningExamEvent}
            onClose={() => setPlanningExamEvent(null)}
            onCommitted={handlePlanCommitted}
          />
        ) : (
          <PlannerSidebar
            backlog={backlog}
            calendarFocusItems={calendarFocusItems}
            backlogFocusItems={backlogFocusItems}
            focusTotalCount={focusTotalCount}
            completedCalendarItems={completedCalendarItems}
            completedBacklogItems={completedBacklogToday}
            upcomingExamEvents={upcomingExamEvents}
            aiSuggestion={aiSuggestion}
            aiSuggestionLoading={aiSuggestionLoading}
            aiChatOpen={aiChatOpen}
            onAiChatOpen={() => setAiChatOpen(true)}
            onAiChatClose={() => setAiChatOpen(false)}
            activeSubjectFilter={activeSubjectFilter}
            setActiveSubjectFilter={setActiveSubjectFilter}
            selectedSubjects={selectedSubjects}
            onCompleteBacklog={handleCompleteBacklog}
            onCompleteCalendarEvent={handleCompleteEvent}
            onUndoBacklog={handleUndoBacklog}
            onUndoCalendarEvent={handleUndoEvent}
            onEditCalendarEvent={handleEditEvent}
            onPlanExam={setPlanningExamEvent}
            onDeleteBacklog={handleDeleteBacklog}
            completingBacklogIds={completingBacklogIds}
            completingEventIds={completingEventIds}
            onScheduleNow={handleScheduleNow}
            onCreateEvent={openCreateModal}
            onCreateAssessment={openAssessmentModal}
          />
        )}

      {/* Create / Edit Event Modal */}
      <CreateEventModal
        open={createModalOpen}
        onClose={() => {
          // Remove the draft block from the calendar if user cancelled without saving
          if (isDraftEdit && editingEvent?.id?.startsWith("__temp_")) {
            setEvents(prev => prev.filter(e => e.id !== editingEvent.id));
          }
          setCreateModalOpen(false);
          setEditingEvent(null);
          setCreateModalDefaults(null);
          setCreateModalIntent("event");
          setIsDraftEdit(false);
          setIsOnboardingModal(false);
        }}
        showSkip={isOnboardingModal}
        onSkip={handleSkipOnboarding}
        onSave={handleSaveEvent}
        onSaveMany={handleSaveEvents}
        onDelete={(id) => {
          void handleDeleteEvent(id);
          setCreateModalOpen(false);
          setEditingEvent(null);
          setCreateModalDefaults(null);
          setCreateModalIntent("event");
          setIsDraftEdit(false);
        }}
        onDeleteRecurring={(id, scope, groupId, fromTime) => {
          void handleDeleteRecurring(id, scope, groupId, fromTime);
        }}
        onSaveAllInGroup={handleSaveAllInGroup}
        defaults={createModalDefaults}
        editingEvent={editingEvent}
        isDraftEdit={isDraftEdit}
        intent={createModalIntent}
        selectedSubjects={selectedSubjects}
      />
      </motion.div>
    </div>
  );
}
