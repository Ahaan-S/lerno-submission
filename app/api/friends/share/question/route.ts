import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { areFriends, isBlockedBetween } from "@/lib/social/friend-api-helpers";
import type { QuestionShareMetadata } from "@/lib/social/share-types";

function previewStem(text: string, max: number): string {
    const oneLine = text.replace(/\s+/g, " ").trim();
    if (oneLine.length <= max) return oneLine;
    return `${oneLine.slice(0, max - 1)}…`;
}

/** POST { questionId, recipientId, note? } — DM + notification */
export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { questionId?: string; recipientId?: string; note?: string | null };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const questionId = body.questionId?.trim();
    const recipientId = body.recipientId?.trim();
    const note =
        typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";

    if (!questionId || !recipientId || recipientId === user.id) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (await isBlockedBetween(supabase, user.id, recipientId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const friends = await areFriends(supabase, user.id, recipientId);
    if (!friends) {
        return NextResponse.json({ error: "You can only share with friends" }, { status: 403 });
    }

    const { data: q, error: qErr } = await supabase
        .from("study_questions")
        .select(
            "id, question_code, grade, subject, chapter_name, chapter_index, question_type, question_text, question_image_url"
        )
        .eq("id", questionId)
        .eq("is_active", true)
        .maybeSingle();

    if (qErr || !q) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const admin = createAdminClient();
    if (!admin) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const { data: threadId, error: rpcErr } = await supabase.rpc("upsert_dm_thread", {
        p_user_a: user.id,
        p_user_b: recipientId,
    });

    if (rpcErr || !threadId) {
        console.error("[share/question] upsert_dm_thread", rpcErr);
        return NextResponse.json({ error: "Could not open conversation" }, { status: 500 });
    }

    const preview = previewStem(q.question_text ?? "", 120);
    const chapterIndex = typeof q.chapter_index === "number" ? q.chapter_index : Number(q.chapter_index) || 0;
    const grade = typeof q.grade === "number" ? q.grade : Number(q.grade) || 0;

    const questionImageUrl =
        typeof (q as { question_image_url?: string | null }).question_image_url === "string"
            ? (q as { question_image_url: string }).question_image_url.trim() || null
            : null;
    const hasImage = Boolean(questionImageUrl);

    const metadata: QuestionShareMetadata = {
        question_id: q.id,
        question_code: q.question_code ?? null,
        grade,
        subject: q.subject,
        chapter_name: q.chapter_name ?? "",
        chapter_index: chapterIndex,
        question_type: q.question_type,
        preview,
        has_image: hasImage,
        question_image_url: questionImageUrl,
    };

    const content =
        note ||
        `Shared a ${q.subject} question — ${q.chapter_name ?? "Practice"}`;

    const { data: prof } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const senderName = prof?.full_name?.trim() || "Someone";

    const { error: dmErr } = await admin.from("direct_messages").insert({
        thread_id: threadId as string,
        sender_id: user.id,
        content,
        message_type: "question_share",
        metadata: metadata as unknown as Record<string, unknown>,
    });

    if (dmErr) {
        console.error("[share/question] direct_messages", dmErr);
        return NextResponse.json({ error: "Failed to send share" }, { status: 500 });
    }

    const { error: nErr } = await admin.from("notifications").insert({
        user_id: recipientId,
        actor_id: user.id,
        type: "question_shared",
        title: `${senderName} shared a study question`,
        body: note || null,
        data: {
            thread_id: threadId,
            question_id: q.id,
            sender_display_name: senderName,
            subject: q.subject,
            chapter_index: chapterIndex,
        },
    });

    if (nErr) {
        console.error("[share/question] notifications", nErr);
        return NextResponse.json({ error: "Message sent but notification failed" }, { status: 207 });
    }

    return NextResponse.json({ ok: true, threadId });
}
