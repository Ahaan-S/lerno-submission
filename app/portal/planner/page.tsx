import React from "react";
import { redirect } from "next/navigation";
import { TutoringSessionProvider } from "@/lib/tutoring-session-context";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PlannerPage from "@/components/planner/PlannerPage";
import { getSessionUser } from "@/utils/supabase/server";

export const metadata = { title: "Study Planner — Lerno" };

export default async function PlannerRoute() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, grade, onboarding_completed, selected_subjects")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  const userForShell = {
    email: user.email,
    user_metadata: { full_name: profile?.full_name ?? user.user_metadata?.full_name },
  };

  const fromProfile = profile?.selected_subjects;
  const profileSubjects = Array.isArray(fromProfile) ? fromProfile.filter(Boolean) : [];
  const coreSubjects = ["science", "math", "english", "hindi", "social", "french"];
  const selectedSubjects: string[] =
    profileSubjects.length > 0 ? profileSubjects : coreSubjects;

  return (
    <TutoringSessionProvider>
      <DashboardShell user={userForShell} fullHeightContent>
        <PlannerPage selectedSubjects={selectedSubjects} />
      </DashboardShell>
    </TutoringSessionProvider>
  );
}
