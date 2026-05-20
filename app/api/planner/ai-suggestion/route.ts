import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateAiSuggestion } from "@/lib/planner/suggestion-engine";

/** POST /api/planner/ai-suggestion */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    subject?: string;
    current_date?: string;
  };

  const currentDate = body.current_date ?? new Date().toISOString().slice(0, 10);

  try {
    const suggestion = await generateAiSuggestion(user.id, currentDate, {
      subject: body.subject,
    });
    return NextResponse.json(suggestion);
  } catch (err) {
    console.error("[planner/ai-suggestion] error:", err);
    return NextResponse.json({
      suggestion: "Start a study session today to keep your momentum going.",
      recommended_subject: "science",
      recommended_duration_minutes: 45,
      urgency: "low",
    });
  }
}
