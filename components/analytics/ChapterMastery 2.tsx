"use client";

import React from "react";

export type MasteryCard = {
  topic_name: string;
  subject: string;
  quiz_attempts: number;
  accuracy: number;
};

function subjectBg(label: string): string {
  const l = label.toLowerCase();
  if (l === "mathematics" || l === "math") return "#333D3C";
  if (l === "physics") return "#4346A9";
  if (l === "chemistry") return "#545C6C";
  if (l === "biology") return "#2B937D";
  if (l.includes("social")) return "#31307B";
  if (l === "hindi") return "#154073";
  if (l.includes("science")) return "#0077ED";
  return "#475569";
}

function ChapterCard({ item }: { item: MasteryCard }) {
  const bg = subjectBg(item.subject);
  return (
    <div
      className="flex min-w-0 w-full max-w-full items-center justify-between gap-2 rounded-xl px-3 py-3 sm:gap-3 sm:px-4"
      style={{ background: bg }}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        <p
          className="truncate text-[13px] font-semibold text-white"
          title={item.topic_name}
        >
          {item.topic_name}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-white/70" title={item.subject}>
          {item.subject}
        </p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className="text-[18px] font-bold leading-none text-white sm:text-[20px]">{item.accuracy}%</p>
        <p className="mt-0.5 whitespace-nowrap text-[10px] text-white/60">
          {item.quiz_attempts} attempts
        </p>
      </div>
    </div>
  );
}

export function ChapterMastery({ strong, weak }: { strong: MasteryCard[]; weak: MasteryCard[] }) {
  const strongShow = strong.slice(0, 4);
  const weakShow = weak.slice(0, 4);

  return (
    <div
      className="grid min-w-0 max-w-full grid-cols-1 gap-5 md:grid-cols-2"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--base-200)] bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 text-[15px] font-semibold text-[var(--base-800)]">Strong Chapters</h3>
        {strongShow.length === 0 ? (
          <p className="break-words text-[13px] text-[var(--base-500)]">
            Strong topics come from <strong className="font-medium text-[var(--base-700)]">Study Feed</strong>{" "}
            quizzes: 5+ scored attempts per topic with high accuracy.
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-2.5">
            {strongShow.map((item, i) => (
              <ChapterCard key={`${item.topic_name}-${i}`} item={item} />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--base-200)] bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 text-[15px] font-semibold text-[var(--base-800)]">Chapters Needing Attention</h3>
        {weakShow.length === 0 ? (
          <p className="break-words text-[13px] text-[var(--base-500)]">
            Weak topics appear after 3+ scored attempts in{" "}
            <strong className="font-medium text-[var(--base-700)]">Study Feed</strong> when accuracy stays low.
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-2.5">
            {weakShow.map((item, i) => (
              <ChapterCard key={`${item.topic_name}-${i}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChapterMasterySkeleton() {
  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-5 md:grid-cols-2">
      {[1, 2].map((col) => (
        <div
          key={col}
          className="min-w-0 max-w-full animate-pulse overflow-hidden rounded-2xl border border-[var(--base-200)] bg-white p-4 sm:p-5"
        >
          <div className="mb-4 h-4 w-40 rounded bg-[var(--base-200)]" />
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[58px] rounded-xl bg-[var(--base-100)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
