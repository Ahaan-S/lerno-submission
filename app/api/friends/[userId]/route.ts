import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isBlockedBetween } from "@/lib/social/friend-api-helpers";

type Ctx = { params: Promise<{ userId: string }> };

/** DELETE — unfriend */
export async function DELETE(_request: Request, ctx: Ctx) {
    const { userId: friendId } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (friendId === user.id) {
        return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }

    if (await isBlockedBetween(supabase, user.id, friendId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await supabase.rpc("unfriend", {
        p_user_id: user.id,
        p_friend_id: friendId,
    });

    if (error) {
        console.error("[friends] unfriend", error);
        return NextResponse.json({ error: "Failed to unfriend" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
