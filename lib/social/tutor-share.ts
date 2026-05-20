import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

export function generateShareToken(): string {
    return randomBytes(24).toString("base64url");
}

/**
 * Returns a stable share token for this session (creates row if needed). Requires service role client.
 */
export async function ensureShareTokenForSession(
    admin: SupabaseClient,
    sessionId: string,
    createdByUserId: string
): Promise<string | null> {
    const { data: existing, error: selErr } = await admin
        .from("tutor_session_shares")
        .select("share_token")
        .eq("session_id", sessionId)
        .maybeSingle();

    if (selErr) {
        console.error("[tutor-share] select share", selErr);
        return null;
    }
    if (existing?.share_token) return existing.share_token;

    const token = generateShareToken();
    const { error: insErr } = await admin.from("tutor_session_shares").insert({
        session_id: sessionId,
        share_token: token,
        created_by: createdByUserId,
    });

    if (insErr) {
        if (insErr.code === "23505") {
            const { data: again } = await admin
                .from("tutor_session_shares")
                .select("share_token")
                .eq("session_id", sessionId)
                .maybeSingle();
            return again?.share_token ?? null;
        }
        console.error("[tutor-share] insert share", insErr);
        return null;
    }

    return token;
}

export function tutorChatPathForSession(mode: string | null | undefined, subject: string, sessionId: string): string {
    if (mode === "learn") {
        const slug = encodeURIComponent(subject);
        return `/learn/${slug}/session/${sessionId}`;
    }
    return `/chat/${sessionId}`;
}
