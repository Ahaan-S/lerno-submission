"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import type { StudyEvent } from "@/lib/planner/types";
import { isPlannerTask } from "@/lib/planner/is-planner-task";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { getSubjectColor } from "@/lib/planner/subject-colors";
import TimePickerPopup, { minutesToDisplay, formatDuration, parseDigitTime } from "./TimePickerPopup";
import DatePickerPopup from "./DatePickerPopup";
import RecurrenceSelector, { type RecurrenceValue, generateRecurrenceDates } from "./RecurrenceSelector";
import RecurringActionDialog, { type RecurringScope } from "./RecurringActionDialog";

// ─── Subject icons ────────────────────────────────────────────────────────────
const ScienceIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
    <path d="M6.453 15h11.094" /><path d="M8.5 2h7" />
  </svg>
);
const PhysicsIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" />
    <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" />
  </svg>
);
const MathIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <line x1="8" x2="16" y1="6" y2="6" />
    <line x1="16" x2="16" y1="14" y2="18" />
    <path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" />
    <path d="M12 14h.01" /><path d="M8 14h.01" />
    <path d="M12 18h.01" /><path d="M8 18h.01" />
  </svg>
);
const SocialIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="m20.893 13.393-1.135-1.135a2.252 2.252 0 0 1-.421-.585l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 0 1-1.81 1.025 1.055 1.055 0 0 1-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 0 1-1.383-2.46l.007-.042a2.25 2.25 0 0 1 .29-.787l.09-.15a2.25 2.25 0 0 1 2.37-1.048l1.178.236a1.125 1.125 0 0 0 1.302-.795l.208-.73a1.125 1.125 0 0 0-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 0 1-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 0 1-1.458-1.137l1.411-2.353a2.25 2.25 0 0 0 .286-.76m11.928 9.869A9 9 0 0 0 8.965 3.525m11.928 9.868A9 9 0 1 1 8.965 3.525" />
  </svg>
);
const HistoryIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8v4l3 3" /><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
  </svg>
);
const GeographyIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);
const CivicsIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 2 7.5V10h20V7.5z" />
    <path d="M12 22V10" /><path d="M2 21h20" /><path d="M7 10v11" /><path d="M17 10v11" />
  </svg>
);
const EconomicsIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="12" x="2" y="6" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>
);
const EnglishIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    <path d="m8 13 4-7 4 7" /><path d="M9.1 11h5.7" />
  </svg>
);
const HindiIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
  </svg>
);
const FrenchIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13h4" /><path d="M12 6v7" /><path d="M16 8V6H8v2" />
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
  </svg>
);
const BiologyIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
    <path d="M9 10c2 0 2-2 4-2" /><path d="M8 14c2 0 2-2 4-2" />
  </svg>
);
const AccountancyIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" />
    <path d="M16 10h.01" /><path d="M2 8v1a2 2 0 0 0 2 2h1" />
  </svg>
);
const BusinessStudiesIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12h.01" />
    <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <path d="M22 13a18.15 18.15 0 0 1-20 0" />
    <rect width="20" height="14" x="2" y="6" rx="2" />
  </svg>
);
const BookIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5v-13A2.5 2.5 0 0 1 6.5 2Z" />
  </svg>
);

type IconComponent = ({ size }: { size?: number }) => React.JSX.Element;

const SUBJECT_ICONS: Record<string, IconComponent> = {
  science: ScienceIcon, physics: PhysicsIcon, chemistry: ScienceIcon,
  biology: BiologyIcon, math: MathIcon, social: SocialIcon,
  social_history: HistoryIcon, social_geography: GeographyIcon,
  social_civics: CivicsIcon, social_economics: EconomicsIcon,
  economics: EconomicsIcon, accountancy: AccountancyIcon,
  business_studies: BusinessStudiesIcon, english: EnglishIcon,
  hindi: HindiIcon, french: FrenchIcon,
};

