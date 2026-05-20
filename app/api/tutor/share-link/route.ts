import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { ensureShareTokenForSession } from "@/lib/social/tutor-share";

/** POST { session_id } — owner creates or returns existing share token for a tutor session */
export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { session_id?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const sessionId = body.session_id?.trim();
    if (!sessionId) {
        return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    const { data: session, error: sErr } = await supabase
        .from("tutor_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (sErr || !session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const admin = createAdminClient();
    if (!admin) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const token = await ensureShareTokenForSession(admin, sessionId, user.id);
    if (!token) {
        return NextResponse.json({ error: "Could not create share link" }, { status: 500 });
    }

    return NextResponse.json({ share_token: token });
}
