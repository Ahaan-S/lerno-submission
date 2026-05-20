import { addMinutes } from "date-fns";
import { chat } from "@/lib/ai/llm";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  CHAPTER_DATA_10,
  CHAPTER_DATA_11,
  SUBJECT_LABELS,
  type Section,
} from "@/lib/chapters";
import { parseLearnProgressStoredSubject } from "@/lib/learn-progress";
import type {
  ExamPlanDraftEvent,
  ExamPlanQuestion,
  ExamPlanSummary,
  StudyEvent,
} from "@/lib/planner/types";

export type ExamPlanAnswers = Record<string, string | string[]>;

interface ChapterContext {
  chapter_index: number;
  chapter_name: string;
  status: string;
  topics_completed: string[];
  weak: boolean;
  strong: boolean;
}

interface BusyWindow {
  title: string;
  start_time: string;
  end_time: string;
  is_task?: boolean;
}

export interface ExamPlanContext {
  user_id: string;
  exam: StudyEvent;
  grade: number;
  selected_subjects: string[];
  target_subject: string;
  target_subject_label: string;
  days_until_exam: number;
  chapters: ChapterContext[];
  weak_topics: string[];
  strong_topics: string[];
  busy_windows: BusyWindow[];
  sparse_calendar: boolean;
  generated_at: string;
}

interface DraftResponse {
  summary?: Partial<ExamPlanSummary>;
  events?: Partial<ExamPlanDraftEvent>[];
}

