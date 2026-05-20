import { createAdminClient } from "@/utils/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChapterListFromQdrant } from "@/lib/ai/qdrant";
import { getChapterLimitForSubject, SUBJECT_LABELS, CHAPTER_DATA_11, CHAPTER_DATA_10, CHAPTER_DATA_9 } from "@/lib/chapters";
import { getNcertBookFromTutorSubject, resolveSubjectSlug } from "@/lib/tutor-subject";
import { getLearnProgressReadKeys } from "@/lib/learn-progress";
import type { ChapterEntry } from "@/components/learn/ChapterStatusList";

interface ProgressRow {
  chapter_index: number;
  chapter_name: string;
  status: string;
  diagnostic_completed: boolean;
  current_topic_index: string | null;
  topics_completed: unknown;
  last_session_at: string | null;
  last_session_id: string | null;
}

/** Returns the ordered chapter name list from static curriculum data (grade 10 or 9 fallback). */
function getStaticChapterList(grade: number, subjectSlug: string): { chapter_index: string; chapter_name: string }[] {
  const gradeData = grade === 11 ? CHAPTER_DATA_11 : grade === 10 ? CHAPTER_DATA_10 : CHAPTER_DATA_9;
  const sections = gradeData[subjectSlug] ?? [];
  const items: { chapter_index: string; chapter_name: string }[] = [];
  let i = 1;
  for (const section of sections) {
    for (const name of section.items) {
      items.push({ chapter_index: String(i), chapter_name: name });
      i++;
    }
  }
  return items;
}

/**
 * Shared data loader for Learn subject page + GET /api/learn/recommendation.
 * Avoids server-side HTTP fetch to another host (localhost vs app.localhost), which drops auth cookies.
 */
