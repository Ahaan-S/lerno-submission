"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { startTopLoader } from "@/components/ui/TopLoader";
import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  CHAPTER_DATA_9,
  CHAPTER_DATA_10,
  CHAPTER_DATA_11,
  getAiTutorSubjectOptionsForGrade,
  SUBJECT_LABELS,
  type Section,
} from "@/lib/chapters";
import { parseLearnProgressStoredSubject } from "@/lib/learn-progress";
import { useDashboardGrade } from "@/lib/dashboard-context";

function getTotalChapters(grade: number, subjectId: string): number {
  const data = grade === 11 ? CHAPTER_DATA_11 : grade === 10 ? CHAPTER_DATA_10 : CHAPTER_DATA_9;
  const sections: Section[] = data[subjectId] ?? [];
  return sections.reduce((sum, s) => sum + s.items.length, 0);
}

/** `chapter_learn_progress.subject` uses per-book labels (not the umbrella "Social Science"). */
const SST_PROGRESS_LABELS = [
  SUBJECT_LABELS.social_history,
  SUBJECT_LABELS.social_geography,
  SUBJECT_LABELS.social_civics,
  SUBJECT_LABELS.social_economics,
  "Civics", // legacy rows before label was unified to "Political Science"
] as const;


const ScienceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
    <path d="M6.453 15h11.094" />
    <path d="M8.5 2h7" />
  </svg>
);

const PhysicsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" />
    <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" />
  </svg>
);

const MathIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <line x1="8" x2="16" y1="6" y2="6" />
    <line x1="16" x2="16" y1="14" y2="18" />
    <path d="M16 10h.01" />
    <path d="M12 10h.01" />
    <path d="M8 10h.01" />
    <path d="M12 14h.01" />
    <path d="M8 14h.01" />
    <path d="M12 18h.01" />
    <path d="M8 18h.01" />
  </svg>
);

const SocialIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="m20.893 13.393-1.135-1.135a2.252 2.252 0 0 1-.421-.585l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 0 1-1.81 1.025 1.055 1.055 0 0 1-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 0 1-1.383-2.46l.007-.042a2.25 2.25 0 0 1 .29-.787l.09-.15a2.25 2.25 0 0 1 2.37-1.048l1.178.236a1.125 1.125 0 0 0 1.302-.795l.208-.73a1.125 1.125 0 0 0-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 0 1-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 0 1-1.458-1.137l1.411-2.353a2.25 2.25 0 0 0 .286-.76m11.928 9.869A9 9 0 0 0 8.965 3.525m11.928 9.868A9 9 0 1 1 8.965 3.525" />
  </svg>
);

const BiologyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
    <path d="M9 10c2 0 2-2 4-2" />
    <path d="M8 14c2 0 2-2 4-2" />
  </svg>
);

const EnglishIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    <path d="m8 13 4-7 4 7" />
    <path d="M9.1 11h5.7" />
  </svg>
);

const FrenchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13h4" />
    <path d="M12 6v7" />
    <path d="M16 8V6H8v2" />
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
  </svg>
);

const HindiIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 8 6 6" />
    <path d="m4 14 6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" />
    <path d="M14 18h6" />
  </svg>
);

const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5v-13A2.5 2.5 0 0 1 6.5 2Z" />
  </svg>
);

const BusinessStudiesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12h.01" />
    <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <path d="M22 13a18.15 18.15 0 0 1-20 0" />
    <rect width="20" height="14" x="2" y="6" rx="2" />
  </svg>
);

const EconomicsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="12" x="2" y="6" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>
);

const AccountancyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" />
    <path d="M16 10h.01" />
    <path d="M2 8v1a2 2 0 0 0 2 2h1" />
  </svg>
);

const ComputerScienceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z" />
    <path d="M20.054 15.987H3.946" />
  </svg>
);

const SUBJECT_ICON_BY_ID: Record<string, () => React.JSX.Element> = {
  science: ScienceIcon,
  physics: PhysicsIcon,
  math: MathIcon,
  social: SocialIcon,
  chemistry: ScienceIcon,
  biology: BiologyIcon,
  economics: EconomicsIcon,
  accountancy: AccountancyIcon,
  business_studies: BusinessStudiesIcon,
  english: EnglishIcon,
  hindi: HindiIcon,
  french: FrenchIcon,
  computer_science: ComputerScienceIcon,
};

