import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getChapterLimitForSubject } from "@/lib/chapters";
import { getLearnProgressReadKeys } from "@/lib/learn-progress";
import { resolveSubjectSlug } from "@/lib/tutor-subject";

/** GET /api/learn/progress?subject=Science&chapter_index=1 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject");
  const chapter_index = searchParams.get("chapter_index");
  const grade = Number(searchParams.get("grade") ?? 10);

  if (!subject || !chapter_index) {
    return NextResponse.json({ error: "subject and chapter_index required" }, { status: 400 });
  }

  const slug = resolveSubjectSlug(subject);
  const chapterLimit = getChapterLimitForSubject(grade, slug);
  if (chapterLimit != null && Number(chapter_index) > chapterLimit) {
    return NextResponse.json({ error: "chapter not available" }, { status: 400 });
  }
  const progressKeys = getLearnProgressReadKeys(grade, slug);

  const { data } = await supabase
    .from("chapter_learn_progress")
    .select("topics_completed, current_topic_index, diagnostic_completed, status")
    .eq("user_id", user.id)
    .in("subject", progressKeys)
    .eq("chapter_index", Number(chapter_index))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    topics_completed: (data?.topics_completed as string[] | null) ?? [],
    current_topic_index: data?.current_topic_index ?? null,
    diagnostic_completed: data?.diagnostic_completed ?? false,
    status: data?.status ?? "not_started",
  });
}
