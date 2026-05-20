import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { chat } from "@/lib/ai/llm";
import type { ChatMessage } from "@/lib/ai/llm";
import { formatPlannerBundleForLlm, loadPlannerProgressBundle } from "@/lib/planner/planner-context";

const PLANNER_SYSTEM_PROMPT = `You are Lerno's study planner assistant. You help students organize their study schedule based on their actual progress data.

Your role:
- Suggest what to study and when, using the student's real progress attached below
- Help them create balanced weekly schedules
- Warn about gaps (not studied a subject in N days)
- Keep responses concise and actionable (2-3 sentences max)

Do NOT teach NCERT content here. If a student asks about NCERT concepts, politely redirect them to the "Ask" mode.
Format suggestions as short, direct recommendations with specific times and durations.
When the data shows no history yet, say so honestly and suggest a simple starter plan.`;

/** POST /api/planner/chat */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { messages: ChatMessage[] };

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const bundle = await loadPlannerProgressBundle(user.id);
  const dataBlock = bundle
    ? formatPlannerBundleForLlm(bundle)
    : "No planner rows loaded (database unavailable or new student).";

  const systemContent = `${PLANNER_SYSTEM_PROMPT}

---
Current student progress (from Supabase — treat as source of truth):
${dataBlock}
---`;

  const rest = body.messages[0]?.role === "system" ? body.messages.slice(1) : body.messages;
  const messages: ChatMessage[] = [{ role: "system", content: systemContent }, ...rest];

  try {
    const content = await chat(messages, { temperature: 0.65, maxTokens: 400 });
    return NextResponse.json({ content });
  } catch (err) {
    console.error("[planner/chat] error:", err);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
