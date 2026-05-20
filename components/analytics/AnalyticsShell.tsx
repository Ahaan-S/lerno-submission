"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { StatCard, StatCardSkeleton } from "@/components/analytics/StatCard";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { ActivityChart, ActivityChartSkeleton, type ActivitySeriesPoint } from "@/components/analytics/ActivityChart";
import { TimeOfDayChart, TimeOfDayChartSkeleton } from "@/components/analytics/TimeOfDayChart";
import { SubjectCompletion, type SubjectCompletionRow } from "@/components/analytics/SubjectCompletion";
import { MistakeFrequency, MistakeFrequencySkeleton, type MistakeRow } from "@/components/analytics/MistakeFrequency";
import { ChapterMastery, ChapterMasterySkeleton, type MasteryCard } from "@/components/analytics/ChapterMastery";
import { SessionDistribution, SessionDistributionSkeleton } from "@/components/analytics/SessionDistribution";
import { ProgressComparison, ProgressComparisonSkeleton } from "@/components/analytics/ProgressComparison";

type SummaryJson = {
  selected_subject: { chapters_completed: number; chapters_total: number };
  overall: {
    questions_answered: number;
    questions_this_week: number;
    average_accuracy: number;
    accuracy_delta_vs_last_month: number;
    active_study_days: number;
    current_streak: number;
    total_minutes_active: number;
  };
};

type ActivityJson = {
  range: string;
  series: ActivitySeriesPoint[];
  time_of_day: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
    peak: string;
  };
  period_totals: {
    this_week_questions: number;
    last_week_questions: number;
    week_delta_pct: number;
    this_month_questions: number;
    last_month_questions: number;
    month_delta_pct: number;
  };
};

type SubjectsJson = {
  subject_completion: SubjectCompletionRow[];
  strong_chapters: MasteryCard[];
  weak_chapters: MasteryCard[];
  mistake_topics: MistakeRow[];
};

type SessionsJson = {
  avg_session_minutes: number;
  distribution: { lt15: number; min15_30: number; min30_60: number; gt60: number; total: number };
};

type ComparisonJson = {
  this_term: { accuracy: number; questions_answered: number; chapters_completed: number };
  last_term: { accuracy: number; questions_answered: number; chapters_completed: number };
  delta_pct: { accuracy: number; questions_answered: number; chapters_completed: number };
};

