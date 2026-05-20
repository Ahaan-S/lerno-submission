import { NextResponse } from "next/server";
import { chat } from "@/lib/ai/llm";
import type { ChatMessage, ChatOptions } from "@/lib/ai/llm";

/**
 * Internal proxy for Supabase Edge Functions (e.g. update-student-memory) to call
 * the same Vertex / Gemini stack as the Next.js app without bundling google-auth-library in Deno.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-lerno-internal-secret");
  const expected = process.env.LERNO_INTERNAL_LLM_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { messages: ChatMessage[]; options?: ChatOptions };
  try {
    body = (await req.json()) as { messages: ChatMessage[]; options?: ChatOptions };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  try {
    const content = await chat(body.messages, body.options);
    return NextResponse.json({ content });
  } catch (e) {
    console.error("[internal/llm-chat]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "LLM call failed" },
      { status: 500 }
    );
  }
}
