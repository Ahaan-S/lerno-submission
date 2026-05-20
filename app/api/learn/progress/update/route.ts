import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getChapterLimitForSubject } from "@/lib/chapters";
import { buildLearnProgressSubjectKey, getLearnProgressReadKeys } from "@/lib/learn-progress";
import { resolveSubjectSlug } from "@/lib/tutor-subject";

/** PATCH /api/learn/progress/update
 * Updates chapter_learn_progress when the learner advances topics or completes a chapter.
 * Normalises Social Science slugs/labels so rows match kickoff, chat, and the subject hub. */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    session_id: string;
    subject: string;
    chapter_index: number;
    chapter_name: string;
    grade?: number;
    completed_topic_index?: string;
    current_topic_index?: string;
    is_chapter_complete?: boolean;
    /** When provided, replaces the entire topics_completed array instead of appending. */
    topics_completed_override?: string[];
  };

  const {
    session_id,
    subject: rawSubject,
    chapter_index,
    chapter_name,
    grade = 10,
    completed_topic_index,
    current_topic_index,
    is_chapter_complete = false,
    topics_completed_override,
  } = body;

  const slug = resolveSubjectSlug(rawSubject);
  const subjectKey = buildLearnProgressSubjectKey(grade, slug);
  const readSubjectKeys = getLearnProgressReadKeys(grade, slug);

  const trimmedCompleted = completed_topic_index?.trim() ?? "";
  const rawCurrent = (current_topic_index ?? "").trim();

  if (!rawSubject || chapter_index == null) {
    return NextResponse.json({ error: "subject and chapter_index required" }, { status: 400 });
  }
  const chapterLimit = getChapterLimitForSubject(grade, slug);
  if (chapterLimit != null && Number(chapter_index) > chapterLimit) {
    return NextResponse.json({ error: `Chapter ${chapter_index} is not available for this subject yet` }, { status: 400 });
  }

  const admin = createAdminClient() ?? supabase;
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("chapter_learn_progress")
    .select("topics_completed, current_topic_index")
    .eq("user_id", user.id)
    .in("subject", readSubjectKeys)
    .eq("chapter_index", chapter_index)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingCurrent = (existing?.current_topic_index as string | undefined)?.trim() ?? "";

  /** For chapter completion, allow deriving current from completed_topic or last saved current */
  const effectiveCurrent =
    rawCurrent ||
    (is_chapter_complete ? trimmedCompleted || existingCurrent : "");

  if (!is_chapter_complete && !rawCurrent) {
    return NextResponse.json({ error: "current_topic_index required" }, { status: 400 });
  }

  if (is_chapter_complete && !effectiveCurrent) {
    return NextResponse.json(
      { error: "Cannot mark chapter complete without a topic reference (current or completed)" },
      { status: 400 }
    );
  }

  const currentCompletedRaw = (existing?.topics_completed as string[] | null) ?? [];
  const currentCompleted = currentCompletedRaw.map((t) => String(t).trim()).filter(Boolean);

  let newCompleted: string[];

  if (topics_completed_override !== undefined) {
    // Caller is providing the full authoritative set (e.g. jump-to-topic nav)
    newCompleted = topics_completed_override.map((t) => String(t).trim()).filter(Boolean);
    if (is_chapter_complete && effectiveCurrent && !newCompleted.includes(effectiveCurrent)) {
      newCompleted.push(effectiveCurrent);
    }
  } else {
    newCompleted = [...currentCompleted];
    const pushIfNew = (idx: string) => {
      if (!idx || newCompleted.includes(idx)) return;
      newCompleted.push(idx);
    };
    if (trimmedCompleted) pushIfNew(trimmedCompleted);
    if (is_chapter_complete) pushIfNew(effectiveCurrent);
  }

  const rowCurrent = is_chapter_complete ? effectiveCurrent : rawCurrent;

  await admin
    .from("chapter_learn_progress")
    .upsert(
      {
        user_id: user.id,
        subject: subjectKey,
        chapter_index,
        chapter_name,
        status: is_chapter_complete ? "completed" : "in_progress",
        current_topic_index: rowCurrent,
        topics_completed: newCompleted,
        last_session_id: session_id,
        last_session_at: now,
        completed_at: is_chapter_complete ? now : null,
        updated_at: now,
      },
      { onConflict: "user_id,subject,chapter_index" }
    );

  return NextResponse.json({ ok: true, topics_completed: newCompleted, current_topic_index: rowCurrent });
}
