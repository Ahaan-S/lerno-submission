"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ChapterStatusList, { type ChapterEntry } from "./ChapterStatusList";

interface RecommendationCardProps {
  subject: string;
  subjectLabel: string;
  chapters: ChapterEntry[];
  recommendedChapterIndex: number | null;
  recommendationMessage: string;
  grade: number;
  loading?: boolean;
}

export default function RecommendationCard({
  subject,
  chapters,
  recommendedChapterIndex,
  recommendationMessage,
  grade,
  loading = false,
}: RecommendationCardProps) {
  const router = useRouter();
  const [showChapterList, setShowChapterList] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<ChapterEntry | null>(
    () =>
      chapters.find((c) => c.chapter_index === recommendedChapterIndex) ??
      chapters[0] ??
      null
  );
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (chapters.length === 0) {
      setSelectedChapter(null);
      return;
    }
    setSelectedChapter((prev) => {
      if (prev && chapters.some((c) => c.chapter_index === prev.chapter_index)) return prev;
      const byRec = recommendedChapterIndex != null
        ? chapters.find((c) => c.chapter_index === recommendedChapterIndex)
        : null;
      return byRec ?? chapters[0] ?? null;
    });
  }, [chapters, recommendedChapterIndex]);

  const handleStartChapter = async () => {
    if (!selectedChapter || starting) return;
    setStarting(true);
    try {
      // For brand-new chapters, always run diagnostic first.
      if (selectedChapter.status === "not_started" && !selectedChapter.diagnostic_completed) {
        router.push(
          `/learn/${subject}/diagnostic/${selectedChapter.chapter_index}?chapter=${encodeURIComponent(selectedChapter.chapter_name)}`
        );
        return;
      }

      const res = await fetch("/api/learn/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject,
          chapter_index: selectedChapter.chapter_index,
          chapter_name: selectedChapter.chapter_name,
          grade,
        }),
      });
      const data = await res.json() as { session_id: string; diagnostic_completed: boolean };
      if (!data.session_id) throw new Error("No session ID returned");
      router.push(`/learn/${subject}/session/${data.session_id}`);
    } catch (err) {
      console.error("[RecommendationCard] Failed to start chapter:", err);
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col gap-4">
        <div className="h-16 bg-[var(--base-100)] rounded-2xl animate-pulse" />
        <div className="h-20 bg-[var(--base-100)] rounded-2xl animate-pulse" />
        <div className="h-11 bg-[var(--base-100)] rounded-xl animate-pulse" />
      </div>
    );
  }

  const ctaLabel = starting
    ? "Starting..."
    : selectedChapter?.status === "in_progress"
    ? `Continue Chapter ${selectedChapter.chapter_index}`
    : selectedChapter?.status === "completed"
    ? `Revisit Chapter ${selectedChapter?.chapter_index}`
    : selectedChapter
    ? `Start Chapter ${selectedChapter.chapter_index}`
    : "Pick a chapter";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="w-full flex flex-col gap-4"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      {/* Recommendation message */}
      <p
        className="text-[15px] leading-[1.65] text-center"
        style={{ color: "var(--base-500)", fontWeight: 400 }}
      >
        {recommendationMessage}
      </p>

      {/* Recommended chapter card */}
      {selectedChapter && (
        <div
          className="rounded-2xl border p-5"
          style={{
            backgroundColor: "#ffffff",
            borderColor: "#E2E8F0",
          }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--primary-400)", letterSpacing: "0.1em" }}
          >
            {selectedChapter.status === "in_progress"
              ? "Continue"
              : selectedChapter.status === "completed"
              ? "Revisit"
              : "Next up"}
          </p>
          <p
            className="text-[18px] font-semibold leading-snug"
            style={{ color: "var(--base-800)" }}
          >
            Chapter {selectedChapter.chapter_index}: {selectedChapter.chapter_name}
          </p>
          {selectedChapter.status === "in_progress" && selectedChapter.current_topic_index && (
            <p className="text-[13px] mt-1.5" style={{ color: "var(--base-400)" }}>
              Left off at Topic {selectedChapter.current_topic_index}
            </p>
          )}
        </div>
      )}

      {/* Primary CTA */}
      <button
        type="button"
        onClick={handleStartChapter}
        disabled={!selectedChapter || starting}
        className="w-full h-11 rounded-xl text-white text-[15px] font-medium transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
        style={{ backgroundColor: "var(--primary-400)" }}
      >
        {ctaLabel}
      </button>

      {/* Toggle chapter list */}
      <button
        type="button"
        onClick={() => setShowChapterList((v) => !v)}
        className="w-full h-9 rounded-xl text-[13px] transition-colors duration-100 hover:bg-[var(--base-100)] cursor-pointer flex items-center justify-center gap-1.5"
        style={{ color: "var(--base-400)" }}
      >
        {showChapterList ? "Hide chapters" : "Choose a different chapter"}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: showChapterList ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Expandable chapter list */}
      <AnimatePresence>
        {showChapterList && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl border p-4"
              style={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0" }}
            >
              <p
                className="text-[12px] font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--base-400)", letterSpacing: "0.08em" }}
              >
                All Chapters
              </p>
              <ChapterStatusList
                chapters={chapters}
                selectedIndex={selectedChapter?.chapter_index ?? null}
                onSelect={(chapter) => {
                  setSelectedChapter(chapter);
                  setShowChapterList(false);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
