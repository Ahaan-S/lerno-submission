import React from "react";
import { redirect } from "next/navigation";
import { TutoringSessionProvider } from "@/lib/tutoring-session-context";
import DashboardShell from "@/components/dashboard/DashboardShell";
import FeedbackPage from "@/components/feedback/FeedbackPage";
import { getSessionUser } from "@/utils/supabase/server";

export const metadata = { title: "Feedback — Lerno" };

export default async function PortalFeedbackPage() {
  const { supabase, user } = await getSessionUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, grade, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  const name = profile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? "Student";
  const email = user.email ?? "";
  const grade = profile?.grade ?? null;

  const userForShell = {
    email: user.email,
    user_metadata: {
      ...user.user_metadata,
      full_name: profile?.full_name ?? user.user_metadata?.full_name,
      grade,
    },
  };

  return (
    <TutoringSessionProvider>
      <DashboardShell user={userForShell} headerTitle="Feedback" fullHeightContent>
        <FeedbackPage name={name} email={email} grade={grade} />
      </DashboardShell>
    </TutoringSessionProvider>
  );
}
