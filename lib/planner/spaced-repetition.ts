import type { StudyEvent, SubjectUrgency } from "./types";

interface ChapterProgressRow {
  subject: string;
  status: string;
  topics_completed?: string[];
  last_session_at?: string | null;
}

interface TopicProgressRow {
  subject: string;
  mastery_level?: string | number | null;
  last_practiced_at?: string | null;
}

function subjectKey(s: string): string {
  return s.trim().toLowerCase();
}

/** mastery_level in DB is text: not_started | learning | weak | strong (see quiz-result route). */
function isWeakTopic(t: TopicProgressRow): boolean {
  const ml = t.mastery_level;
  if (typeof ml === "number") return ml < 0.5;
  const s = String(ml ?? "").toLowerCase();
  return s === "weak" || s === "learning";
}

export function computeSubjectUrgency(
  chaptersProgress: ChapterProgressRow[],
  topicProgress: TopicProgressRow[],
  recentEvents: StudyEvent[],
  seedSubjects: string[] = []
): SubjectUrgency[] {
  const now = Date.now();

  const subjectSet = new Set<string>();
  chaptersProgress.forEach((c) => subjectSet.add(subjectKey(c.subject)));
  topicProgress.forEach((t) => subjectSet.add(subjectKey(t.subject)));
  recentEvents.forEach((e) => subjectSet.add(subjectKey(e.subject)));
  seedSubjects.forEach((s) => subjectSet.add(subjectKey(s)));

  return Array.from(subjectSet).map((subject) => {
    const subjectEvents = recentEvents
      .filter((e) => subjectKey(e.subject) === subject && e.status === "completed")
      .map((e) => new Date(e.start_time).getTime());

    const chapterTimes = chaptersProgress
      .filter((c) => subjectKey(c.subject) === subject && c.last_session_at)
      .map((c) => new Date(c.last_session_at!).getTime());

    const topicTimes = topicProgress
      .filter((t) => subjectKey(t.subject) === subject && t.last_practiced_at)
      .map((t) => new Date(t.last_practiced_at!).getTime());

    const lastStudiedMs = Math.max(0, ...subjectEvents, ...chapterTimes, ...topicTimes);
    const daysSinceStudied = lastStudiedMs
      ? Math.floor((now - lastStudiedMs) / 86_400_000)
      : 14;

    const subjectTopics = topicProgress.filter((t) => subjectKey(t.subject) === subject);
    const weakTopicCount = subjectTopics.filter(isWeakTopic).length;
    const weakTopicRatio = subjectTopics.length > 0 ? weakTopicCount / subjectTopics.length : 0;

    const subjectChapters = chaptersProgress.filter((c) => subjectKey(c.subject) === subject);
    const completedCount = subjectChapters.filter((c) => c.status === "completed").length;
    const completionPct = subjectChapters.length > 0 ? completedCount / subjectChapters.length : 0;

    // Urgency score: higher = more urgent
    const normalizedDays = Math.min(daysSinceStudied / 14, 1);
    const urgencyScore =
      normalizedDays * 0.4 + weakTopicRatio * 0.4 + (1 - completionPct) * 0.2;

    return {
      subject,
      daysSinceStudied,
      weakTopicCount,
      completionPct,
      urgencyScore,
    };
  }).sort((a, b) => b.urgencyScore - a.urgencyScore);
}
