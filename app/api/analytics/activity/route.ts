import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type Range = "week" | "month";

function parseRange(param: string | null): Range {
  return param === "month" ? "month" : "week";
}

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

function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function dateKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoDateKey(iso: string): string {
  return iso.slice(0, 10);
}

type TBucket = "morning" | "afternoon" | "evening" | "night";

function hourToBucket(h: number): TBucket {
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18 && h < 21) return "evening";
  return "night";
}

const BUCKET_LABEL: Record<TBucket, string> = {
  morning: "Morning (6 AM – 12 PM)",
  afternoon: "Afternoon (12 – 6 PM)",
  evening: "Evening (6 – 9 PM)",
  night: "Night (9 PM – 6 AM)",
};

/** When a session was never closed, approximate minutes per scored attempt for time-of-day. */
const FALLBACK_ATTEMPT_MINUTES = 2;
const MAX_ATTEMPT_MINUTES_CAP = 45;

function attemptMinutes(timeTakenSecs: number | null | undefined): number {
  if (timeTakenSecs != null && timeTakenSecs > 0) {
    return Math.min(MAX_ATTEMPT_MINUTES_CAP, Math.max(1, Math.round(timeTakenSecs / 60)));
  }
  return FALLBACK_ATTEMPT_MINUTES;
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
  parseGrade(searchParams.get("grade")); // reserved for future grade-scoped daily rows
  const range = parseRange(searchParams.get("range"));
  const days = range === "month" ? 30 : 7;

  const MAX_TUTOR_SESSION_MINUTES = 120;

  const now = new Date();
  const startDay = addDaysUtc(now, -(days - 1));
  startDay.setUTCHours(0, 0, 0, 0);
  const startKey = dateKeyUtc(startDay);
  const thirtyDaysAgoIso = addDaysUtc(now, -30).toISOString();
  const attemptsFetchStartIso = addDaysUtc(now, -120).toISOString();
  // Fetch tutor sessions for the full time range needed (series + time-of-day)
  const tutorSessionsFetchStart = addDaysUtc(now, -120).toISOString();

  const [dailyRes, sessionsRes, practiceAttemptsRes, tutorSessionsRes] = await Promise.all([
    supabase
      .from("user_daily_activity")
      .select("activity_date, questions_answered, minutes_active")
      .eq("user_id", user.id)
      .gte("activity_date", startKey)
      .order("activity_date", { ascending: true }),
    supabase
      .from("study_feed_sessions")
      .select("id, time_active_secs, started_at")
      .eq("user_id", user.id)
      .not("ended_at", "is", null)
      .gte("ended_at", thirtyDaysAgoIso),
    supabase
      .from("study_attempts")
      .select("feed_session_id, attempted_at, time_taken_secs")
      .eq("user_id", user.id)
      .not("is_correct", "is", null)
      .gte("attempted_at", attemptsFetchStartIso),
    supabase
      .from("tutor_sessions")
      .select("id, created_at, last_message_at")
      .eq("user_id", user.id)
      .gte("created_at", tutorSessionsFetchStart),
  ]);

  if (dailyRes.error) {
    console.error("[analytics/activity] user_daily_activity", dailyRes.error);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
  if (sessionsRes.error) {
    console.error("[analytics/activity] study_feed_sessions", sessionsRes.error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
  if (practiceAttemptsRes.error) {
    console.error("[analytics/activity] study_attempts", practiceAttemptsRes.error);
    return NextResponse.json({ error: "Failed to load attempts" }, { status: 500 });
  }
  if (tutorSessionsRes.error) {
    console.warn("[analytics/activity] tutor_sessions fetch error:", tutorSessionsRes.error.message);
    // Non-fatal — continue without tutor minutes
  }

  const practiceAttempts = practiceAttemptsRes.data ?? [];

  // --- AI Tutor minutes by date ---
  // Estimate duration as (last_message_at - created_at), capped at MAX_TUTOR_SESSION_MINUTES.
  // Sessions with no messages sent (last_message_at == created_at) contribute 0.
  const tutorMinutesByDate = new Map<string, number>();
  const tutorMinutesByBucket: Record<TBucket, number> = {
    morning: 0, afternoon: 0, evening: 0, night: 0,
  };
  for (const s of tutorSessionsRes.data ?? []) {
    const createdAt = s.created_at as string | null;
    const lastMsgAt = s.last_message_at as string | null;
    if (!createdAt || !lastMsgAt) continue;
    const durationMs = Date.parse(lastMsgAt) - Date.parse(createdAt);
    if (durationMs <= 0) continue;
    const mins = Math.min(MAX_TUTOR_SESSION_MINUTES, Math.round(durationMs / 60_000));
    if (mins <= 0) continue;
    const dayKey = isoDateKey(createdAt);
    tutorMinutesByDate.set(dayKey, (tutorMinutesByDate.get(dayKey) ?? 0) + mins);
    // Attribute to time-of-day bucket based on session start hour
    const h = new Date(createdAt).getUTCHours();
    tutorMinutesByBucket[hourToBucket(h)] += mins;
  }

  const questionsByUtcDate = new Map<string, number>();
  for (const row of practiceAttempts) {
    const at = row.attempted_at as string;
    if (!at) continue;
    const key = isoDateKey(at);
    questionsByUtcDate.set(key, (questionsByUtcDate.get(key) ?? 0) + 1);
  }

  const byDate = new Map<string, { questions: number; minutes: number }>();
  for (const row of dailyRes.data ?? []) {
    const key = row.activity_date as string;
    byDate.set(key, {
      questions: row.questions_answered ?? 0,
      minutes: row.minutes_active ?? 0,
    });
  }

  const series: { date: string; questions: number; minutes: number; label: string }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDaysUtc(startDay, i);
    const key = dateKeyUtc(d);
    const entry = byDate.get(key) ?? { questions: 0, minutes: 0 };
    const qFromAttempts = questionsByUtcDate.get(key) ?? 0;
    const tutorMins = tutorMinutesByDate.get(key) ?? 0;
    const dow = d.getUTCDay();
    const label = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow];
    series.push({
      date: key,
      questions: qFromAttempts,
      minutes: entry.minutes + tutorMins,
      label,
    });
  }

  // Time-of-day: closed sessions → full tracked minutes in bucket of first attempt (or start)
  const sessionMinutes = new Map<string, number>();
  for (const s of sessionsRes.data ?? []) {
    const secs = s.time_active_secs;
    if (secs == null || secs <= 0) continue;
    sessionMinutes.set(s.id as string, Math.round(secs / 60));
  }

  const closedSessionIds = new Set(
    (sessionsRes.data ?? []).map((s) => s.id as string).filter(Boolean),
  );

  const firstAttemptBySession = new Map<string, string>();
  for (const a of practiceAttempts) {
    const sid = a.feed_session_id as string | null;
    if (!sid) continue;
    const at = a.attempted_at as string;
    if (!at) continue;
    const prev = firstAttemptBySession.get(sid);
    if (!prev || at < prev) firstAttemptBySession.set(sid, at);
  }

  const buckets: Record<TBucket, number> = {
    morning: tutorMinutesByBucket.morning,
    afternoon: tutorMinutesByBucket.afternoon,
    evening: tutorMinutesByBucket.evening,
    night: tutorMinutesByBucket.night,
  };

  for (const s of sessionsRes.data ?? []) {
    const id = s.id as string;
    const mins = sessionMinutes.get(id);
    if (mins == null) continue;
    const anchorIso = firstAttemptBySession.get(id) ?? (s.started_at as string);
    const h = new Date(anchorIso).getUTCHours();
    buckets[hourToBucket(h)] += mins;
  }

  // Open / unaggregated sessions: add per-attempt time so charts work when session/end wasn't called
  const thirtyMs = Date.parse(thirtyDaysAgoIso);
  for (const a of practiceAttempts) {
    const at = a.attempted_at as string;
    if (!at || Date.parse(at) < thirtyMs) continue;
    const sid = a.feed_session_id as string | null;
    if (sid && closedSessionIds.has(sid)) continue;
    const h = new Date(at).getUTCHours();
    buckets[hourToBucket(h)] += attemptMinutes(a.time_taken_secs as number | null | undefined);
  }

  let peakKey: TBucket = "morning";
  let peakVal = -1;
  (Object.keys(buckets) as TBucket[]).forEach((k) => {
    if (buckets[k] > peakVal) {
      peakVal = buckets[k];
      peakKey = k;
    }
  });
  const peak = peakVal <= 0 ? "Evening (6 – 9 PM)" : BUCKET_LABEL[peakKey];

  const weekStart = startOfWeekMondayUtc(now);
  const weekStartKey = dateKeyUtc(weekStart);
  const prevWeekStart = addDaysUtc(weekStart, -7);
  const prevWeekStartKey = dateKeyUtc(prevWeekStart);

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthStartKey = dateKeyUtc(monthStart);
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const prevMonthStartKey = dateKeyUtc(prevMonthStart);
  const prevMonthEndKey = dateKeyUtc(prevMonthEnd);

  const todayKey = dateKeyUtc(now);
  const lastWeekEnd = addDaysUtc(weekStart, -1);
  const lastWeekEndKey = dateKeyUtc(lastWeekEnd);

  const countAttemptsBetween = (fromKey: string, toKey: string) => {
    let sum = 0;
    for (const row of practiceAttempts) {
      const at = row.attempted_at as string;
      if (!at) continue;
      const d = isoDateKey(at);
      if (d >= fromKey && d <= toKey) sum += 1;
    }
    return sum;
  };

  const thisWeekQ = countAttemptsBetween(weekStartKey, todayKey);
  const lastWeekQ = countAttemptsBetween(prevWeekStartKey, lastWeekEndKey);
  const thisMonthQ = countAttemptsBetween(monthStartKey, todayKey);
  const lastMonthQ = countAttemptsBetween(prevMonthStartKey, prevMonthEndKey);

  const pctDelta = (cur: number, prev: number) => {
    if (prev <= 0) return cur > 0 ? 1 : 0;
    return (cur - prev) / prev;
  };

  return NextResponse.json({
    range,
    series,
    time_of_day: {
      morning: buckets.morning,
      afternoon: buckets.afternoon,
      evening: buckets.evening,
      night: buckets.night,
      peak,
    },
    period_totals: {
      this_week_questions: thisWeekQ,
      last_week_questions: lastWeekQ,
      week_delta_pct: pctDelta(thisWeekQ, lastWeekQ),
      this_month_questions: thisMonthQ,
      last_month_questions: lastMonthQ,
      month_delta_pct: pctDelta(thisMonthQ, lastMonthQ),
    },
  });
}
