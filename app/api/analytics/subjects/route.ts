import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SUBJECT_LABELS } from "@/lib/chapters";
import {
  chapterLearnProgressQuerySubjectKeys,
  chapterLearnProgressSubjectLabels,
  curriculumChapterCount,
  topicProgressRowMatchesSubject,
} from "@/lib/analytics-subject-mapping";

export const dynamic = "force-dynamic";

function parseGrade(param: string | null): number {
  const n = Number(param ?? "10");
  if (Number.isNaN(n) || n < 1 || n > 12) return 10;
  return n;
}

function parseForSubjects(param: string | null): string[] | null {
  if (!param?.trim()) return null;
  const slugs = param
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return slugs.length ? slugs : null;
}

function accuracyPct(quizCorrect: number | null | undefined, quizAttempts: number | null | undefined): number {
  const a = quizAttempts ?? 0;
  const c = quizCorrect ?? 0;
  if (a <= 0) return 0;
  return Math.round((c / a) * 100);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const subjectSlug = (searchParams.get("subject") ?? "science").toLowerCase().trim();
  const grade = parseGrade(searchParams.get("grade"));
  const forSubjectSlugs = parseForSubjects(searchParams.get("for_subjects"));
  const [chaptersRes, topicsRes] = await Promise.all([
    supabase.from("chapter_learn_progress").select("subject, status").eq("user_id", user.id),
    supabase
      .from("student_topic_progress")
      .select("subject, topic_name, quiz_attempts, quiz_correct, mastery_level")
      .eq("user_id", user.id),
  ]);

  if (chaptersRes.error) {
    console.error("[analytics/subjects] chapter_learn_progress", chaptersRes.error);
    return NextResponse.json({ error: "Failed to load chapters" }, { status: 500 });
  }
  if (topicsRes.error) {
    console.error("[analytics/subjects] student_topic_progress", topicsRes.error);
    return NextResponse.json({ error: "Failed to load topics" }, { status: 500 });
  }

  const chaptersByLabel = new Map<string, { total: number; completed: number }>();
  for (const row of chaptersRes.data ?? []) {
    const subj = row.subject as string;
    const cur = chaptersByLabel.get(subj) ?? { total: 0, completed: 0 };
    cur.total += 1;
    if (row.status === "completed") cur.completed += 1;
    chaptersByLabel.set(subj, cur);
  }

  let subject_completion: {
    label: string;
    completed: number;
    total: number;
    pct: number;
  }[] = [];

  if (forSubjectSlugs && forSubjectSlugs.length > 0) {
    subject_completion = forSubjectSlugs.map((slug) => {
      const display = SUBJECT_LABELS[slug] ?? slug;
      const subjectKeySet = new Set(chapterLearnProgressQuerySubjectKeys(grade, slug));
      let completed = 0;
      let rowsForSubject = 0;
      for (const row of chaptersRes.data ?? []) {
        if (!subjectKeySet.has(row.subject as string)) continue;
        rowsForSubject += 1;
        if (row.status === "completed") completed += 1;
      }
      const curriculumTotal = curriculumChapterCount(grade, slug);
      const total =
        curriculumTotal > 0 ? curriculumTotal : Math.max(rowsForSubject, completed, 1);
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { label: display, completed, total, pct };
    });
  } else {
    for (const [label, agg] of chaptersByLabel) {
      const pct = agg.total > 0 ? Math.round((agg.completed / agg.total) * 100) : 0;
      subject_completion.push({
        label,
        completed: agg.completed,
        total: agg.total,
        pct,
      });
    }
    subject_completion.sort((a, b) => a.label.localeCompare(b.label));
  }

  const topics = topicsRes.data ?? [];

  const strong = topics
    .filter(
      (t) =>
        t.mastery_level === "strong" &&
        (t.quiz_attempts ?? 0) >= 5 &&
        (t.topic_name ?? "").length > 0,
    )
    .map((t) => ({
      topic_name: t.topic_name as string,
      subject: t.subject as string,
      quiz_attempts: t.quiz_attempts ?? 0,
      accuracy: accuracyPct(t.quiz_correct, t.quiz_attempts),
    }))
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 6);

  const weak = topics
    .filter(
      (t) =>
        t.mastery_level === "weak" &&
        (t.quiz_attempts ?? 0) >= 3 &&
        (t.topic_name ?? "").length > 0,
    )
    .map((t) => ({
      topic_name: t.topic_name as string,
      subject: t.subject as string,
      quiz_attempts: t.quiz_attempts ?? 0,
      accuracy: accuracyPct(t.quiz_correct, t.quiz_attempts),
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 6);

  const mistakeCandidates = topics
    .filter(
      (t) =>
        topicProgressRowMatchesSubject(t.subject as string, grade, subjectSlug) &&
        (t.quiz_attempts ?? 0) >= 3 &&
        (t.topic_name ?? "").length > 0,
    )
    .map((t) => {
      const attempts = t.quiz_attempts ?? 0;
      const correct = t.quiz_correct ?? 0;
      return {
        topic_name: t.topic_name as string,
        subject: t.subject as string,
        quiz_attempts: attempts,
        accuracy: accuracyPct(t.quiz_correct, t.quiz_attempts),
        mistake_count: Math.max(0, attempts - correct),
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.mistake_count - a.mistake_count)
    .slice(0, 3);

  return NextResponse.json({
    subject_completion,
    strong_chapters: strong,
    weak_chapters: weak,
    mistake_topics: mistakeCandidates,
    selected_subject_slug: subjectSlug,
    chapter_subjects_for_selection: chapterLearnProgressSubjectLabels(subjectSlug),
  });
}
