import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminOrNull } from "@/lib/social/friend-api-helpers";

type InboxRpcRow = {
    thread_id: string;
    peer_id: string;
    sort_at: string;
    last_content: string | null;
    last_message_type: string;
    last_sender_id: string | null;
    unread_count: number;
};

function previewLabel(messageType: string, content: string | null): string {
    if (messageType === "question_share") return "Shared a study question";
    if (messageType === "session_share") return "Shared a tutor chat";
    if (content?.trim()) {
        const one = content.replace(/\s+/g, " ").trim();
        return one.length > 72 ? `${one.slice(0, 71)}…` : one;
    }
    return "No messages yet";
}

/** GET — inbox: threads with peer profile + preview + unread */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rows, error } = await supabase.rpc("dm_inbox_for_user");

    if (error) {
        console.error("[friends/messages] dm_inbox_for_user", error);
        return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
    }

    const list = (rows ?? []) as InboxRpcRow[];
    if (list.length === 0) {
        return NextResponse.json({ threads: [] });
    }

    const peerIds = [...new Set(list.map((r) => r.peer_id))];
    const db = getAdminOrNull() ?? supabase;

    const [{ data: profiles }, { data: socials }] = await Promise.all([
        (async () => {
            const withPresence = await db
                .from("profiles")
                .select("id, full_name, email, grade, avatar_url, dm_last_seen_at")
                .in("id", peerIds);
            if (!withPresence.error) return withPresence;
            console.warn("[friends/messages] profiles with presence failed, retrying", withPresence.error.message);
            return db.from("profiles").select("id, full_name, email, grade, avatar_url").in("id", peerIds);
        })(),
        db.from("social_profiles").select("user_id, display_name").in("user_id", peerIds),
    ]);

    type ProfileRow = {
        id: string;
        full_name: string | null;
        email: string | null;
        grade: string | null;
        avatar_url: string | null;
        dm_last_seen_at?: string | null;
    };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]));
    const socialById = new Map((socials ?? []).map((s) => [s.user_id, s]));

    const threads = list.map((r) => {
        const p = profileById.get(r.peer_id);
        const s = socialById.get(r.peer_id);
        const displayName =
            s?.display_name?.trim() || p?.full_name || p?.email?.split("@")[0] || "Student";
        const rawSeen = p?.dm_last_seen_at;
        const peerLastSeenAt =
            rawSeen != null ? (typeof rawSeen === "string" ? rawSeen : String(rawSeen)) : null;
        return {
            threadId: r.thread_id,
            peerUserId: r.peer_id,
            displayName,
            fullName: p?.full_name ?? null,
            grade: p?.grade ?? null,
            avatarUrl: p?.avatar_url ?? null,
            lastMessageAt: r.sort_at,
            preview: previewLabel(r.last_message_type, r.last_content),
            unreadCount: Number(r.unread_count) || 0,
            peerLastSeenAt,
        };
    });

    return NextResponse.json({ threads });
}
