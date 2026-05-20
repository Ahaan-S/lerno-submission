"use client";

import { motion, useReducedMotion } from "framer-motion";
import { resolveChapterProgressSubjectForDisplay } from "@/lib/learn-progress";
import { getTutorSubjectDotColor } from "@/lib/tutor-subject-dot-color";

type Chapter = {
  subject: string;
  chapter_name: string;
  status?: string;
  completed_at?: string | null;
};

const ease = [0.22, 1, 0.36, 1] as const;

export function ProfileChapterList({ chapters }: { chapters: Chapter[] }) {
  const reduceMotion = useReducedMotion();

  if (!chapters.length) {
    return (
      <p className="text-[13px] text-[var(--base-400)]" style={{ fontFamily: "var(--font-inter)" }}>
        No completed chapters yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {chapters.map((c, i) => {
        const { displayLabel, tutorSlug } = resolveChapterProgressSubjectForDisplay(c.subject);
        const dotColor = getTutorSubjectDotColor(tutorSlug);
        return (
        <motion.li
          key={`${tutorSlug}-${c.chapter_name}-${i}`}
          initial={reduceMotion ? false : { opacity: 0, x: -6 }}
          animate={reduceMotion ? false : { opacity: 1, x: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.04 * i, duration: 0.22, ease }}
          className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-[14px] text-[var(--base-800)] transition-colors duration-150 hover:bg-[var(--base-50)]"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <span
            className="mt-[3px] size-2 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
            aria-hidden
          />
          <span>
            <span className="font-medium text-[var(--base-600)]">{displayLabel}</span>
            <span className="text-[var(--base-400)]"> · </span>
            {c.chapter_name}
          </span>
        </motion.li>
        );
      })}
    </ul>
  );
}
