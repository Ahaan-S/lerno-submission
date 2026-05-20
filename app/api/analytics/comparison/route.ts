import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thisStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const lastStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const lastEnd = thisStart;

  const thisStartIso = thisStart.toISOString();
  const lastStartIso = lastStart.toISOString();
  const lastEndIso = lastEnd.toISOString();

  const [attemptsThisRes, attemptsLastRes, chaptersThisRes, chaptersLastRes] = await Promise.all([
    supabase
      .from("study_attempts")
      .select("is_correct")
      .eq("user_id", user.id)
      .not("is_correct", "is", null)
      .gte("attempted_at", thisStartIso),
    supabase
      .from("study_attempts")
      .select("is_correct")
      .eq("user_id", user.id)
      .not("is_correct", "is", null)
      .gte("attempted_at", lastStartIso)
      .lt("attempted_at", lastEndIso),
    supabase
      .from("chapter_learn_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", thisStartIso),
    supabase
      .from("chapter_learn_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", lastStartIso)
      .lt("completed_at", lastEndIso),
  ]);

  if (attemptsThisRes.error || attemptsLastRes.error) {
    console.error("[analytics/comparison] attempts", attemptsThisRes.error ?? attemptsLastRes.error);
    return NextResponse.json({ error: "Failed to load attempts" }, { status: 500 });
  }
  if (chaptersThisRes.error || chaptersLastRes.error) {
    console.error("[analytics/comparison] chapters", chaptersThisRes.error ?? chaptersLastRes.error);
    return NextResponse.json({ error: "Failed to load chapters" }, { status: 500 });
  }

  const avgAcc = (rows: { is_correct: boolean | null }[] | null) => {
    const list = rows ?? [];
    if (list.length === 0) return 0;
    let c = 0;
    for (const r of list) {
      if (r.is_correct === true) c += 1;
    }
    return c / list.length;
  };

  const thisAttempts = attemptsThisRes.data ?? [];
  const lastAttempts = attemptsLastRes.data ?? [];

  const accuracy_this = avgAcc(thisAttempts);
  const accuracy_last = avgAcc(lastAttempts);
  const questions_this = thisAttempts.length;
  const questions_last = lastAttempts.length;
  const chapters_this = chaptersThisRes.count ?? 0;
  const chapters_last = chaptersLastRes.count ?? 0;

  const delta = (cur: number, prev: number) => {
    if (prev <= 0) return cur > 0 ? 1 : 0;
    return (cur - prev) / prev;
  };

  return NextResponse.json({
    this_term: {
      accuracy: accuracy_this,
      questions_answered: questions_this,
      chapters_completed: chapters_this,
    },
    last_term: {
      accuracy: accuracy_last,
      questions_answered: questions_last,
      chapters_completed: chapters_last,
    },
    delta_pct: {
      accuracy: delta(accuracy_this, accuracy_last),
      questions_answered: delta(questions_this, questions_last),
      chapters_completed: delta(chapters_this, chapters_last),
    },
  });
}
