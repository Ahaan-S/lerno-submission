"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SLOT_CONFIG = [
  { key: "Morning", label: "Morning (6-12)", fill: "#FCD34D" },
  { key: "Afternoon", label: "Afternoon (12-18)", fill: "#FB923C" },
  { key: "Evening", label: "Evening (18-21)", fill: "#0077ED" },
  { key: "Night", label: "Night (21-24)", fill: "#312E81" },
];

export function TimeOfDayChart({
  morning,
  afternoon,
  evening,
  night,
  peak,
}: {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
  peak: string;
}) {
  const values = { Morning: morning, Afternoon: afternoon, Evening: evening, Night: night };
  const data = SLOT_CONFIG.map((s) => ({ ...s, value: values[s.key as keyof typeof values] }));

  return (
    <div
      className="rounded-2xl border border-[var(--base-200)] bg-white p-5 shadow-sm"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <h3 className="mb-4 text-[15px] font-semibold text-[var(--base-800)]">Study Time by Time of Day</h3>
      <div className="h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--base-500)" }}
              axisLine={false}
              tickLine={false}
              interval={0}
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
              formatter={(v) => [`${v ?? 0} min`, "Active"]}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={120}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[12px] text-[var(--base-600)]">
        <span aria-hidden>{String.fromCodePoint(0x1f319)}</span>{" "}
        You&apos;re most active in the{" "}
        <strong className="text-[var(--base-800)]">{peak}</strong>
      </p>
    </div>
  );
}

export function TimeOfDayChartSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--base-200)] bg-white p-5">
      <div className="mb-4 h-4 w-48 rounded bg-[var(--base-200)]" />
      <div className="h-[200px] rounded-xl bg-[var(--base-100)]" />
    </div>
  );
}
