import React from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TutoringSessionProvider } from "@/lib/tutoring-session-context";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { createAdminClient } from "@/utils/supabase/admin";
import { loadTutorShareSnapshot } from "@/lib/social/load-tutor-share-snapshot";
import { mapTutorRowsToInitialMessages } from "@/lib/tutor/map-tutor-rows-to-initial-messages";

type PageProps = {
    params: Promise<{ token: string }>;
};

export default async function SharedTutorChatPage({ params }: PageProps) {
    const { token } = await params;
    const raw = token?.trim();
    if (!raw) {
        redirect("/ask");
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {}
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth");
    }

    const admin = createAdminClient();
    if (!admin) {
        redirect("/ask");
    }

    const snapshot = await loadTutorShareSnapshot(admin, user.id, raw);
    if (!snapshot) {
        redirect("/ask");
    }

    if (snapshot.kind === "owner") {
        redirect(snapshot.redirect_path);
    }

    const [profileRes] = await Promise.all([
        supabase
            .from("profiles")
            .select("full_name, grade, onboarding_completed")
            .eq("id", user.id)
            .maybeSingle(),
    ]);

    let profile = profileRes.data;
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

    const { grade: metaGrade } = user.user_metadata || {};
    const rawGrade = profile?.grade ?? metaGrade ?? 9;
    let grade =
        typeof rawGrade === "string" && rawGrade.startsWith("Class ")
            ? parseInt(rawGrade.replace("Class ", ""), 10)
            : Number(rawGrade);
    if (Number.isNaN(grade) || grade < 1 || grade > 12) grade = 9;

    const userForShell = {
        email: user.email,
        user_metadata: {
            ...user.user_metadata,
            full_name: profile?.full_name ?? user.user_metadata?.full_name,
        },
    };

    const initialMessages = mapTutorRowsToInitialMessages(snapshot.messages);

    return (
        <TutoringSessionProvider>
            <DashboardShell user={userForShell}>
                <DashboardContent
                    grade={grade}
                    initialSessionId={null}
                    initialMessages={initialMessages}
                    initialSubject={snapshot.session.subject}
                    initialTitle={snapshot.session.title}
                    hasOlderMessages={false}
                    initialChapterIndex={
                        snapshot.session.chapter_index != null
                            ? String(snapshot.session.chapter_index)
                            : null
                    }
                    forcedTutorMode={snapshot.session.mode}
                    initialShareForkToken={snapshot.share_token}
                />
            </DashboardShell>
        </TutoringSessionProvider>
    );
}
