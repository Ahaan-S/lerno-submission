import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { areFriends, isBlockedBetween } from "@/lib/social/friend-api-helpers";

async function assertThreadAccess(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    threadId: string
): Promise<boolean> {
    const { data: thread, error } = await supabase
        .from("direct_message_threads")
        .select("id, user_id_1, user_id_2")
        .eq("id", threadId)
        .maybeSingle();

    if (error || !thread) return false;
    if (thread.user_id_1 !== userId && thread.user_id_2 !== userId) return false;

    const peerId = thread.user_id_1 === userId ? thread.user_id_2 : thread.user_id_1;
    if (await isBlockedBetween(supabase, userId, peerId)) return false;
    if (!(await areFriends(supabase, userId, peerId))) return false;
    return true;
}

/** POST — mark incoming messages in this thread as read */
export async function POST(
    _request: Request,
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

    const ok = await assertThreadAccess(supabase, user.id, threadId);
    if (!ok) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await supabase.rpc("mark_dm_thread_read", {
        p_thread_id: threadId,
    });

    if (error) {
        console.error("[friends/messages/read] mark_dm_thread_read", error);
        return NextResponse.json({ error: "Failed to update read state" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
