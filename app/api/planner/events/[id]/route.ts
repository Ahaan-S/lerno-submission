import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { addMinutes } from "date-fns";

/** PATCH /api/planner/events/[id] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as {
    title?: string;
    subject?: string;
    chapter_index?: number;
    chapter_name?: string;
    topic?: string;
    related_exam?: string;
    difficulty?: "easy" | "medium" | "hard";
    notes?: string;
    start_time?: string;
    duration_minutes?: number;
    status?: "scheduled" | "completed" | "skipped" | "in_progress";
    color?: string;
    is_task?: boolean;
  };

  // Fetch all fields we might need in one round-trip (avoids a second SELECT for timing recompute)
  const { data: existingRow, error: existingErr } = await supabase
    .from("study_events")
    .select("status, completed_at, duration_minutes, subject, is_task, start_time")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
  if (!existingRow) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const effectiveIsTask =
    body.is_task !== undefined ? body.is_task !== false : (existingRow as { is_task?: boolean }).is_task !== false;

  if (body.status === "completed" && !effectiveIsTask) {
    return NextResponse.json(
      { error: "Calendar-only events cannot be marked complete" },
      { status: 400 }
    );
  }

  const undoingCompletion = body.status !== undefined && body.status !== "completed";
  const existingBeforeUpdate = undoingCompletion
    ? {
        status: existingRow.status as string,
        completed_at: existingRow.completed_at as string | null,
        duration_minutes: existingRow.duration_minutes as number,
        subject: existingRow.subject as string,
      }
    : null;

  const clearingTaskWhileCompleted =
    body.is_task === false &&
    (existingRow as { is_task?: boolean }).is_task !== false &&
    existingRow.status === "completed" &&
    existingRow.completed_at;

  const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };

  if (clearingTaskWhileCompleted) {
    updates.status = "scheduled";
    updates.completed_at = null;
  }

  if (body.status === "completed" && !("completed_at" in updates)) {
    updates.completed_at = new Date().toISOString();
  } else if (body.status && body.status !== "completed") {
    updates.completed_at = null;
  }

  // Recompute end_time if start_time or duration changes — use existingRow (already fetched above)
  if (body.start_time && body.duration_minutes) {
    updates.end_time = addMinutes(new Date(body.start_time), body.duration_minutes).toISOString();
  } else if (body.start_time || body.duration_minutes) {
    const newStart = body.start_time ?? (existingRow as { start_time: string }).start_time;
    const newDuration = body.duration_minutes ?? existingRow.duration_minutes;
    updates.end_time = addMinutes(new Date(newStart), newDuration).toISOString();
  }

  const { data, error } = await supabase
    .from("study_events")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (clearingTaskWhileCompleted && existingRow.completed_at) {
    const statsDate = new Date(existingRow.completed_at as string).toISOString().slice(0, 10);
    const adminClient = createAdminClient();
    if (adminClient) {
      void (async () => {
        try {
          const { data: stats } = await adminClient
            .from("daily_study_stats")
            .select("total_minutes, subjects_covered, events_completed, backlog_reduced")
            .eq("user_id", user.id)
            .eq("date", statsDate)
            .maybeSingle();
          if (!stats) return;
          await adminClient.from("daily_study_stats").upsert(
            {
              user_id: user.id,
              date: statsDate,
              total_minutes: Math.max(0, (stats.total_minutes ?? 0) - (existingRow.duration_minutes ?? 0)),
              events_completed: Math.max(0, (stats.events_completed ?? 0) - 1),
              subjects_covered: stats.subjects_covered ?? [],
              backlog_reduced: stats.backlog_reduced ?? 0,
            },
            { onConflict: "user_id,date" }
          );
        } catch (e) {
          console.error("[planner/events PATCH] undo stats after is_task=false failed", e);
        }
      })();
    }
  }

  const completedRow = data as { is_task?: boolean; duration_minutes: number; subject: string; topic?: string | null; title: string };
  if (body.status === "completed" && completedRow.is_task !== false) {
    const today = new Date().toISOString().slice(0, 10);
    const adminClient = createAdminClient();
    if (adminClient) {
      const row = completedRow;

      void (async () => {
        try {
          const { data: stats } = await adminClient
            .from("daily_study_stats")
            .select("total_minutes, subjects_covered, events_completed, backlog_reduced")
            .eq("user_id", user.id)
            .eq("date", today)
            .maybeSingle();
          const prevMinutes = stats?.total_minutes ?? 0;
          const prevCompleted = stats?.events_completed ?? 0;
          const prevSubjects = (stats?.subjects_covered as string[]) ?? [];
          const subj = row.subject;
          const mergedSubjects = prevSubjects.includes(subj) ? prevSubjects : [...prevSubjects, subj];
          await adminClient.from("daily_study_stats").upsert(
            {
              user_id: user.id,
              date: today,
              total_minutes: prevMinutes + row.duration_minutes,
              events_completed: prevCompleted + 1,
              subjects_covered: mergedSubjects,
              backlog_reduced: stats?.backlog_reduced ?? 0,
            },
            { onConflict: "user_id,date" }
          );
        } catch (e) {
          console.error("[planner/events PATCH] daily_study_stats update failed", e);
        }
      })();

      void (async () => {
        try {
          const topicLabel = row.topic?.trim() || row.title?.trim() || `${row.subject} study`;
          const { data: mem } = await adminClient
            .from("student_ai_memory")
            .select("recently_discussed_topics")
            .eq("user_id", user.id)
            .eq("subject", row.subject)
            .maybeSingle();
          const existing: string[] = (mem?.recently_discussed_topics as string[]) ?? [];
          const updated = [topicLabel, ...existing.filter((t) => t !== topicLabel)].slice(0, 10);
          await adminClient.from("student_ai_memory").upsert(
            { user_id: user.id, subject: row.subject, recently_discussed_topics: updated },
            { onConflict: "user_id,subject" }
          );
        } catch {
          /* ignore */
        }
      })();
    }
  } else if (
    undoingCompletion &&
    existingBeforeUpdate?.status === "completed" &&
    existingBeforeUpdate.completed_at
  ) {
    const statsDate = new Date(existingBeforeUpdate.completed_at).toISOString().slice(0, 10);
    const adminClient = createAdminClient();
    if (adminClient) {
      void (async () => {
        try {
          const { data: stats } = await adminClient
            .from("daily_study_stats")
            .select("total_minutes, subjects_covered, events_completed, backlog_reduced")
            .eq("user_id", user.id)
            .eq("date", statsDate)
            .maybeSingle();
          if (!stats) return;
          await adminClient.from("daily_study_stats").upsert(
            {
              user_id: user.id,
              date: statsDate,
              total_minutes: Math.max(0, (stats.total_minutes ?? 0) - (existingBeforeUpdate.duration_minutes ?? 0)),
              events_completed: Math.max(0, (stats.events_completed ?? 0) - 1),
              subjects_covered: stats.subjects_covered ?? [],
              backlog_reduced: stats.backlog_reduced ?? 0,
            },
            { onConflict: "user_id,date" }
          );
        } catch (e) {
          console.error("[planner/events PATCH] undo stats update failed", e);
        }
      })();
    }
  }

  return NextResponse.json({ event: data });
}

/** DELETE /api/planner/events/[id]
 *  Query params for recurring scope:
 *  ?scope=following&group_id=xxx&from_time=ISO  — delete this + all future in series
 *  ?scope=all&group_id=xxx                       — delete entire series
 *  (no params / scope=this)                      — delete just this event
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope"); // "this" | "following" | "all"
  const groupId = searchParams.get("group_id");
  const fromTime = searchParams.get("from_time");

  if (scope === "all" && groupId) {
    const { error } = await supabase
      .from("study_events")
      .delete()
      .eq("recurrence_group_id", groupId)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (scope === "following" && groupId && fromTime) {
    const { error } = await supabase
      .from("study_events")
      .delete()
      .eq("recurrence_group_id", groupId)
      .eq("user_id", user.id)
      .gte("start_time", fromTime);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Default: delete just this event
  const { error } = await supabase
    .from("study_events")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
