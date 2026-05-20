import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function isoDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Consecutive active days ending today (or yesterday when today has no activity yet).
 * A day counts as "active" if the user sent ≥1 tutor message OR answered ≥1 study
 * question OR had a user_daily_activity row with questions_answered > 0.
 */
function computeStreak(activeDates: Set<string>, todayKey: string): number {
  let streak = 0;
  const cursor = new Date(`${todayKey}T12:00:00.000Z`);
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (activeDates.has(key)) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else if (i === 0) {
      // Today has no activity yet — don't break on the first iteration;
      // check yesterday so the streak doesn't reset at midnight.
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayKey = isoDateKey(now.toISOString());
  const since = addDaysUtc(now, -365).toISOString();
  const sinceDateKey = isoDateKey(since);

  const [sessionsRes, studyAttemptsRes, dailyActivityRes] = await Promise.all([
    supabase
      .from("tutor_sessions")
      .select("id, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since),
    supabase
      .from("study_attempts")
      .select("attempted_at")
      .eq("user_id", user.id)
      .not("is_correct", "is", null)
      .gte("attempted_at", since),
    supabase
      .from("user_daily_activity")
      .select("activity_date, questions_answered")
      .eq("user_id", user.id)
      .gte("activity_date", sinceDateKey),
  ]);

  const activeDates = new Set<string>();

  // Study feed attempts
  for (const row of studyAttemptsRes.data ?? []) {
    const at = row.attempted_at as string;
    if (at) activeDates.add(isoDateKey(at));
  }

  // Daily activity rollup (study feed sessions)
  for (const row of dailyActivityRes.data ?? []) {
    if ((row.questions_answered ?? 0) > 0) {
      activeDates.add(row.activity_date as string);
    }
  }

  // Tutor messages — fetch messages for user's sessions (batch up to 500)
  const sessionIds = (sessionsRes.data ?? []).map((s) => s.id as string).slice(0, 500);
  if (sessionIds.length > 0) {
    const msgsRes = await supabase
      .from("tutor_messages")
      .select("created_at")
      .in("session_id", sessionIds)
      .eq("role", "user")
      .gte("created_at", since);

    for (const msg of msgsRes.data ?? []) {
      const at = msg.created_at as string;
      if (at) activeDates.add(isoDateKey(at));
    }
  }

  const streak = computeStreak(activeDates, todayKey);

  // Build last-7-days active map (Mon–Sun of current week, ending today)
  // We show the current calendar week: Monday through Sunday
  const todayDate = new Date(`${todayKey}T12:00:00.000Z`);
  const dayOfWeek = todayDate.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const mondayOffset = (dayOfWeek + 6) % 7; // days since Monday
  const monday = addDaysUtc(todayDate, -mondayOffset);

  const weekDays: { date: string; label: string; active: boolean; is_today: boolean }[] = [];
  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
  for (let i = 0; i < 7; i++) {
    const d = addDaysUtc(monday, i);
    const key = isoDateKey(d.toISOString());
    weekDays.push({
      date: key,
      label: DAY_LABELS[i],
      active: activeDates.has(key),
      is_today: key === todayKey,
    });
  }

  return NextResponse.json({ streak, today: todayKey, week: weekDays });
}
