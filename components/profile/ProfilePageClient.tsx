"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Flame } from "lucide-react";
import { resolveChapterProgressSubjectForDisplay } from "@/lib/learn-progress";
import { getTutorSubjectDotColor } from "@/lib/tutor-subject-dot-color";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { ProfileChapterList } from "@/components/profile/ProfileChapterList";
import { FriendButton } from "@/components/profile/FriendButton";
import type { ProfileRelationship } from "@/lib/profile-viewer-relationship";
import { format } from "date-fns";

type Chapter = {
  subject: string;
  chapter_name: string;
  status?: string;
  completed_at?: string | null;
};

type ProfilePayload = {
  id: string;
  is_visible?: boolean;
  visibility?: string;
  display_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  grade?: string | null;
  joined_at?: string | null;
  stats?: Record<string, number | undefined>;
  recent_chapters?: Chapter[];
  friends_count?: number;
  strong_topics?: { subject: string; topic_name: string | null }[];
};

const sectionEase = [0.22, 1, 0.36, 1] as const;

export function ProfilePageClient({ userId }: { userId: string }) {
  const reduceMotion = useReducedMotion();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [relationship, setRelationship] = useState<ProfileRelationship>("none");
  const [meta, setMeta] = useState<{
    incoming_request_id?: string | null;
    outgoing_request_id?: string | null;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/${userId}`, { credentials: "include" });
      const data = (await res.json()) as {
        profile?: ProfilePayload;
        relationship?: ProfileRelationship;
        relationship_meta?: typeof meta;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load profile");
        setProfile(null);
        return;
      }
      setProfile(data.profile ?? null);
      setRelationship(data.relationship ?? "none");
      setMeta(data.relationship_meta ?? {});
    } catch {
      setError("Network error");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 w-full max-w-7xl mx-auto" style={{ fontFamily: "var(--font-inter)" }}>
        <div className="h-20 w-20 rounded-full skeleton motion-safe:animate-pulse" />
        <div className="h-6 w-48 skeleton rounded motion-safe:animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl skeleton motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <motion.div
        className="p-8 text-center text-[var(--base-600)] max-w-md mx-auto"
        style={{ fontFamily: "var(--font-inter)" }}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={reduceMotion ? false : { opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: sectionEase }}
      >
        <p className="text-[15px] font-medium">{error ?? "Profile not found"}</p>
        <Link
          href="/friends"
          className="mt-4 inline-block text-[14px] text-[var(--primary-500)] font-semibold transition-opacity duration-150 hover:opacity-90"
        >
          Back to friends
        </Link>
      </motion.div>
    );
  }

  if (profile.is_visible === false) {
    const msg =
      profile.visibility === "friends_only"
        ? "This profile is only visible to friends."
        : "This profile is private.";
    return (
      <motion.div
        className="w-full max-w-7xl mx-auto px-5 sm:px-8 py-12"
        style={{ fontFamily: "var(--font-inter)" }}
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={reduceMotion ? false : { opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: sectionEase }}
      >
        <div className="flex items-start gap-4 rounded-2xl border border-[var(--base-200)] bg-white/90 p-5 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-md">
          <ProfileAvatar
            avatarUrl={profile.avatar_url}
            displayName={profile.display_name}
            fullName={profile.full_name}
            size={80}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold text-[var(--base-800)] truncate">
              {profile.display_name ?? "Student"}
            </h1>
            {profile.grade != null && (
              <p className="text-[13px] text-[var(--base-500)] mt-0.5">Grade {String(profile.grade)}</p>
            )}
            <p className="text-[14px] text-[var(--base-500)] mt-4 leading-relaxed">{msg}</p>
            <div className="mt-6">
              <FriendButton
                targetUserId={userId}
                relationship={relationship}
                relationshipMeta={meta}
                onChanged={() => void load()}
              />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const joined =
    profile.joined_at != null
      ? format(new Date(profile.joined_at), "MMM yyyy")
      : null;

  return (
    <div
      className="w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-8 bg-gradient-to-b from-violet-50/50 via-[var(--base-100)] to-sky-50/40 rounded-3xl sm:rounded-none"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <motion.div
        className="overflow-visible rounded-2xl border border-[color-mix(in_srgb,var(--physics)_18%,var(--base-200))] bg-gradient-to-br from-white via-[color-mix(in_srgb,var(--physics)_4%,white)] to-[color-mix(in_srgb,var(--math)_5%,white)] p-5 sm:p-7 shadow-[0_8px_32px_-12px_rgba(99,102,241,0.2)] transition-shadow duration-300 ease-out hover:shadow-[0_16px_48px_-12px_rgba(99,102,241,0.22)]"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={reduceMotion ? false : { opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: sectionEase }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <motion.div
            className="shrink-0 sm:mt-1"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
            animate={reduceMotion ? false : { opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 24, delay: reduceMotion ? 0 : 0.04 }}
          >
            <ProfileAvatar
              avatarUrl={profile.avatar_url}
              displayName={profile.display_name}
              fullName={profile.full_name}
              size={88}
              className="shadow-sm"
            />
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-[22px] sm:text-[24px] font-bold text-[var(--base-800)] tracking-tight truncate">
                  {profile.display_name ?? "Student"}
                </h1>
                <p className="text-[13px] text-[var(--base-500)] mt-1.5">
                  {profile.grade != null && <>Grade {String(profile.grade)}</>}
                  {profile.grade != null && joined != null && " · "}
                  {joined != null && <>Joined {joined}</>}
                </p>
              </div>
              <FriendButton
                targetUserId={userId}
                relationship={relationship}
                relationshipMeta={meta}
                onChanged={() => void load()}
              />
            </div>
            {profile.bio && (
              <p className="text-[14px] text-[var(--base-600)] mt-4 leading-relaxed border-t border-[var(--base-200)]/80 pt-4">
                {profile.bio}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        className="mt-8"
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={reduceMotion ? false : { opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: sectionEase, delay: reduceMotion ? 0 : 0.08 }}
      >
        <ProfileStats stats={profile.stats ?? {}} />
      </motion.div>

      <motion.section
        className="mt-10 rounded-2xl border border-[color-mix(in_srgb,var(--science)_22%,var(--base-200))] bg-gradient-to-br from-white to-[color-mix(in_srgb,var(--science)_7%,white)] p-5 sm:p-6 shadow-[0_8px_28px_-10px_rgba(59,130,246,0.18)] transition-[box-shadow,border-color] duration-200 hover:border-[color-mix(in_srgb,var(--science)_35%,var(--base-300))]"
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={reduceMotion ? false : { opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: sectionEase, delay: reduceMotion ? 0 : 0.12 }}
      >
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-[color-mix(in_srgb,var(--science)_55%,var(--base-500))] mb-4">
          Recently completed
        </h2>
        <ProfileChapterList chapters={profile.recent_chapters ?? []} />
      </motion.section>

      {(profile.strong_topics?.length ?? 0) > 0 && (
        <motion.section
          className="mt-6 rounded-2xl border border-[color-mix(in_srgb,var(--chemistry)_20%,var(--base-200))] bg-gradient-to-br from-white to-[color-mix(in_srgb,var(--chemistry)_6%,white)] p-5 sm:p-6 shadow-[0_8px_28px_-10px_rgba(236,72,153,0.14)] transition-[box-shadow,border-color] duration-200 hover:border-[color-mix(in_srgb,var(--chemistry)_32%,var(--base-300))]"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: sectionEase, delay: reduceMotion ? 0 : 0.16 }}
        >
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-[color-mix(in_srgb,var(--chemistry)_50%,var(--base-500))] mb-3">
            Strong topics
          </h2>
          <ul className="flex flex-col gap-2 text-[13px] text-[var(--base-700)]">
            {(profile.strong_topics ?? []).map((t, i) => {
              const { tutorSlug } = resolveChapterProgressSubjectForDisplay(t.subject);
              const topicAccent = getTutorSubjectDotColor(tutorSlug);
              return (
                <motion.li
                  key={`${t.subject}-${i}`}
                  initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                  animate={reduceMotion ? false : { opacity: 1, x: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.04 * i, duration: 0.2, ease: sectionEase }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--base-100)_70%,transparent)]"
                >
                  <BookOpen
                    className="size-3.5 shrink-0"
                    strokeWidth={2}
                    aria-hidden
                    style={{ color: topicAccent }}
                  />
                  <span>
                    <span className="font-medium text-[var(--base-600)]">{t.subject}</span>
                    {t.topic_name ? <span className="text-[var(--base-500)]"> · {t.topic_name}</span> : null}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </motion.section>
      )}

      <motion.section
        className="mt-8 flex flex-wrap items-center gap-3 text-[14px] text-[var(--base-600)]"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? false : { opacity: 1 }}
        transition={{ duration: 0.25, delay: reduceMotion ? 0 : 0.2 }}
      >
        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--base-800)]">
          <Flame
            className="size-4 text-[var(--streak-flame)] drop-shadow-[0_0_10px_color-mix(in_srgb,var(--streak-glow)_70%,transparent)]"
            strokeWidth={2.25}
            aria-hidden
          />
          {profile.friends_count ?? 0} friends
        </span>
        <Link
          href="/friends"
          className="text-[var(--primary-500)] font-semibold text-[13px] transition-opacity duration-150 hover:opacity-90 hover:underline underline-offset-2"
        >
          See all
        </Link>
      </motion.section>
    </div>
  );
}
