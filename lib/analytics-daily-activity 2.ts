import { createAdminClient } from "@/utils/supabase/admin";

function parseProfileGrade(raw: unknown): number {
  if (typeof raw === "number" && raw >= 1 && raw <= 12) return raw;
  if (typeof raw === "string") {
    if (raw.startsWith("Class ")) {
      const n = parseInt(raw.replace("Class ", ""), 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;
    }
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;
  }
  return 10;
}

/**
 * Increment rolled-up daily stats after a study feed session ends (service role).
 * Safe to fire-and-forget; logs warnings on failure.
 */
export async function upsertDailyActivityAfterSession(options: {
  userId: string;
  timeActiveSecs: number | null;
  feedSessionId: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[analytics-daily-activity] Admin client unavailable — skip daily rollup");
    return;
  }

  const { userId, timeActiveSecs, feedSessionId } = options;

  const [{ count: answered }, { count: correct }, profileRes, sessionEndRes] = await Promise.all([
    admin
      .from("study_attempts")
      .select("id", { count: "exact", head: true })
      .eq("feed_session_id", feedSessionId)
      .eq("interaction_type", "answered")
      .not("is_correct", "is", null),
    admin
      .from("study_attempts")
      .select("id", { count: "exact", head: true })
      .eq("feed_session_id", feedSessionId)
      .eq("interaction_type", "answered")
      .eq("is_correct", true),
    admin.from("profiles").select("grade").eq("id", userId).maybeSingle(),
    admin.from("study_feed_sessions").select("ended_at").eq("id", feedSessionId).maybeSingle(),
  ]);

  const stats = {
    questions_answered: answered ?? 0,
    questions_correct: correct ?? 0,
  };

  const grade = parseProfileGrade(profileRes.data?.grade);

  const endedAt = sessionEndRes.data?.ended_at as string | null | undefined;
  const activityDate = endedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const addMinutes = Math.round((timeActiveSecs ?? 0) / 60);

  const { data: existing, error: fetchErr } = await admin
    .from("user_daily_activity")
    .select("questions_answered, questions_correct, minutes_active, sessions_count")
    .eq("user_id", userId)
    .eq("activity_date", activityDate)
    .maybeSingle();

  if (fetchErr) {
    console.warn("[analytics-daily-activity] fetch existing:", fetchErr.message);
    return;
  }

  const row = existing as {
    questions_answered: number;
    questions_correct: number;
    minutes_active: number;
    sessions_count: number;
  } | null;

  const payload = {
    user_id: userId,
    activity_date: activityDate,
    grade,
    questions_answered: (row?.questions_answered ?? 0) + stats.questions_answered,
    questions_correct: (row?.questions_correct ?? 0) + stats.questions_correct,
    minutes_active: (row?.minutes_active ?? 0) + addMinutes,
    sessions_count: (row?.sessions_count ?? 0) + 1,
  };

  const { error: upsertErr } = await admin.from("user_daily_activity").upsert(payload, {
    onConflict: "user_id,activity_date",
  });

  if (upsertErr) {
    console.warn("[analytics-daily-activity] upsert:", upsertErr.message);
  } else {
    console.log("[analytics-daily-activity] upserted | date:", activityDate, "| +answered:", stats.questions_answered);
  }
}
