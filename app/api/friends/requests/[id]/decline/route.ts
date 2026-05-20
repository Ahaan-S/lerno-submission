import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

/** POST — decline incoming friend request */
export async function POST(_request: Request, ctx: Ctx) {
    const { id: requestId } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.rpc("decline_friend_request", {
        p_request_id: requestId,
        p_recipient_id: user.id,
    });

    if (error) {
        console.error("[friends/requests/decline]", error);
        const msg = error.message ?? "";
        if (msg.includes("not found") || msg.includes("already actioned")) {
            return NextResponse.json({ error: "Request not found or already handled" }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to decline" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
