import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { areFriends, getAdminOrNull, isBlockedBetween } from "@/lib/social/friend-api-helpers";

const DAILY_REQUEST_CAP = 20;

type SocialEmbed = { display_name: string | null } | { display_name: string | null }[] | null;

function firstSocial(sp: SocialEmbed): { display_name: string | null } | null {
    if (!sp) return null;
    return Array.isArray(sp) ? sp[0] ?? null : sp;
}

/** GET — incoming pending friend requests for current user */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // profiles RLS hides other users; service role reads sender rows for display (same as user search).
    const db = getAdminOrNull() ?? supabase;

    const { data, error } = await db
        .from("friend_requests")
        .select(
            `
      id,
      message,
      created_at,
      expires_at,
      sender:profiles!friend_requests_sender_id_fkey (
        id,
        full_name,
        email,
        grade,
        social_profiles (
          display_name
        )
      )
    `
        )
        .eq("recipient_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[friends/requests] GET incoming", error);
        return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
    }

    const rows = (data ?? []) as {
        id: string;
        message: string | null;
        created_at: string;
        expires_at: string;
        sender:
            | {
                  id: string;
                  full_name: string | null;
                  email: string | null;
                  grade: string | number | null;
                  social_profiles: SocialEmbed;
              }
            | {
                  id: string;
                  full_name: string | null;
                  email: string | null;
                  grade: string | number | null;
                  social_profiles: SocialEmbed;
              }[]
            | null;
    }[];

    const normalized = rows.map((r) => {
        const s = Array.isArray(r.sender) ? r.sender[0] : r.sender;
        const sp = s ? firstSocial(s.social_profiles) : null;
        const display =
            sp?.display_name?.trim() || s?.full_name?.trim() || null;
        return {
            id: r.id,
            message: r.message,
            createdAt: r.created_at,
            expiresAt: r.expires_at,
            sender: s
                ? {
                      id: s.id,
                      fullName: display,
                      email: s.email,
                      grade: s.grade,
                  }
                : null,
        };
    });

    return NextResponse.json({ requests: normalized });
}

/** POST — send friend request { recipientId, message? } */
export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { recipientId?: string; recipientEmail?: string | null; message?: string | null };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // profiles / social_profiles RLS only allows reading your own row; use service role for
    // recipient checks (same pattern as GET /api/users/search).
    const db = getAdminOrNull() ?? supabase;

    let recipientId = body.recipientId?.trim() ?? "";

    if (!recipientId && typeof body.recipientEmail === "string") {
        const normalized = body.recipientEmail.trim().toLowerCase();
        if (normalized.length > 3 && normalized.includes("@")) {
            const { data: byEmail } = await db
                .from("profiles")
                .select("id")
                .ilike("email", normalized)
                .maybeSingle();
            recipientId = byEmail?.id ?? "";
        }
    }

    if (!recipientId || recipientId === user.id) {
        return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
    }

    const message =
        typeof body.message === "string" ? body.message.trim().slice(0, 500) : null;

    if (await isBlockedBetween(supabase, user.id, recipientId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: recipientProfile } = await db
        .from("profiles")
        .select("id")
        .eq("id", recipientId)
        .maybeSingle();

    if (!recipientProfile) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: social } = await db
        .from("social_profiles")
        .select("allow_friend_requests, require_mutual_friend, profile_privacy")
        .eq("user_id", recipientId)
        .maybeSingle();

    if (social?.allow_friend_requests === false) {
        return NextResponse.json({ error: "User is not accepting friend requests" }, { status: 403 });
    }

    if (social?.require_mutual_friend) {
        return NextResponse.json(
            { error: "This user only accepts requests from mutual friends (not supported yet)" },
            { status: 403 }
        );
    }

    if (social?.profile_privacy === "private") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (social?.profile_privacy === "friends_only") {
        const ok = await areFriends(supabase, user.id, recipientId);
        if (!ok) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
    }

    if (await areFriends(supabase, user.id, recipientId)) {
        return NextResponse.json({ error: "Already friends" }, { status: 409 });
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: sentToday } = await supabase
        .from("friend_requests")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", user.id)
        .gte("created_at", startOfDay.toISOString());

    if ((sentToday ?? 0) >= DAILY_REQUEST_CAP) {
        return NextResponse.json({ error: "Daily friend request limit reached" }, { status: 429 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentDecline } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", user.id)
        .eq("recipient_id", recipientId)
        .eq("status", "declined")
        .gte("actioned_at", thirtyDaysAgo)
        .order("actioned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (recentDecline) {
        return NextResponse.json(
            { error: "You can send another request after the cooldown period" },
            { status: 429 }
        );
    }

    const { data: pendingOut } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", user.id)
        .eq("recipient_id", recipientId)
        .eq("status", "pending")
        .maybeSingle();

    const { data: pendingIn } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", recipientId)
        .eq("recipient_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

    if (pendingOut || pendingIn) {
        return NextResponse.json({ error: "A pending request already exists" }, { status: 409 });
    }

    const { data: inserted, error: insErr } = await supabase
        .from("friend_requests")
        .insert({
            sender_id: user.id,
            recipient_id: recipientId,
            message: message || null,
            status: "pending",
        })
        .select("id, created_at, expires_at")
        .single();

    if (insErr) {
        console.error("[friends/requests] insert", insErr);
        if (insErr.code === "23505") {
            return NextResponse.json({ error: "Duplicate or conflicting request" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to send request" }, { status: 500 });
    }

    return NextResponse.json({ request: inserted });
}
