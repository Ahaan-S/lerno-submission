"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen, Flame } from "lucide-react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { ProfileRelationship } from "@/lib/profile-viewer-relationship";
import { FriendButton } from "@/components/profile/FriendButton";

type HoverPayload = {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  grade?: string | null;
  current_chapter?: string | null;
  current_streak?: number;
};

/** Short delay so accidental trackpad brushes do not open the card; kept low for a smooth reveal. */
const INTENT_MS = 220;

export function ProfileHoverCard({
  userId,
  displayName,
  /** When known (e.g. friends list), improves initial-letter fallback before hover payload loads */
  friendFullName,
  children,
  relationship = "none",
  relationshipMeta,
  onRelationshipChanged,
}: {
  userId: string;
  displayName: string;
  friendFullName?: string | null;
  children: React.ReactNode;
  relationship?: ProfileRelationship;
  relationshipMeta?: { incoming_request_id?: string | null; outgoing_request_id?: string | null };
  onRelationshipChanged?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<HoverPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    timerRef.current = null;
    closeTimerRef.current = null;
  }, []);

  const loadHover = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/${userId}/hover`, { credentials: "include" });
      const data = (await res.json()) as { hover?: HoverPayload | null };
      setHover(data.hover ?? null);
    } catch {
      setHover(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const positionPopover = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(280, window.innerWidth - 16);
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    const top = r.bottom + 8;
    setPos({ top, left });
  }, []);

  const onEnter = useCallback(() => {
    clearTimers();
    positionPopover();
    timerRef.current = setTimeout(() => {
      setOpen(true);
      void loadHover();
    }, INTENT_MS);
  }, [clearTimers, loadHover, positionPopover]);

  const onLeave = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 160);
  }, [clearTimers]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => positionPopover();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open, positionPopover]);

  const name = hover?.display_name ?? displayName;

  return (
    <span
      ref={wrapRef}
      className="relative inline max-w-full"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            key="profile-hover-popover"
            ref={popRef}
            role="dialog"
            aria-label="Profile preview"
            className="fixed z-[100] w-[min(280px,calc(100vw-16px))] origin-top overflow-visible rounded-xl border border-[var(--base-200)] bg-white/95 p-3.5 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-md will-change-[transform,opacity]"
            style={{
              top: pos.top,
              left: pos.left,
              fontFamily: "var(--font-inter)",
            }}
            initial={reduceMotion ? false : { opacity: 0, y: -10, scale: 0.96 }}
            animate={reduceMotion ? false : { opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? undefined
                : {
                    opacity: 0,
                    y: -6,
                    scale: 0.98,
                    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: "tween", duration: 0.3, ease: [0.22, 1, 0.36, 1] }
            }
            onMouseEnter={() => {
              clearTimers();
              setOpen(true);
            }}
            onMouseLeave={onLeave}
          >
            {loading && !hover ? (
              <p className="text-[12px] text-[var(--base-400)] motion-safe:animate-pulse">Loading…</p>
            ) : !hover ? (
              <p className="text-[12px] text-[var(--base-400)]">Profile unavailable</p>
            ) : (
              <>
                <div className="flex items-start gap-2.5">
                  <ProfileAvatar
                    avatarUrl={hover.avatar_url}
                    displayName={name}
                    fullName={friendFullName}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[var(--base-800)] truncate">{name}</p>
                    {hover.grade != null && (
                      <p className="text-[12px] text-[var(--base-500)]">Grade {String(hover.grade)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[12px] text-[var(--base-600)]">
                  {typeof hover.current_streak === "number" && (
                    <p className="flex items-center gap-1.5">
                      <Flame className="size-3.5 shrink-0 text-[var(--primary-400)]" strokeWidth={2} aria-hidden />
                      <span>{hover.current_streak} day streak</span>
                    </p>
                  )}
                  {hover.current_chapter && (
                    <p className="flex items-start gap-1.5 line-clamp-2">
                      <BookOpen className="size-3.5 shrink-0 mt-0.5 text-[var(--primary-400)]" strokeWidth={2} aria-hidden />
                      <span>{hover.current_chapter}</span>
                    </p>
                  )}
                </div>
                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[var(--base-200)] pt-3">
                  <Link
                    href={`/profile/${userId}`}
                    className="text-[12px] font-semibold text-[var(--primary-500)] transition-opacity duration-150 hover:opacity-90 hover:underline underline-offset-2"
                  >
                    View profile
                  </Link>
                  <FriendButton
                    targetUserId={userId}
                    relationship={relationship}
                    relationshipMeta={relationshipMeta}
                    compact
                    onChanged={() => {
                      onRelationshipChanged?.();
                      void loadHover();
                    }}
                  />
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
