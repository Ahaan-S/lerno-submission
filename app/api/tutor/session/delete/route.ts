import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { session_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { session_id } = body;

  if (!session_id) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("tutor_sessions")
    .delete()
    .eq("id", session_id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
