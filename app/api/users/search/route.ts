import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { escapeIlikePattern, getAdminOrNull } from "@/lib/social/friend-api-helpers";

type SocialRow = {
    user_id: string;
    display_name: string | null;
    profile_privacy: "public" | "friends_only" | "private" | null;
    allow_friend_requests: boolean | null;
    avatar_emoji: string | null;
};

type ProfileRow = {
    id: string;
    full_name: string | null;
    grade: string | number | null;
    avatar_url?: string | null;
    social_profiles: SocialRow | SocialRow[] | null;
};

function normalizeSocial(sp: SocialRow | SocialRow[] | null): SocialRow | null {
    if (!sp) return null;
    return Array.isArray(sp) ? sp[0] ?? null : sp;
}

type RpcFriendSearchRow = {
    id: string;
    full_name: string | null;
    grade: string | null;
    display_name: string | null;
    profile_privacy: "public" | "friends_only" | "private" | null;
    allow_friend_requests: boolean | null;
    avatar_emoji: string | null;
    avatar_url: string | null;
};

function rpcRowsToProfiles(rows: RpcFriendSearchRow[]): ProfileRow[] {
    return rows.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        grade: r.grade,
        avatar_url: r.avatar_url ?? null,
        social_profiles: {
            user_id: r.id,
            display_name: r.display_name,
            profile_privacy: r.profile_privacy,
            allow_friend_requests: r.allow_friend_requests,
            avatar_emoji: r.avatar_emoji,
        },
    }));
}

/** GET ?q= — search users by name (profiles.full_name or social display name). Email is not matched. */
export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const raw = url.searchParams.get("q")?.trim() ?? "";
    if (raw.length < 2) {
        return NextResponse.json({ users: [] });
    }

    const admin = getAdminOrNull();
    const db = admin ?? supabase;

    // Fetch current user's grade so we can restrict results to the same class
    const { data: selfProfile } = await supabase
        .from("profiles")
        .select("grade")
        .eq("id", user.id)
        .single();
    const selfGrade = selfProfile?.grade != null ? String(selfProfile.grade).trim() : null;

    const esc = escapeIlikePattern(raw);
    const pattern = `%${esc}%`;

    const { data: rpcData, error: rpcError } = await supabase.rpc("search_profiles_for_friends", {
        p_exclude_user_id: user.id,
        p_ilike_pattern: pattern,
    });

    let candidates: ProfileRow[] = [];
    if (!rpcError && rpcData && Array.isArray(rpcData)) {
        candidates = rpcRowsToProfiles(rpcData as RpcFriendSearchRow[]);
    } else {
        if (rpcError) {
            console.error("[users/search] rpc", rpcError.message);
        }

        const { data: nameRows, error: neErr } = await db
            .from("profiles")
            .select(
                "id, full_name, grade, avatar_url, social_profiles(user_id, display_name, profile_privacy, allow_friend_requests, avatar_emoji)"
            )
            .neq("id", user.id)
            .ilike("full_name", pattern)
            .limit(50);

        if (neErr) {
            console.error("[users/search] profiles query", neErr.message);
        }

        const { data: displayIdRows, error: dErr } = await db
            .from("social_profiles")
            .select("user_id")
            .ilike("display_name", pattern)
            .neq("user_id", user.id)
            .limit(50);

        if (dErr) {
            console.error("[users/search] social_profiles ids", dErr.message);
        }

        const displayIds = [...new Set((displayIdRows ?? []).map((r) => r.user_id))].filter(Boolean);

        let displayProfiles: ProfileRow[] = [];
        if (displayIds.length > 0) {
            const { data: dp, error: dpErr } = await db
                .from("profiles")
                .select(
                    "id, full_name, grade, avatar_url, social_profiles(user_id, display_name, profile_privacy, allow_friend_requests, avatar_emoji)"
                )
                .in("id", displayIds);
            if (dpErr) {
                console.error("[users/search] profiles by display ids", dpErr.message);
            } else {
                displayProfiles = (dp ?? []) as ProfileRow[];
            }
        }

        const merged = new Map<string, ProfileRow>();
        for (const row of (nameRows ?? []) as ProfileRow[]) {
            merged.set(row.id, row);
        }
        for (const row of displayProfiles) {
            if (!merged.has(row.id)) merged.set(row.id, row);
        }

        candidates = [...merged.values()];
    }

    if (candidates.length === 0) {
        return NextResponse.json({ users: [] });
    }

    const ids = candidates.map((c) => c.id);

    const [{ data: blockRows }, { data: friendshipRows }] = await Promise.all([
        db.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
        db
            .from("friendships")
            .select("user_id_1, user_id_2")
            .is("deleted_at", null)
            .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`),
    ]);

    const blocked = new Set<string>();
    for (const b of blockRows ?? []) {
        const other = b.blocker_id === user.id ? b.blocked_id : b.blocker_id;
        if (ids.includes(other)) blocked.add(other);
    }

    const friendIds = new Set<string>();
    for (const f of friendshipRows ?? []) {
        const other = f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1;
        if (ids.includes(other)) friendIds.add(other);
    }

    const out = candidates
        .filter((c) => !blocked.has(c.id))
        .map((c) => {
            const sp = normalizeSocial(c.social_profiles);
            const privacy = sp?.profile_privacy ?? "public";
            if (privacy === "private") return null;
            if (privacy === "friends_only" && !friendIds.has(c.id)) return null;
            // Only return students from the same grade as the current user
            if (selfGrade != null && c.grade != null && String(c.grade).trim() !== selfGrade) return null;
            const display = sp?.display_name?.trim() || c.full_name?.trim() || "Student";
            return {
                id: c.id,
                displayName: display,
                fullName: c.full_name,
                grade: c.grade,
                avatarUrl: c.avatar_url ?? null,
                allowFriendRequests: sp?.allow_friend_requests !== false,
            };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

    out.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));

    return NextResponse.json({ users: out });
}
