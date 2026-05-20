"use client";

import React, { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ActivitySeriesPoint = { date: string; questions: number; minutes: number; label: string };

export function ActivityChart({ series }: { series: ActivitySeriesPoint[] }) {
  const [mode, setMode] = useState<"questions" | "minutes">("questions");
  const data = series.map((d) => ({
    ...d,
    value: mode === "questions" ? d.questions : d.minutes,
  }));

  return (
    <div
      className="rounded-2xl border border-[var(--base-200)] bg-white p-5 shadow-sm"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-[var(--base-800)]">
          Activity Over Time
        </h3>
        <div className="flex gap-1.5 rounded-lg border border-[var(--base-200)] p-0.5">
          {(["questions", "minutes"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 text-[12px] font-medium transition-all cursor-pointer ${
                mode === m
                  ? "bg-[var(--primary-400)] text-white shadow-sm"
                  : "text-[var(--base-600)] hover:bg-[var(--base-100)]"
              }`}
            >
              {m === "questions" ? "Questions" : "Minutes"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="analyticsActivityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0077ED" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#AFD6FD" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--base-500)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--base-500)" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,119,237,0.06)" }}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid var(--base-300)",
                backgroundColor: "var(--panel-bg)",
                color: "var(--base-700)",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              }}
              labelFormatter={(_, payload) => (payload?.[0]?.payload?.date as string) ?? ""}
              formatter={(v) => [String(v ?? ""), mode === "questions" ? "Questions" : "Minutes"]}
            />
            <Bar dataKey="value" fill="url(#analyticsActivityFill)" radius={[6, 6, 0, 0]} maxBarSize={120} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ActivityChartSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--base-200)] bg-white p-5">
      <div className="mb-4 flex justify-between">
        <div className="h-4 w-40 rounded bg-[var(--base-200)]" />
        <div className="h-7 w-32 rounded-lg bg-[var(--base-100)]" />
      </div>
      <div className="h-[240px] rounded-xl bg-[var(--base-100)]" />
    </div>
  );
}
