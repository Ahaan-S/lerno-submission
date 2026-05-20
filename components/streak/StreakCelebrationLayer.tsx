"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  STREAK_CELEBRATION_EVENT,
  type StreakCelebrationDetail,
  type WeekDay,
} from "@/lib/streak-client";

const DURATION_MS = 520;
const CHECK_DELAY_MS = 220;
const AUTO_DISMISS_MS = 3400;

function easeOutCubic(t: number): number {
  const x = 1 - t;
  return 1 - x * x * x;
}

function isTodaySlot(day: WeekDay, todayKey: string): boolean {
  if (day.is_today === true) return true;
  if (day.is_today === false) return false;
  return Boolean(todayKey && day.date === todayKey);
}

export function StreakCelebrationLayer() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<StreakCelebrationDetail | null>(null);
  const [shownStreak, setShownStreak] = useState(0);
  const [showTodayCheck, setShowTodayCheck] = useState(false);
  const animRef = useRef<number | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const clearTimers = useCallback(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (checkTimerRef.current != null) {
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }
    if (dismissTimerRef.current != null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setOpen(false);
    setDetail(null);
    setShowTodayCheck(false);
  }, [clearTimers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<StreakCelebrationDetail>).detail;
      if (!d || d.newStreak <= d.previousStreak) return;

      clearTimers();
      setDetail(d);
      setOpen(true);
      setShowTodayCheck(false);

      const reduced =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced) {
        setShownStreak(d.newStreak);
        setShowTodayCheck(true);
        dismissTimerRef.current = setTimeout(close, AUTO_DISMISS_MS);
        return;
      }

      const from = d.previousStreak;
      const to = d.newStreak;
      setShownStreak(from);
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / DURATION_MS);
        const eased = easeOutCubic(t);
        setShownStreak(Math.round(from + (to - from) * eased));
        if (t < 1) animRef.current = requestAnimationFrame(tick);
        else animRef.current = null;
      };
      animRef.current = requestAnimationFrame(tick);

      checkTimerRef.current = setTimeout(() => setShowTodayCheck(true), CHECK_DELAY_MS);
      dismissTimerRef.current = setTimeout(close, AUTO_DISMISS_MS);
    };

    window.addEventListener(STREAK_CELEBRATION_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(STREAK_CELEBRATION_EVENT, handler as EventListener);
      clearTimers();
    };
  }, [clearTimers, close]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && detail ? (
        <motion.div
          key="streak-celebration"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[10050] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.34)", backdropFilter: "blur(3px)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Streak updated"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[min(92vw,364px)] rounded-[24px] border border-slate-200/80 px-4 pb-4 pt-4 min-[480px]:px-5 min-[480px]:pb-5 min-[480px]:pt-5 shadow-xl"
            style={{
              background:
                "radial-gradient(120% 100% at 100% 0%, rgba(255,244,224,0.94) 0%, rgba(255,255,255,0.98) 44%, rgba(255,255,255,1) 100%)",
              boxShadow: "0 22px 44px rgba(15,23,42,0.18), 0 4px 14px rgba(15,23,42,0.09)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.span
              aria-hidden
              className="absolute right-0 top-0 size-[104px] rounded-full blur-[34px]"
              style={{ background: "rgba(249,115,22,0.16)" }}
              initial={{ opacity: 0.55, scale: 0.9 }}
              animate={{ opacity: 0.9, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />

            <div className="relative z-[1]">
              <div className="mb-3 inline-flex items-center rounded-full border border-orange-100 bg-orange-50/90 px-2.5 py-1">
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-600"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  Streak Updated
                </span>
              </div>

              <div className="mb-3.5 flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-[17px] font-semibold leading-tight text-slate-900 min-[480px]:text-[19px]"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    Daily streak increased
                  </p>
                  <p
                    className="mt-1 text-[12px] text-slate-500 min-[480px]:text-[13px]"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    Nice consistency. Keep the chain alive.
                  </p>
                </div>
                <motion.div
                  aria-hidden
                  className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border border-orange-200/70 bg-white shadow-[0_8px_20px_rgba(249,115,22,0.16)]"
                  initial={{ rotate: -8, scale: 0.9 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Image src="/fire.svg" alt="" width={26} height={30} unoptimized />
                </motion.div>
              </div>

              <div className="mb-3.5 flex items-end justify-between rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 min-[480px]:px-3.5">
                <div>
                  <p
                    className="text-[11px] font-medium uppercase tracking-[0.11em] text-slate-500"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    Current streak
                  </p>
                  <div className="mt-1.5 flex items-end gap-2">
                    <span
                      className="tabular-nums inline-flex overflow-hidden leading-none text-[38px] font-black tracking-[-0.03em] text-slate-900 min-[480px]:text-[44px]"
                      style={{
                        minWidth: `${Math.max(1, String(shownStreak).length) * 0.62}em`,
                        fontFamily: "var(--font-nunito)",
                      }}
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        <motion.span
                          key={shownStreak}
                          initial={{ y: "75%", opacity: 0 }}
                          animate={{ y: "0%", opacity: 1 }}
                          exit={{ y: "-75%", opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        >
                          {shownStreak}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <span
                      className="pb-1 text-[13px] font-medium text-slate-500"
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      day{shownStreak !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <motion.div
                  className="mb-0.5 rounded-full bg-orange-100 px-2 py-1"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
                >
                  <span
                    className="text-[12px] font-semibold text-orange-700"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    +{Math.max(0, detail.newStreak - detail.previousStreak)}
                  </span>
                </motion.div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/85 px-2.5 py-2.5 min-[480px]:px-3">
                <div className="flex items-center justify-between gap-1.5">
                  {detail.week.map((day, i) => {
                    const isToday = isTodaySlot(day, detail.today);
                    const active = day.active;
                    const showCheck = active && (!isToday || showTodayCheck);
                    const labelColor = isToday ? "#0F172A" : "#64748B";

                    return (
                      <div
                        key={`${day.date}-${i}`}
                        className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                      >
                        <span
                          className="text-[10px] font-semibold uppercase tracking-[0.04em]"
                          style={{ fontFamily: "var(--font-inter)", color: labelColor }}
                        >
                          {day.label}
                        </span>
                        <motion.div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
                          style={
                            showCheck
                              ? {
                                  background: "#F97316",
                                  borderColor: "#F97316",
                                }
                              : isToday
                                ? {
                                    background: "#fff",
                                    borderColor: "#FB923C",
                                  }
                                : {
                                    background: "#fff",
                                    borderColor: "#CBD5E1",
                                  }
                          }
                          animate={
                            isToday && showTodayCheck && active
                              ? { scale: [0.86, 1.08, 1] }
                              : { scale: 1 }
                          }
                          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <AnimatePresence>
                            {showCheck ? (
                              <motion.svg
                                key="check"
                                width="11"
                                height="11"
                                viewBox="0 0 14 14"
                                fill="none"
                                aria-hidden
                                initial={{ opacity: 0, scale: 0.55, y: 3 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <path
                                  d="M2.5 7.5L5.5 10.5L11.5 3.5"
                                  stroke="#fff"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </motion.svg>
                            ) : null}
                          </AnimatePresence>
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
