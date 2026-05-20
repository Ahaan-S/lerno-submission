import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** POST — End session & trigger background memory update (fire-and-forget)
 * Call when: user closes tutor, or after 10 min inactivity
 * Invokes Supabase Edge Function update-student-memory
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { session_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { session_id } = body;
  if (!session_id || typeof session_id !== "string") {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("tutor_sessions")
    .select("id")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found or access denied" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn("[session/end] Supabase URL or service role missing — skipping memory edge invoke");
    return NextResponse.json({
      ok: true,
      memory_update_skipped: true,
      reason: "server_misconfigured",
    });
  }

  const fnUrl = `${url}/functions/v1/update-student-memory`;

  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ session_id }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[session/end] Edge function error:", res.status, data);
      // Still return 200 so navigation / visibility handlers don't surface a hard error;
      // memory sync is best-effort. Logs capture the real failure.
      return NextResponse.json({
        ok: true,
        memory_update_skipped: true,
        reason: data?.error ?? `edge_status_${res.status}`,
      });
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("[session/end] Invoke error:", err);
    return NextResponse.json({
      ok: true,
      memory_update_skipped: true,
      reason: "invoke_failed",
    });
  }
}
