"use client";

import React from "react";

export function StatCard({
  label,
  value,
  footnote,
  footnotePositive,
  subtext,
}: {
  label: string;
  value: string;
  footnote?: React.ReactNode;
  footnotePositive?: boolean;
  subtext?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--base-200)] bg-white px-5 py-4 shadow-sm">
      <p className="text-[12px] text-[var(--base-500)]" style={{ fontFamily: "var(--font-inter)" }}>
        {label}
      </p>
      <p
        className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-[var(--base-800)]"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {value}
      </p>
      {footnote != null && (
        <p
          className={`mt-1 flex items-center gap-1 text-[12px] font-semibold ${
            footnotePositive === false ? "text-rose-600" : "text-emerald-600"
          }`}
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M6 9V3M6 3L3 6M6 3L9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {footnote}
        </p>
      )}
      {subtext && (
        <p className="mt-1 text-[12px] text-[var(--base-500)]" style={{ fontFamily: "var(--font-inter)" }}>
          {subtext}
        </p>
      )}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--base-200)] bg-white px-5 py-4">
      <div className="h-3 w-28 rounded bg-[var(--base-200)]" />
      <div className="mt-2 h-8 w-20 rounded bg-[var(--base-300)]" />
      <div className="mt-2 h-3 w-32 rounded bg-[var(--base-200)]" />
    </div>
  );
}
