import React from "react";
import { redirect } from "next/navigation";
import { TutoringSessionProvider } from "@/lib/tutoring-session-context";
import DashboardShell from "@/components/dashboard/DashboardShell";
import LearnChat from "@/components/learn/LearnChat";
import { getChapterTopicsFromQdrant } from "@/lib/ai/qdrant";
import { getTopicsFromCurriculum } from "@/lib/curriculum";
import { CHAPTER_DATA_11, CHAPTER_DATA_10, CHAPTER_DATA_9, getChapterLimitForSubject, SUBJECT_LABELS } from "@/lib/chapters";
import { getLearnProgressReadKeys } from "@/lib/learn-progress";
import { getNcertBookFromTutorSubject, resolveSubjectSlug } from "@/lib/tutor-subject";
import { resolveStudentGradeNumber } from "@/lib/student-grade";
import type { InlineCitation } from "@/lib/database.types";
import type { GraphArtifact } from "@/lib/graphs/types";
import { getSessionUser } from "@/utils/supabase/server";

type SessionPageProps = {
  params: Promise<{ subject: string; sessionId: string }>;
};

export default async function LearnSessionPage({ params }: SessionPageProps) {
  const { subject, sessionId } = await params;
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/auth");

  // Fetch session and profile in parallel to reduce route latency.
  const [sessionRes, profileRes] = await Promise.all([
    supabase
      .from("tutor_sessions")
      .select("id, subject, chapter_name, chapter_index, mode, title")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, grade, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const session = sessionRes.data;
  let profileData = profileRes.data;

  if (!profileData) {
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
    profileData = createdProfile;
  }

  if (!session) redirect("/learn");
  if (session.mode !== "learn") redirect(`/chat/${sessionId}`);

  if (profileData?.onboarding_completed !== true) redirect("/onboarding");

  const grade = resolveStudentGradeNumber(profileData?.grade, user);

  const chapterIndex = Number(session.chapter_index ?? 1);
  const chapterName = session.chapter_name ?? session.title ?? `Chapter ${chapterIndex}`;
  /** Route param is always the slug; session may store slug or legacy display label ("Geography") */
  const sessionSubjectSlug = resolveSubjectSlug(session.subject ?? subject);
  const chapterLimit = getChapterLimitForSubject(grade, sessionSubjectSlug);
  if (chapterLimit != null && chapterIndex > chapterLimit) redirect(`/learn/${sessionSubjectSlug}`);
  const subjectLabel = SUBJECT_LABELS[sessionSubjectSlug] ?? sessionSubjectSlug;
  const progressReadKeys = getLearnProgressReadKeys(grade, sessionSubjectSlug);
  const sessionNcertBook = getNcertBookFromTutorSubject(sessionSubjectSlug) ?? null;

  // Fetch topics, progress, and messages in parallel
  // Curriculum JSON is the primary source; Qdrant is the fallback (legacy / grades without JSON)
  const curriculumTopics = getTopicsFromCurriculum(grade, sessionSubjectSlug, chapterIndex, chapterName);

  const [qdrantTopics, progressRow, messageRowsDesc] = await Promise.all([
    curriculumTopics.length > 0
      ? Promise.resolve([] as { topic_index: string; topic_name: string }[])
      : getChapterTopicsFromQdrant(grade, sessionSubjectSlug, chapterIndex, sessionNcertBook),
    supabase
      .from("chapter_learn_progress")
      .select("topics_completed, current_topic_index, diagnostic_completed")
      .eq("user_id", user.id)
      .in("subject", progressReadKeys)
      .eq("chapter_index", chapterIndex)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tutor_messages")
      .select("id, role, content, display_content, citations, graph_artifacts, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Priority: curriculum JSON → Qdrant → synthesised single-topic fallback
  let allTopics = curriculumTopics.length > 0 ? curriculumTopics : qdrantTopics;
  if (allTopics.length === 0) {
    const gradeData = grade === 11 ? CHAPTER_DATA_11 : grade === 10 ? CHAPTER_DATA_10 : CHAPTER_DATA_9;
    const sections = gradeData[sessionSubjectSlug] ?? [];
    let staticChapterName = chapterName;
    let globalIdx = 1;
    outer: for (const section of sections) {
      for (const name of section.items) {
        if (globalIdx === chapterIndex) { staticChapterName = name; break outer; }
        globalIdx++;
      }
    }
    allTopics = [{ topic_index: `${chapterIndex}.0`, topic_name: staticChapterName }];
  }

  const topicsCompleted = (progressRow.data?.topics_completed as string[] | null) ?? [];
  const currentTopicIndex = progressRow.data?.current_topic_index ?? allTopics[0]?.topic_index ?? null;

  const initialMessages = ((messageRowsDesc.data ?? []).reverse()).map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    ...(row.display_content ? { display_content: row.display_content as string } : {}),
    citations: row.citations as InlineCitation[] | null | undefined,
    graph_artifacts: row.graph_artifacts as GraphArtifact[] | null | undefined,
    created_at: row.created_at,
  }));

  const userForShell = {
    email: user.email,
    user_metadata: {
      ...user.user_metadata,
      full_name: profileData?.full_name ?? user.user_metadata?.full_name,
    },
  };

  return (
    <TutoringSessionProvider>
      <DashboardShell
        user={userForShell}
        fullHeightContent
        headerBreadcrumb={
          subject.startsWith("social_")
            ? [
                { label: "Social Science", href: "/learn/social" },
                { label: subjectLabel, href: `/learn/${subject}` },
                { label: chapterName },
              ]
            : [
                { label: subjectLabel, href: `/learn/${subject}` },
                { label: chapterName },
              ]
        }
      >
        <LearnChat
          sessionId={sessionId}
          subject={sessionSubjectSlug}
          chapterIndex={chapterIndex}
          chapterName={chapterName}
          grade={grade}
          initialMessages={initialMessages}
          topics={allTopics}
          currentTopicIndex={currentTopicIndex}
          topicsCompleted={topicsCompleted}
        />
      </DashboardShell>
    </TutoringSessionProvider>
  );
}