function parseGrade(raw: unknown): number {
  const parsed =
    typeof raw === "string" && raw.startsWith("Class ")
      ? Number(raw.replace("Class ", ""))
      : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function subjectSlugFromLabel(label: string, selectedSubjects: string[]): string | null {
  const normalized = normalizeText(parseLearnProgressStoredSubject(label));
  for (const subject of selectedSubjects) {
    const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
    if (normalizeText(subjectLabel) === normalized || normalizeText(subject) === normalized) return subject;
  }
  const match = Object.entries(SUBJECT_LABELS).find(([, display]) => normalizeText(display) === normalized);
  return match?.[0] ?? null;
}

function getChaptersForSubject(grade: number, subject: string): ChapterContext[] {
  const data = grade === 11 ? CHAPTER_DATA_11 : CHAPTER_DATA_10;
  const sections: Section[] = data[subject] ?? [];
  const chapters: ChapterContext[] = [];
  let index = 1;
  for (const section of sections) {
    for (const item of section.items) {
      chapters.push({
        chapter_index: index,
        chapter_name: item,
        status: "not_started",
        topics_completed: [],
        weak: false,
        strong: false,
      });
      index += 1;
    }
  }
  return chapters;
}

function chooseTargetSubject(exam: StudyEvent, selectedSubjects: string[]): string {
  if (exam.subject?.trim()) return exam.subject;
  const title = normalizeText(`${exam.title} ${exam.related_exam ?? ""}`);
  const match = selectedSubjects.find((subject) => {
    const label = SUBJECT_LABELS[subject] ?? subject;
    return title.includes(normalizeText(label)) || title.includes(normalizeText(subject));
  });
  return match ?? selectedSubjects[0] ?? "science";
}

function applyProgressToChapters(
  chapters: ChapterContext[],
  progressRows: Record<string, unknown>[],
  selectedSubjects: string[],
  targetSubject: string
): ChapterContext[] {
  const byName = new Map(chapters.map((chapter) => [normalizeText(chapter.chapter_name), chapter]));
  for (const row of progressRows) {
    const rowSubject = typeof row.subject === "string" ? row.subject : "";
    const slug = subjectSlugFromLabel(rowSubject, selectedSubjects);
    if (slug !== targetSubject) continue;
    const chapterName = typeof row.chapter_name === "string" ? row.chapter_name : "";
    const chapter = byName.get(normalizeText(chapterName));
    if (!chapter) continue;
    chapter.status = typeof row.status === "string" ? row.status : chapter.status;
    chapter.topics_completed = Array.isArray(row.topics_completed)
      ? row.topics_completed.filter((topic): topic is string => typeof topic === "string")
      : [];
  }
  return chapters;
}

function markStrengths(
  chapters: ChapterContext[],
  weakTopics: string[],
  strongTopics: string[]
): ChapterContext[] {
  return chapters.map((chapter) => {
    const haystack = normalizeText(chapter.chapter_name);
    return {
      ...chapter,
      weak: weakTopics.some((topic) => haystack.includes(normalizeText(topic)) || normalizeText(topic).includes(haystack)),
      strong: strongTopics.some((topic) => haystack.includes(normalizeText(topic)) || normalizeText(topic).includes(haystack)),
    };
  });
}

export async function loadExamPlanContext(userId: string, examEventId: string): Promise<ExamPlanContext> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase admin client is not configured");

  const { data: exam, error: examError } = await supabase
    .from("study_events")
    .select("*")
    .eq("id", examEventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (examError) throw new Error(examError.message);
  if (!exam || exam.is_task !== false || !exam.related_exam) throw new Error("Exam event not found");

  const nowIso = new Date().toISOString();
  const examStartIso = String(exam.start_time);
  const [{ data: profile }, { data: progressRows }, { data: memoryRows }, { data: busyRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("grade, selected_subjects, weak_subjects, strong_subjects, topic_weaknesses, topic_strengths")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("chapter_learn_progress")
        .select("subject, chapter_index, chapter_name, status, topics_completed, last_session_at")
        .eq("user_id", userId),
      supabase
        .from("student_ai_memory")
        .select("subject, weak_topics, strong_topics, struggle_patterns, learning_pace, preferred_style")
        .eq("user_id", userId),
      supabase
        .from("study_events")
        .select("title, start_time, end_time, is_task")
        .eq("user_id", userId)
        .gte("end_time", nowIso)
        .lte("start_time", examStartIso)
        .order("start_time", { ascending: true }),
    ]);

  const grade = parseGrade((profile as Record<string, unknown> | null)?.grade);
  const profileSubjects = (profile as Record<string, unknown> | null)?.selected_subjects;
  const selectedSubjects = Array.isArray(profileSubjects) && profileSubjects.length
    ? profileSubjects.filter((subject): subject is string => typeof subject === "string")
    : ["science", "math", "social"];
  const targetSubject = chooseTargetSubject(exam as StudyEvent, selectedSubjects);
  const targetSubjectLabel = SUBJECT_LABELS[targetSubject] ?? targetSubject;

  const memoryForSubject = (memoryRows ?? []).filter((row: Record<string, unknown>) => {
    const subject = typeof row.subject === "string" ? row.subject : "";
    return subject === targetSubject || normalizeText(subject) === normalizeText(targetSubjectLabel);
  });
  const weakTopics = memoryForSubject.flatMap((row: Record<string, unknown>) =>
    Array.isArray(row.weak_topics) ? row.weak_topics.filter((topic): topic is string => typeof topic === "string") : []
  );
  const strongTopics = memoryForSubject.flatMap((row: Record<string, unknown>) =>
    Array.isArray(row.strong_topics) ? row.strong_topics.filter((topic): topic is string => typeof topic === "string") : []
  );

  const baseChapters = getChaptersForSubject(grade, targetSubject);
  const chaptersWithProgress = applyProgressToChapters(
    baseChapters,
    (progressRows ?? []) as Record<string, unknown>[],
    selectedSubjects,
    targetSubject
  );
  const chapters = markStrengths(chaptersWithProgress, weakTopics, strongTopics);
  const daysUntilExam = Math.max(
    0,
    Math.ceil((new Date(examStartIso).getTime() - Date.now()) / 86_400_000)
  );
  const busyWindows = (busyRows ?? [])
    .filter((row: Record<string, unknown>) => String(row.title) !== String(exam.title))
    .map((row: Record<string, unknown>) => ({
      title: String(row.title ?? "Busy"),
      start_time: String(row.start_time),
      end_time: String(row.end_time),
      is_task: row.is_task !== false,
    }));

  return {
    user_id: userId,
    exam: exam as StudyEvent,
    grade,
    selected_subjects: selectedSubjects,
    target_subject: targetSubject,
    target_subject_label: targetSubjectLabel,
    days_until_exam: daysUntilExam,
    chapters,
    weak_topics: [...new Set(weakTopics)].slice(0, 20),
    strong_topics: [...new Set(strongTopics)].slice(0, 20),
    busy_windows: busyWindows,
    sparse_calendar: busyWindows.length <= Math.max(1, Math.floor(daysUntilExam / 5)),
    generated_at: new Date().toISOString(),
  };
}

export function buildExamPlanQuestions(context: ExamPlanContext): ExamPlanQuestion[] {
  const weakChapters = context.chapters.filter((chapter) => chapter.weak).slice(0, 4);
  const incomplete = context.chapters.filter((chapter) => chapter.status !== "completed").slice(0, 6);
  const questions: ExamPlanQuestion[] = [
    {
      id: "weekday_availability",
      type: "single_choice",
      title: "On normal school days, how much exam study time can you realistically give?",
      required: true,
      options: [
        { id: "normal_weekdays", label: "1-2 hours", description: "Good default for steady prep after school/classes." },
        { id: "light_weekdays", label: "45-60 minutes", description: "Use this if weekdays are already packed." },
        { id: "strong_weekdays", label: "2-3 hours", description: "Use this if you can do a serious weekday push." },
        { id: "busy_weekdays", label: "Almost none", description: "The plan will lean more on weekends and buffers." },
        { id: "custom", label: "Custom timing", description: "Type exact availability here." },
      ],
    },
    {
      id: "weekend_availability",
      type: "single_choice",
      title: "What about weekends or holidays before this exam?",
      required: true,
      options: [
        { id: "weekend_2_3h", label: "2-3 hours/day", description: "Balanced weekend load with breaks." },
        { id: "weekend_1h", label: "Around 1 hour/day", description: "Keeps the plan lighter." },
        { id: "weekend_3_4h", label: "3-4 hours/day", description: "A focused but still manageable weekend plan." },
        { id: "weekend_4h", label: "4+ hours/day", description: "For urgent prep with longer revision blocks." },
      ],
    },
    {
      id: "fixed_obligations",
      type: "short_text",
      title: "Any fixed obligations Lerno should avoid?",
      helper: "Example: school 8-2, tuition Mon/Wed 5-7, football Saturday morning.",
    },
    {
      id: "study_intensity",
      type: "single_choice",
      title: "How intense should the plan feel?",
      required: true,
      options: [
        { id: "balanced", label: "Balanced", description: "Steady work, revision, and breathing room." },
        { id: "catch_up", label: "Catch-up mode", description: "More study blocks because the exam is close or prep is behind." },
        { id: "high_confidence", label: "Polish mode", description: "Mostly revision, practice, and mistake cleanup." },
        { id: "light", label: "Light", description: "Lower pressure, fewer blocks." },
      ],
    },
  ];

  if (weakChapters.length > 0) {
    questions.push({
      id: "weak_chapter_priority",
      type: "multi_choice",
      title: "Which weak chapters should get extra attention?",
      options: weakChapters.map((chapter) => ({
        id: chapter.chapter_name,
        label: chapter.chapter_name,
      })),
    });
  }

  if (incomplete.length > 0) {
    questions.push({
      id: "completed_or_skipped",
      type: "short_text",
      title: "Anything already done or not coming in the exam?",
      helper: `Mention chapters to skip or reduce. Examples from ${context.target_subject_label}: ${incomplete.map((c) => c.chapter_name).join(", ")}.`,
    });
  }

  return questions.slice(0, 6);
}

function extractJsonObject(text: string): DraftResponse | null {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as DraftResponse;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as DraftResponse;
    } catch {
      return null;
    }
  }
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function hasConflict(start: Date, durationMinutes: number, busy: BusyWindow[], draft: ExamPlanDraftEvent[]): boolean {
  const end = addMinutes(start, durationMinutes);
  return [...busy, ...draft.map((event) => ({
    title: event.title,
    start_time: event.start_time,
    end_time: addMinutes(new Date(event.start_time), event.duration_minutes).toISOString(),
  }))].some((window) => rangesOverlap(start, end, new Date(window.start_time), new Date(window.end_time)));
}

