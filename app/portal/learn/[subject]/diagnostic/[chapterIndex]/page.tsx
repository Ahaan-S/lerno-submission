import React from "react";
import { redirect } from "next/navigation";
import { TutoringSessionProvider } from "@/lib/tutoring-session-context";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DiagnosticTest from "@/components/learn/DiagnosticTest";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { resolveStudentGradeNumber } from "@/lib/student-grade";
import { getSessionUser } from "@/utils/supabase/server";

type DiagnosticPageProps = {
  params: Promise<{ subject: string; chapterIndex: string }>;
  searchParams: Promise<{ chapter?: string }>;
};

export default async function DiagnosticPage({ params, searchParams }: DiagnosticPageProps) {
  const { subject, chapterIndex: chapterIndexStr } = await params;
  const { chapter: chapterNameEncoded } = await searchParams;
  const chapterIndex = parseInt(chapterIndexStr, 10);
  const chapterName = chapterNameEncoded ? decodeURIComponent(chapterNameEncoded) : `Chapter ${chapterIndex}`;

  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/auth");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name, grade, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const resolvedProfile = profileData ?? (await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? null,
      full_name: user.user_metadata?.full_name ?? null,
      onboarding_completed: false,
    })
    .select("full_name, grade, onboarding_completed")
    .single()).data;

  if (resolvedProfile?.onboarding_completed !== true) redirect("/onboarding");

  const grade = resolveStudentGradeNumber(resolvedProfile?.grade, user);

  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;

  const userForShell = {
    email: user.email,
    user_metadata: {
      ...user.user_metadata,
      full_name: resolvedProfile?.full_name ?? user.user_metadata?.full_name,
    },
  };

  return (
    <TutoringSessionProvider>
      <DashboardShell user={userForShell} fullHeightContent headerBreadcrumb={[
          { label: subjectLabel, href: `/learn/${subject}` },
          { label: chapterName },
        ]}>
        <DiagnosticTest
          subject={subject}
          subjectLabel={subjectLabel}
          chapterIndex={chapterIndex}
          chapterName={chapterName}
          grade={grade}
        />
      </DashboardShell>
    </TutoringSessionProvider>
  );
}