function formatMinutes(mins: number): string {
  if (mins <= 0) return "No time tracked yet";
  if (mins < 60) return `${mins} min on Lerno`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h total on Lerno` : `${h}h ${m}m total on Lerno`;
}

export function AnalyticsShell({ grade, subjectIds }: { grade: number; subjectIds: string[] }) {
  const safeSubjects = useMemo(
    () => (subjectIds.length > 0 ? subjectIds : ["science"]),
    [subjectIds],
  );
  const [index, setIndex] = useState(0);
  const subject = safeSubjects[Math.min(index, safeSubjects.length - 1)] ?? "science";
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;

  const [summary, setSummary] = useState<SummaryJson | null>(null);
  const [activity, setActivity] = useState<ActivityJson | null>(null);
  const [subjects, setSubjects] = useState<SubjectsJson | null>(null);
  const [sessions, setSessions] = useState<SessionsJson | null>(null);
  const [comparison, setComparison] = useState<ComparisonJson | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const fetchGenerationRef = useRef(0);

  const completionForSubject = useMemo(() => {
    if (!subjects) return null;
    return subjects.subject_completion.find((r) => r.label === subjectLabel) ?? null;
  }, [subjects, subjectLabel]);

  useEffect(() => {
    const gen = ++fetchGenerationRef.current;
    const ac = new AbortController();
    setLoading(true);
    setErr(null);

    (async () => {
      const base = { credentials: "include" as const, signal: ac.signal };

      try {
        const qSummary = new URLSearchParams({ grade: String(grade), subject });
        const qActivity = new URLSearchParams({ grade: String(grade), range: "week" });
        const qSubjects = new URLSearchParams({
          grade: String(grade),
          subject,
          for_subjects: safeSubjects.join(","),
        });

        const [r1, r2, r3, r4, r5] = await Promise.all([
          fetch(`/api/analytics/summary?${qSummary}`, base),
          fetch(`/api/analytics/activity?${qActivity}`, base),
          fetch(`/api/analytics/subjects?${qSubjects}`, base),
          fetch(`/api/analytics/sessions?grade=${grade}`, base),
          fetch(`/api/analytics/comparison?grade=${grade}`, base),
        ]);

        if (!r1.ok) throw new Error("Summary failed");
        if (!r2.ok) throw new Error("Activity failed");
        if (!r3.ok) throw new Error("Subjects failed");
        if (!r4.ok) throw new Error("Sessions failed");
        if (!r5.ok) throw new Error("Comparison failed");

        const [j1, j2, j3, j4, j5] = await Promise.all([
          r1.json() as Promise<SummaryJson>,
          r2.json() as Promise<ActivityJson>,
          r3.json() as Promise<SubjectsJson>,
          r4.json() as Promise<SessionsJson>,
          r5.json() as Promise<ComparisonJson>,
        ]);

        if (gen !== fetchGenerationRef.current) return;
        setSummary(j1);
        setActivity(j2);
        setSubjects(j3);
        setSessions(j4);
        setComparison(j5);
      } catch (e: unknown) {
        if ((e as Error).name === "AbortError") return;
        console.error(e);
        if (gen !== fetchGenerationRef.current) return;
        setErr("Could not load analytics. Try again later.");
      } finally {
        if (gen === fetchGenerationRef.current) setLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [grade, subject, safeSubjects]);

  const prevSubject = () => setIndex((i) => (i - 1 + safeSubjects.length) % safeSubjects.length);
  const nextSubject = () => setIndex((i) => (i + 1) % safeSubjects.length);

  const weekDelta = activity?.period_totals.week_delta_pct;
  const monthDelta = activity?.period_totals.month_delta_pct;
  const accDelta = summary?.overall.accuracy_delta_vs_last_month;

  const chapterStats =
    completionForSubject != null
      ? { chapters_completed: completionForSubject.completed, chapters_total: completionForSubject.total }
      : summary?.selected_subject;

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto scrollbar-none pb-12"
      style={{ background: "#f0f4f8", fontFamily: "var(--font-inter)" }}
    >
      <div className="mx-auto min-w-0 max-w-5xl px-5 pt-6 md:px-8">

        {/* ── Page header ── */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/learn"
              className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-[var(--base-600)] transition-colors hover:text-[var(--base-800)]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
                <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="truncate">Back to Tutor</span>
            </Link>
            {/* Mobile: streak in top header row (dashboard shell hides streak on /analytics) */}
            <div className="shrink-0 md:hidden">
              <StreakBadge size="sm" />
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 md:items-center">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight text-[var(--base-800)]">
              Learning Analytics
            </h1>
            <p className="mt-1 text-[14px] text-[var(--base-500)]">
              Track your progress and identify areas for improvement
            </p>
          </div>
          <div className="mb-1 hidden shrink-0 md:flex md:items-center">
            <StreakBadge size="md" />
          </div>
        </div>
        <div className="mb-6" />

        {err ? (
          <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            {err}
          </p>
        ) : null}

        {/* ── 4 stat cards ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">

          {/* Card 1: Subject chapters with nav arrows */}
          <div className="rounded-2xl border border-[var(--base-200)] px-4 py-4 shadow-sm" style={{ backgroundColor: "var(--panel-bg)" }}>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevSubject}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--base-400)] transition-colors hover:bg-[var(--base-100)] hover:text-[var(--base-700)] cursor-pointer"
                aria-label="Previous subject"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2.5L4.5 7L9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <motion.p
                key={subjectLabel}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="text-[12px] text-[var(--base-500)] text-center"
              >
                {subjectLabel}
              </motion.p>
              <button
                type="button"
                onClick={nextSubject}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--base-400)] transition-colors hover:bg-[var(--base-100)] hover:text-[var(--base-700)] cursor-pointer"
                aria-label="Next subject"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {loading || !chapterStats ? (
              <div className="mt-1 animate-pulse">
                <div className="mx-auto h-8 w-16 rounded bg-[var(--base-200)]" />
                <div className="mx-auto mt-2 h-3 w-24 rounded bg-[var(--base-100)]" />
              </div>
            ) : (
              <motion.div
                key={`${subjectLabel}-data`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-center"
              >
                <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-[var(--base-800)]">
                  {chapterStats.chapters_completed}{" "}
                  <span className="text-[var(--base-400)]">/</span>{" "}
                  {chapterStats.chapters_total}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--base-500)]">Chapters Completed</p>
              </motion.div>
            )}
          </div>

          {/* Card 2: Questions answered */}
          {loading || !summary || !activity ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              label="Questions Answered"
              value={summary.overall.questions_answered.toLocaleString()}
              footnote={`+${summary.overall.questions_this_week} this week`}
              footnotePositive={
                weekDelta != null && Number.isFinite(weekDelta) ? weekDelta >= 0 : true
              }
            />
          )}

          {/* Card 3: Average accuracy */}
          {loading || !summary ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              label="Average Accuracy"
              value={`${Math.round(summary.overall.average_accuracy * 100)}%`}
              footnote={
                accDelta != null && Number.isFinite(accDelta)
                  ? `${accDelta >= 0 ? "+" : ""}${(accDelta * 100).toFixed(0)}% vs last month`
                  : undefined
              }
              footnotePositive={accDelta != null ? accDelta > 0 : undefined}
            />
          )}

          {/* Card 4: Active days + total time */}
          {loading || !summary ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              label="Active Study Days"
              value={`${summary.overall.active_study_days} days`}
              subtext={formatMinutes(summary.overall.total_minutes_active)}
            />
          )}
        </div>

        {/* ── Subject Completion — only shown once the user has completed ≥1 chapter ── */}
        {(!loading && subjects && subjects.subject_completion.some((r) => r.completed > 0)) && (
          <div className="mb-5">
            <SubjectCompletion rows={subjects.subject_completion} />
          </div>
        )}

        {/* ── Activity Over Time ── */}
        <div className="mb-5">
          {loading || !activity ? <ActivityChartSkeleton /> : <ActivityChart series={activity.series} />}
        </div>

        {/* ── Period totals: This Week / This Month ── */}
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          {loading || !activity ? (
            <>
              <div className="h-[108px] animate-pulse rounded-2xl border border-[var(--base-200)] skeleton" />
              <div className="h-[108px] animate-pulse rounded-2xl border border-[var(--base-200)] skeleton" />
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--base-200)] px-5 py-4 shadow-sm" style={{ backgroundColor: "var(--panel-bg)" }}>
                <p className="text-[12px] text-[var(--base-500)]">This Week</p>
                <p className="mt-1 text-[26px] font-bold text-[var(--base-800)]">
                  {activity.period_totals.this_week_questions.toLocaleString()}{" "}
                  <span className="text-[15px] font-normal text-[var(--base-500)]">questions</span>
                </p>
                {weekDelta != null && Number.isFinite(weekDelta) && (
                  <p className={`mt-1 flex items-center gap-1 text-[12px] font-semibold ${weekDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d={weekDelta >= 0 ? "M6 9V3M6 3L3 6M6 3L9 6" : "M6 3V9M6 9L3 6M6 9L9 6"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {weekDelta >= 0 ? "+" : ""}{(weekDelta * 100).toFixed(0)}% vs last week
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-[var(--base-200)] px-5 py-4 shadow-sm" style={{ backgroundColor: "var(--panel-bg)" }}>
                <p className="text-[12px] text-[var(--base-500)]">This Month</p>
                <p className="mt-1 text-[26px] font-bold text-[var(--base-800)]">
                  {activity.period_totals.this_month_questions.toLocaleString()}{" "}
                  <span className="text-[15px] font-normal text-[var(--base-500)]">questions</span>
                </p>
                {monthDelta != null && Number.isFinite(monthDelta) && (
                  <p className={`mt-1 flex items-center gap-1 text-[12px] font-semibold ${monthDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d={monthDelta >= 0 ? "M6 9V3M6 3L3 6M6 3L9 6" : "M6 3V9M6 9L3 6M6 9L9 6"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {monthDelta >= 0 ? "+" : ""}{(monthDelta * 100).toFixed(0)}% vs last month
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Study Time by Time of Day + Mistake Frequency ── */}
        <div className="mb-5 grid gap-5 md:grid-cols-2">
          {loading || !activity ? (
            <TimeOfDayChartSkeleton />
          ) : (
            <TimeOfDayChart
              morning={activity.time_of_day.morning}
              afternoon={activity.time_of_day.afternoon}
              evening={activity.time_of_day.evening}
              night={activity.time_of_day.night}
              peak={activity.time_of_day.peak}
            />
          )}
          {loading || !subjects ? (
            <MistakeFrequencySkeleton />
          ) : (
            <MistakeFrequency topics={subjects.mistake_topics} subjectLabel={subjectLabel} />
          )}
        </div>

        {/* ── Session Length Distribution ── */}
        <div className="mb-5">
          {loading || !sessions ? (
            <SessionDistributionSkeleton />
          ) : (
            <SessionDistribution avgMinutes={sessions.avg_session_minutes} distribution={sessions.distribution} />
          )}
        </div>

        {/* ── Chapter Mastery ── */}
        <div className="mb-5">
          {loading || !subjects ? (
            <ChapterMasterySkeleton />
          ) : (
            <ChapterMastery strong={subjects.strong_chapters} weak={subjects.weak_chapters} />
          )}
        </div>

        {/* ── Progress Comparison ── */}
        <div className="mb-5">
          {loading || !comparison ? (
            <ProgressComparisonSkeleton />
          ) : (
            <ProgressComparison
              thisTerm={comparison.this_term}
              lastTerm={comparison.last_term}
              deltaPct={comparison.delta_pct}
            />
          )}
        </div>

      </div>
    </div>
  );
}
