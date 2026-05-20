import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getChapterTopicsFromQdrant } from "@/lib/ai/qdrant";

/** GET /api/learn/topics?subject=Science&chapter_index=1&grade=10 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject");
  const chapter_index = searchParams.get("chapter_index");
  const grade = searchParams.get("grade") ?? "10";

  if (!subject || !chapter_index) {
    return NextResponse.json({ error: "subject and chapter_index required" }, { status: 400 });
  }

  const topics = await getChapterTopicsFromQdrant(grade, subject, chapter_index);
  return NextResponse.json({ topics });
}
