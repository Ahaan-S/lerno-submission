"use client";

import React from "react";
import { motion } from "framer-motion";

export function SessionDistribution({
  avgMinutes,
  distribution,
}: {
  avgMinutes: number;
  distribution: { lt15: number; min15_30: number; min30_60: number; gt60: number; total: number };
}) {
  const rows = [
    { key: "lt15", label: "<15 min", count: distribution.lt15 },
    { key: "15_30", label: "15–30 min", count: distribution.min15_30 },
    { key: "30_60", label: "30–60 min", count: distribution.min30_60 },
    { key: "gt60", label: "60+ min", count: distribution.gt60 },
  ];
  const total = distribution.total || 0;
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div
      className="rounded-2xl border border-[var(--base-200)] bg-white p-5 shadow-sm"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <h3 className="mb-1 text-[15px] font-semibold text-[var(--base-800)]">Session Length Distribution</h3>
      <p className="mb-4 text-[12px] text-[var(--base-500)]">
        All study sessions — AI Tutor, Study Feed, and Learn Mode.
      </p>
      <div className="flex flex-col gap-5 md:flex-row md:items-stretch md:gap-6">
        {/* Left: Average session */}
        <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--base-100)] px-6 py-6 md:w-[200px]">
          <p className="text-[12px] font-medium text-[var(--base-500)]">Avg Session Length</p>
          <p
            className="mt-2 text-[36px] font-bold leading-none text-[var(--primary-400)]"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            {avgMinutes}
          </p>
          <p className="mt-1 text-[14px] font-medium text-[var(--base-600)]">minutes</p>
        </div>

        {/* Right: Distribution bars */}
        <div className="min-w-0 flex-1 space-y-4">
          {total === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center justify-center h-full py-6 gap-3 text-center"
            >
              <div className="w-11 h-11 rounded-full bg-[var(--base-100)] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--base-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--base-600)]">Not enough data yet</p>
                <p className="text-[12px] text-[var(--base-400)] mt-0.5">Complete sessions to see length stats</p>
              </div>
            </motion.div>
          ) : (
            rows.map((r) => (
              <div key={r.key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] text-[var(--base-700)]">{r.label}</span>
                  <span className="text-[12px] text-[var(--base-500)]">{r.count} sessions</span>
                </div>
                <div className="h-[10px] overflow-hidden rounded-full bg-[var(--base-100)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--primary-400)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((r.count / maxCount) * 100)}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function SessionDistributionSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--base-200)] bg-white p-5">
      <div className="mb-5 h-4 w-48 rounded bg-[var(--base-200)]" />
      <div className="flex flex-col gap-5 md:flex-row md:gap-6">
        <div className="h-[132px] w-full rounded-xl bg-[var(--base-100)] md:w-[200px]" />
        <div className="flex-1 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="mb-2 flex justify-between">
                <div className="h-3 w-16 rounded bg-[var(--base-200)]" />
                <div className="h-3 w-20 rounded bg-[var(--base-100)]" />
              </div>
              <div className="h-[10px] rounded-full bg-[var(--base-100)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
