import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const MAX_STUDY_FEED_SECS = 8 * 60 * 60;
const MAX_TUTOR_SESSION_SECS = 4 * 60 * 60;

function durationSecs(startIso: string, endIso: string | null, cap: number): number | null {
  if (!startIso || !endIso) return null;
  const delta = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(delta) || delta <= 0) return null;
  return Math.min(Math.round(delta / 1000), cap);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [studyFeedResult, tutorResult] = await Promise.all([
    supabase
      .from("study_feed_sessions")
      .select("time_active_secs, started_at, ended_at")
      .eq("user_id", user.id)
      .not("ended_at", "is", null),
    supabase
      .from("tutor_sessions")
      .select("created_at, last_message_at")
      .eq("user_id", user.id)
      .not("last_message_at", "is", null),
  ]);

  if (studyFeedResult.error) {
    console.error("[analytics/sessions] study_feed_sessions", studyFeedResult.error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
  if (tutorResult.error) {
    console.error("[analytics/sessions] tutor_sessions", tutorResult.error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }

  let sum = 0;
  let n = 0;
  let lt15 = 0;
  let min15_30 = 0;
  let min30_60 = 0;
  let gt60 = 0;

  function tally(secs: number | null) {
    if (secs == null || secs <= 0) return;
    sum += secs;
    n += 1;
    if (secs < 900) lt15 += 1;
    else if (secs < 1800) min15_30 += 1;
    else if (secs < 3600) min30_60 += 1;
    else gt60 += 1;
  }

  for (const r of studyFeedResult.data ?? []) {
    const tracked = (r as { time_active_secs: number | null }).time_active_secs;
    if (tracked != null && tracked > 0) {
      tally(Math.min(tracked, MAX_STUDY_FEED_SECS));
    } else {
      tally(durationSecs(
        (r as { started_at: string }).started_at,
        (r as { ended_at: string | null }).ended_at,
        MAX_STUDY_FEED_SECS,
      ));
    }
  }

  for (const r of tutorResult.data ?? []) {
    tally(durationSecs(
      (r as { created_at: string }).created_at,
      (r as { last_message_at: string | null }).last_message_at,
      MAX_TUTOR_SESSION_SECS,
    ));
  }

  const avgSeconds = n > 0 ? Math.round(sum / n) : 0;
  const avgMinutes = Math.round(avgSeconds / 60);

  return NextResponse.json({
    avg_session_minutes: avgMinutes,
    avg_session_seconds: avgSeconds,
    distribution: { lt15, min15_30, min30_60, gt60, total: n },
  });
}
