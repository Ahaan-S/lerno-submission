import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminOrNull } from "@/lib/social/friend-api-helpers";

/** GET /api/users/mutual?targetId=<uuid> — returns mutual friends between current user and target */
export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const targetId = url.searchParams.get("targetId")?.trim() ?? "";
    if (!targetId || targetId === user.id) {
        return NextResponse.json({ mutual: [], total: 0 });
    }

    const db = getAdminOrNull() ?? supabase;

    const [{ data: myLinks }, { data: theirLinks }] = await Promise.all([
        db
            .from("friendships")
            .select("user_id_1, user_id_2")
            .is("deleted_at", null)
            .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`),
        db
            .from("friendships")
            .select("user_id_1, user_id_2")
            .is("deleted_at", null)
            .or(`user_id_1.eq.${targetId},user_id_2.eq.${targetId}`),
    ]);

    const myFriendIds = new Set(
        (myLinks ?? []).map((r) => (r.user_id_1 === user.id ? r.user_id_2 : r.user_id_1))
    );
    const theirFriendIds = new Set(
        (theirLinks ?? []).map((r) => (r.user_id_1 === targetId ? r.user_id_2 : r.user_id_1))
    );

    const mutualIds = [...myFriendIds].filter(
        (id) => theirFriendIds.has(id) && id !== user.id && id !== targetId
    );

    if (mutualIds.length === 0) {
        return NextResponse.json({ mutual: [], total: 0 });
    }

    const [{ data: profiles }, { data: socials }] = await Promise.all([
        db.from("profiles").select("id, full_name, avatar_url, grade").in("id", mutualIds),
        db.from("social_profiles").select("user_id, display_name").in("user_id", mutualIds),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const socialById = new Map((socials ?? []).map((s) => [s.user_id, s]));

    const mutual = mutualIds
        .map((id) => {
            const p = profileById.get(id);
            const s = socialById.get(id);
            return {
                id,
                displayName: s?.display_name?.trim() || p?.full_name?.trim() || "Student",
                avatarUrl: p?.avatar_url ?? null,
                grade: p?.grade ?? null,
            };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));

    return NextResponse.json({ mutual, total: mutual.length });
}
