import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { areFriends, getAdminOrNull, isBlockedBetween } from "@/lib/social/friend-api-helpers";

const MAX_CONTENT = 8000;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;

async function assertThreadAccess(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    threadId: string
): Promise<{ ok: true; peerId: string } | { ok: false; status: number }> {
    const { data: thread, error } = await supabase
        .from("direct_message_threads")
        .select("id, user_id_1, user_id_2")
        .eq("id", threadId)
        .maybeSingle();

    if (error || !thread) {
        return { ok: false, status: 404 };
    }

    if (thread.user_id_1 !== userId && thread.user_id_2 !== userId) {
        return { ok: false, status: 404 };
    }

    const peerId = thread.user_id_1 === userId ? thread.user_id_2 : thread.user_id_1;

    if (await isBlockedBetween(supabase, userId, peerId)) {
        return { ok: false, status: 404 };
    }

    if (!(await areFriends(supabase, userId, peerId))) {
        return { ok: false, status: 403 };
    }

    return { ok: true, peerId };
}

/** GET — paginated messages (newest first in response body, client may reverse for display) */
export async function GET(
    request: Request,
    ctx: { params: Promise<{ threadId: string }> }
) {
    const { threadId } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await assertThreadAccess(supabase, user.id, threadId);
    if (!access.ok) {
        return NextResponse.json({ error: "Not found" }, { status: access.status });
    }

    const url = new URL(request.url);
    const before = url.searchParams.get("before");
    const limit = Math.min(
        Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
        MAX_LIMIT
    );

    let q = supabase
        .from("direct_messages")
        .select("id, thread_id, sender_id, content, message_type, metadata, read_at, created_at")
        .eq("thread_id", threadId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (before) {
        q = q.lt("created_at", before);
    }

    const { data: rows, error } = await q;
    if (error) {
        console.error("[friends/messages/threadId] GET", error);
        return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
    }

    const messages = [...(rows ?? [])].reverse();
    const hasMore = (rows ?? []).length === limit;
    const oldest = messages[0]?.created_at ?? null;

    const db = getAdminOrNull() ?? supabase;
    const peerId = access.peerId;

    let prof: {
        full_name?: string | null;
        email?: string | null;
        grade?: string | number | null;
        avatar_url?: string | null;
        dm_last_seen_at?: string | null;
    } | null = null;
    let social: { display_name?: string | null } | null = null;

    const socialRes = await db.from("social_profiles").select("user_id, display_name").eq("user_id", peerId).maybeSingle();
    social = socialRes.data;
    if (socialRes.error) {
        console.warn("[friends/messages/threadId] social_profiles", socialRes.error.message);
    }

    const profWithPresence = await db
        .from("profiles")
        .select("id, full_name, email, grade, avatar_url, dm_last_seen_at")
        .eq("id", peerId)
        .maybeSingle();
    if (!profWithPresence.error) {
        prof = profWithPresence.data;
    } else {
        console.warn("[friends/messages/threadId] profiles (with presence) retrying without dm_last_seen_at", profWithPresence.error.message);
        const profBasic = await db
            .from("profiles")
            .select("id, full_name, email, grade, avatar_url")
            .eq("id", peerId)
            .maybeSingle();
        if (profBasic.error) {
            console.warn("[friends/messages/threadId] profiles basic", profBasic.error.message);
        } else {
            prof = profBasic.data;
        }
    }

    const displayName =
        social?.display_name?.trim() ||
        prof?.full_name ||
        prof?.email?.split("@")[0] ||
        "Student";

    return NextResponse.json({
        messages,
        hasMore,
        nextBefore: hasMore && oldest ? oldest : null,
        peerUserId: peerId,
        peer: {
            userId: peerId,
            displayName,
            fullName: prof?.full_name ?? null,
            grade: prof?.grade ?? null,
            avatarUrl: prof?.avatar_url ?? null,
            dmLastSeenAt:
                prof?.dm_last_seen_at != null
                    ? typeof prof.dm_last_seen_at === "string"
                        ? prof.dm_last_seen_at
                        : String(prof.dm_last_seen_at)
                    : null,
        },
    });
}

/** POST — send text message */
export async function POST(
    request: Request,
    ctx: { params: Promise<{ threadId: string }> }
) {
    const { threadId } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await assertThreadAccess(supabase, user.id, threadId);
    if (!access.ok) {
        return NextResponse.json({ error: "Not found" }, { status: access.status });
    }

    let body: { content?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const raw = typeof body.content === "string" ? body.content.trim() : "";
    if (!raw) {
        return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }
    if (raw.length > MAX_CONTENT) {
        return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const { data: inserted, error: insErr } = await supabase
        .from("direct_messages")
        .insert({
            thread_id: threadId,
            sender_id: user.id,
            content: raw,
            message_type: "text",
        })
        .select("id, thread_id, sender_id, content, message_type, metadata, read_at, created_at")
        .single();

    if (insErr || !inserted) {
        console.error("[friends/messages/threadId] POST insert", insErr);
        return NextResponse.json({ error: "Failed to send" }, { status: 500 });
    }

    return NextResponse.json({ message: inserted });
}
