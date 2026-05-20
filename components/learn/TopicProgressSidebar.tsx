"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

export interface TopicEntry {
  topic_index: string;
  topic_name: string;
  page_start?: number;
  page_end?: number;
}

interface TopicProgressSidebarProps {
  chapterName: string;
  topics: TopicEntry[];
  topicsCompleted: string[];
  currentTopicIndex: string | null;
  collapsed?: boolean;
}

export default function TopicProgressSidebar({
  chapterName,
  topics,
  topicsCompleted,
  currentTopicIndex,
  collapsed = false,
}: TopicProgressSidebarProps) {
  const currentKey = currentTopicIndex != null && String(currentTopicIndex).trim() !== "" ? String(currentTopicIndex).trim() : null;

  const { completedSet, completedCount, totalTopics, progressPercent } = useMemo(() => {
    const normalized = topicsCompleted.map((x) => String(x).trim()).filter(Boolean);
    const set = new Set(normalized);
    const total = topics.length;
    const done = topics.reduce((n, t) => n + (set.has(String(t.topic_index).trim()) ? 1 : 0), 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { completedSet: set, completedCount: done, totalTopics: total, progressPercent: pct };
  }, [topics, topicsCompleted]);

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--base-200)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%`, backgroundColor: "var(--primary-400)" }}
          />
        </div>
        <span
          className="text-[12px] shrink-0"
          style={{ fontFamily: "var(--font-inter)", color: "var(--base-500)" }}
        >
          {completedCount}/{totalTopics}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full py-5 px-4"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      {/* Chapter title */}
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--base-400)" }}>
          Chapter Progress
        </p>
        <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--base-800)" }}>
          {chapterName}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[12px]" style={{ color: "var(--base-500)" }}>
            {completedCount} of {totalTopics} topics
          </span>
          <span className="text-[12px] font-medium" style={{ color: "var(--primary-400)" }}>
            {progressPercent}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--base-200)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--primary-400)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Topic list */}
      <div className="flex flex-col gap-1 flex-1 overflow-y-auto scrollbar-none">
        {topics.map((topic, i) => {
          const ti = String(topic.topic_index).trim();
          const isCompleted = completedSet.has(ti);
          const isCurrent = currentKey != null && ti === currentKey;
          const isFuture = !isCompleted && !isCurrent;

          return (
            <motion.div
              key={ti}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className={`flex items-start gap-2.5 px-2 py-2 rounded-lg ${
                isCurrent ? "bg-[var(--primary-10)]" : ""
              }`}
            >
              <span className="text-sm mt-0.5 shrink-0">
                {isCompleted ? "✅" : isCurrent ? "🔵" : "⬜"}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-[13px] leading-snug ${isFuture ? "opacity-50" : ""}`}
                  style={{
                    color: isCurrent ? "var(--primary-400)" : "var(--base-700)",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {topic.topic_name}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--base-400)" }}>
                  {ti}
                </p>
              </div>
              {isCurrent && (
                <span
                  className="ml-auto text-[11px] font-medium shrink-0 px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: "var(--primary-400)", color: "#fff" }}
                >
                  Now
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
