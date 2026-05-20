import React from "react";
import { redirect } from "next/navigation";
import { TutoringSessionProvider } from "@/lib/tutoring-session-context";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { DashboardGradeProvider } from "@/lib/dashboard-context";
import { DashboardHeaderProvider } from "@/lib/dashboard-header-context";
import { getSessionUser } from "@/utils/supabase/server";
import { resolveStudentGradeNumber } from "@/lib/student-grade";
import {
    getAiTutorSubjectOptionsForGrade,
    mergeProfileSubjectsForTutorSubjects,
} from "@/lib/chapters";

/**
 * Shared layout for /learn, /ask, /study, /analytics, /friends, /profile/:id,
 * and /learn/[subject].
 *
 * Auth check and profile fetch run ONCE here. Because this is a Next.js
 * route-group layout, it is NOT re-executed when the user navigates between
 * sibling routes — DashboardShell stays mounted and only the {children}
 * slot swaps, making all tab and subject switching instant.
 */
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { supabase, user } = await getSessionUser();
    if (!user) redirect("/auth");

    let profile: {
        full_name?: string | null;
        onboarding_completed?: boolean | null;
        grade?: number | string | null;
        selected_subjects?: string[] | null;
    } | null = null;

    const { data: profileData } = await supabase
        .from("profiles")
        .select("onboarding_completed, full_name, grade, selected_subjects")
        .eq("id", user.id)
        .maybeSingle();

    if (!profileData) {
        const { data: createdProfile } = await supabase
            .from("profiles")
            .insert({
                id: user.id,
                email: user.email ?? null,
                full_name: user.user_metadata?.full_name ?? null,
                onboarding_completed: false,
            })
            .select("onboarding_completed, full_name, grade, selected_subjects")
            .single();
        profile = createdProfile;
    } else {
        profile = profileData;
    }

    if (profile?.onboarding_completed !== true) redirect("/onboarding");

    const grade = resolveStudentGradeNumber(profile?.grade, user);

    // Resolve subject list for analytics and subject filtering
    const fallbackSubjects = getAiTutorSubjectOptionsForGrade(grade).map((s) => s.id);
    const merged = mergeProfileSubjectsForTutorSubjects(grade, profile?.selected_subjects);
    const selectedSubjects =
        merged != null && merged.length > 0 ? merged : fallbackSubjects;

    const userForShell = {
        email: user.email,
        user_metadata: {
            ...user.user_metadata,
            full_name: profile?.full_name ?? user.user_metadata?.full_name,
        },
    };

    return (
        <TutoringSessionProvider>
            <DashboardGradeProvider grade={grade} selectedSubjects={selectedSubjects}>
                <DashboardHeaderProvider>
                    <DashboardShell user={userForShell}>
                        {children}
                    </DashboardShell>
                </DashboardHeaderProvider>
            </DashboardGradeProvider>
        </TutoringSessionProvider>
    );
}
