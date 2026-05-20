import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { loadTutorShareSnapshot } from "@/lib/social/load-tutor-share-snapshot";

/**
 * GET — authenticated snapshot of a shared tutor session (read-only).
 * Session owner receives { owner: true, redirect_path } to open their own chat.
 */
export async function GET(
    _request: Request,
    context: { params: Promise<{ token: string }> }
) {
    const { token: rawToken } = await context.params;
    const token = rawToken?.trim();
    if (!token) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const snapshot = await loadTutorShareSnapshot(admin, user.id, token);
    if (!snapshot) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (snapshot.kind === "owner") {
        return NextResponse.json({
            owner: true as const,
            redirect_path: snapshot.redirect_path,
        });
    }

    return NextResponse.json({
        owner: false as const,
        share_token: snapshot.share_token,
        session: snapshot.session,
        messages: snapshot.messages,
    });
}