// ─── Types ────────────────────────────────────────────────────────────────────
type PickerType = "date" | "start" | "end" | null;
type AssessmentDateItem = {
  date: string;
  subject: string;
  startTime: string;
  endTime: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (event: Partial<StudyEvent>) => Promise<void>;
  onSaveMany?: (events: Partial<StudyEvent>[]) => Promise<void>;
  onDelete?: (id: string) => void;
  /** Called when deleting a recurring event with scope "following" or "all". */
  onDeleteRecurring?: (id: string, scope: "following" | "all", groupId: string, fromTime: string) => void;
  /** Called when saving a recurring event edit with scope "all" (bulk update). */
  onSaveAllInGroup?: (groupId: string, fields: Partial<StudyEvent>) => Promise<void>;
  defaults?: Partial<StudyEvent> | null;
  editingEvent?: StudyEvent | null;
  isDraftEdit?: boolean;
  intent?: "event" | "assessment";
  selectedSubjects: string[];
  showSkip?: boolean;
  onSkip?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CreateEventModal({
  open, onClose, onSave, onSaveMany, onDelete, onDeleteRecurring, onSaveAllInGroup,
  defaults, editingEvent, isDraftEdit = false, intent = "event", selectedSubjects,
  showSkip = false, onSkip,
}: Props) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startMinutes, setStartMinutes] = useState(9 * 60);
  const [endMinutes, setEndMinutes] = useState(10 * 60);
  const [topic, setTopic] = useState("");
  const [relatedExam, setRelatedExam] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "">("");
  const [notes, setNotes] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isTask, setIsTask] = useState(true);

  const [allDay, setAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>({ option: "none" });
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [timeInputVal, setTimeInputVal] = useState("");
  const [assessmentDates, setAssessmentDates] = useState<AssessmentDateItem[]>([]);
  const [assessmentDraftDates, setAssessmentDraftDates] = useState<string[]>([]);
  const [assessmentDatePickerOpen, setAssessmentDatePickerOpen] = useState(false);
  const [assessmentTimePicker, setAssessmentTimePicker] = useState<null | { date: string; type: "startTime" | "endTime" }>(null);
  const [assessmentSubjectOpen, setAssessmentSubjectOpen] = useState<string | null>(null);
  const [recurringDialog, setRecurringDialog] = useState<"save" | "delete" | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const assessmentDateRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLButtonElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const assessmentTimeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const assessmentSubjectRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  type Snapshot = {
    title: string; subject: string; date: string;
    startMinutes: number; endMinutes: number; allDay: boolean;
    topic: string; relatedExam: string; difficulty: string; notes: string;
    isTask: boolean;
  };
  const initialRef = useRef<Snapshot | null>(null);

  const isEditing = !!editingEvent && !isDraftEdit;
  const isAssessmentIntent = intent === "assessment";

  const openDatePicker = () => {
    setActivePicker(prev => (prev === "date" ? null : "date"));
  };

  const openTimePicker = (type: "start" | "end") => {
    setTimeInputVal("");
    setActivePicker(prev => (prev === type ? null : type));
  };

  const commitTime = (type: "start" | "end") => {
    const mins = parseDigitTime(timeInputVal);
    if (mins !== null) {
      if (type === "start") handleStartChange(mins);
      else handleEndChange(mins);
    }
    setActivePicker(null);
    setTimeInputVal("");
  };

  // live preview value for dropdown highlight while typing
  const liveMinutes = parseDigitTime(timeInputVal) ?? undefined;

  const handleStartChange = (mins: number) => {
    const dur = endMinutes - startMinutes;
    setStartMinutes(mins);
    setEndMinutes(Math.min(23 * 60 + 45, mins + dur));
  };

  const handleEndChange = (mins: number) => setEndMinutes(mins);

  const handleDateChange = (d: Date) => setDate(format(d, "yyyy-MM-dd"));

  const toggleAssessmentDraftDate = (d: Date) => {
    const key = format(d, "yyyy-MM-dd");
    setAssessmentDraftDates((prev) =>
      prev.includes(key) ? prev.filter((dateKey) => dateKey !== key) : [...prev, key].sort()
    );
  };

  const addAssessmentDates = () => {
    setAssessmentDates((prev) => {
      const previousByDate = new Map(prev.map((item) => [item.date, item]));
      return assessmentDraftDates
        .map((dateKey) => previousByDate.get(dateKey) ?? { date: dateKey, subject: "", startTime: "", endTime: "" })
        .sort((a, b) => a.date.localeCompare(b.date));
    });
    setAssessmentDraftDates([]);
    setAssessmentDatePickerOpen(false);
  };

  const removeAssessmentDate = (dateKey: string) => {
    setAssessmentDates((prev) => prev.filter((item) => item.date !== dateKey));
  };

  const setAssessmentSubject = (dateKey: string, nextSubject: string) => {
    setAssessmentDates((prev) =>
      prev.map((item) => item.date === dateKey ? { ...item, subject: nextSubject } : item)
    );
  };

  const setAssessmentTime = (dateKey: string, key: "startTime" | "endTime", value: string) => {
    setAssessmentDates((prev) =>
      prev.map((item) => item.date === dateKey ? { ...item, [key]: value } : item)
    );
  };

  const minutesToTimeValue = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const timeToMinutes = (value: string) => {
    if (!value) return null;
    const [h, m] = value.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  useEffect(() => {
    if (!open) { setActivePicker(null); setTimeInputVal(""); setAllDay(false); return; }

    let snap: Snapshot = {
      title: "", subject: "", date: format(new Date(), "yyyy-MM-dd"),
      startMinutes: 9 * 60, endMinutes: 10 * 60, allDay: false,
      topic: "", relatedExam: "", difficulty: "", notes: "",
      isTask: true,
    };

    if (editingEvent && !isDraftEdit) {
      const d = new Date(editingEvent.start_time);
      const sm = d.getHours() * 60 + d.getMinutes();
      const isAllDay = editingEvent.duration_minutes === 1440;
      snap = {
        title: editingEvent.title,
        subject: editingEvent.subject,
        date: format(d, "yyyy-MM-dd"),
        startMinutes: sm,
        endMinutes: sm + (editingEvent.duration_minutes ?? 60),
        allDay: isAllDay,
        topic: editingEvent.topic ?? "",
        relatedExam: editingEvent.related_exam ?? "",
        difficulty: editingEvent.difficulty ?? "",
        notes: editingEvent.notes ?? "",
        isTask: isPlannerTask(editingEvent),
      };
      if (intent === "assessment") {
        const endMinutesForExam = sm + (editingEvent.duration_minutes ?? 1440);
        setAssessmentDates([{
          date: format(d, "yyyy-MM-dd"),
          subject: editingEvent.subject ?? "",
          startTime: isAllDay ? "" : minutesToTimeValue(sm),
          endTime: isAllDay ? "" : minutesToTimeValue(Math.min(23 * 60 + 45, endMinutesForExam)),
        }]);
      }
    } else if (isDraftEdit && editingEvent) {
      const d = new Date(editingEvent.start_time);
      const sm = d.getHours() * 60 + d.getMinutes();
      snap.date = format(d, "yyyy-MM-dd");
      snap.startMinutes = sm;
      snap.endMinutes = sm + (editingEvent.duration_minutes ?? 60);
      snap.allDay = editingEvent.duration_minutes >= 1440;
      snap.isTask = isPlannerTask(editingEvent);
    } else if (defaults?.start_time) {
      const d = new Date(defaults.start_time);
      const sm = d.getHours() * 60 + d.getMinutes();
      snap.title = defaults.title ?? snap.title;
      snap.subject = defaults.subject ?? snap.subject;
      snap.date = format(d, "yyyy-MM-dd");
      snap.startMinutes = sm;
      snap.endMinutes = sm + (defaults.duration_minutes ?? 60);
      snap.allDay = (defaults.duration_minutes ?? 60) >= 1440;
      snap.topic = defaults.topic ?? snap.topic;
      snap.relatedExam = defaults.related_exam ?? snap.relatedExam;
      snap.difficulty = defaults.difficulty ?? snap.difficulty;
      snap.notes = defaults.notes ?? snap.notes;
      snap.isTask = defaults.is_task ?? snap.isTask;
    }

    setTitle(snap.title);
    setSubject(snap.subject);
    setDate(snap.date);
    setStartMinutes(snap.startMinutes);
    setEndMinutes(snap.endMinutes);
    setAllDay(snap.allDay);
    setTopic(snap.topic);
    setRelatedExam(snap.relatedExam);
    setDifficulty(snap.difficulty as "easy" | "medium" | "hard" | "");
    setNotes(snap.notes);
    setIsTask(snap.isTask);
    setRecurrence({ option: "none" });
    if (!(editingEvent && !isDraftEdit && intent === "assessment")) setAssessmentDates([]);
    setAssessmentDraftDates([]);
    setAssessmentDatePickerOpen(false);
    setAssessmentTimePicker(null);
    setAssessmentSubjectOpen(null);
    setAdvancedOpen(false);
    initialRef.current = snap;

    setTimeout(() => titleRef.current?.focus(), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => { if (saving) return; onClose(); };

  const newGroupId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `grp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const buildBaseData = () => {
    const sm = allDay ? 0 : startMinutes;
    const em = allDay ? 24 * 60 : endMinutes;
    const durationMinutes = em - sm;
    const h = Math.floor(sm / 60);
    const m = sm % 60;
    const start_time = new Date(
      `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
    ).toISOString();
    const baseEventData: Partial<StudyEvent> = {
      title: title.trim(),
      subject: subject || undefined,
      duration_minutes: durationMinutes,
      topic: topic.trim() || undefined,
      related_exam: relatedExam.trim() || undefined,
      difficulty: difficulty || undefined,
      notes: notes.trim() || undefined,
      is_task: isTask,
    };
    return { start_time, durationMinutes, baseEventData };
  };

  // Main save — scope only matters when editing a recurring event
  const handleSave = async (scope?: RecurringScope) => {
    if (!canSave) return;
    setSaving(true);

    if (isAssessmentIntent) {
      const eventsToSave = assessmentDates.map((item) => {
        const start = timeToMinutes(item.startTime);
        const end = timeToMinutes(item.endTime);
        const hasTime = start !== null && end !== null && end > start;
        const startMinutesForDate = hasTime ? start : 0;
        const h = Math.floor(startMinutesForDate / 60);
        const m = startMinutesForDate % 60;
        return {
          title: title.trim(),
          subject: item.subject,
          start_time: new Date(`${item.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).toISOString(),
          duration_minutes: hasTime ? end - start : 24 * 60,
          related_exam: title.trim(),
          is_task: false,
        };
      });
      if (editingEvent) {
        await onSave({ id: editingEvent.id, ...eventsToSave[0] });
      } else {
        await (onSaveMany ? onSaveMany(eventsToSave) : Promise.all(eventsToSave.map(onSave)).then(() => undefined));
      }
      setSaving(false);
      return;
    }

    const { start_time, durationMinutes, baseEventData } = buildBaseData();

    // ── Editing a recurring event ──────────────────────────────────────────
    if (isEditing && editingEvent?.recurrence_group_id) {
      const effectiveScope = scope ?? "this";
      const groupId = editingEvent.recurrence_group_id;

      if (effectiveScope === "this") {
        await onSave({ id: editingEvent.id, ...baseEventData, start_time });
      } else if (effectiveScope === "following") {
        // Update this event, delete all future in series, optionally create new series
        await onSave({ id: editingEvent.id, ...baseEventData, start_time });
        if (recurrence.option !== "none" && onSaveMany) {
          const allDates = generateRecurrenceDates(start_time, durationMinutes, recurrence);
          const gid = newGroupId();
          await onSaveMany(allDates.slice(1).map(dt => ({ ...baseEventData, start_time: dt, recurrence_group_id: gid })));
        }
        // Signal parent to delete everything after this event in the original series
        onDeleteRecurring?.(editingEvent.id, "following", groupId, start_time);
      } else {
        // "all" — bulk-update metadata, update this event's full data
        await onSave({ id: editingEvent.id, ...baseEventData, start_time });
        await onSaveAllInGroup?.(groupId, baseEventData);
      }
      setSaving(false);
      return;
    }

    // ── Editing a non-recurring event but enabling recurrence ──────────────
    if (isEditing && editingEvent && recurrence.option !== "none" && onSaveMany) {
      const allDates = generateRecurrenceDates(start_time, durationMinutes, recurrence);
      const gid = newGroupId();
      await onSaveMany(allDates.map((dt, i) => ({
        ...(i === 0 ? { id: editingEvent.id } : {}),
        ...baseEventData,
        start_time: dt,
        recurrence_group_id: gid,
      })));
      setSaving(false);
      return;
    }

    // ── Creating a new recurring series ────────────────────────────────────
    if (!isEditing && recurrence.option !== "none" && onSaveMany) {
      const allDates = generateRecurrenceDates(start_time, durationMinutes, recurrence);
      const gid = newGroupId();
      await onSaveMany(allDates.map((dt, i) => ({
        ...(i === 0 && isDraftEdit && editingEvent ? { id: editingEvent.id } : {}),
        ...baseEventData,
        start_time: dt,
        recurrence_group_id: gid,
      })));
      setSaving(false);
      return;
    }

    // ── Simple single-event save ───────────────────────────────────────────
    await onSave({
      ...(editingEvent ? { id: editingEvent.id } : {}),
      ...baseEventData,
      start_time,
    });
    setSaving(false);
  };

  const handleDeleteClick = () => {
    if (!editingEvent || !onDelete) return;
    if (editingEvent.recurrence_group_id) {
      setRecurringDialog("delete");
    } else {
      onDelete(editingEvent.id);
      onClose();
    }
  };

  const handleSaveClick = () => {
    if (isEditing && editingEvent?.recurrence_group_id) {
      setRecurringDialog("save");
    } else {
      void handleSave();
    }
  };

  const handleRecurringConfirm = async (scope: RecurringScope) => {
    setRecurringDialog(null);
    if (recurringDialog === "delete") {
      if (!editingEvent || !onDelete) return;
      if (scope === "this") {
        onDelete(editingEvent.id);
      } else {
        onDeleteRecurring?.(
          editingEvent.id,
          scope,
          editingEvent.recurrence_group_id!,
          editingEvent.start_time
        );
      }
      onClose();
    } else {
      await handleSave(scope);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (assessmentSubjectOpen) {
        setAssessmentSubjectOpen(null);
        return;
      }
      if (e.key === "Escape" && !activePicker && !assessmentDatePickerOpen && !assessmentTimePicker) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saving, activePicker, assessmentDatePickerOpen, assessmentSubjectOpen, assessmentTimePicker]);

  const isValid = isAssessmentIntent
    ? title.trim().length > 0 && assessmentDates.length > 0
    : title.trim().length > 0 && !!date && (allDay || endMinutes > startMinutes);

  const hasChanges = initialRef.current ? (
    title !== initialRef.current.title ||
    subject !== initialRef.current.subject ||
    date !== initialRef.current.date ||
    startMinutes !== initialRef.current.startMinutes ||
    endMinutes !== initialRef.current.endMinutes ||
    allDay !== initialRef.current.allDay ||
    topic !== initialRef.current.topic ||
    relatedExam !== initialRef.current.relatedExam ||
    difficulty !== initialRef.current.difficulty ||
    notes !== initialRef.current.notes ||
    isTask !== initialRef.current.isTask ||
    recurrence.option !== "none"
  ) : true;

  // For editing: require changes; for creating: just require valid
  const canSave = isAssessmentIntent ? isValid : isValid && (!isEditing || hasChanges);
  const dateObj = new Date(`${date}T12:00:00`);
  const dateDisplay = format(dateObj, "EEE, MMM d");
  const duration = endMinutes - startMinutes;

  if (typeof document === "undefined") return null;

  return (
    <>
      {/* ── Modal portal ────────────────────────────────────── */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center p-4"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {/* Backdrop — exam/test modal uses a dim scrim; event modal stays transparent */}
              <div
                className={isAssessmentIntent ? "absolute inset-0 bg-black/45" : "absolute inset-0"}
                onClick={handleClose}
              />

              {/* Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full max-w-[520px] bg-white rounded-3xl"
                style={{
                  boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
                  maxHeight: "90vh",
                  overflowY: "auto",
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--base-200)]">
                  <div className="flex flex-col gap-0.5">
                    <h2 className="text-[16px] font-semibold text-[var(--base-800)]">
                      {isAssessmentIntent ? (isEditing ? "Edit Exam / Test" : "Add Exam / Test") : isEditing ? "Edit Event" : "Create Event"}
                    </h2>
                    {showSkip && (
                      <p className="text-[12px] text-[var(--base-400)]">Add your upcoming exams to get started with the planner</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--base-100)] transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="px-6 py-5 flex flex-col gap-5">
                  {/* Title */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[var(--base-700)]">Title</label>
                    <input
                      ref={titleRef}
                      type="text"
                      placeholder={isAssessmentIntent ? "e.g., Unit Test, Half-yearly, Boards" : "e.g., Trigonometry Practice"}
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && isValid) void handleSave(); }}
                      className="h-10 px-3.5 rounded-xl border border-[var(--base-200)] text-[14px] text-[var(--base-800)] placeholder:text-[var(--base-300)] outline-none focus:border-[var(--primary-400)] transition-colors"
                      maxLength={100}
                    />
                  </div>

                  {isAssessmentIntent ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[13px] font-medium text-[var(--base-700)]">Dates</label>
                        <button
                          ref={assessmentDateRef}
                          type="button"
                          onClick={() => {
                            setAssessmentDraftDates(assessmentDates.map((item) => item.date));
                            setAssessmentDatePickerOpen(true);
                          }}
                          className="h-11 w-full px-4 rounded-xl border border-[var(--base-200)] text-[14px] font-medium text-left text-[var(--base-700)] hover:bg-[var(--base-100)] transition-colors cursor-pointer flex items-center justify-between gap-3"
                        >
                          <span className="min-w-0 truncate">
                            {assessmentDates.length > 0
                              ? `${assessmentDates.length} date${assessmentDates.length === 1 ? "" : "s"} added`
                              : "Add exam dates"}
                          </span>
                          <svg className="w-4 h-4 shrink-0 text-[var(--base-400)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25M3 10h18" />
                          </svg>
                        </button>
                      </div>

                      {assessmentDates.length > 0 && (
                        <div className="flex flex-col gap-2.5">
                          {assessmentDates.map((item) => {
                            const selectedSubjectColors = item.subject ? getSubjectColor(item.subject) : null;
                            const selectedSubjectLabel = item.subject ? SUBJECT_LABELS[item.subject] ?? item.subject : "Subject";
                            const startMinutesValue = timeToMinutes(item.startTime) ?? 9 * 60;
                            const endMinutesValue = timeToMinutes(item.endTime) ?? Math.max(startMinutesValue + 60, 10 * 60);
                            const dateLabel = format(new Date(`${item.date}T12:00:00`), "MMM d");
                            return (
                            <div
                              key={item.date}
                              className="relative rounded-2xl border border-[var(--base-200)] bg-white px-3.5 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[13px] font-semibold text-[var(--base-800)]">
                                  {format(new Date(`${item.date}T12:00:00`), "EEE, MMM d")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeAssessmentDate(item.date)}
                                  aria-label={`Remove ${format(new Date(`${item.date}T12:00:00`), "MMM d")}`}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--base-400)] hover:bg-[var(--base-100)] hover:text-[var(--base-700)] transition-colors cursor-pointer shrink-0"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>

                              <div className="mt-2.5 grid grid-cols-[1fr_1.15fr] gap-2">
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-xl border border-[var(--base-200)] bg-[var(--base-50,#FAFBFC)] p-1">
                                  <button
                                    ref={(node) => { assessmentTimeRefs.current[`${item.date}:startTime`] = node; }}
                                    type="button"
                                    onClick={() => {
                                      setAssessmentSubjectOpen(null);
                                      setAssessmentTimePicker({ date: item.date, type: "startTime" });
                                    }}
                                    aria-label={`${dateLabel} start time`}
                                    className="h-8 min-w-0 rounded-lg bg-white px-2 text-[12px] font-semibold text-[var(--base-700)] outline-none focus:ring-2 focus:ring-[var(--primary-400)] cursor-pointer hover:bg-[var(--base-100)] transition-colors"
                                  >
                                    {item.startTime ? minutesToDisplay(startMinutesValue) : "Start"}
                                  </button>
                                  <span className="text-[12px] font-medium text-[var(--base-300)]">-</span>
                                  <button
                                    ref={(node) => { assessmentTimeRefs.current[`${item.date}:endTime`] = node; }}
                                    type="button"
                                    onClick={() => {
                                      setAssessmentSubjectOpen(null);
                                      setAssessmentTimePicker({ date: item.date, type: "endTime" });
                                    }}
                                    aria-label={`${dateLabel} end time`}
                                    className="h-8 min-w-0 rounded-lg bg-white px-2 text-[12px] font-semibold text-[var(--base-700)] outline-none focus:ring-2 focus:ring-[var(--primary-400)] cursor-pointer hover:bg-[var(--base-100)] transition-colors"
                                  >
                                    {item.endTime ? minutesToDisplay(endMinutesValue) : "End"}
                                  </button>
                                </div>

                                <div className="relative">
                                  <button
                                    ref={(node) => { assessmentSubjectRefs.current[item.date] = node; }}
                                    type="button"
                                    onClick={() => {
                                      setAssessmentTimePicker(null);
                                      setAssessmentSubjectOpen((prev) => prev === item.date ? null : item.date);
                                    }}
                                    aria-expanded={assessmentSubjectOpen === item.date}
                                    aria-label={`${dateLabel} subject`}
                                    className="h-10 w-full rounded-xl border pl-3 pr-10 text-left text-[13px] font-semibold outline-none focus:ring-2 focus:ring-[var(--primary-400)] cursor-pointer transition-colors flex items-center gap-2"
                                    style={
                                      selectedSubjectColors
                                        ? {
                                            backgroundColor: selectedSubjectColors.bg,
                                            borderColor: selectedSubjectColors.border,
                                            color: selectedSubjectColors.text,
                                          }
                                        : {
                                            backgroundColor: "white",
                                            borderColor: "var(--base-200)",
                                            color: "var(--base-600)",
                                          }
                                    }
                                  >
                                    <span
                                      className="h-2 w-2 rounded-full shrink-0"
                                      style={{ backgroundColor: selectedSubjectColors?.dot ?? "var(--base-300)" }}
                                    />
                                    <span className="min-w-0 truncate">{selectedSubjectLabel}</span>
                                  </button>
                                  <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" style={{ color: selectedSubjectColors?.text ?? "var(--base-400)" }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          );})}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                  {/* Task vs calendar-only */}
                  <div className="flex flex-col gap-1">
                    <span id="planner-event-type-label" className="text-[11px] font-medium uppercase tracking-wide text-[var(--base-500)]">
                      Type
                    </span>
                    <div
                      role="group"
                      aria-labelledby="planner-event-type-label"
                      className="flex rounded-lg p-0.5 gap-px"
                      style={{
                        backgroundColor: "var(--base-100)",
                        boxShadow: "inset 0 1px 1px rgba(15,23,42,0.05)",
                      }}
                    >
                      <button
                        type="button"
                        aria-pressed={isTask}
                        onClick={() => setIsTask(true)}
                        className="relative flex-1 flex items-center justify-center gap-1 h-7 px-2 rounded-[6px] text-[11px] font-medium transition-[color,background-color,box-shadow] duration-150 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-400)] focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                        style={
                          isTask
                            ? {
                                backgroundColor: "white",
                                color: "var(--base-800)",
                                boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                              }
                            : { color: "var(--base-500)", backgroundColor: "transparent" }
                        }
                      >
                        <svg className="w-3 h-3 shrink-0 opacity-85" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        Study task
                      </button>
                      <button
                        type="button"
                        aria-pressed={!isTask}
                        onClick={() => setIsTask(false)}
                        className="relative flex-1 flex items-center justify-center gap-1 h-7 px-2 rounded-[6px] text-[11px] font-medium transition-[color,background-color,box-shadow] duration-150 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-400)] focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                        style={
                          !isTask
                            ? {
                                backgroundColor: "white",
                                color: "var(--base-800)",
                                boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                              }
                            : { color: "var(--base-500)", backgroundColor: "transparent" }
                        }
                      >
                        <svg className="w-3 h-3 shrink-0 opacity-85" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
                          <rect width="18" height="18" x="3" y="4" rx="2" />
                          <path strokeLinecap="round" d="M3 10h18" />
                          <path strokeLinecap="round" d="M7 2v4M17 2v4" />
                        </svg>
                        Event only
                      </button>
                    </div>
                    <p className="text-[11px] leading-snug text-[var(--base-500)]">
                      {isTask
                        ? "In Today’s Focus; can mark done."
                        : isAssessmentIntent
                        ? "Marks the exam/test date on your calendar."
                        : "Calendar only; no focus or check-off."}
                    </p>
                  </div>

                  {/* Subject */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[var(--base-700)]">Subject</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedSubjects.map(s => {
                        const label = SUBJECT_LABELS[s] ?? s;
                        const Icon: IconComponent = SUBJECT_ICONS[s] ?? BookIcon;
                        const isSelected = subject === s;
                        const sc = getSubjectColor(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-medium border transition-all cursor-pointer"
                            style={
                              isSelected
                                ? { backgroundColor: sc.bg, borderColor: sc.border, color: sc.text }
                                : { backgroundColor: "white", borderColor: "var(--base-200)", color: sc.text }
                            }
                            onClick={() => setSubject(prev => (prev === s ? "" : s))}
                          >
                            <Icon size={15} />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date + Time section */}
                  <div className="flex items-start gap-3">
                    {/* Clock icon — aligned to first row */}
                    <svg className="w-[18px] h-[18px] shrink-0 mt-[10px]" style={{ color: "var(--base-400)" }}
                      fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>

                    <div className="flex flex-col gap-1 min-w-0">
                      {/* Row 1: Date + times */}
                      <div className="flex items-center gap-0.5 flex-wrap">
                        {/* Date */}
                        <button
                          ref={dateRef}
                          type="button"
                          onClick={openDatePicker}
                          className="h-9 px-3 rounded-xl text-[14px] font-medium transition-colors cursor-pointer"
                          style={{
                            color: "var(--base-800)",
                            backgroundColor: activePicker === "date" ? "var(--base-100)" : "transparent",
                          }}
                          onMouseEnter={e => { if (activePicker !== "date") e.currentTarget.style.backgroundColor = "var(--base-100)"; }}
                          onMouseLeave={e => { if (activePicker !== "date") e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          {dateDisplay}
                        </button>

                        {!allDay && (
                          <>
                            {/* Start time — button or inline input */}
                            {activePicker === "start" ? (
                              <input
                                ref={startInputRef}
                                type="text"
                                inputMode="numeric"
                                autoFocus
                                value={timeInputVal}
                                placeholder={minutesToDisplay(startMinutes)}
                                onChange={e => setTimeInputVal(e.target.value.replace(/[^0-9:]/g, "").slice(0, 5))}
                                onKeyDown={e => {
                                  if (e.key === "Enter") { commitTime("start"); }
                                  if (e.key === "Escape") { setActivePicker(null); setTimeInputVal(""); }
                                  if (e.key === "Tab") {
                                    e.preventDefault();
                                    commitTime("start");
                                    setTimeout(() => openTimePicker("end"), 0);
                                  }
                                }}
                                onBlur={() => commitTime("start")}
                                className="h-9 px-2.5 rounded-xl text-[14px] font-medium text-center outline-none"
                                style={{ width: 76, color: "var(--primary-400)", backgroundColor: "rgba(0,119,237,0.07)", border: "1.5px solid var(--primary-400)" }}
                              />
                            ) : (
                              <button
                                ref={startRef}
                                type="button"
                                onClick={() => openTimePicker("start")}
                                className="h-9 px-2.5 rounded-xl text-[14px] font-medium transition-colors cursor-pointer"
                                style={{ color: "var(--base-800)", backgroundColor: "transparent" }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--base-100)")}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                {minutesToDisplay(startMinutes)}
                              </button>
                            )}

                            <span className="text-[14px] px-0.5 select-none" style={{ color: "var(--base-400)" }}>–</span>

                            {/* End time — button or inline input */}
                            {activePicker === "end" ? (
                              <input
                                ref={endInputRef}
                                type="text"
                                inputMode="numeric"
                                autoFocus
                                value={timeInputVal}
                                placeholder={minutesToDisplay(endMinutes)}
                                onChange={e => setTimeInputVal(e.target.value.replace(/[^0-9:]/g, "").slice(0, 5))}
                                onKeyDown={e => {
                                  if (e.key === "Enter") { commitTime("end"); }
                                  if (e.key === "Escape") { setActivePicker(null); setTimeInputVal(""); }
                                }}
                                onBlur={() => commitTime("end")}
                                className="h-9 px-2.5 rounded-xl text-[14px] font-medium text-center outline-none"
                                style={{ width: 76, color: "var(--primary-400)", backgroundColor: "rgba(0,119,237,0.07)", border: "1.5px solid var(--primary-400)" }}
                              />
                            ) : (
                              <button
                                ref={endRef}
                                type="button"
                                onClick={() => openTimePicker("end")}
                                className="h-9 px-2.5 rounded-xl text-[14px] font-medium transition-colors cursor-pointer"
                                style={{ color: "var(--base-800)", backgroundColor: "transparent" }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--base-100)")}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                {minutesToDisplay(endMinutes)}
                              </button>
                            )}

                            {/* Duration hint */}
                            {duration > 0 && (
                              <span className="text-[12px] ml-1.5 select-none" style={{ color: "var(--base-400)" }}>
                                {formatDuration(duration)}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Row 2: All day + recurrence */}
                      <div className="flex items-center gap-2 flex-wrap pl-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none py-0.5"
                          onClick={() => { setAllDay(v => !v); setActivePicker(null); setTimeInputVal(""); }}
                        >
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center transition-all shrink-0"
                            style={{
                              backgroundColor: allDay ? "var(--primary-400)" : "white",
                              border: allDay ? "1.5px solid var(--primary-400)" : "1.5px solid var(--base-300)",
                            }}
                          >
                            {allDay && (
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none">
                                <path d="m5 12.5 4.2 4.2L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span className="text-[13px] font-medium" style={{ color: "var(--base-600)" }}>All day</span>
                        </label>

                        {/* Recurrence selector */}
                        <div className="relative">
                          <RecurrenceSelector value={recurrence} onChange={setRecurrence} date={date} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--base-600)] hover:text-[var(--base-800)] transition-colors cursor-pointer"
                      onClick={() => setAdvancedOpen(o => !o)}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                      Advanced options
                    </button>

                    <AnimatePresence>
                      {advancedOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-4 pt-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[13px] font-medium text-[var(--base-700)]">Chapter / Topic</label>
                              <input
                                type="text"
                                placeholder="e.g., Chapter 4 — Chemical Reactions"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="h-10 px-3.5 rounded-xl border border-[var(--base-200)] text-[14px] text-[var(--base-800)] placeholder:text-[var(--base-300)] outline-none focus:border-[var(--primary-400)] transition-colors"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[13px] font-medium text-[var(--base-700)]">Related Exam</label>
                              <input
                                type="text"
                                placeholder="e.g., Mid-term Mathematics"
                                value={relatedExam}
                                onChange={e => setRelatedExam(e.target.value)}
                                className="h-10 px-3.5 rounded-xl border border-[var(--base-200)] text-[14px] text-[var(--base-800)] placeholder:text-[var(--base-300)] outline-none focus:border-[var(--primary-400)] transition-colors"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[13px] font-medium text-[var(--base-700)]">Difficulty</label>
                              <div className="flex items-center gap-2">
                                {(["Easy", "Medium", "Hard"] as const).map(d => {
                                  const val = d.toLowerCase() as "easy" | "medium" | "hard";
                                  return (
                                    <button
                                      key={d}
                                      type="button"
                                      className="flex-1 h-9 rounded-xl border text-[13px] font-medium transition-all cursor-pointer"
                                      style={
                                        difficulty === val
                                          ? { backgroundColor: "var(--primary-10, #E6F4FF)", borderColor: "var(--primary-400)", color: "var(--primary-400)" }
                                          : { backgroundColor: "white", borderColor: "var(--base-200)", color: "var(--base-500)" }
                                      }
                                      onClick={() => setDifficulty(prev => (prev === val ? "" : val))}
                                    >
                                      {d}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[13px] font-medium text-[var(--base-700)]">Notes</label>
                              <textarea
                                placeholder="Any additional notes…"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                                className="px-3.5 py-2.5 rounded-xl border border-[var(--base-200)] text-[14px] text-[var(--base-800)] placeholder:text-[var(--base-300)] outline-none focus:border-[var(--primary-400)] transition-colors resize-none"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[var(--base-200)]">
                  {isEditing && onDelete && editingEvent ? (
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={saving}
                      className="h-9 px-4 rounded-full text-[13px] font-medium border transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      style={{ color: "var(--red-100)", borderColor: "var(--red-10)", backgroundColor: "transparent" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--red-10)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                      Delete
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    {showSkip ? (
                      <button
                        type="button"
                        onClick={onSkip}
                        disabled={saving}
                        className="h-9 px-4 rounded-full text-[14px] text-[var(--base-500)] hover:text-[var(--base-700)] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Skip for now
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={saving}
                        className="h-9 px-4 rounded-full text-[14px] text-[var(--base-600)] border border-[var(--base-200)] hover:bg-[var(--base-100)] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveClick}
                      disabled={!canSave || saving}
                      className="h-9 px-5 rounded-full text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer flex items-center gap-2"
                      style={{ backgroundColor: "var(--primary-400)" }}
                    >
                      {saving ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Saving…
                        </>
                      ) : isEditing ? (
                        "Save Changes"
                      ) : isAssessmentIntent ? (
                        "Add Exam / Test"
                      ) : (
                        "Create Event"
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Picker portals (each uses createPortal internally) ─ */}
      {open && activePicker === "date" && (
        <DatePickerPopup
          value={dateObj}
          onChange={handleDateChange}
          onClose={() => setActivePicker(null)}
          triggerRef={dateRef}
        />
      )}
      {open && assessmentDatePickerOpen && (
        <DatePickerPopup
          value={assessmentDraftDates[0] ? new Date(`${assessmentDraftDates[0]}T12:00:00`) : new Date()}
          onChange={() => undefined}
          onClose={() => setAssessmentDatePickerOpen(false)}
          triggerRef={assessmentDateRef}
          selectedDates={assessmentDraftDates}
          onToggleDate={toggleAssessmentDraftDate}
          onAdd={addAssessmentDates}
          addLabel="Add"
          closeOnSelect={false}
        />
      )}
      {open && assessmentTimePicker && (() => {
        const item = assessmentDates.find((entry) => entry.date === assessmentTimePicker.date);
        if (!item) return null;
        const start = timeToMinutes(item.startTime);
        const end = timeToMinutes(item.endTime);
        const fallbackStart = start ?? 9 * 60;
        const pickerValue = assessmentTimePicker.type === "startTime"
          ? fallbackStart
          : end ?? Math.min(23 * 60 + 45, fallbackStart + 60);
        return (
          <TimePickerPopup
            value={pickerValue}
            onChange={(mins) => {
              setAssessmentTime(assessmentTimePicker.date, assessmentTimePicker.type, minutesToTimeValue(mins));
              if (assessmentTimePicker.type === "startTime") {
                const currentEnd = timeToMinutes(item.endTime);
                if (currentEnd !== null && currentEnd <= mins) {
                  setAssessmentTime(assessmentTimePicker.date, "endTime", minutesToTimeValue(Math.min(23 * 60 + 45, mins + 60)));
                }
              }
              setAssessmentTimePicker(null);
            }}
            onClose={() => setAssessmentTimePicker(null)}
            triggerRef={{ current: assessmentTimeRefs.current[`${assessmentTimePicker.date}:${assessmentTimePicker.type}`] }}
            startMinutes={assessmentTimePicker.type === "endTime" ? fallbackStart : undefined}
            minValue={assessmentTimePicker.type === "endTime" ? fallbackStart + 15 : undefined}
          />
        );
      })()}
      {open && assessmentSubjectOpen && (() => {
        const trigger = assessmentSubjectRefs.current[assessmentSubjectOpen];
        const rect = trigger?.getBoundingClientRect();
        if (!rect) return null;
        const width = Math.max(190, rect.width);
        const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
        const top = Math.min(rect.bottom + 6, window.innerHeight - 260);
        return createPortal(
          <>
            <button
              type="button"
              aria-label="Close subject menu"
              className="fixed inset-0 z-[10000] cursor-default"
              onClick={() => setAssessmentSubjectOpen(null)}
              tabIndex={-1}
            />
            <div
              className="fixed z-[10001] rounded-xl bg-white py-1.5"
              style={{
                left,
                top: Math.max(8, top),
                width,
                boxShadow: "0 10px 24px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.08)",
                fontFamily: "var(--font-inter)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAssessmentSubject(assessmentSubjectOpen, "");
                  setAssessmentSubjectOpen(null);
                }}
                className="flex h-9 w-full items-center gap-2 px-3 text-left text-[13px] font-medium text-[var(--base-600)] hover:bg-[var(--base-100)] cursor-pointer"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--base-300)]" />
                None
              </button>
              {selectedSubjects.map((s) => {
                const colors = getSubjectColor(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setAssessmentSubject(assessmentSubjectOpen, s);
                      setAssessmentSubjectOpen(null);
                    }}
                    className="flex h-9 w-full items-center gap-2 px-3 text-left text-[13px] font-semibold hover:bg-[var(--base-100)] cursor-pointer"
                    style={{ color: colors.text }}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colors.dot }} />
                    <span className="min-w-0 truncate">{SUBJECT_LABELS[s] ?? s}</span>
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        );
      })()}
      {open && activePicker === "start" && (
        <TimePickerPopup
          value={startMinutes}
          onChange={mins => { handleStartChange(mins); setActivePicker(null); setTimeInputVal(""); }}
          onClose={() => { setActivePicker(null); setTimeInputVal(""); }}
          triggerRef={startInputRef}
          highlightMinutes={liveMinutes}
        />
      )}
      {open && activePicker === "end" && (
        <TimePickerPopup
          value={endMinutes}
          onChange={mins => { handleEndChange(mins); setActivePicker(null); setTimeInputVal(""); }}
          onClose={() => { setActivePicker(null); setTimeInputVal(""); }}
          triggerRef={endInputRef}
          startMinutes={startMinutes}
          minValue={startMinutes + 15}
          highlightMinutes={liveMinutes}
        />
      )}

      <RecurringActionDialog
        open={recurringDialog !== null}
        mode={recurringDialog === "delete" ? "delete" : "edit"}
        onClose={() => setRecurringDialog(null)}
        onConfirm={(scope) => void handleRecurringConfirm(scope)}
      />
    </>
  );
}
