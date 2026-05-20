"use client";

import React from "react";
import { motion } from "framer-motion";
import type { BacklogItem as BacklogItemType } from "@/lib/planner/types";
import { getSubjectColor } from "@/lib/planner/subject-colors";
import { SUBJECT_LABELS } from "@/lib/chapters";

interface Props {
  item: BacklogItemType;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  isCompleting?: boolean;
  isCompleted?: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

export default function BacklogItem({ item, onComplete, onDelete, isCompleting = false, isCompleted = false }: Props) {
  const colors = getSubjectColor(item.subject || null);
  const subjectLabel = item.subject ? (SUBJECT_LABELS[item.subject] ?? item.subject) : null;
  const dotColor = PRIORITY_DOT[item.priority] ?? "#94A3B8";
  const checked = isCompleting || isCompleted;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{
        opacity: isCompleting ? 0 : 1,
        x: isCompleting ? 12 : 0,
        scale: isCompleting ? 0.98 : 1,
      }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-2 py-2 border-b border-[var(--base-200)] last:border-0 group overflow-hidden"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <button
        type="button"
        className="w-5 h-5 rounded-full shrink-0 border-2 transition-colors cursor-pointer hover:opacity-80 flex items-center justify-center"
        style={{
          borderColor: isCompleting ? "var(--primary-400)" : dotColor,
          backgroundColor: checked ? "var(--primary-400)" : "transparent",
        }}
        onClick={() => onComplete(item.id)}
        disabled={checked}
        title="Mark complete"
      >
        <motion.svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <motion.path
            d="m5 12.5 4.2 4.2L19 7"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          />
        </motion.svg>
      </button>
      <div className="flex-1 min-w-0">
        <p
          className="text-[12px] text-[var(--base-700)] truncate transition-colors"
          style={{ textDecoration: checked ? "line-through" : "none", color: checked ? "var(--base-400)" : undefined }}
        >
          {item.title}
        </p>
        {subjectLabel && <span className="text-[10px]" style={{ color: colors.text }}>{subjectLabel}</span>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-50 text-red-400 cursor-pointer"
          onClick={() => onDelete(item.id)}
          title="Remove"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </motion.div>
  );
}
