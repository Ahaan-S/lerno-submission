import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface FeedbackBody {
  message_id: string;
  session_id: string;
  type: "up" | "down";
  comment?: string;
}

// POST /api/tutor/feedback
// Upserts a feedback row for a given message. Calling again with the same
// message_id updates the existing row (e.g. flipping up→down or editing comment).
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: FeedbackBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message_id, session_id, type, comment } = body;

  if (!message_id || !session_id || !type) {
    return NextResponse.json(
      { error: "message_id, session_id, and type are required" },
      { status: 400 }
    );
  }

  if (type !== "up" && type !== "down") {
    return NextResponse.json(
      { error: "type must be 'up' or 'down'" },
      { status: 400 }
    );
  }

  // Verify the message belongs to a session owned by this user
  const { data: session, error: sessionError } = await supabase
    .from("tutor_sessions")
    .select("id")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Upsert — update type/comment if feedback already exists for this message
  const { error } = await supabase.from("message_feedback").upsert(
    {
      user_id: user.id,
      message_id,
      session_id,
      type,
      comment: comment?.trim() || null,
    },
    { onConflict: "user_id,message_id" }
  );

  if (error) {
    console.error("[feedback] upsert error:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/tutor/feedback
// Removes feedback (used when user un-clicks an already-active thumb).
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message_id } = body;

  if (!message_id) {
    return NextResponse.json({ error: "message_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("message_feedback")
    .delete()
    .eq("user_id", user.id)
    .eq("message_id", message_id);

  if (error) {
    console.error("[feedback] delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete feedback" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
