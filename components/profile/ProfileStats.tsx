"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, CheckCircle2, Clock, Flame } from "lucide-react";

type Stats = {
  current_streak?: number;
  total_questions?: number;
  chapters_completed?: number;
  total_minutes?: number;
};

const icons = {
  Streak: Flame,
  Questions: BookOpen,
  Chapters: CheckCircle2,
  Minutes: Clock,
} as const;

type StatLabel = keyof typeof icons;

const STAT_VARIANTS: Record<
  StatLabel,
  {
    border: string;
    bg: string;
    icon: string;
    label: string;
    value: string;
  }
> = {
  Streak: {
    border: "border-orange-200/80",
    bg: "bg-gradient-to-br from-amber-50 via-orange-50/95 to-rose-50/90",
    icon: "text-[var(--streak-flame)] drop-shadow-[0_0_14px_color-mix(in_srgb,var(--streak-glow)_65%,transparent)]",
    label: "text-orange-950/55",
    value: "text-orange-950",
  },
  Questions: {
    border: "border-[color-mix(in_srgb,var(--math)_38%,transparent)]",
    bg: "bg-[color-mix(in_srgb,var(--math)_12%,white)]",
    icon: "text-[var(--math)]",
    label: "text-[color-mix(in_srgb,var(--math)_58%,var(--base-600))]",
    value: "text-[color-mix(in_srgb,var(--math)_25%,var(--base-900))]",
  },
  Chapters: {
    border: "border-[color-mix(in_srgb,var(--biology)_40%,transparent)]",
    bg: "bg-[color-mix(in_srgb,var(--biology)_11%,white)]",
    icon: "text-[var(--biology)]",
    label: "text-[color-mix(in_srgb,var(--biology)_52%,var(--base-600))]",
    value: "text-[color-mix(in_srgb,var(--biology)_22%,var(--base-900))]",
  },
  Minutes: {
    border: "border-[color-mix(in_srgb,var(--physics)_38%,transparent)]",
    bg: "bg-[color-mix(in_srgb,var(--physics)_11%,white)]",
    icon: "text-[var(--physics)]",
    label: "text-[color-mix(in_srgb,var(--physics)_52%,var(--base-600))]",
    value: "text-[color-mix(in_srgb,var(--physics)_22%,var(--base-900))]",
  },
};

export function ProfileStats({ stats }: { stats: Stats }) {
  const reduceMotion = useReducedMotion();
  const items: { label: StatLabel; value: number; suffix: string }[] = [
    { label: "Streak", value: stats.current_streak ?? 0, suffix: " days" },
    { label: "Questions", value: stats.total_questions ?? 0, suffix: "" },
    { label: "Chapters", value: stats.chapters_completed ?? 0, suffix: " done" },
    { label: "Minutes", value: stats.total_minutes ?? 0, suffix: "" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {items.map((it, i) => {
        const Icon = icons[it.label];
        const v = STAT_VARIANTS[it.label];
        return (
          <motion.div
            key={it.label}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? false : { opacity: 1, y: 0 }}
            transition={{
              delay: reduceMotion ? 0 : 0.05 * i,
              duration: 0.22,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={`rounded-2xl border px-3 py-3 sm:py-4 text-center shadow-sm transition-[border-color,box-shadow,transform] duration-200 ease-out hover:shadow-[0_10px_28px_-8px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 ${v.border} ${v.bg}`}
            style={{ fontFamily: "var(--font-inter)" }}
          >
            <p
              className={`flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-1.5 ${v.label}`}
            >
              <Icon className={`size-3.5 shrink-0 ${v.icon}`} strokeWidth={2.25} aria-hidden />
              {it.label}
            </p>
            <p className={`text-[20px] sm:text-[22px] font-bold tabular-nums ${v.value}`}>
              {typeof it.value === "number" && it.value >= 1000 ? it.value.toLocaleString() : it.value}
              {it.suffix && (
                <span className={`text-[13px] font-semibold opacity-80 ${v.label}`}>{it.suffix}</span>
              )}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
