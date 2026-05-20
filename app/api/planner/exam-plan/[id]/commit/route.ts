import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ExamPlanDraftEvent } from "@/lib/planner/types";

/** POST /api/planner/exam-plan/[id]/commit */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: run, error: runError } = await supabase
    .from("exam_plan_runs")
    .select("id, status, exam_event_id, context_snapshot, draft_events")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });
  if (!run) return NextResponse.json({ error: "Plan run not found" }, { status: 404 });
  if (run.status === "committed") {
    return NextResponse.json({ error: "Plan has already been committed" }, { status: 409 });
  }
  if (run.status !== "drafted") {
    return NextResponse.json({ error: "Draft the plan before committing it" }, { status: 400 });
  }

  const context = run.context_snapshot as {
    exam?: { title?: string; related_exam?: string; start_time?: string };
    target_subject?: string;
  };
  const draftEvents = Array.isArray(run.draft_events)
    ? (run.draft_events as ExamPlanDraftEvent[])
    : [];

  if (draftEvents.length === 0) {
    return NextResponse.json({ error: "No draft events to commit" }, { status: 400 });
  }

  const relatedExam = context.exam?.related_exam || context.exam?.title || "Exam";
  const rows = draftEvents.map((event) => {
    const start = new Date(event.start_time);
    const end = new Date(start.getTime() + event.duration_minutes * 60_000);
    return {
      user_id: user.id,
      title: event.title,
      subject: event.subject || context.target_subject || "",
      chapter_index: event.chapter_index ?? null,
      chapter_name: event.chapter_name ?? null,
      topic: event.topic ?? null,
      related_exam: relatedExam,
      difficulty: event.difficulty ?? null,
      notes: event.notes ?? null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: event.duration_minutes,
      status: "scheduled",
      is_task: true,
      plan_run_id: id,
    };
  });

  const { data: events, error: insertError } = await supabase
    .from("study_events")
    .insert(rows)
    .select("*");

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: updateError } = await supabase
    .from("exam_plan_runs")
    .update({ status: "committed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ events: events ?? [] }, { status: 201 });
}
