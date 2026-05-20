import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildExamPlanQuestions, loadExamPlanContext } from "@/lib/planner/exam-plan-engine";

/** POST /api/planner/exam-plan/start */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { exam_event_id?: string };
  if (!body.exam_event_id) {
    return NextResponse.json({ error: "exam_event_id is required" }, { status: 400 });
  }

  try {
    const context = await loadExamPlanContext(user.id, body.exam_event_id);
    const questions = buildExamPlanQuestions(context);
    const { data, error } = await supabase
      .from("exam_plan_runs")
      .insert({
        user_id: user.id,
        exam_event_id: body.exam_event_id,
        status: "questioning",
        context_snapshot: context,
        question_answers: {},
        draft_events: [],
      })
      .select("id, status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      plan_run_id: data.id,
      status: data.status,
      questions,
      context: {
        exam: context.exam,
        grade: context.grade,
        target_subject: context.target_subject,
        target_subject_label: context.target_subject_label,
        days_until_exam: context.days_until_exam,
        chapter_count: context.chapters.length,
        weak_topic_count: context.weak_topics.length,
        busy_window_count: context.busy_windows.length,
        sparse_calendar: context.sparse_calendar,
      },
    });
  } catch (err) {
    console.error("[exam-plan/start] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start exam plan" },
      { status: 500 }
    );
  }
}
