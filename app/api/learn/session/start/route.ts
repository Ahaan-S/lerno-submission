import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getChapterLimitForSubject } from "@/lib/chapters";
import { buildLearnProgressSubjectKey, getLearnProgressReadKeys } from "@/lib/learn-progress";
import { resolveSubjectSlug } from "@/lib/tutor-subject";

/** POST /api/learn/session/start
 * Creates (or returns existing) a Learn Mode tutor_session for a chapter.
 * Also upserts chapter_learn_progress if it doesn't exist. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    subject: string;
    chapter_index: number;
    chapter_name: string;
    grade?: number;
  };

  const { subject: rawSubject, chapter_index, chapter_name, grade = 10 } = body;
  if (!rawSubject || chapter_index == null || !chapter_name) {
    return NextResponse.json({ error: "subject, chapter_index, chapter_name required" }, { status: 400 });
  }

  const admin = createAdminClient() ?? supabase;
  const subject = resolveSubjectSlug(rawSubject);
  const chapterLimit = getChapterLimitForSubject(grade, subject);
  if (chapterLimit != null && Number(chapter_index) > chapterLimit) {
    return NextResponse.json({ error: `Chapter ${chapter_index} is not available for this subject yet` }, { status: 400 });
  }
  const progressSubjectKey = buildLearnProgressSubjectKey(grade, subject);
  const readProgressKeys = getLearnProgressReadKeys(grade, subject);

  // Check if there's an existing in-progress session for this chapter
  const { data: existingProgress } = await admin
    .from("chapter_learn_progress")
    .select("last_session_id, status, diagnostic_completed, current_topic_index, topics_completed")
    .eq("user_id", user.id)
    .in("subject", readProgressKeys)
    .eq("chapter_index", chapter_index)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // If there's an existing session for this chapter, always reuse it (1 chapter = 1 session)
  if (existingProgress?.last_session_id) {
    const { data: existingSession } = await admin
      .from("tutor_sessions")
      .select("id")
      .eq("id", existingProgress.last_session_id)
      .maybeSingle();

    if (existingSession) {
      return NextResponse.json({
        session_id: existingSession.id,
        is_new: false,
        diagnostic_completed: existingProgress.diagnostic_completed,
        current_topic_index: existingProgress.current_topic_index,
        topics_completed: existingProgress.topics_completed ?? [],
      });
    }
  }

  // Create a new tutor_session for this chapter
  // Store the subject SLUG (not display label) so the chat route can resolve Qdrant filters correctly
  const title = `Chapter ${chapter_index}: ${chapter_name}`;
  const { data: newSession, error: sessionError } = await admin
    .from("tutor_sessions")
    .insert({
      user_id: user.id,
      subject: subject,
      chapter_name,
      chapter_index: String(chapter_index),
      title,
      mode: "learn",
      grade,
    })
    .select("id")
    .single();

  if (sessionError || !newSession) {
    console.error("[learn/session/start] Failed to create session:", sessionError);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Upsert chapter_learn_progress
  const now = new Date().toISOString();
  await admin
    .from("chapter_learn_progress")
    .upsert(
      {
        user_id: user.id,
        subject: progressSubjectKey,
        chapter_index,
        chapter_name,
        status: existingProgress ? existingProgress.status : "not_started",
        sessions_count: (existingProgress ? 0 : 0) + 1,
        last_session_id: newSession.id,
        last_session_at: now,
        started_at: existingProgress?.status === "not_started" || !existingProgress ? now : undefined,
        updated_at: now,
      },
      { onConflict: "user_id,subject,chapter_index" }
    );

  void admin
    .from("chapter_learn_progress")
    .update({ sessions_count: (existingProgress ? 1 : 0) + 1 })
    .eq("user_id", user.id)
    .eq("subject", progressSubjectKey)
    .eq("chapter_index", chapter_index);

  return NextResponse.json({
    session_id: newSession.id,
    is_new: true,
    grade,
    diagnostic_completed: existingProgress?.diagnostic_completed ?? false,
    current_topic_index: existingProgress?.current_topic_index ?? null,
    topics_completed: (existingProgress?.topics_completed as string[] | null) ?? [],
  });
}
