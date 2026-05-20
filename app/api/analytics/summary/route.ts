import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  chapterLearnProgressQuerySubjectKeys,
  curriculumChapterCount,
} from "@/lib/analytics-subject-mapping";
import {
  addDaysUtc,
  currentStreakFromDates,
  mergeActiveStudyDatesFromRows,
} from "@/lib/analytics-active-dates";

export const dynamic = "force-dynamic";

function parseGrade(param: string | null): number {
  const n = Number(param ?? "10");
  if (Number.isNaN(n) || n < 1 || n > 12) return 10;
  return n;
}

function startOfWeekMondayUtc(now: Date): Date {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
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
  const grade = parseGrade(searchParams.get("grade"));
  const subjectSlug = (searchParams.get("subject") ?? "science").toLowerCase().trim();
  const chapterSubjectKeys = chapterLearnProgressQuerySubjectKeys(grade, subjectSlug);
  const chaptersTotalCurriculum = curriculumChapterCount(grade, subjectSlug);

  const todayKey = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const weekStart = startOfWeekMondayUtc(now);
  const weekStartIso = weekStart.toISOString();
  const days30Ago = addDaysUtc(now, -30).toISOString();
  const days60Ago = addDaysUtc(now, -60).toISOString();

  const activeAttemptSince = addDaysUtc(now, -180).toISOString();

  const [
    chaptersRes,
    attemptsOverallRes,
    attemptsWeekRes,
    attemptsThisMonthRes,
    attemptsPrevMonthRes,
    dailyRes,
    activeAttemptDaysRes,
  ] = await Promise.all([
    supabase
      .from("chapter_learn_progress")
      .select("status")
      .eq("user_id", user.id)
      .in("subject", chapterSubjectKeys),
    supabase
      .from("study_attempts")
      .select("is_correct")
      .eq("user_id", user.id)
      .not("is_correct", "is", null),
    supabase
      .from("study_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("is_correct", "is", null)
      .gte("attempted_at", weekStartIso),
    supabase
      .from("study_attempts")
      .select("is_correct")
      .eq("user_id", user.id)
      .not("is_correct", "is", null)
      .gte("attempted_at", days30Ago),
    supabase
      .from("study_attempts")
      .select("is_correct")
      .eq("user_id", user.id)
      .not("is_correct", "is", null)
      .gte("attempted_at", days60Ago)
      .lt("attempted_at", days30Ago),
    supabase
      .from("user_daily_activity")
      .select("activity_date, questions_answered")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .limit(400),
    supabase
      .from("study_attempts")
      .select("attempted_at")
      .eq("user_id", user.id)
      .not("is_correct", "is", null)
      .gte("attempted_at", activeAttemptSince),
  ]);

  if (chaptersRes.error) {
    console.error("[analytics/summary] chapter_learn_progress", chaptersRes.error);
    return NextResponse.json({ error: "Failed to load progress" }, { status: 500 });
  }
  if (attemptsOverallRes.error) {
    console.error("[analytics/summary] study_attempts", attemptsOverallRes.error);
    return NextResponse.json({ error: "Failed to load attempts" }, { status: 500 });
  }
  if (activeAttemptDaysRes.error) {
    console.error("[analytics/summary] study_attempts active days", activeAttemptDaysRes.error);
    return NextResponse.json({ error: "Failed to load attempts" }, { status: 500 });
  }

  const chapterRows = chaptersRes.data ?? [];
  const chaptersCompleted = chapterRows.filter((r) => r.status === "completed").length;
  const chaptersTotal =
    chaptersTotalCurriculum > 0 ? chaptersTotalCurriculum : chapterRows.length;

  const allAttempts = attemptsOverallRes.data ?? [];
  const questionsAnswered = allAttempts.length;
  let correct = 0;
  for (const a of allAttempts) {
    if (a.is_correct === true) correct += 1;
  }
  const averageAccuracy = questionsAnswered > 0 ? correct / questionsAnswered : 0;

  const thisMonth = attemptsThisMonthRes.data ?? [];
  const prevMonth = attemptsPrevMonthRes.data ?? [];
  let tmC = 0,
    tmT = 0,
    pmC = 0,
    pmT = 0;
  for (const a of thisMonth) {
    if (a.is_correct === true) tmC += 1;
    tmT += 1;
  }
  for (const a of prevMonth) {
    if (a.is_correct === true) pmC += 1;
    pmT += 1;
  }
  const accThis = tmT > 0 ? tmC / tmT : 0;
  const accPrev = pmT > 0 ? pmC / pmT : 0;
  const accuracyDeltaVsLastMonth = accThis - accPrev;

  const dailyRows = dailyRes.data ?? [];
  const activeDates = mergeActiveStudyDatesFromRows(
    dailyRows as { activity_date: string; questions_answered?: number | null }[],
    activeAttemptDaysRes.data ?? []
  );
  const activeStudyDays = activeDates.size;
  const currentStreak = currentStreakFromDates(activeDates, todayKey);

  const questionsThisWeek = attemptsWeekRes.count ?? 0;

  return NextResponse.json({
    selected_subject: {
      chapters_completed: chaptersCompleted,
      chapters_total: Math.max(chaptersTotal, chaptersCompleted),
    },
    overall: {
      questions_answered: questionsAnswered,
      questions_this_week: questionsThisWeek,
      average_accuracy: averageAccuracy,
      accuracy_delta_vs_last_month: accuracyDeltaVsLastMonth,
      active_study_days: activeStudyDays,
      current_streak: currentStreak,
    },
  });
}
