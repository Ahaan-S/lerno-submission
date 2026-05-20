import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { areFriends, isBlockedBetween } from "@/lib/social/friend-api-helpers";

/** POST { peerUserId } — ensure DM thread with a friend; returns threadId */
export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { peerUserId?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const peerUserId = body.peerUserId?.trim();
    if (!peerUserId || peerUserId === user.id) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (await isBlockedBetween(supabase, user.id, peerUserId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!(await areFriends(supabase, user.id, peerUserId))) {
        return NextResponse.json({ error: "You can only message friends" }, { status: 403 });
    }

    const { data: threadId, error: rpcErr } = await supabase.rpc("upsert_dm_thread", {
        p_user_a: user.id,
        p_user_b: peerUserId,
    });

    if (rpcErr || !threadId) {
        console.error("[friends/messages/open] upsert_dm_thread", rpcErr);
        return NextResponse.json({ error: "Could not open conversation" }, { status: 500 });
    }

    return NextResponse.json({ threadId: threadId as string });
}