function validateDraftEvents(
  context: ExamPlanContext,
  proposed: Partial<ExamPlanDraftEvent>[] | undefined
): ExamPlanDraftEvent[] {
  const now = new Date();
  const examStart = new Date(context.exam.start_time);
  const allowedSubjects = new Set([context.target_subject, ...context.selected_subjects]);
  const out: ExamPlanDraftEvent[] = [];

  for (const event of proposed ?? []) {
    if (!event.title || !event.start_time || !event.duration_minutes) continue;
    const start = new Date(event.start_time);
    if (Number.isNaN(start.getTime())) continue;
    const duration = Math.round(Number(event.duration_minutes));
    if (duration < 30 || duration > 180) continue;
    const end = addMinutes(start, duration);
    if (start <= now || end > examStart) continue;
    const subject = typeof event.subject === "string" && allowedSubjects.has(event.subject)
      ? event.subject
      : context.target_subject;
    if (hasConflict(start, duration, context.busy_windows, out)) continue;
    out.push({
      title: String(event.title).slice(0, 90),
      subject,
      chapter_index: typeof event.chapter_index === "number" ? event.chapter_index : null,
      chapter_name: typeof event.chapter_name === "string" ? event.chapter_name.slice(0, 120) : null,
      topic: typeof event.topic === "string" ? event.topic.slice(0, 120) : null,
      difficulty: event.difficulty === "easy" || event.difficulty === "medium" || event.difficulty === "hard" ? event.difficulty : null,
      notes: typeof event.notes === "string" ? event.notes.slice(0, 500) : null,
      start_time: start.toISOString(),
      duration_minutes: duration,
    });
    if (out.length >= 90) break;
  }

  return out.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

function dailyMinutes(answers: ExamPlanAnswers, date: Date): number {
  const weekday = date.getDay() !== 0 && date.getDay() !== 6;
  const intensity = answers.study_intensity;
  const weekdayAnswer = answers.weekday_availability;
  const weekendAnswer = answers.weekend_availability;
  let minutes = weekday
    ? weekdayAnswer === "busy_weekdays" ? 0 : weekdayAnswer === "light_weekdays" ? 60 : weekdayAnswer === "strong_weekdays" ? 150 : 90
    : weekendAnswer === "weekend_4h" ? 240 : weekendAnswer === "weekend_3_4h" ? 210 : weekendAnswer === "weekend_1h" ? 60 : 150;
  if (intensity === "catch_up") minutes = Math.round(minutes * 1.25);
  if (intensity === "light") minutes = Math.round(minutes * 0.7);
  if (intensity === "high_confidence") minutes = Math.round(minutes * 0.9);
  return Math.max(0, Math.min(240, minutes));
}

function findSlot(context: ExamPlanContext, draft: ExamPlanDraftEvent[], day: Date, duration: number): Date | null {
  const starts = day.getDay() === 0 || day.getDay() === 6 ? [10, 12, 15, 17, 19] : [17, 18, 19, 20, 21];
  for (const hour of starts) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    if (start <= new Date()) continue;
    if (addMinutes(start, duration) > new Date(context.exam.start_time)) continue;
    if (!hasConflict(start, duration, context.busy_windows, draft)) return start;
  }
  return null;
}

