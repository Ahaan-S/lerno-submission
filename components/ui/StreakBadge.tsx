"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  type WeekDay,
} from "@/lib/streak-client";
import { useStreak } from "@/hooks/use-streak";

/** Intro count-up animation: once per JS bundle load. */
let hasAnimatedThisLoad = false;

/* ─────────────────────────────────────────────────────────────────────────────
 * Props
 * ──────────────────────────────────────────────────────────────────────────── */
interface StreakBadgeProps {
  splashActive?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Hover card — Duolingo-style
 * ──────────────────────────────────────────────────────────────────────────── */
const POPOVER_WIDTH = 300;

function StreakHoverCard({
  streak,
  week,
  todayKey,
  arrowShiftPx,
}: {
  streak: number;
  week: WeekDay[];
  /** ISO date `YYYY-MM-DD` for “today” (from API; matches `week[].date`). */
  todayKey: string;
  /** Same horizontal px applied to the popover wrapper; keeps arrow under the streak pill. */
  arrowShiftPx: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 5, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "relative",
        width: POPOVER_WIDTH,
        maxWidth: "calc(100vw - 24px)",
        boxSizing: "border-box",
        borderRadius: 20,
        background: "#FB923C",
        boxShadow: "0 12px 40px rgba(234,88,12,0.22), 0 2px 10px rgba(0,0,0,0.10)",
        padding: "20px 18px 18px",
        userSelect: "none",
        overflow: "visible",
      }}
    >
      {/* Arrow: stays under streak pill when card is viewport-shifted (shift moves card, so nudge arrow opposite). */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -7,
          left: `clamp(14px, calc(50% - ${arrowShiftPx}px), calc(100% - 14px))`,
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderBottom: "8px solid #FB923C",
        }}
      />

      {/* Top row: title left, fire right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p style={{
            fontFamily: "var(--font-nunito)",
            fontWeight: 800,
            fontSize: 24,
            color: "#fff",
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            margin: 0,
          }}>
            {streak} day{streak !== 1 ? "s" : ""} streak
          </p>
          <p style={{
            fontFamily: "var(--font-inter)",
            fontSize: 13,
            color: "rgba(255,255,255,0.88)",
            marginTop: 5,
            fontWeight: 500,
          }}>
            Keep it going!
          </p>
        </div>
        <Image
          src="/fire.svg"
          alt=""
          width={60}
          height={68}
          aria-hidden
          unoptimized
          style={{ display: "block", flexShrink: 0 }}
        />
      </div>

      {/* Week row — flex children shrink equally so Sunday is never clipped */}
      <div
        style={{
          background: "rgba(0,0,0,0.15)",
          borderRadius: 14,
          padding: "10px 10px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "stretch",
          gap: 3,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {week.map((day, i) => {
          const isToday =
            day.is_today === true ||
            (day.is_today !== false && todayKey !== "" && day.date === todayKey);
          const labelColor = isToday ? "#fff" : "rgba(255,255,255,0.42)";
          const circleActive = day.active;
          const circleTodayInactive = isToday && !circleActive;

          const circleStyle: React.CSSProperties = {
            width: 28,
            height: 28,
            maxWidth: "100%",
            aspectRatio: "1",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxSizing: "border-box",
            ...(circleActive
              ? {
                  background: "#fff",
                  border: "2px solid transparent",
                }
              : circleTodayInactive
                ? {
                    background: "rgba(255,255,255,0.06)",
                    border: "2px dashed rgba(255,255,255,0.78)",
                  }
                : {
                    background: "rgba(255,255,255,0.14)",
                    border: "2px solid transparent",
                  }),
          };

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                flex: "1 1 0",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: labelColor,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                {day.label}
              </span>
              <div style={circleStyle}>
                {circleActive && (
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                      d="M2.5 7.5L5.5 10.5L11.5 3.5"
                      stroke="#F97316"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Main badge
 * ──────────────────────────────────────────────────────────────────────────── */
export function StreakBadge({ splashActive = false, size = "md", className = "" }: StreakBadgeProps) {
  // SWR-backed: stays accurate across tabs; revalidateOnFocus replaces
  // the getStreakData() + STREAK_DATA_EVENT listener pattern.
  const { data } = useStreak();
  const [displayed, setDisplayed] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(hasAnimatedThisLoad);
  const [hovered, setHovered] = useState(false);
  const [popoverShiftX, setPopoverShiftX] = useState(0);
  const splashRef = useRef(splashActive);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const streakAnchorRef = useRef<HTMLDivElement>(null);
  const popoverShellRef = useRef<HTMLDivElement>(null);

  /** Keep popover inside viewport (analytics header flush-right, small screens). */
  const updatePopoverShift = useCallback(() => {
    const anchor = streakAnchorRef.current;
    const shell = popoverShellRef.current;
    if (!anchor || !shell) return;
    const w = shell.getBoundingClientRect().width;
    const r = anchor.getBoundingClientRect();
    const pillCenter = r.left + r.width / 2;
    const margin = 12;
    const vw = document.documentElement.clientWidth;
    let shift = 0;
    const right = pillCenter + w / 2 + shift;
    if (right > vw - margin) shift += vw - margin - right;
    const left = pillCenter - w / 2 + shift;
    if (left < margin) shift += margin - left;
    setPopoverShiftX(shift);
  }, []);

  useEffect(() => { splashRef.current = splashActive; }, [splashActive]);

  const streak = data?.streak ?? null;
  const week = data?.week ?? [];
  const todayKey = data?.today ?? "";

  // Trigger count-up after splash clears
  useEffect(() => {
    if (streak === null) return;

    if (hasAnimatedThisLoad) {
      const t = setTimeout(() => { setDisplayed(streak); setVisible(true); setAnimating(false); }, 0);
      return () => clearTimeout(t);
    }

    let pollTimer: ReturnType<typeof setTimeout>;
    const tryStart = () => {
      if (splashRef.current) { pollTimer = setTimeout(tryStart, 100); return; }
      pollTimer = setTimeout(() => { hasAnimatedThisLoad = true; setVisible(true); setAnimating(true); }, 200);
    };
    tryStart();
    return () => clearTimeout(pollTimer);
  }, [streak]);

  // Count up 0 → streak with ease-out cadence
  useEffect(() => {
    if (!animating || streak === null || streak === 0) {
      if (animating && streak === 0) {
        const t = setTimeout(() => setAnimating(false), 0);
        return () => clearTimeout(t);
      }
      return;
    }

    let current = 0;
    const target = streak;
    let tickTimer: ReturnType<typeof setTimeout>;

    const tick = () => {
      current += 1;
      setDisplayed(current);
      if (current >= target) { setAnimating(false); return; }
      const remaining = target - current;
      const delay = remaining <= 3 ? 160 : remaining <= 8 ? 100 : 60;
      tickTimer = setTimeout(tick, delay);
    };

    tickTimer = setTimeout(tick, 60);
    return () => clearTimeout(tickTimer);
  }, [animating, streak]);

  // Close card on outside click
  useEffect(() => {
    if (!hovered) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setHovered(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [hovered]);

  // Horizontal clamp so the card stays on-screen (popover may mount a frame after hover)
  useLayoutEffect(() => {
    if (!hovered) {
      queueMicrotask(() => setPopoverShiftX(0));
      return;
    }
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => updatePopoverShift());
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [hovered, streak, week.length, updatePopoverShift]);

  useEffect(() => {
    if (!hovered) return;
    const onViewportChange = () => updatePopoverShift();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [hovered, updatePopoverShift]);

  if (streak === null) return null;

  const isSm = size === "sm";

  return (
    <div
      ref={wrapperRef}
      className={`select-none ${className}`}
      style={{ transition: "opacity 500ms", opacity: visible ? 1 : 0 }}
      title={`${streak}-day streak`}
      aria-label={`${streak}-day streak`}
    >
      {/* Positioning context = streak badge only; popover centred under pill */}
      <div
        ref={streakAnchorRef}
        className="relative inline-flex"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Badge pill with subtle hover bg */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px 6px 8px",
            borderRadius: 999,
            background: hovered ? "rgba(249,115,22,0.1)" : "transparent",
            transition: "background 200ms ease",
            cursor: "default",
          }}
        >
          <Image
            src="/fire.svg"
            alt=""
            width={isSm ? 22 : 28}
            height={isSm ? 18 : 22}
            aria-hidden
            style={{ display: "block", flexShrink: 0, marginBottom: 3 }}
            unoptimized
          />

          {/* Slot-machine number */}
          <span style={{
            display: "inline-flex",
            overflow: "hidden",
            height: isSm ? "1.1em" : "1.15em",
            alignItems: "center",
            minWidth: `${Math.max(1, String(displayed).length) * 0.65}em`,
            justifyContent: "center",
          }}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={displayed}
                style={{
                  display: "block",
                  lineHeight: 1,
                  fontSize: 15,
                  color: "#F97316",
                  fontFamily: "var(--font-nunito)",
                  fontWeight: 800,
                  letterSpacing: "0.01em",
                }}
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-110%", opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                {displayed}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        {/* Hover card — full-width anchor under pill, flex-centred (avoids motion transform clash) */}
        <AnimatePresence>
          {hovered && week.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                zIndex: 9999,
                pointerEvents: "none",
              }}
            >
              <div
                ref={popoverShellRef}
                style={{
                  pointerEvents: "auto",
                  transform: popoverShiftX !== 0 ? `translateX(${popoverShiftX}px)` : undefined,
                }}
              >
                <StreakHoverCard
                  streak={streak}
                  week={week}
                  todayKey={todayKey}
                  arrowShiftPx={popoverShiftX}
                />
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
