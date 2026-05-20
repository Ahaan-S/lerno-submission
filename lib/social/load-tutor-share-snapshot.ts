import type { SupabaseClient } from "@supabase/supabase-js";
import { tutorChatPathForSession } from "@/lib/social/tutor-share";

const MAX_MESSAGES = 2500;

export type TutorShareSnapshot =
    | {
          kind: "owner";
          redirect_path: string;
      }
    | {
          kind: "viewer";
          share_token: string;
          session: {
              id: string;
              subject: string;
              chapter_name: string | null;
              chapter_index: string | null;
              title: string | null;
              grade: number | null;
              mode: "ask" | "learn";
          };
          messages: Array<{
              id: string;
              role: string;
              content: string;
              task_type?: string | null;
              citations?: unknown;
              graph_artifacts?: unknown;
              thinking?: unknown;
              attachments?: unknown;
              created_at?: string;
          }>;
      };

export async function loadTutorShareSnapshot(
    admin: SupabaseClient,
    viewerUserId: string,
    token: string
): Promise<TutorShareSnapshot | null> {
    const { data: shareRow, error: shareErr } = await admin
        .from("tutor_session_shares")
        .select("session_id")
        .eq("share_token", token)
        .maybeSingle();

    if (shareErr || !shareRow) {
        return null;
    }

    const sessionId = shareRow.session_id as string;

    const { data: session, error: sessErr } = await admin
        .from("tutor_sessions")
        .select(
            "id, user_id, subject, chapter_name, chapter_index, title, grade, mode, created_at, last_message_at"
        )
        .eq("id", sessionId)
        .maybeSingle();

    if (sessErr || !session) {
        return null;
    }

    const ownerId = session.user_id as string;
    if (viewerUserId === ownerId) {
        const mode = session.mode as string | null;
        const subject = String(session.subject ?? "");
        return {
            kind: "owner",
            redirect_path: tutorChatPathForSession(mode, subject, session.id as string),
        };
    }

    const { data: msgRows, error: msgErr } = await admin
        .from("tutor_messages")
        .select("id, role, content, task_type, citations, graph_artifacts, thinking, attachments, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(MAX_MESSAGES);

    if (msgErr) {
        console.error("[loadTutorShareSnapshot] messages", msgErr);
        return null;
    }

    return {
        kind: "viewer",
        share_token: token,
        session: {
            id: session.id as string,
            subject: String(session.subject ?? ""),
            chapter_name: (session.chapter_name as string | null) ?? null,
            chapter_index: (session.chapter_index as string | null) ?? null,
            title: (session.title as string | null) ?? null,
            grade: (session.grade as number | null) ?? null,
            mode: session.mode === "learn" ? "learn" : "ask",
        },
        messages: msgRows ?? [],
    };
}
