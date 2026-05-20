"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import type {
  ExamPlanDraftEvent,
  ExamPlanQuestion,
  ExamPlanSummary,
  StudyEvent,
} from "@/lib/planner/types";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { getSubjectColor } from "@/lib/planner/subject-colors";

type Answers = Record<string, string | string[]>;

interface StartResponse {
  plan_run_id: string;
  questions: ExamPlanQuestion[];
  context: {
    target_subject_label: string;
    days_until_exam: number;
    chapter_count: number;
    weak_topic_count: number;
    busy_window_count: number;
    sparse_calendar: boolean;
  };
}

interface DraftResponse {
  summary: ExamPlanSummary;
  events: ExamPlanDraftEvent[];
  used_fallback?: boolean;
}

interface Props {
  exam: StudyEvent;
  onClose: () => void;
  onCommitted: (events: StudyEvent[]) => void;
}

function IconSparkle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25M12 18.75V21M4.5 4.5l1.6 1.6M17.9 17.9l1.6 1.6M3 12h2.25M18.75 12H21M4.5 19.5l1.6-1.6M17.9 6.1l1.6-1.6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 12a3.25 3.25 0 1 0 6.5 0 3.25 3.25 0 0 0-6.5 0Z" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function emptyAnswer(question: ExamPlanQuestion): string | string[] {
  return question.type === "multi_choice" ? [] : "";
}

function hasRequiredAnswer(question: ExamPlanQuestion, answers: Answers): boolean {
  if (!question.required) return true;
  const answer = answers[question.id];
  return Array.isArray(answer) ? answer.length > 0 : !!answer;
}

function isCustomOption(optionId: string): boolean {
  return optionId === "custom";
}

function customAnswerValue(answer: string | string[] | undefined): string {
  if (typeof answer !== "string") return "";
  return answer.startsWith("custom:") ? answer.slice("custom:".length) : "";
}

function groupedEvents(events: ExamPlanDraftEvent[]) {
  const groups = new Map<string, ExamPlanDraftEvent[]>();
  for (const event of events) {
    const key = format(new Date(event.start_time), "EEE, MMM d");
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()];
}

