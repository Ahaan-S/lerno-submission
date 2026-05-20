import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type BrowseRpcRow = {
    id: string;
    full_name: string | null;
    display_name: string | null;
    grade: string | null;
    avatar_url: string | null;
    allow_friend_requests: boolean | null;
    mutual_count: string | number | null;
};

/** GET /api/users/browse?grade=11&limit=20&offset=0 */
export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const limitParam = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
    const offsetParam = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

    let grade = url.searchParams.get("grade");
    if (!grade) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("grade")
            .eq("id", user.id)
            .single();
        grade = profile?.grade != null ? String(profile.grade) : null;
    }

    if (!grade) {
        return NextResponse.json({ users: [], hasMore: false });
    }

    // Fetch one extra to determine hasMore
    const { data, error } = await supabase.rpc("browse_students_for_user", {
        p_user_id: user.id,
        p_grade: grade,
        p_limit: limitParam + 1,
        p_offset: offsetParam,
    });

    if (error) {
        console.error("[users/browse] rpc error", error.message);
        return NextResponse.json({ error: "Failed to browse students" }, { status: 500 });
    }

    const rows = (data ?? []) as BrowseRpcRow[];
    const hasMore = rows.length > limitParam;
    const items = hasMore ? rows.slice(0, limitParam) : rows;

    const users = items.map((r) => ({
        id: r.id,
        displayName: r.display_name?.trim() || r.full_name?.trim() || "Student",
        fullName: r.full_name ?? null,
        grade: r.grade ?? null,
        avatarUrl: r.avatar_url ?? null,
        allowFriendRequests: r.allow_friend_requests !== false,
        mutualCount: Number(r.mutual_count ?? 0),
    }));

    return NextResponse.json({ users, hasMore });
}
