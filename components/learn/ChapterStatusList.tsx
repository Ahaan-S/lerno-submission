"use client";

import { motion, AnimatePresence } from "framer-motion";

export type ChapterStatus = "not_started" | "diagnostic_done" | "in_progress" | "completed";

export interface ChapterEntry {
  chapter_index: number;
  chapter_name: string;
  status: ChapterStatus;
  diagnostic_completed: boolean;
  current_topic_index: string | null;
  topics_completed: string[];
  last_session_at: string | null;
  last_session_id: string | null;
}

function StatusDot({ status }: { status: ChapterStatus }) {
  if (status === "completed") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7.5" fill="#22c55e" stroke="none" />
        <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "in_progress") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7.5" stroke="#f59e0b" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="3.5" fill="#f59e0b" />
      </svg>
    );
  }
  if (status === "diagnostic_done") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7.5" stroke="#3b82f6" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="3.5" fill="#3b82f6" />
      </svg>
    );
  }
  // not_started
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7.5" stroke="#CBD5E1" strokeWidth="1.5" />
    </svg>
  );
}

const STATUS_LABEL: Record<ChapterStatus, string> = {
  not_started: "Not started",
  diagnostic_done: "Quick check done",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_COLOR: Record<ChapterStatus, string> = {
  not_started: "var(--base-300)",
  diagnostic_done: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#22c55e",
};

export default function ChapterStatusList({
  chapters,
  selectedIndex,
  onSelect,
}: {
  chapters: ChapterEntry[];
  selectedIndex: number | null;
  onSelect: (chapter: ChapterEntry) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <AnimatePresence>
        {chapters.map((chapter, i) => {
          const isSelected = selectedIndex === chapter.chapter_index;

          return (
            <motion.button
              key={chapter.chapter_index}
              type="button"
              onClick={() => onSelect(chapter)}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, delay: i * 0.025 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-100 cursor-pointer ${
                isSelected
                  ? "bg-[var(--primary-10)] border border-[var(--primary-200)]"
                  : "hover:bg-[var(--base-100)] border border-transparent"
              }`}
            >
              <span className="shrink-0">
                <StatusDot status={chapter.status} />
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[14px] font-medium truncate"
                  style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}
                >
                  {chapter.chapter_index}. {chapter.chapter_name}
                </p>
                <p
                  className="text-[12px]"
                  style={{ fontFamily: "var(--font-inter)", color: STATUS_COLOR[chapter.status] }}
                >
                  {STATUS_LABEL[chapter.status]}
                  {chapter.status === "in_progress" && chapter.current_topic_index
                    ? ` — Topic ${chapter.current_topic_index}`
                    : ""}
                  {chapter.status === "in_progress" && chapter.topics_completed.length > 0
                    ? ` (${chapter.topics_completed.length} done)`
                    : ""}
                </p>
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