export default function ExamPlanPanel({ exam, onClose, onCommitted }: Props) {
  const [step, setStep] = useState<"context" | "questions" | "draft" | "done">("context");
  const [planRunId, setPlanRunId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamPlanQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [context, setContext] = useState<StartResponse["context"] | null>(null);
  const [summary, setSummary] = useState<ExamPlanSummary | null>(null);
  const [draftEvents, setDraftEvents] = useState<ExamPlanDraftEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStep("context");
    setPlanRunId(null);
    setQuestions([]);
    setQuestionIndex(0);
    setAnswers({});
    setContext(null);
    setSummary(null);
    setDraftEvents([]);
    setError(null);
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch("/api/planner/exam-plan/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ exam_event_id: exam.id }),
        });
        const data = await res.json() as StartResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not start plan");
        if (cancelled) return;
        setPlanRunId(data.plan_run_id);
        setQuestions(data.questions);
        setAnswers(Object.fromEntries(data.questions.map((q) => [q.id, emptyAnswer(q)])));
        setContext(data.context);
        setStep("questions");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start plan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [exam.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (step !== "questions") return;
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        void handleNextQuestion();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setQuestionIndex((idx) => Math.max(0, idx - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const activeQuestion = questions[questionIndex];
  const canContinue = activeQuestion ? hasRequiredAnswer(activeQuestion, answers) : false;
  const subjectColor = useMemo(() => getSubjectColor(exam.subject || null), [exam.subject]);
  const grouped = useMemo(() => groupedEvents(draftEvents), [draftEvents]);

  async function requestDraft() {
    if (!planRunId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/planner/exam-plan/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_run_id: planRunId, answers }),
      });
      const data = await res.json() as DraftResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not draft plan");
      setSummary(data.summary);
      setDraftEvents(data.events);
      setStep("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft plan");
    } finally {
      setLoading(false);
    }
  }

  async function handleNextQuestion() {
    if (!activeQuestion || !hasRequiredAnswer(activeQuestion, answers) || loading) return;
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((idx) => idx + 1);
      return;
    }
    await requestDraft();
  }

  async function handleCommit() {
    if (!planRunId || committing) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/planner/exam-plan/${planRunId}/commit`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { events?: StudyEvent[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add plan to calendar");
      onCommitted(data.events ?? []);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add plan to calendar");
    } finally {
      setCommitting(false);
    }
  }

  function setSingleAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function setCustomAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value.trim() ? `custom:${value}` : "" }));
  }

  function toggleMultiAnswer(id: string, value: string) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? prev[id] as string[] : [];
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, [id]: next };
    });
  }

  return (
    <aside
      className="flex h-full min-h-0 w-[440px] shrink-0 flex-col overflow-hidden border-l border-[var(--base-200)] bg-white"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="shrink-0 border-b border-[var(--base-200)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
              style={{ backgroundColor: subjectColor.bg, borderColor: subjectColor.border, color: subjectColor.text }}
            >
              <IconSparkle className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--base-400)]">AI Planner</p>
              <h2 className="mt-0.5 truncate text-[15px] font-bold text-[var(--base-900)]">{exam.title}</h2>
              <p className="mt-1 text-[12px] font-medium text-[var(--base-500)]">
                {context ? `${context.target_subject_label} · ${context.days_until_exam} days left` : "Gathering context"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--base-400)] transition-all duration-100 hover:bg-[var(--base-100)] hover:text-[var(--base-700)] active:scale-95"
            aria-label="Close AI planner"
            title="Close"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
            {error}
          </div>
        )}

        {step === "context" && (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 text-center">
            <div className="h-8 w-8 rounded-full border-2 border-[var(--base-200)] border-t-[var(--primary-400)] animate-spin" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--base-800)]">Reading your study context</p>
              <p className="mt-1 max-w-[280px] text-[12px] leading-relaxed text-[var(--base-500)]">
                Checking progress, weak areas, exam date, and busy calendar slots.
              </p>
            </div>
          </div>
        )}

        {step === "questions" && activeQuestion && (
          <motion.div
            key={activeQuestion.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mb-4 flex items-center justify-between text-[12px] font-semibold text-[var(--base-400)]">
              <span>{questionIndex + 1} of {questions.length}</span>
              <span>{context?.busy_window_count ?? 0} events checked</span>
            </div>
            <h3 className="text-[20px] font-bold leading-tight text-[var(--base-900)]">{activeQuestion.title}</h3>
            {activeQuestion.helper && (
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--base-500)]">{activeQuestion.helper}</p>
            )}

            <div className="mt-5 flex flex-col gap-2">
              {activeQuestion.type === "short_text" ? (
                <textarea
                  value={typeof answers[activeQuestion.id] === "string" ? answers[activeQuestion.id] as string : ""}
                  onChange={(e) => setSingleAnswer(activeQuestion.id, e.target.value)}
                  placeholder="Type a short answer..."
                  className="min-h-36 resize-none rounded-lg border border-[var(--base-200)] bg-[var(--base-50)] px-3.5 py-3 text-[14px] text-[var(--base-800)] outline-none transition-colors placeholder:text-[var(--base-300)] focus:border-[var(--primary-400)]"
                />
              ) : (
                activeQuestion.options?.map((option, index) => {
                  const custom = activeQuestion.type === "single_choice" && isCustomOption(option.id);
                  const selected = activeQuestion.type === "multi_choice"
                    ? Array.isArray(answers[activeQuestion.id]) && (answers[activeQuestion.id] as string[]).includes(option.id)
                    : custom
                      ? typeof answers[activeQuestion.id] === "string" && (answers[activeQuestion.id] as string).startsWith("custom:")
                      : answers[activeQuestion.id] === option.id;
                  if (custom) {
                    return (
                      <label
                        key={option.id}
                        className="block rounded-lg border bg-white px-3 py-2.5 transition-colors duration-100 hover:border-[var(--base-300)] hover:bg-[var(--base-50)]"
                        style={{
                          borderColor: selected ? "var(--primary-400)" : "var(--base-200)",
                          backgroundColor: selected ? "rgba(0,119,237,0.05)" : undefined,
                        }}
                      >
                        <span className="flex items-start gap-3">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[12px] font-bold"
                            style={{
                              backgroundColor: selected ? "var(--primary-400)" : "var(--base-100)",
                              color: selected ? "white" : "var(--base-500)",
                            }}
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold text-[var(--base-800)]">{option.label}</span>
                            {option.description && (
                              <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--base-500)]">{option.description}</span>
                            )}
                            <input
                              value={customAnswerValue(answers[activeQuestion.id])}
                              onChange={(e) => setCustomAnswer(activeQuestion.id, e.target.value)}
                              placeholder="Example: 7-8:30pm on weekdays"
                              className="mt-2 h-9 w-full rounded-md border border-[var(--base-200)] bg-white px-3 text-[13px] font-medium text-[var(--base-800)] outline-none transition-colors duration-100 placeholder:text-[var(--base-300)] focus:border-[var(--primary-400)]"
                            />
                          </span>
                        </span>
                      </label>
                    );
                  }
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (activeQuestion.type === "multi_choice") toggleMultiAnswer(activeQuestion.id, option.id);
                        else setSingleAnswer(activeQuestion.id, option.id);
                      }}
                      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-100 hover:border-[var(--base-300)] hover:bg-[var(--base-50)] active:scale-[0.99]"
                      style={{
                        borderColor: selected ? "var(--primary-400)" : "var(--base-200)",
                        backgroundColor: selected ? "rgba(0,119,237,0.06)" : "white",
                      }}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[12px] font-bold"
                        style={{
                          backgroundColor: selected ? "var(--primary-400)" : "var(--base-100)",
                          color: selected ? "white" : "var(--base-500)",
                        }}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-[var(--base-800)]">{option.label}</span>
                        {option.description && (
                          <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--base-500)]">{option.description}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {step === "draft" && (
          <div>
            <div className="rounded-lg border border-[var(--base-200)] bg-[var(--base-50)] p-3">
              <h3 className="text-[15px] font-bold leading-snug text-[var(--base-900)]">{summary?.headline ?? "Draft plan"}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md bg-white p-2.5">
                  <p className="text-[10px] font-semibold uppercase text-[var(--base-400)]">Blocks</p>
                  <p className="mt-1 text-[18px] font-bold text-[var(--base-800)]">{summary?.total_blocks ?? draftEvents.length}</p>
                </div>
                <div className="rounded-md bg-white p-2.5">
                  <p className="text-[10px] font-semibold uppercase text-[var(--base-400)]">Hours</p>
                  <p className="mt-1 text-[18px] font-bold text-[var(--base-800)]">{Math.round((summary?.total_minutes ?? 0) / 60)}</p>
                </div>
                <div className="rounded-md bg-white p-2.5">
                  <p className="text-[10px] font-semibold uppercase text-[var(--base-400)]">Exam</p>
                  <p className="mt-1 text-[12px] font-bold text-[var(--base-800)]">{format(new Date(exam.start_time), "MMM d")}</p>
                </div>
              </div>
              {summary?.focus_notes?.length ? (
                <div className="mt-3 flex flex-col gap-1.5">
                  {summary.focus_notes.map((note) => (
                    <p key={note} className="text-[12px] leading-relaxed text-[var(--base-600)]">{note}</p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-2.5">
              {grouped.map(([day, events]) => (
                <div key={day} className="rounded-lg border border-[var(--base-200)] bg-white p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--base-500)]">{day}</p>
                  <div className="flex flex-col gap-2">
                    {events.map((event) => {
                      const colors = getSubjectColor(event.subject);
                      return (
                        <div key={`${event.start_time}-${event.title}`} className="flex items-start gap-3 rounded-md bg-[var(--base-50)] p-2.5">
                          <div className="w-14 shrink-0 text-[11px] font-bold text-[var(--base-600)]">{format(new Date(event.start_time), "h:mm a")}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-[var(--base-800)]">{event.title}</p>
                            <p className="mt-0.5 text-[11px] font-medium" style={{ color: colors.text }}>
                              {SUBJECT_LABELS[event.subject] ?? event.subject} · {event.duration_minutes} min
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <IconCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-[17px] font-bold text-[var(--base-900)]">Plan added to your calendar</h3>
            <p className="mt-1 max-w-[300px] text-[13px] leading-relaxed text-[var(--base-500)]">
              The scheduled blocks now appear on the timeline and in Today&apos;s Focus when they come up.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--base-200)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[11px] font-medium text-[var(--base-400)]">
            {step === "questions" ? "Enter to continue · Esc to close" : "Review before adding"}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {step === "questions" && questionIndex > 0 && (
              <button
                type="button"
                onClick={() => setQuestionIndex((idx) => Math.max(0, idx - 1))}
                className="h-10 cursor-pointer rounded-lg border border-[var(--base-200)] px-4 text-[13px] font-semibold text-[var(--base-600)] transition-all duration-100 hover:border-[var(--base-300)] hover:bg-[var(--base-50)] active:scale-[0.98]"
              >
                Back
              </button>
            )}
            {step === "draft" && (
              <button
                type="button"
                onClick={() => setStep("questions")}
                className="h-10 cursor-pointer rounded-lg border border-[var(--base-200)] px-4 text-[13px] font-semibold text-[var(--base-600)] transition-all duration-100 hover:border-[var(--base-300)] hover:bg-[var(--base-50)] active:scale-[0.98]"
              >
                Edit
              </button>
            )}
            {step === "done" ? (
              <button
                type="button"
                onClick={onClose}
                className="h-10 cursor-pointer rounded-lg bg-[var(--primary-400)] px-5 text-[13px] font-semibold text-white transition-all duration-100 hover:opacity-90 active:scale-[0.98]"
              >
                Close
              </button>
            ) : step === "draft" ? (
              <button
                type="button"
                onClick={() => void handleCommit()}
                disabled={committing || draftEvents.length === 0}
                className="h-10 cursor-pointer rounded-lg bg-[var(--primary-400)] px-5 text-[13px] font-semibold text-white transition-all duration-100 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
              >
                {committing ? "Adding..." : "Add to calendar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleNextQuestion()}
                disabled={!canContinue || loading}
                className="h-12 min-w-32 cursor-pointer rounded-xl bg-[var(--primary-400)] px-6 text-[14px] font-bold text-white shadow-sm transition-all duration-100 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
              >
                {loading ? "Thinking..." : questionIndex === questions.length - 1 ? "Create draft" : "Next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
