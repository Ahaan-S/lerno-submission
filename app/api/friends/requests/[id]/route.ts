import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE — cancel own outgoing pending request */
export async function DELETE(_request: Request, ctx: Ctx) {
    const { id: requestId } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row } = await supabase
        .from("friend_requests")
        .select("id, sender_id, status")
        .eq("id", requestId)
        .maybeSingle();

    if (!row || row.sender_id !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (row.status !== "pending") {
        return NextResponse.json({ error: "Request is no longer pending" }, { status: 400 });
    }

    const { error } = await supabase
        .from("friend_requests")
        .update({ status: "cancelled", actioned_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("sender_id", user.id)
        .eq("status", "pending");

    if (error) {
        console.error("[friends/requests] DELETE cancel", error);
        return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