export default function SubjectSelector({ grade = 10 }: { grade?: number }) {
  const router = useRouter();
  const [completedCounts, setCompletedCounts] = useState<Record<string, number>>({});
  const { selectedSubjects: contextSubjects } = useDashboardGrade();
  // Initialise directly from context so the grid renders on first paint
  // without waiting for the chapter_learn_progress query.
  const [selectedSubjects, setSelectedSubjects] = useState<string[] | null>(
    contextSubjects.length > 0 ? contextSubjects : null
  );
  /** Tracks whether the chapter_learn_progress query has finished (subjects are ready from context). */
  const [subjectFilterReady, setSubjectFilterReady] = useState(contextSubjects.length > 0);
  /** Track which subject hrefs have already been prefetched to avoid duplicate calls. */
  const prefetchedSubjects = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function fetchProgress() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const progressResult = await supabase
          .from("chapter_learn_progress")
          .select("subject, status")
          .eq("user_id", user.id);

        if (progressResult.data) {
          const counts: Record<string, number> = {};
          for (const row of progressResult.data) {
            const rawSubject = String(row.subject ?? "");
            const isScoped = rawSubject.startsWith("grade_");
            const isCurrentGradeRow = grade === 11 ? rawSubject.startsWith("grade_11:") : (rawSubject.startsWith("grade_10:") || !isScoped);
            if (!isCurrentGradeRow) continue;
            if (row.status === "completed") {
              const normalized = parseLearnProgressStoredSubject(rawSubject);
              counts[normalized] = (counts[normalized] ?? 0) + 1;
            }
          }
          setCompletedCounts(counts);
        }
      } finally {
        setSubjectFilterReady(true);
      }
    }

    void fetchProgress();
  }, [grade]);

  if (!subjectFilterReady) {
    const skeletonCount = getAiTutorSubjectOptionsForGrade(grade).length;
    const skeletonGridClass =
      skeletonCount === 1
        ? "grid grid-cols-1 max-w-[240px] mx-auto gap-3.5 sm:gap-4 w-full"
        : skeletonCount === 2
          ? "grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 max-w-[480px] mx-auto w-full"
          : "grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4";
    return (
      <div className="w-full max-w-[720px] mx-auto px-4 flex flex-col gap-4 sm:gap-5">
        <p
          className="text-[14px] text-center"
          style={{
            fontFamily: "var(--font-inter)",
            color: "var(--base-400)",
            fontWeight: 400,
            marginTop: "-10px",
          }}
        >
          What are you learning today?
        </p>
        <div
          className={skeletonGridClass}
          aria-busy="true"
          aria-label="Loading subjects"
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border bg-[#F8FAFC] animate-pulse min-h-[120px] sm:min-h-[160px]"
              style={{ borderColor: "#E2E8F0" }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 flex flex-col gap-4 sm:gap-5">
      {/* Section label */}
      <p
        className="text-[14px] text-center"
        style={{
          fontFamily: "var(--font-inter)",
          color: "var(--base-400)",
          fontWeight: 400,
          marginTop: '-10px',
        }}
      >
        What are you learning today?
      </p>

      {/* Subject grid */}
      {(() => {
        const gradeSubjects = getAiTutorSubjectOptionsForGrade(grade).map((subject) => ({
          ...subject,
          Icon: SUBJECT_ICON_BY_ID[subject.id] ?? BookIcon,
        }));
        const visibleSubjects = gradeSubjects.filter((subject) => selectedSubjects === null || selectedSubjects.includes(subject.id));
        const colClass =
          visibleSubjects.length === 1
            ? "grid grid-cols-1 max-w-[240px] mx-auto gap-3.5 sm:gap-4 w-full"
            : visibleSubjects.length === 2
            ? "grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 max-w-[480px] mx-auto w-full"
            : visibleSubjects.length === 4
            ? "grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4"
            : "grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4";
        return (
          <div className={colClass}>
            {visibleSubjects.map((subject, i) => {
              const total = getTotalChapters(grade, subject.id);
              const completed =
                subject.id === "social"
                  ? SST_PROGRESS_LABELS.reduce((sum, label) => sum + (completedCounts[label] ?? 0), 0)
                  : (completedCounts[SUBJECT_LABELS[subject.id] ?? subject.label] ?? 0);
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <motion.button
                  key={subject.id}
                  type="button"
                  onClick={() => { startTopLoader(); router.push(`/learn/${subject.id}`); }}
                  onMouseEnter={() => {
                    if (!prefetchedSubjects.current.has(subject.id)) {
                      prefetchedSubjects.current.add(subject.id);
                      router.prefetch(`/learn/${subject.id}`);
                    }
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  whileTap={{ scale: 0.98 }}
                  className="group border text-left cursor-pointer transition-colors duration-150 bg-white hover:bg-[#F4F6F8] rounded-2xl sm:rounded-2xl"
                  style={{
                    borderColor: "#E2E8F0",
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  {/* Mobile: horizontal layout */}
                  <div className="flex sm:hidden items-center gap-4 px-5 py-4">
                    <div
                      className="shrink-0 transition-colors duration-150"
                      style={{ color: "var(--primary-400)" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        {(subject.id === "science" || subject.id === "physics") && <>
                          <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
                          <path d="M6.453 15h11.094" /><path d="M8.5 2h7" />
                        </>}
                        {subject.id === "math" && <>
                          <rect width="16" height="20" x="4" y="2" rx="2" />
                          <line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" />
                          <path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" />
                          <path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" />
                        </>}
                        {subject.id === "social" && <path d="m20.893 13.393-1.135-1.135a2.252 2.252 0 0 1-.421-.585l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 0 1-1.81 1.025 1.055 1.055 0 0 1-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 0 1-1.383-2.46l.007-.042a2.25 2.25 0 0 1 .29-.787l.09-.15a2.25 2.25 0 0 1 2.37-1.048l1.178.236a1.125 1.125 0 0 0 1.302-.795l.208-.73a1.125 1.125 0 0 0-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 0 1-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 0 1-1.458-1.137l1.411-2.353a2.25 2.25 0 0 0 .286-.76m11.928 9.869A9 9 0 0 0 8.965 3.525m11.928 9.868A9 9 0 1 1 8.965 3.525" />}
                        {(subject.id === "chemistry") && <>
                          <path d="M9 3h6" />
                          <path d="M10 3v5.5l-4.5 7.8A2 2 0 0 0 7.2 19h9.6a2 2 0 0 0 1.7-2.7L14 8.5V3" />
                          <path d="M8.5 14h7" />
                        </>}
                        {(subject.id === "biology") && <>
                          <path d="M12 22s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
                          <path d="M9 10c2 0 2-2 4-2" />
                          <path d="M8 14c2 0 2-2 4-2" />
                        </>}
                        {!(["science","physics","math","social","chemistry","biology"].includes(subject.id)) && <>
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5v-13A2.5 2.5 0 0 1 6.5 2Z" />
                        </>}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[15px] font-semibold leading-snug"
                        style={{ color: "var(--base-700)" }}
                      >
                        {subject.label}
                      </p>
                      <p className="text-[13px] mt-1" style={{ color: "var(--base-400)" }}>
                        {completed}/{total} chapters
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 w-16">
                      <p className="text-[12px] font-medium" style={{ color: "var(--primary-400)" }}>{pct}%</p>
                      <div className="w-full rounded-full overflow-hidden" style={{ height: "3px", backgroundColor: "#E2E8F0" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: "var(--primary-400)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Desktop: vertical layout (unchanged) */}
                  <div className="hidden sm:flex flex-col items-start p-6" style={{ minHeight: "160px" }}>
                    <div
                      className="mb-[18px] transition-colors duration-150"
                      style={{ color: "var(--primary-400)" }}
                    >
                      <subject.Icon />
                    </div>
                    <p
                      className="text-[16px] font-semibold leading-snug transition-colors duration-150 group-hover:text-[var(--base-800)]"
                      style={{ color: "var(--base-700)" }}
                    >
                      {subject.label}
                    </p>
                    <div className="flex items-center justify-between w-full mt-[10px]">
                      <p
                        className="text-[14px] transition-colors duration-150 group-hover:text-[var(--base-500)]"
                        style={{ color: "var(--base-400)" }}
                      >
                        {completed}/{total} chapters
                      </p>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth={2.5}
                        strokeLinecap="round" strokeLinejoin="round"
                        className="transition-all duration-150 group-hover:translate-x-0.5"
                        style={{ color: "var(--base-500)" }}
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="w-full mt-3 rounded-full overflow-hidden" style={{ height: "3px", backgroundColor: "#E2E8F0" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: "var(--primary-400)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
