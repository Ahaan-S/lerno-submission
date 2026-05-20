import { createAdminClient } from "@/utils/supabase/admin";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { computeSubjectUrgency } from "./spaced-repetition";
import type { StudyEvent, SubjectUrgency } from "./types";

const FOURTEEN_DAYS_MS = 14 * 86_400_000;

export interface ChapterProgressLite {
  subject: string;
  status: string;
  topics_completed?: string[];
  last_session_at?: string | null;
}

export interface TopicProgressLite {
  subject: string;
  mastery_level?: string | number | null;
  last_practiced_at?: string | null;
}

export interface PlannerProgressBundle {
  chapters: ChapterProgressLite[];
  topics: TopicProgressLite[];
  events14d: StudyEvent[];
  urgencies: SubjectUrgency[];
  upcomingLines: string[];
  memoryWeakLines: string[];
}

/**
 * Loads chapter progress, topic mastery, recent calendar events, weak topics from memory,
 * and upcoming scheduled events — used for AI suggestions and planner chat context.
 */
export async function loadPlannerProgressBundle(userId: string): Promise<PlannerProgressBundle | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const fourteenDaysAgo = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();
  const nowIso = new Date().toISOString();

  const [chaptersRes, topicsRes, eventsRes, memoryRes, upcomingRes] = await Promise.all([
    supabase
      .from("chapter_learn_progress")
      .select("subject, status, topics_completed, last_session_at")
      .eq("user_id", userId),
    supabase
      .from("student_topic_progress")
      .select("subject, mastery_level, last_practiced_at")
      .eq("user_id", userId),
    supabase
      .from("study_events")
      .select("*")
      .eq("user_id", userId)
      .gte("start_time", fourteenDaysAgo)
      .order("start_time", { ascending: false }),
    supabase
      .from("student_ai_memory")
      .select("subject, weak_topics")
      .eq("user_id", userId)
      .neq("subject", "__global__"),
    supabase
      .from("study_events")
      .select("start_time, end_time, subject, title, status")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .eq("is_task", true)
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(12),
  ]);

  const chapters = chaptersRes.data ?? [];
  const topics = topicsRes.data ?? [];
  const events: StudyEvent[] = (eventsRes.data ?? []) as StudyEvent[];

  const urgencies = computeSubjectUrgency(chapters, topics, events);

  const memoryRows = memoryRes.data ?? [];
  const memoryWeakLines = memoryRows
    .filter((r) => Array.isArray(r.weak_topics) && r.weak_topics.length > 0)
    .map((r) => {
      const label = SUBJECT_LABELS[r.subject] ?? r.subject;
      const topicsList = (r.weak_topics as string[]).slice(0, 5).join("; ");
      return `${label}: ${topicsList}`;
    });

  const upcoming = upcomingRes.data ?? [];
  const upcomingLines = upcoming.map((row) => {
    const label = SUBJECT_LABELS[row.subject] ?? row.subject;
    return `${row.start_time} — ${label}: ${row.title}`;
  });

  return {
    chapters,
    topics,
    events14d: events,
    urgencies,
    upcomingLines,
    memoryWeakLines,
  };
}

/** Urgency list for sidebar (all subjects) or modal (one subject, always includes a row via seed). */
export function computeUrgenciesForSuggestion(
  bundle: PlannerProgressBundle,
  focusSubject?: string
): SubjectUrgency[] {
  const seed = focusSubject?.trim().toLowerCase();
  return computeSubjectUrgency(bundle.chapters, bundle.topics, bundle.events14d, seed ? [seed] : []);
}

/** Compact text block for LLM system / user context. */
export function formatPlannerBundleForLlm(bundle: PlannerProgressBundle): string {
  const top = bundle.urgencies.slice(0, 6).map((u) => {
    const name = SUBJECT_LABELS[u.subject] ?? u.subject;
    return `- ${name}: urgency ${u.urgencyScore.toFixed(2)}, days since last activity ${u.daysSinceStudied}, weak topic rows ${u.weakTopicCount}, chapter completion ~${Math.round(u.completionPct * 100)}%`;
  });

  const parts = [
    "Computed study signals (from Supabase: chapter_learn_progress, student_topic_progress, study_events last 14 days):",
    top.length ? top.join("\n") : "- No subject rows yet; student may be new.",
  ];

  if (bundle.memoryWeakLines.length) {
    parts.push("Quiz-verified weak topics (student_ai_memory.weak_topics):");
    parts.push(bundle.memoryWeakLines.map((l) => `- ${l}`).join("\n"));
  }

  if (bundle.upcomingLines.length) {
    parts.push("Upcoming scheduled study_events:");
    parts.push(bundle.upcomingLines.map((l) => `- ${l}`).join("\n"));
  }

  return parts.join("\n\n");
}