export async function loadLearnRecommendation(
  supabase: SupabaseClient,
  userId: string,
  subjectSlug: string,
  grade: number
): Promise<{
  chapters: ChapterEntry[];
  recommended_chapter_index: number | null;
  recommendation_message: string;
}> {
  const admin = createAdminClient() ?? supabase;
  const slug = resolveSubjectSlug(subjectSlug);
  const subjectLabel = SUBJECT_LABELS[slug] ?? subjectSlug;
  const progressKeys = getLearnProgressReadKeys(grade, slug);
  const chapterLimit = getChapterLimitForSubject(grade, slug);

  // For SST sub-subjects (social_history etc.), scope Qdrant to the specific book
  const qdrantBook = getNcertBookFromTutorSubject(slug) ?? null;

  // Build static chapter list first (synchronous, zero latency).
  // If static data exists, skip the Qdrant scroll entirely — Qdrant chapter names
  // are near-identical to static names and the scroll can take 1–5s on large collections.
  const staticChaptersEarly = getStaticChapterList(grade, slug).filter((c) =>
    chapterLimit != null ? Number(c.chapter_index) <= chapterLimit : true
  );

  const [chaptersFromQdrant, progressRows] = await Promise.all([
    staticChaptersEarly.length > 0
      ? Promise.resolve([] as { chapter_index: string; chapter_name: string }[])
      : getChapterListFromQdrant(grade, slug, qdrantBook),
    admin
      .from("chapter_learn_progress")
      .select(
        "chapter_index, chapter_name, status, diagnostic_completed, current_topic_index, topics_completed, last_session_at, last_session_id"
      )
      .eq("user_id", userId)
      .in("subject", progressKeys),
  ]);

  const progressMap = new Map<number, ProgressRow>();
  for (const row of (progressRows.data ?? []) as ProgressRow[]) {
    progressMap.set(Number(row.chapter_index), row);
  }

  // Build authoritative chapter index from Qdrant, falling back to static curriculum data,
  // then filling in any gaps from progress rows so nothing is ever hidden.
  const staticChapters = staticChaptersEarly;

  // Qdrant chapters keyed by index (most authoritative for chapter names)
  const qdrantMap = new Map<string, string>();
  for (const c of chaptersFromQdrant) {
    qdrantMap.set(String(c.chapter_index), c.chapter_name);
  }

  // Merge: prefer Qdrant name, fall back to static, then progress row
  const seenIndices = new Set<number>();
  const allChapterDefs: { chapter_index: number; chapter_name: string }[] = [];

  // Walk static list in order (guarantees correct curriculum order)
  for (const sc of staticChapters) {
    const idx = Number(sc.chapter_index);
    const name = qdrantMap.get(sc.chapter_index) ?? sc.chapter_name;
    allChapterDefs.push({ chapter_index: idx, chapter_name: name });
    seenIndices.add(idx);
  }

  // Add any extra chapters from Qdrant not in static list (e.g. a new chapter)
  for (const c of chaptersFromQdrant) {
    const idx = Number(c.chapter_index);
    if (chapterLimit != null && idx > chapterLimit) continue;
    if (!seenIndices.has(idx)) {
      allChapterDefs.push({ chapter_index: idx, chapter_name: c.chapter_name });
      seenIndices.add(idx);
    }
  }

  // Add any chapters from progress rows not yet in the list
  for (const row of (progressRows.data ?? []) as ProgressRow[]) {
    const idx = Number(row.chapter_index);
    if (chapterLimit != null && idx > chapterLimit) continue;
    if (!seenIndices.has(idx)) {
      allChapterDefs.push({ chapter_index: idx, chapter_name: row.chapter_name });
      seenIndices.add(idx);
    }
  }

  allChapterDefs.sort((a, b) => a.chapter_index - b.chapter_index);

  const merged: ChapterEntry[] = allChapterDefs.map(({ chapter_index, chapter_name }) => {
    const prog = progressMap.get(chapter_index);
    return {
      chapter_index,
      chapter_name,
      status: (prog?.status ?? "not_started") as ChapterEntry["status"],
      diagnostic_completed: prog?.diagnostic_completed ?? false,
      current_topic_index: prog?.current_topic_index ?? null,
      topics_completed: (prog?.topics_completed as string[] | null) ?? [],
      last_session_at: prog?.last_session_at ?? null,
      last_session_id: prog?.last_session_id ?? null,
    };
  });

  const recommended =
    merged.find((c) => c.status === "in_progress") ??
    merged.find((c) => c.status === "diagnostic_done") ??
    merged.find((c) => c.status === "not_started") ??
    merged[0] ??
    null;

  const completedCount = merged.filter((c) => c.status === "completed").length;
  const totalCount = merged.length;
  const inProgressChapter = merged.find((c) => c.status === "in_progress");

  let recommendation_message: string;
  if (inProgressChapter) {
    const topicLine = inProgressChapter.current_topic_index
      ? ` You were on Topic ${inProgressChapter.current_topic_index} — we'll pick up right from there.`
      : " Your tutor will pick up right where you left off.";
    recommendation_message = `You're in the middle of Chapter ${inProgressChapter.chapter_index}: ${inProgressChapter.chapter_name}.${topicLine} Continue below when you're ready.`;
  } else if (completedCount > 0 && recommended) {
    recommendation_message = `You've completed ${completedCount} of ${totalCount} chapters in ${subjectLabel}. Up next is Chapter ${recommended.chapter_index}: ${recommended.chapter_name}. Your tutor will walk you through it step by step.`;
  } else if (recommended) {
    recommendation_message = `Let's start with Chapter ${recommended.chapter_index}: ${recommended.chapter_name}. Your tutor will guide you through each topic, check your understanding along the way, and adjust the pace to suit you.`;
  } else {
    recommendation_message = `Choose a chapter below to begin. Your tutor will take it from there and guide you through each topic at your own pace.`;
  }

  return {
    chapters: merged,
    recommended_chapter_index: recommended?.chapter_index ?? null,
    recommendation_message,
  };
}
