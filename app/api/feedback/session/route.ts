import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const RATING_LABELS: Record<number, string> = { 1: "😕 Struggled", 2: "😊 It was okay", 3: "🔥 Loved it!" };

async function sendSessionFeedbackEmail({
  rating,
  comment,
  subject,
  chapterName,
  grade,
  userEmail,
  lastMessages,
}: {
  rating: number;
  comment: string;
  subject: string;
  chapterName: string | null;
  grade?: string;
  userEmail?: string;
  lastMessages: { role: string; content: string }[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmails = process.env.FEEDBACK_NOTIFY_EMAILS;
  const fromEmail = process.env.FEEDBACK_FROM_EMAIL || "noreply@lerno.in";
  if (!apiKey || !notifyEmails) return;

  const to = notifyEmails.split(",").map((e) => e.trim()).filter(Boolean);
  const ratingLabel = RATING_LABELS[rating] ?? rating;
  const subjectLine = `Session feedback: ${ratingLabel} — ${subject}${chapterName ? ` · ${chapterName}` : ""}`;

  const messagesHtml = lastMessages
    .map(
      (m) => `
      <div style="margin-bottom:12px;">
        <span style="font-size:11px;font-weight:600;text-transform:uppercase;color:${m.role === "user" ? "#0077ED" : "#475569"};letter-spacing:0.5px;">
          ${m.role === "user" ? "Student" : "Lerno AI"}
        </span>
        <p style="margin:4px 0 0;color:#1e293b;font-size:14px;line-height:1.5;white-space:pre-wrap;">${m.content.slice(0, 400)}${m.content.length > 400 ? "…" : ""}</p>
      </div>`
    )
    .join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Lerno Feedback <${fromEmail}>`,
      to,
      subject: subjectLine,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1e293b;margin-bottom:4px;">Session Feedback</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
            <tr><td style="padding:6px 0;color:#64748b;width:110px;">Rating</td><td style="color:#1e293b;font-weight:600;">${ratingLabel}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Subject</td><td style="color:#1e293b;">${subject}${chapterName ? ` — ${chapterName}` : ""}</td></tr>
            ${grade ? `<tr><td style="padding:6px 0;color:#64748b;">Grade</td><td style="color:#1e293b;">Grade ${grade}</td></tr>` : ""}
            ${userEmail ? `<tr><td style="padding:6px 0;color:#64748b;">Student</td><td style="color:#1e293b;">${userEmail}</td></tr>` : ""}
          </table>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
            <p style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">What they said</p>
            <p style="color:#1e293b;font-size:15px;line-height:1.6;white-space:pre-wrap;margin:0;">${comment}</p>
          </div>
          ${lastMessages.length > 0 ? `
          <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;">
            <p style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;">Last messages in session</p>
            ${messagesHtml}
          </div>` : ""}
          <p style="color:#94a3b8;font-size:12px;margin-top:20px;">Sent from Lerno in-app session feedback</p>
        </div>
      `,
    }),
  }).catch((err) => console.error("[feedback/session/email] failed:", err));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { session_id: string; rating: number; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, rating, comment } = body;

  if (!session_id || !rating || rating < 1 || rating > 3) {
    return NextResponse.json({ error: "session_id and rating (1-3) required" }, { status: 400 });
  }

  // Fetch session + last 4 messages in parallel
  const [sessionRes, messagesRes, profileRes] = await Promise.all([
    supabase
      .from("tutor_sessions")
      .select("subject, chapter_name, user_id")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("tutor_messages")
      .select("role, content")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("profiles")
      .select("grade")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("tutor_sessions")
    .update({ session_rating: rating, session_rating_comment: comment?.trim() || null })
    .eq("id", session_id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[feedback/session] db error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  // Fire-and-forget email with full context
  const lastMessages = (messagesRes.data ?? []).reverse();
  sendSessionFeedbackEmail({
    rating,
    comment: comment?.trim() ?? "",
    subject: sessionRes.data.subject,
    chapterName: sessionRes.data.chapter_name,
    grade: profileRes.data?.grade ?? undefined,
    userEmail: user.email,
    lastMessages,
  });

  return NextResponse.json({ ok: true });
}
