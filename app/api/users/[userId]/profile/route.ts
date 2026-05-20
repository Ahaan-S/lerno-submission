import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { areFriends, isBlockedBetween } from "@/lib/social/friend-api-helpers";

type Ctx = { params: Promise<{ userId: string }> };

/** GET — public profile of another user + relationship hints */
export async function GET(_request: Request, ctx: Ctx) {
    const { userId: targetId } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (targetId === user.id) {
        return NextResponse.json({ error: "Use account settings for your own profile" }, { status: 400 });
    }

    if (await isBlockedBetween(supabase, user.id, targetId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, grade")
        .eq("id", targetId)
        .maybeSingle();

    if (pErr || !profile) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: social } = await supabase
        .from("social_profiles")
        .select("display_name, bio, avatar_emoji, profile_privacy, allow_friend_requests, friend_count")
        .eq("user_id", targetId)
        .maybeSingle();

    const privacy = social?.profile_privacy ?? "public";
    const friends = await areFriends(supabase, user.id, targetId);

    if (privacy === "private" && !friends) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (privacy === "friends_only" && !friends) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: pendingIncoming } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", targetId)
        .eq("recipient_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

    const { data: pendingOutgoing } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", user.id)
        .eq("recipient_id", targetId)
        .eq("status", "pending")
        .maybeSingle();

    const displayName =
        social?.display_name?.trim() || profile.full_name || profile.email?.split("@")[0] || "Student";

    return NextResponse.json({
        id: profile.id,
        displayName,
        fullName: profile.full_name,
        grade: profile.grade,
        bio: social?.bio ?? null,
        avatarEmoji: social?.avatar_emoji ?? null,
        friendCount: social?.friend_count ?? 0,
        allowFriendRequests: social?.allow_friend_requests !== false,
        relationship: friends
            ? "friends"
            : pendingIncoming
              ? "request_received"
              : pendingOutgoing
                ? "request_sent"
                : "none",
        pendingRequestId: pendingIncoming?.id ?? pendingOutgoing?.id ?? null,
    });
}
