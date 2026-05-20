import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  type ExamPlanAnswers,
  type ExamPlanContext,
  generateExamPlanDraft,
} from "@/lib/planner/exam-plan-engine";

/** POST /api/planner/exam-plan/draft */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    plan_run_id?: string;
    answers?: ExamPlanAnswers;
  };
  if (!body.plan_run_id || !body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "plan_run_id and answers are required" }, { status: 400 });
  }

  const { data: run, error: runError } = await supabase
    .from("exam_plan_runs")
    .select("id, status, context_snapshot")
    .eq("id", body.plan_run_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });
  if (!run) return NextResponse.json({ error: "Plan run not found" }, { status: 404 });
  if (run.status === "committed") {
    return NextResponse.json({ error: "Plan has already been committed" }, { status: 409 });
  }

  try {
    const context = run.context_snapshot as ExamPlanContext;
    const draft = await generateExamPlanDraft(context, body.answers);
    const { error: updateError } = await supabase
      .from("exam_plan_runs")
      .update({
        status: "drafted",
        question_answers: body.answers,
        draft_events: draft.events,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.plan_run_id)
      .eq("user_id", user.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({
      plan_run_id: body.plan_run_id,
      summary: draft.summary,
      events: draft.events,
      used_fallback: draft.usedFallback,
    });
  } catch (err) {
    console.error("[exam-plan/draft] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not draft exam plan" },
      { status: 500 }
    );
  }
}