function fallbackDraft(context: ExamPlanContext, answers: ExamPlanAnswers): ExamPlanDraftEvent[] {
  const draft: ExamPlanDraftEvent[] = [];
  const examStart = new Date(context.exam.start_time);
  const chapters = [
    ...context.chapters.filter((chapter) => chapter.weak || chapter.status !== "completed"),
    ...context.chapters.filter((chapter) => chapter.status === "completed"),
  ];
  const fallbackChapter = chapters[0] ?? {
    chapter_index: 1,
    chapter_name: context.target_subject_label,
    status: "not_started",
    topics_completed: [],
    weak: false,
    strong: false,
  };
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + (cursor.getHours() >= 20 ? 1 : 0));
  cursor.setHours(0, 0, 0, 0);
  let chapterIndex = 0;

  while (cursor < examStart && draft.length < 60) {
    const minutes = dailyMinutes(answers, cursor);
    if (minutes > 0) {
      const daysLeft = Math.ceil((examStart.getTime() - cursor.getTime()) / 86_400_000);
      const duration = Math.min(120, Math.max(45, minutes));
      const slot = findSlot(context, draft, cursor, duration);
      if (slot) {
        const chapter = chapters[chapterIndex % Math.max(1, chapters.length)] ?? fallbackChapter;
        const phase = daysLeft <= 3 ? "Practice" : daysLeft <= 6 ? "Revise" : chapter.status === "completed" ? "Review" : "Study";
        draft.push({
          title: `${phase} ${chapter.chapter_name}`,
          subject: context.target_subject,
          chapter_index: chapter.chapter_index,
          chapter_name: chapter.chapter_name,
          topic: daysLeft <= 3 ? "Exam questions and weak areas" : null,
          difficulty: chapter.weak ? "hard" : "medium",
          notes: daysLeft <= 3
            ? "Focus on timed questions, mistakes, and a quick formula/concept recap."
            : "Cover the core concepts first, then mark doubts for revision.",
          start_time: slot.toISOString(),
          duration_minutes: duration,
        });
        chapterIndex += 1;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return draft;
}

function summarizeDraft(context: ExamPlanContext, events: ExamPlanDraftEvent[], aiSummary?: Partial<ExamPlanSummary>): ExamPlanSummary {
  const totalMinutes = events.reduce((sum, event) => sum + event.duration_minutes, 0);
  const weakCount = events.filter((event) => event.difficulty === "hard").length;
  return {
    headline: aiSummary?.headline || `${context.target_subject_label} plan until ${new Date(context.exam.start_time).toLocaleDateString()}`,
    total_blocks: events.length,
    total_minutes: totalMinutes,
    focus_notes: Array.isArray(aiSummary?.focus_notes) && aiSummary?.focus_notes.length
      ? aiSummary.focus_notes.slice(0, 4).map(String)
      : [
          `${Math.round(totalMinutes / 60)} hours planned across ${events.length} blocks.`,
          weakCount > 0 ? `${weakCount} blocks focus on weak or high-priority areas.` : "Revision and practice are spread across the remaining days.",
          "Existing calendar events are avoided.",
        ],
  };
}

export async function generateExamPlanDraft(
  context: ExamPlanContext,
  answers: ExamPlanAnswers
): Promise<{ summary: ExamPlanSummary; events: ExamPlanDraftEvent[]; usedFallback: boolean }> {
  const prompt = `
Create a realistic exam study calendar for this student. Return JSON only.

Rules:
- Schedule only before the exam start.
- Avoid every busy window.
- Use the target subject unless a block is genuinely about a linked prerequisite.
- Increase study/revision/practice closer to exam date, but keep breaks realistic.
- Include revision and question practice, not only chapter reading.
- Keep blocks 30-180 minutes.
- Do not create more than 3 study blocks on one day.

Context:
${JSON.stringify(context)}

Student answers:
${JSON.stringify(answers)}

Return shape:
{
  "summary": { "headline": string, "focus_notes": string[] },
  "events": [
    {
      "title": string,
      "subject": string,
      "chapter_index": number | null,
      "chapter_name": string | null,
      "topic": string | null,
      "difficulty": "easy" | "medium" | "hard" | null,
      "notes": string | null,
      "start_time": ISO string,
      "duration_minutes": number
    }
  ]
}
`.trim();

  try {
    const response = await chat(
      [
        { role: "system", content: "You are Lerno's exam planner. Output valid JSON only. Do not teach content." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.25, maxTokens: 7000, jsonMode: true }
    );
    const parsed = extractJsonObject(response);
    const events = validateDraftEvents(context, parsed?.events);
    if (events.length > 0) {
      return { summary: summarizeDraft(context, events, parsed?.summary), events, usedFallback: false };
    }
  } catch (error) {
    console.warn("[exam-plan] AI draft failed, using fallback:", error instanceof Error ? error.message : error);
  }

  const events = validateDraftEvents(context, fallbackDraft(context, answers));
  return { summary: summarizeDraft(context, events), events, usedFallback: true };
}
