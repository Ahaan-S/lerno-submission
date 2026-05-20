import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

/** PATCH /api/planner/backlog/[id] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as {
    completed?: boolean;
    priority?: "low" | "medium" | "high";
    title?: string;
  };

  const undoingCompletion = body.completed === false;
  const { data: existingBeforeUpdate } = undoingCompletion
    ? await supabase
        .from("study_backlog")
        .select("completed, completed_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const updates: Record<string, unknown> = { ...body };
  if (body.completed) {
    updates.completed_at = new Date().toISOString();
  } else if (body.completed === false) {
    updates.completed_at = null;
  }

  const { data, error } = await supabase
    .from("study_backlog")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // On complete: increment backlog_reduced in daily_study_stats
  if (body.completed) {
    const today = new Date().toISOString().slice(0, 10);
    const adminClient = createAdminClient();
    if (adminClient) {
      void adminClient
        .from("daily_study_stats")
        .select("backlog_reduced, total_minutes, subjects_covered, events_completed")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle()
        .then(({ data: stats }) => {
          return adminClient.from("daily_study_stats").upsert(
            {
              user_id: user.id,
              date: today,
              backlog_reduced: (stats?.backlog_reduced ?? 0) + 1,
              total_minutes: stats?.total_minutes ?? 0,
              subjects_covered: stats?.subjects_covered ?? [],
              events_completed: stats?.events_completed ?? 0,
            },
            { onConflict: "user_id,date" }
          );
        });
    }
  }

  if (undoingCompletion && existingBeforeUpdate?.completed && existingBeforeUpdate.completed_at) {
    const statsDate = new Date(existingBeforeUpdate.completed_at).toISOString().slice(0, 10);
    const adminClient = createAdminClient();
    if (adminClient) {
      void adminClient
        .from("daily_study_stats")
        .select("backlog_reduced, total_minutes, subjects_covered, events_completed")
        .eq("user_id", user.id)
        .eq("date", statsDate)
        .maybeSingle()
        .then(({ data: stats }) => {
          if (!stats) return null;
          return adminClient.from("daily_study_stats").upsert(
            {
              user_id: user.id,
              date: statsDate,
              backlog_reduced: Math.max(0, (stats.backlog_reduced ?? 0) - 1),
              total_minutes: stats.total_minutes ?? 0,
              subjects_covered: stats.subjects_covered ?? [],
              events_completed: stats.events_completed ?? 0,
            },
            { onConflict: "user_id,date" }
          );
        });
    }
  }

  return NextResponse.json({ item: data });
}

/** DELETE /api/planner/backlog/[id] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from("study_backlog")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
