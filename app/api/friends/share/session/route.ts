import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { areFriends, isBlockedBetween } from "@/lib/social/friend-api-helpers";
import type { SessionShareMetadata } from "@/lib/social/share-types";
import { ensureShareTokenForSession } from "@/lib/social/tutor-share";

/** POST { sessionId, recipientId, note? } — DM + notification */
export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { sessionId?: string; recipientId?: string; note?: string | null };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const sessionId = body.sessionId?.trim();
    const recipientId = body.recipientId?.trim();
    const note =
        typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";

    if (!sessionId || !recipientId || recipientId === user.id) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (await isBlockedBetween(supabase, user.id, recipientId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!(await areFriends(supabase, user.id, recipientId))) {
        return NextResponse.json({ error: "You can only share with friends" }, { status: 403 });
    }

    const { data: row, error: sErr } = await supabase
        .from("tutor_sessions")
        .select("id, user_id, subject, title, chapter_name, chapter_index, grade, mode")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (sErr || !row) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const modeRaw = (row as { mode?: string | null }).mode;
    const mode: SessionShareMetadata["mode"] =
        modeRaw === "learn" ? "learn" : "ask";

    const admin = createAdminClient();
    if (!admin) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const shareToken = await ensureShareTokenForSession(admin, sessionId, user.id);

    const { data: threadId, error: rpcErr } = await supabase.rpc("upsert_dm_thread", {
        p_user_a: user.id,
        p_user_b: recipientId,
    });

    if (rpcErr || !threadId) {
        console.error("[share/session] upsert_dm_thread", rpcErr);
        return NextResponse.json({ error: "Could not open conversation" }, { status: 500 });
    }

    const metadata: SessionShareMetadata = {
        session_id: row.id,
        ...(shareToken ? { share_token: shareToken } : {}),
        subject: row.subject,
        title: row.title ?? null,
        grade: row.grade ?? null,
        mode,
        chapter_name: row.chapter_name ?? null,
        chapter_index: row.chapter_index ?? null,
    };

    const titleLine = row.title?.trim() || row.subject;
    const content = note || `Shared a tutor chat — ${titleLine}`;

    const { data: prof } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const senderName = prof?.full_name?.trim() || "Someone";

    const { error: dmErr } = await admin.from("direct_messages").insert({
        thread_id: threadId as string,
        sender_id: user.id,
        content,
        message_type: "session_share",
        metadata: metadata as unknown as Record<string, unknown>,
    });

    if (dmErr) {
        console.error("[share/session] direct_messages", dmErr);
        return NextResponse.json({ error: "Failed to send share" }, { status: 500 });
    }

    const { error: nErr } = await admin.from("notifications").insert({
        user_id: recipientId,
        actor_id: user.id,
        type: "session_shared",
        title: `${senderName} shared a tutor session`,
        body: note || null,
        data: {
            thread_id: threadId,
            session_id: row.id,
            sender_display_name: senderName,
            mode,
        },
    });

    if (nErr) {
        console.error("[share/session] notifications", nErr);
        return NextResponse.json({ error: "Message sent but notification failed" }, { status: 207 });
    }

    return NextResponse.json({ ok: true, threadId });
}
