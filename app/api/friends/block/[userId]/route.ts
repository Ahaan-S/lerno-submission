import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Ctx = { params: Promise<{ userId: string }> };

/** POST — block a user */
export async function POST(_request: Request, ctx: Ctx) {
    const { userId: blockedId } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (blockedId === user.id) {
        return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }

    const { data: exists } = await supabase.from("profiles").select("id").eq("id", blockedId).maybeSingle();
    if (!exists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await supabase.rpc("unfriend", { p_user_id: user.id, p_friend_id: blockedId });

    const { error } = await supabase.from("user_blocks").insert({
        blocker_id: user.id,
        blocked_id: blockedId,
    });

    if (error) {
        if (error.code === "23505") {
            return NextResponse.json({ ok: true, alreadyBlocked: true });
        }
        console.error("[friends/block] POST", error);
        return NextResponse.json({ error: "Failed to block" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}

/** DELETE — unblock */
export async function DELETE(_request: Request, ctx: Ctx) {
    const { userId: blockedId } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", blockedId);

    if (error) {
        console.error("[friends/block] DELETE", error);
        return NextResponse.json({ error: "Failed to unblock" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
