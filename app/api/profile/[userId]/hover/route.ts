import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  addDaysUtc,
  currentStreakFromDates,
  mergeActiveStudyDatesFromRows,
} from "@/lib/analytics-active-dates";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid profile id" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const { data: raw, error } = await admin.rpc("get_profile_hover_card", {
    p_user_id: userId,
    p_viewer_id: viewer?.id ?? null,
  });

  if (error) {
    console.error("[profile/hover] rpc", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }

  if (raw == null) {
    return NextResponse.json({ hover: null });
  }

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const activeAttemptSince = addDaysUtc(now, -180).toISOString();

  const [dailyRes, attemptRes] = await Promise.all([
    admin
      .from("user_daily_activity")
      .select("activity_date, questions_answered")
      .eq("user_id", userId)
      .order("activity_date", { ascending: false })
      .limit(400),
    admin
      .from("study_attempts")
      .select("attempted_at")
      .eq("user_id", userId)
      .not("is_correct", "is", null)
      .gte("attempted_at", activeAttemptSince),
  ]);

  const activeDates = mergeActiveStudyDatesFromRows(
    (dailyRes.data ?? []) as { activity_date: string; questions_answered?: number | null }[],
    attemptRes.data ?? []
  );
  const current_streak = currentStreakFromDates(activeDates, todayKey);

  const hover = { ...(raw as Record<string, unknown>), current_streak };
  return NextResponse.json({ hover });
}
