import React from "react";
import { redirect } from "next/navigation";
import RecommendationCard from "@/components/learn/RecommendationCard";
import SocialSubjectPicker from "@/components/learn/SocialSubjectPicker";
import { DashboardBreadcrumbSetter } from "@/lib/dashboard-header-context";
import { SUBJECT_LABELS, getAiTutorSubjectOptionsForGrade } from "@/lib/chapters";
import { loadLearnRecommendation } from "@/lib/learn/recommendation-data";
import { resolveStudentGradeNumber } from "@/lib/student-grade";
import { getSessionUser } from "@/utils/supabase/server";

type SubjectPageProps = {
  params: Promise<{ subject: string }>;
};

/**
 * Subject chapter list — lives under (dashboard) so DashboardShell stays mounted.
 *
 * Auth and profile are already verified by the shared (dashboard)/layout.tsx.
 * This page only needs `user.id` + `grade` for `loadLearnRecommendation`, so we
 * skip the redundant `profiles` DB query and derive grade from user metadata.
 */
export default async function SubjectRecommendationPage({ params }: SubjectPageProps) {
  const { subject } = await params;
  const { user } = await getSessionUser();
  if (!user) redirect("/auth");

  // Grade from user metadata — avoids an extra profiles DB round-trip.
  // The layout already verified onboarding and the session, so this is safe.
  const grade = resolveStudentGradeNumber(
    (user.user_metadata as { grade?: string | number | null } | undefined)?.grade ?? null,
    user,
  );

  const allowedSubjects = getAiTutorSubjectOptionsForGrade(grade).map((s) => s.id);
  const allowedWithSocialSubs = allowedSubjects.includes("social")
    ? [...allowedSubjects, "social_history", "social_geography", "social_civics", "social_economics"]
    : allowedSubjects;
  if (!allowedWithSocialSubs.includes(subject)) redirect("/learn");

  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const isSocialPicker = subject === "social";
  const isSocialSub = subject.startsWith("social_");

  if (isSocialPicker) {
    return (
      <>
        <DashboardBreadcrumbSetter crumbs={[{ label: "Social Science" }]} />
        <SocialSubjectPicker />
      </>
    );
  }

  let chapters: Awaited<ReturnType<typeof loadLearnRecommendation>>["chapters"] = [];
  let recommendedChapterIndex: number | null = null;
  let recommendationMessage = "Ready to continue your learning journey?";

  try {
    const { supabase } = await getSessionUser();
    const rec = await loadLearnRecommendation(supabase, user.id, subject, grade);
    chapters = rec.chapters;
    recommendedChapterIndex = rec.recommended_chapter_index;
    recommendationMessage = rec.recommendation_message;
  } catch (err) {
    console.error("[SubjectRecommendationPage] loadLearnRecommendation failed:", err);
  }

  const breadcrumb = isSocialSub
    ? [{ label: "Social Science", href: "/learn/social" }, { label: subjectLabel }]
    : [{ label: subjectLabel }];

  return (
    <>
      <DashboardBreadcrumbSetter crumbs={breadcrumb} />
      <div className="flex flex-col items-center justify-center min-h-full py-16 px-6">
        <div className="w-full max-w-[520px] flex flex-col gap-8">
          <div className="flex flex-col gap-2 text-center">
            <h1
              className="text-[32px] font-semibold"
              style={{ fontFamily: "var(--font-crimson-pro)", color: "var(--base-800)" }}
            >
              Choose a chapter
            </h1>
            <p className="text-[15px]" style={{ fontFamily: "var(--font-inter)", color: "var(--base-400)" }}>
              Your tutor will guide you through each topic, one step at a time.
            </p>
          </div>
          <RecommendationCard
            subject={subject}
            subjectLabel={subjectLabel}
            grade={grade}
            chapters={chapters}
            recommendedChapterIndex={recommendedChapterIndex}
            recommendationMessage={recommendationMessage}
          />
        </div>
      </div>
    </>
  );
}
