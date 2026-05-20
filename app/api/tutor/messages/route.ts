import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/tutor/messages
 * Params: session_id, before (ISO timestamp), limit (default 10)
 * Returns messages older than `before`, in chronological order, plus hasMore.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const before = url.searchParams.get("before");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10"), 50);

  if (!sessionId) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  // Verify ownership
  const { data: session } = await supabase
    .from("tutor_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let query = supabase
    .from("tutor_messages")
    .select("id, role, content, display_content, citations, graph_artifacts, thinking, attachments, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });

  // Reverse to get chronological order
  const messages = (data ?? []).reverse();
  return NextResponse.json({ messages, hasMore: (data ?? []).length === limit });
}
