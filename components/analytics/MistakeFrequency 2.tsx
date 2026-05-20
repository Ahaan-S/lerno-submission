"use client";

import React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";

export type MistakeRow = { topic_name: string; mistake_count: number; accuracy: number };

function TruncatedTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const text = payload?.value ?? "";
  const maxChars = 20;
  const display = text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={4} textAnchor="end" fill="var(--base-600)" fontSize={10}>
        {display}
      </text>
    </g>
  );
}

export function MistakeFrequency({ topics, subjectLabel }: { topics: MistakeRow[]; subjectLabel: string }) {
  const data = [...topics].reverse();

  if (topics.length === 0) {
    return (
      <div
        className="rounded-2xl border border-[var(--base-200)] bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <h3 className="text-[15px] font-semibold text-[var(--base-800)]">Mistake Frequency</h3>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center justify-center py-10 gap-3 text-center"
        >
          <div className="w-11 h-11 rounded-full bg-[var(--base-100)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--base-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--base-600)]">Not enough data yet</p>
            <p className="text-[12px] text-[var(--base-400)] mt-0.5">Answer more questions to see weak topics</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-[var(--base-200)] bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <h3 className="mb-1 text-[15px] font-semibold text-[var(--base-800)]">Mistake Frequency</h3>
      <p className="mb-4 text-[12px] text-[var(--base-500)]">Top weak topics in {subjectLabel}</p>
      <div className="h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-200)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--base-500)" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="topic_name"
              width={120}
              tick={<TruncatedTick />}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid var(--base-200)", fontSize: 12 }}
              formatter={(v, _n, item) => {
                const acc = (item?.payload as MistakeRow)?.accuracy;
                return [`${v ?? 0} wrong`, acc != null ? `${acc}% accuracy` : ""];
              }}
              labelFormatter={(_label, payload) => (payload?.[0]?.payload as MistakeRow)?.topic_name ?? ""}
            />
            <Bar dataKey="mistake_count" radius={[0, 6, 6, 0]} maxBarSize={40} fill="var(--primary-400)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MistakeFrequencySkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--base-200)] bg-[var(--base-100)] p-5">
      <div className="mb-4 h-4 w-36 rounded bg-[var(--base-300)]" />
      <div className="h-[200px] rounded-xl bg-[var(--base-200)]" />
    </div>
  );
}
