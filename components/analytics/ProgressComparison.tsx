"use client";

import React from "react";

function DeltaBadge({ value, isPositive }: { value: string; isPositive: boolean | null }) {
  if (isPositive === null) {
    return (
      <div className="flex items-center gap-1 text-[13px] font-semibold text-[var(--base-400)]">
        <span>—</span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-0.5 text-[13px] font-semibold ${
        isPositive ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      <span>{value}</span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        {isPositive ? (
          <path d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M7 3V11M7 11L3.5 7.5M7 11L10.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </div>
  );
}

export function ProgressComparison({
  thisTerm,
  lastTerm,
  deltaPct,
}: {
  thisTerm: { accuracy: number; questions_answered: number; chapters_completed: number };
  lastTerm: { accuracy: number; questions_answered: number; chapters_completed: number };
  deltaPct: { accuracy: number; questions_answered: number; chapters_completed: number };
}) {
  const accDelta = Number.isFinite(deltaPct.accuracy) ? deltaPct.accuracy : null;
  const qDelta = Number.isFinite(deltaPct.questions_answered) ? deltaPct.questions_answered : null;
  const chapAbsDelta = thisTerm.chapters_completed - lastTerm.chapters_completed;

  const noPriorQuestions = lastTerm.questions_answered === 0;
  const hasThisQuestions = thisTerm.questions_answered > 0;

  let accDeltaStr: string | null = null;
  let accPositive: boolean | null = null;
  if (noPriorQuestions && hasThisQuestions) {
    accDeltaStr = "New";
    accPositive = true;
  } else if (!noPriorQuestions && accDelta != null) {
    accDeltaStr = `${accDelta >= 0 ? "+" : ""}${(accDelta * 100).toFixed(0)}%`;
    accPositive = accDelta > 0;
  }

  let qDeltaStr: string | null = null;
  let qPositive: boolean | null = null;
  if (noPriorQuestions && hasThisQuestions) {
    qDeltaStr = `+${thisTerm.questions_answered.toLocaleString()}`;
    qPositive = true;
  } else if (!noPriorQuestions && qDelta != null) {
    qDeltaStr = `${qDelta >= 0 ? "+" : ""}${(qDelta * 100).toFixed(0)}%`;
    qPositive = qDelta > 0;
  }

  const cards = [
    {
      title: "Accuracy",
      thisVal: `${Math.round(thisTerm.accuracy * 100)}%`,
      lastVal: `${Math.round(lastTerm.accuracy * 100)}%`,
      thisLabel: "This period",
      lastLabel: "Prior period",
      deltaStr: accDeltaStr,
      isPositive: accPositive,
    },
    {
      title: "Questions Answered",
      thisVal: thisTerm.questions_answered.toLocaleString(),
      lastVal: lastTerm.questions_answered.toLocaleString(),
      thisLabel: "This period",
      lastLabel: "Prior period",
      deltaStr: qDeltaStr,
      isPositive: qPositive,
    },
    {
      title: "Chapters Completed",
      thisVal: String(thisTerm.chapters_completed),
      lastVal: String(lastTerm.chapters_completed),
      thisLabel: "This period",
      lastLabel: "Prior period",
      deltaStr: `${chapAbsDelta >= 0 ? "+" : ""}${chapAbsDelta}`,
      isPositive: chapAbsDelta > 0 ? true : chapAbsDelta < 0 ? false : null,
    },
  ];

  return (
    <div style={{ fontFamily: "var(--font-inter)" }}>
      <h3 className="mb-1 text-[15px] font-semibold text-[var(--base-800)]">Progress Comparison</h3>
      <p className="mb-4 text-[12px] text-[var(--base-500)]">
        Last 90 days vs the previous 90 days (all subjects). Chapters counts learn-mode completions with a
        completion date in each window.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-[var(--base-200)] bg-white px-5 py-4 shadow-sm"
          >
            <p className="mb-3 text-[12px] text-[var(--base-500)]">{c.title}</p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[28px] font-bold leading-none text-[var(--base-800)]">{c.thisVal}</p>
                <p className="mt-1 text-[11px] text-[var(--base-400)]">{c.thisLabel}</p>
              </div>
              <div className="mb-4">
                {c.deltaStr ? (
                  <DeltaBadge value={c.deltaStr} isPositive={c.isPositive} />
                ) : (
                  <DeltaBadge value="—" isPositive={null} />
                )}
              </div>
              <div className="ml-auto text-right">
                <p className="text-[20px] font-semibold leading-none text-[var(--base-600)]">{c.lastVal}</p>
                <p className="mt-1 text-[11px] text-[var(--base-400)]">{c.lastLabel}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressComparisonSkeleton() {
  return (
    <div>
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-[var(--base-200)]" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[100px] animate-pulse rounded-2xl border border-[var(--base-200)] bg-white" />
        ))}
      </div>
    </div>
  );
}
