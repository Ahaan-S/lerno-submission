import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getChapterLimitForSubject } from "@/lib/chapters";
import { buildLearnProgressSubjectKey } from "@/lib/learn-progress";
import { resolveSubjectSlug } from "@/lib/tutor-subject";

/** POST /api/learn/diagnostic/complete
 * Saves diagnostic results and updates chapter_learn_progress. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    subject: string;
    chapter_index: number;
    chapter_name: string;
    grade?: number;
    topic_results: { topic_index: string; topic_name: string; correct: number; total: number }[];
    skipped?: boolean;
  };

  const normalizedSubject = resolveSubjectSlug(body.subject);
  const { chapter_index, chapter_name, grade = 10, topic_results, skipped = false } = body;
  const subject = normalizedSubject;
  if (!subject || chapter_index == null) {
    return NextResponse.json({ error: "subject, chapter_index required" }, { status: 400 });
  }
  const chapterLimit = getChapterLimitForSubject(grade, subject);
  if (chapterLimit != null && Number(chapter_index) > chapterLimit) {
    return NextResponse.json({ error: `Chapter ${chapter_index} is not available for this subject yet` }, { status: 400 });
  }

  const admin = createAdminClient() ?? supabase;
  const progressSubjectKey = buildLearnProgressSubjectKey(grade, subject);

  // Build diagnostic_score keyed by topic_index
  const diagnosticScore: Record<string, number> = {};

  if (!skipped && topic_results?.length > 0) {
    for (const t of topic_results) {
      diagnosticScore[t.topic_index] = t.total > 0 ? t.correct / t.total : 0;
    }
  }

  const now = new Date().toISOString();

  // Create the learn session now (after diagnostic, not before)
  const { data: newSession, error: sessionError } = await admin
    .from("tutor_sessions")
    .insert({
      user_id: user.id,
      subject,
      chapter_name,
      chapter_index: String(chapter_index),
      title: `Chapter ${chapter_index}: ${chapter_name}`,
      mode: "learn",
      grade,
    })
    .select("id")
    .single();

  if (sessionError || !newSession) {
    console.error("[diagnostic/complete] Failed to create session:", sessionError);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  await admin
    .from("chapter_learn_progress")
    .upsert(
      {
        user_id: user.id,
        subject: progressSubjectKey,
        chapter_index,
        chapter_name,
        status: "diagnostic_done",
        diagnostic_completed: true,
        diagnostic_score: skipped ? {} : diagnosticScore,
        last_session_id: newSession.id,
        last_session_at: now,
        started_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,subject,chapter_index" }
    );

  return NextResponse.json({ ok: true, session_id: newSession.id, diagnostic_score: diagnosticScore });
}
