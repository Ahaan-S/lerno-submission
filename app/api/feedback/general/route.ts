import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

async function sendFeedbackEmail({
  type,
  message,
  grade,
  userEmail,
}: {
  type: string;
  message: string;
  grade?: string | null;
  userEmail?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmails = process.env.FEEDBACK_NOTIFY_EMAILS;
  const fromEmail = process.env.FEEDBACK_FROM_EMAIL || "noreply@lerno.in";

  if (!apiKey || !notifyEmails) return;

  const to = notifyEmails.split(",").map((e) => e.trim()).filter(Boolean);
  const typeLabel = type === "issue" ? "🐛 Bug Report" : "💡 Suggestion";
  const gradeLabel = grade ? ` · Grade ${grade}` : "";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Lerno Feedback <${fromEmail}>`,
      to,
      subject: `${typeLabel} from Lerno user${gradeLabel}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1e293b; margin-bottom: 4px;">${typeLabel}</h2>
          <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
            ${userEmail ? `From: ${userEmail}` : "Anonymous user"}${gradeLabel}
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <p style="color: #1e293b; font-size: 15px; line-height: 1.6; white-space: pre-wrap; margin: 0;">${message}</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Sent from Lerno in-app feedback</p>
        </div>
      `,
    }),
  }).catch((err) => console.error("[feedback/email] send failed:", err));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { message: string; type?: string; grade?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, type = "general", grade } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const { error } = await supabase.from("general_feedback").insert({
    user_id: user.id,
    message: message.trim(),
    grade: grade ?? null,
    type: type,
  });

  if (error) {
    console.error("[feedback/general] db error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  // Fire-and-forget email notification
  sendFeedbackEmail({
    type,
    message: message.trim(),
    grade,
    userEmail: user.email,
  });

  return NextResponse.json({ ok: true });
}
