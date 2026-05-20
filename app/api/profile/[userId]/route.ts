import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  addDaysUtc,
  currentStreakFromDates,
  mergeActiveStudyDatesFromRows,
} from "@/lib/analytics-active-dates";
import { getProfileRelationship } from "@/lib/profile-viewer-relationship";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublicProfileRpcRow = {
  id: string;
  is_visible?: boolean;
  visibility?: string;
  display_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  grade?: string | null;
  joined_at?: string | null;
  stats?: {
    total_questions?: number;
    total_minutes?: number;
    active_days?: number;
    chapters_completed?: number;
  };
  recent_chapters?: unknown[];
  friends_count?: number;
};

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
    console.error("[profile] missing service role");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const viewerId = viewer?.id ?? null;

  const { data: raw, error } = await admin.rpc("get_public_profile", {
    p_profile_user_id: userId,
    p_viewer_id: viewerId,
  });

  if (error) {
    console.error("[profile] get_public_profile", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  if (raw == null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = raw as PublicProfileRpcRow;

  if (row.is_visible === false) {
    const relationship = await getProfileRelationship(supabase, viewerId, userId);
    let incoming_request_id: string | null = null;
    let outgoing_request_id: string | null = null;
    if (viewerId && viewerId !== userId && admin) {
      if (relationship === "pending_incoming") {
        const { data: inc } = await admin
          .from("friend_requests")
          .select("id")
          .eq("sender_id", userId)
          .eq("recipient_id", viewerId)
          .eq("status", "pending")
          .maybeSingle();
        incoming_request_id = inc?.id ?? null;
      } else if (relationship === "pending_outgoing") {
        const { data: out } = await admin
          .from("friend_requests")
          .select("id")
          .eq("sender_id", viewerId)
          .eq("recipient_id", userId)
          .eq("status", "pending")
          .maybeSingle();
        outgoing_request_id = out?.id ?? null;
      }
    }
    return NextResponse.json({
      profile: {
        id: row.id,
        is_visible: false,
        visibility: row.visibility ?? "private",
        display_name: row.display_name ?? null,
        avatar_url: row.avatar_url ?? null,
        grade: row.grade ?? null,
      },
      relationship,
      relationship_meta: { incoming_request_id, outgoing_request_id },
    });
  }

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const activeAttemptSince = addDaysUtc(now, -180).toISOString();

  const [dailyRes, attemptRes, topicsRes] = await Promise.all([
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
    admin
      .from("student_topic_progress")
      .select("subject, topic_name, mastery_level")
      .eq("user_id", userId)
      .eq("mastery_level", "strong")
      .order("last_practiced_at", { ascending: false })
      .limit(8),
  ]);

  if (dailyRes.error) {
    console.error("[profile] user_daily_activity", dailyRes.error);
  }
  if (attemptRes.error) {
    console.error("[profile] study_attempts streak", attemptRes.error);
  }
  if (topicsRes.error) {
    console.error("[profile] student_topic_progress", topicsRes.error);
  }

  const activeDates = mergeActiveStudyDatesFromRows(
    (dailyRes.data ?? []) as { activity_date: string; questions_answered?: number | null }[],
    attemptRes.data ?? []
  );
  const current_streak = currentStreakFromDates(activeDates, todayKey);
  const active_study_days = activeDates.size;

  const stats = {
    ...(row.stats ?? {}),
    active_study_days,
    current_streak,
  };

  const strong_topics = (topicsRes.data ?? []).map((t) => ({
    subject: t.subject,
    topic_name: t.topic_name,
  }));

  const relationship = await getProfileRelationship(supabase, viewerId, userId);

  let incoming_request_id: string | null = null;
  let outgoing_request_id: string | null = null;
  if (viewerId && viewerId !== userId) {
    if (relationship === "pending_incoming") {
      const { data: inc } = await admin
        .from("friend_requests")
        .select("id")
        .eq("sender_id", userId)
        .eq("recipient_id", viewerId)
        .eq("status", "pending")
        .maybeSingle();
      incoming_request_id = inc?.id ?? null;
    } else if (relationship === "pending_outgoing") {
      const { data: out } = await admin
        .from("friend_requests")
        .select("id")
        .eq("sender_id", viewerId)
        .eq("recipient_id", userId)
        .eq("status", "pending")
        .maybeSingle();
      outgoing_request_id = out?.id ?? null;
    }
  }

  return NextResponse.json({
    profile: {
      ...row,
      stats,
      strong_topics,
    },
    relationship,
    relationship_meta: { incoming_request_id, outgoing_request_id },
  });
}
