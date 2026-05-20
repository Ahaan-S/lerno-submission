import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveSubjectSlug } from "@/lib/tutor-subject";
import { buildLearnProgressSubjectKey } from "@/lib/learn-progress";
import { tutorChatPathForSession } from "@/lib/social/tutor-share";

/** POST { token } — copy shared session + messages into the current user's account (ChatGPT-style fork). */
export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { token?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const token = body.token?.trim();
    if (!token) {
        return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const { data: shareRow, error: shareErr } = await admin
        .from("tutor_session_shares")
        .select("session_id")
        .eq("share_token", token)
        .maybeSingle();

    if (shareErr || !shareRow) {
        return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    const sourceSessionId = shareRow.session_id as string;

    const { data: source, error: srcErr } = await admin
        .from("tutor_sessions")
        .select(
            "id, user_id, subject, chapter_name, chapter_index, title, grade, mode, starred"
        )
        .eq("id", sourceSessionId)
        .maybeSingle();

    if (srcErr || !source) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sourceOwnerId = source.user_id as string;
    const sourceMode = (source.mode as string | null) ?? null;
    /** DB requires non-null mode; ask + legacy rows use "ask". */
    const forkMode = sourceMode === "learn" ? "learn" : "ask";
    const subjectRaw = String(source.subject ?? "");
    const subjectSlug = resolveSubjectSlug(subjectRaw);

    if (user.id === sourceOwnerId) {
        return NextResponse.json({
            session_id: sourceSessionId,
            redirect_path: tutorChatPathForSession(sourceMode, subjectSlug, sourceSessionId),
            reused: true as const,
        });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("grade")
        .eq("id", user.id)
        .maybeSingle();

    const rawG = profile?.grade;
    let viewerGrade =
        typeof rawG === "string" && rawG.startsWith("Class ")
            ? Number(rawG.replace("Class ", ""))
            : Number(rawG ?? 10);
    if (!Number.isFinite(viewerGrade) || viewerGrade < 1 || viewerGrade > 12) {
        viewerGrade = Number(source.grade ?? 10) || 10;
    }

    const { data: newSession, error: insSessErr } = await admin
        .from("tutor_sessions")
        .insert({
            user_id: user.id,
            subject: subjectRaw,
            chapter_name: source.chapter_name ?? null,
            chapter_index: source.chapter_index ?? null,
            title: source.title ?? null,
            grade: viewerGrade,
            mode: forkMode,
            starred: false,
        })
        .select("id")
        .single();

    if (insSessErr || !newSession) {
        console.error("[tutor/share/fork] insert session", insSessErr);
        return NextResponse.json({ error: "Could not create your copy" }, { status: 500 });
    }

    const newId = newSession.id as string;

    const { data: msgs, error: msgErr } = await admin
        .from("tutor_messages")
        .select("role, content, task_type, citations, graph_artifacts, thinking, attachments, created_at")
        .eq("session_id", sourceSessionId)
        .order("created_at", { ascending: true });

    if (msgErr) {
        console.error("[tutor/share/fork] load messages", msgErr);
        await admin.from("tutor_sessions").delete().eq("id", newId);
        return NextResponse.json({ error: "Could not copy messages" }, { status: 500 });
    }

    const rows = msgs ?? [];
    const chunkSize = 80;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize).map((m) => ({
            session_id: newId,
            role: m.role,
            content: m.content,
            task_type: m.task_type ?? null,
            citations: m.citations ?? null,
            graph_artifacts: (m as { graph_artifacts?: unknown }).graph_artifacts ?? null,
            thinking: m.thinking ?? null,
            attachments: (m as { attachments?: unknown }).attachments ?? null,
        }));
        const { error: insMsgErr } = await admin.from("tutor_messages").insert(slice);
        if (insMsgErr) {
            console.error("[tutor/share/fork] insert messages", insMsgErr);
            await admin.from("tutor_sessions").delete().eq("id", newId);
            return NextResponse.json({ error: "Could not copy messages" }, { status: 500 });
        }
    }

    if (forkMode === "learn") {
        const progressSubjectKey = buildLearnProgressSubjectKey(viewerGrade, subjectSlug);
        const chapterIdx = Number(source.chapter_index ?? 1);
        const now = new Date().toISOString();
        const chapterName =
            (source.chapter_name as string | null)?.trim() || `Chapter ${chapterIdx}`;

        const { error: progErr } = await admin.from("chapter_learn_progress").upsert(
            {
                user_id: user.id,
                subject: progressSubjectKey,
                chapter_index: chapterIdx,
                chapter_name: chapterName,
                status: "in_progress",
                last_session_id: newId,
                last_session_at: now,
                updated_at: now,
            },
            { onConflict: "user_id,subject,chapter_index" }
        );

        if (progErr) {
            console.warn("[tutor/share/fork] chapter_learn_progress upsert", progErr);
        }
    }

    return NextResponse.json({
        session_id: newId,
        redirect_path: tutorChatPathForSession(forkMode, subjectSlug, newId),
        reused: false as const,
    });
}
