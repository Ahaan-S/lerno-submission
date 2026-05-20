import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { loadLearnRecommendation } from "@/lib/learn/recommendation-data";

/** GET /api/learn/recommendation?subject=science&grade=10
 * Returns chapter list with progress status + AI recommendation message. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject");
  const grade = Number(searchParams.get("grade") ?? 10);

  if (!subject) return NextResponse.json({ error: "subject required" }, { status: 400 });

  const payload = await loadLearnRecommendation(supabase, user.id, subject, grade);

  return NextResponse.json({
    chapters: payload.chapters,
    recommended_chapter_index: payload.recommended_chapter_index,
    recommendation_message: payload.recommendation_message,
  });
}
