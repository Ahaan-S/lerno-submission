import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { areFriends, getAdminOrNull, isBlockedBetween } from "@/lib/social/friend-api-helpers";

/** POST — bump current user's DM/app presence (heartbeat). */
export async function POST() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.rpc("bump_dm_presence");
    if (error) {
        console.error("[friends/presence] bump_dm_presence", error);
        return NextResponse.json({ error: "Presence unavailable" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}

/** GET ?peerId= — friend's dm_last_seen_at (friends + not blocked only). */
export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const peerId = new URL(request.url).searchParams.get("peerId")?.trim();
    if (!peerId) {
        return NextResponse.json({ error: "peerId required" }, { status: 400 });
    }

    if (peerId === user.id) {
        return NextResponse.json({ lastSeenAt: null });
    }

    if (await isBlockedBetween(supabase, user.id, peerId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!(await areFriends(supabase, user.id, peerId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const db = getAdminOrNull() ?? supabase;
    const { data: row, error } = await db
        .from("profiles")
        .select("dm_last_seen_at")
        .eq("id", peerId)
        .maybeSingle();

    if (error) {
        console.error("[friends/presence] GET profile", error);
        return NextResponse.json({ error: "Failed to load" }, { status: 500 });
    }

    const last = row?.dm_last_seen_at;
    return NextResponse.json({
        lastSeenAt: typeof last === "string" ? last : last != null ? String(last) : null,
    });
}
