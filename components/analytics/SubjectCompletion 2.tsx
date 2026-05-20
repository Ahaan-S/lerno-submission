"use client";

import React from "react";
import Link from "next/link";

export type SubjectCompletionRow = { label: string; completed: number; total: number; pct: number };

function subjectBarColor(label: string): string {
  const l = label.toLowerCase();
  if (l === "mathematics" || l === "math") return "#333D3C";
  if (l === "physics") return "#4346A9";
  if (l === "chemistry") return "#545C6C";
  if (l === "biology") return "#2B937D";
  if (l.includes("social")) return "#31307B";
  if (l === "hindi") return "#154073";
  if (l === "french") return "#2563EB";
  if (l === "english") return "#5C4B7A";
  if (l.includes("science")) return "#0077ED";
  return "#0077ED";
}

function completionWidthPct(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (completed / total) * 100));
}

export function SubjectCompletion({ rows }: { rows: SubjectCompletionRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl border border-[var(--base-200)] bg-white p-6 shadow-sm md:p-7"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <h3 className="text-[16px] font-semibold tracking-tight text-[var(--base-800)]">Subject Completion</h3>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--base-500)]">
          No subjects to show yet. Complete onboarding or start a chapter to see progress here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-[var(--base-200)] bg-white p-6 shadow-sm md:p-7"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h3 className="text-[16px] font-semibold tracking-tight text-[var(--base-800)]">Subject Completion</h3>
        <Link
          href="/learn"
          className="inline-flex shrink-0 items-center justify-center self-start rounded-full bg-[var(--primary-400)] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90 sm:self-auto"
        >
          View all subjects
        </Link>
      </div>

      <ul className="flex flex-col gap-5" role="list">
        {rows.map((r) => {
          const widthPct = completionWidthPct(r.completed, r.total);
          const fill = subjectBarColor(r.label);
          const chapterWord = r.total === 1 ? "chapter" : "chapters";

          return (
            <li key={r.label} className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-[14px] text-[var(--base-600)]">{r.label}</span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[var(--base-800)]">
                  {r.completed} / {r.total} {chapterWord}
                </span>
              </div>
              <div
                className="h-4 w-full overflow-hidden rounded-full bg-[#EEF1F4]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(widthPct)}
                aria-label={`${r.label}: ${r.completed} of ${r.total} chapters complete`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: fill,
                    minWidth: widthPct > 0 ? "4px" : undefined,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SubjectCompletionSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--base-200)] bg-white p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-4 w-44 rounded-md bg-[var(--base-200)]" />
        <div className="h-9 w-36 shrink-0 rounded-full bg-[var(--base-100)]" />
      </div>
      <div className="flex flex-col gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="mb-2 flex justify-between">
              <div className="h-3.5 w-24 rounded bg-[var(--base-200)]" />
              <div className="h-3.5 w-28 rounded bg-[var(--base-200)]" />
            </div>
            <div className="h-4 w-full rounded-full bg-[var(--base-100)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
