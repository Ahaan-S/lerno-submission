import React from "react";
import { redirect } from "next/navigation";
import { TutoringSessionProvider } from "@/lib/tutoring-session-context";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { mapTutorRowsToInitialMessages } from "@/lib/tutor/map-tutor-rows-to-initial-messages";
import { getSessionUser } from "@/utils/supabase/server";

type ChatPageProps = {
    params: Promise<{ sessionId: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
    const { sessionId } = await params;
    const { supabase, user } = await getSessionUser();

    if (!user) {
        redirect("/auth");
    }

    const { grade: metaGrade } = user.user_metadata || {};

    const [profileRes, sessionRes, messagesRes] = await Promise.all([
        supabase
            .from("profiles")
            .select("full_name, grade, onboarding_completed")
            .eq("id", user.id)
            .maybeSingle(),
        supabase
            .from("tutor_sessions")
            .select("id, subject, title, starred, chapter_index")
            .eq("id", sessionId)
            .eq("user_id", user.id)
            .maybeSingle(),
        // Load last 10 messages — older ones are fetched client-side on scroll
        supabase
            .from("tutor_messages")
            .select("id, role, content, task_type, citations, graph_artifacts, thinking, attachments, created_at")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(10),
    ]);

    let profile = profileRes.data;
    const session = sessionRes.data;
    const messageRowsDesc = messagesRes.data;

    if (!profile) {
        const { data: createdProfile } = await supabase
            .from("profiles")
            .insert({
                id: user.id,
                email: user.email ?? null,
                full_name: user.user_metadata?.full_name ?? null,
                onboarding_completed: false,
            })
            .select("full_name, grade, onboarding_completed")
            .single();
        profile = createdProfile;
    }

    if (profile?.onboarding_completed !== true) {
        redirect("/onboarding");
    }

    if (!session) {
        redirect("/ask");
    }
    const messageRows = (messageRowsDesc ?? []).reverse();
    const hasOlderMessages = (messageRowsDesc ?? []).length >= 10;

    const userForShell = {
        email: user.email,
        user_metadata: {
            ...user.user_metadata,
            full_name: profile?.full_name ?? user.user_metadata?.full_name,
        },
    };

    // Profile is source of truth (updatable); auth metadata can be stale from initial onboarding
    const rawGrade = profile?.grade ?? metaGrade ?? 9;
    let grade = typeof rawGrade === "string" && rawGrade.startsWith("Class ")
        ? parseInt(rawGrade.replace("Class ", ""), 10)
        : Number(rawGrade);
    if (Number.isNaN(grade) || grade < 1 || grade > 12) grade = 9;
    // Dev: verify grade source (profile takes precedence over auth)
    console.log("[chat/page] Grade for session:", { profileGrade: profile?.grade, metaGrade, rawGrade, resolved: grade });
    const initialMessages = mapTutorRowsToInitialMessages(messageRows ?? []);

    return (
        <TutoringSessionProvider>
            <DashboardShell user={userForShell} fullHeightContent>
                <DashboardContent
                    grade={grade}
                    initialSessionId={session.id}
                    initialMessages={initialMessages}
                    initialSubject={session.subject}
                    initialTitle={(session as { title?: string | null }).title ?? null}
                    hasOlderMessages={hasOlderMessages}
                    initialChapterIndex={(session as { chapter_index?: string | number | null }).chapter_index != null
                        ? String((session as { chapter_index?: string | number | null }).chapter_index)
                        : null}
                />
            </DashboardShell>
        </TutoringSessionProvider>
    );
}
