import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminOrNull } from "@/lib/social/friend-api-helpers";

/** GET — list active friends with basic profile + social display */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: links, error } = await supabase
        .from("friendships")
        .select("id, user_id_1, user_id_2, created_at")
        .is("deleted_at", null)
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[friends] GET list", error);
        return NextResponse.json({ error: "Failed to load friends" }, { status: 500 });
    }

    const rows = links ?? [];
    const otherIds = rows.map((r) => (r.user_id_1 === user.id ? r.user_id_2 : r.user_id_1));

    if (otherIds.length === 0) {
        return NextResponse.json({ friends: [] });
    }

    const db = getAdminOrNull() ?? supabase;

    const [{ data: profiles }, { data: socials }] = await Promise.all([
        db.from("profiles").select("id, full_name, email, grade, avatar_url").in("id", otherIds),
        db.from("social_profiles").select("user_id, display_name").in("user_id", otherIds),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const socialById = new Map((socials ?? []).map((s) => [s.user_id, s]));

    const friends = rows.map((r) => {
        const oid = r.user_id_1 === user.id ? r.user_id_2 : r.user_id_1;
        const p = profileById.get(oid);
        const s = socialById.get(oid);
        const displayName =
            s?.display_name?.trim() || p?.full_name || p?.email?.split("@")[0] || "Student";
        return {
            friendshipId: r.id,
            userId: oid,
            displayName,
            fullName: p?.full_name ?? null,
            grade: p?.grade ?? null,
            avatarUrl: p?.avatar_url ?? null,
            friendsSince: r.created_at,
        };
    });

    return NextResponse.json({ friends });
}
