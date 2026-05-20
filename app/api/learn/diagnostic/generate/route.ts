import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { generateDiagnosticQuestions, validateChapterLimit } from "@/lib/ai/diagnostic-questions";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { resolveSubjectSlug } from "@/lib/tutor-subject";

/** POST /api/learn/diagnostic/generate
 * Returns pre-generated diagnostic questions from DB cache (instant).
 * Falls back to generation + saves to cache if not found. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    subject: string;
    chapter_index: number;
    chapter_name: string;
    grade?: number;
    topic_indices?: string[];
  };

  const normalizedSubject = resolveSubjectSlug(body.subject);
  const { chapter_index, chapter_name, grade = 10, topic_indices = [] } = body;
  const subject = normalizedSubject;
  if (!subject || chapter_index == null) {
    return NextResponse.json({ error: "subject, chapter_index required" }, { status: 400 });
  }
  const chapterLimitError = validateChapterLimit(grade, subject, chapter_index);
  if (chapterLimitError) {
    return NextResponse.json({ error: chapterLimitError }, { status: 400 });
  }

  // Check DB cache first — instant return if pre-generated
  const admin = createAdminClient();
  if (admin) {
    const { data: cached } = await admin
      .from("diagnostic_questions_cache")
      .select("questions")
      .eq("grade", grade)
      .eq("subject", subject)
      .eq("chapter_index", chapter_index)
      .single();

    if (cached?.questions) {
      console.log("[learn/diagnostic/generate] DB cache hit:", grade, subject, chapter_index);
      return NextResponse.json({ questions: cached.questions });
    }
  }

  // Cache miss: rate limit before generation.
  const rl = await checkRateLimit(user.id, "llm_diagnostic");
  if (!rl.success) {
    console.log("[learn/diagnostic/generate] Rate limited:", user.id);
    return rateLimitedResponse(rl.reset);
  }

  const questions = await generateDiagnosticQuestions({ grade, subject, chapter_index, chapter_name, topic_indices });
  if (!questions) {
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }

  // Save to DB so next request is instant
  if (!admin) return NextResponse.json({ questions });
  await admin.from("diagnostic_questions_cache").upsert({
    grade,
    subject,
    chapter_index,
    chapter_name,
    questions,
  }, { onConflict: "grade,subject,chapter_index" });

  return NextResponse.json({ questions });
}
