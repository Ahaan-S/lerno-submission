"use client";

import React from "react";
import type { BacklogItem as BacklogItemType } from "@/lib/planner/types";
import { getSubjectColor } from "@/lib/planner/subject-colors";
import { SUBJECT_LABELS } from "@/lib/chapters";

interface Props {
  item: BacklogItemType;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

export default function BacklogItem({ item, onComplete, onDelete }: Props) {
  const colors = getSubjectColor(item.subject);
  const subjectLabel = SUBJECT_LABELS[item.subject] ?? item.subject;
  const dotColor = PRIORITY_DOT[item.priority] ?? "#94A3B8";

  return (
    <div
      className="flex items-center gap-2 py-2 border-b border-[var(--base-200)] last:border-0 group"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <button
        type="button"
        className="w-3.5 h-3.5 rounded-full shrink-0 border-2 transition-colors cursor-pointer hover:opacity-80 flex items-center justify-center"
        style={{ borderColor: dotColor, backgroundColor: "transparent" }}
        onClick={() => onComplete(item.id)}
        title="Mark complete"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-[var(--base-700)] truncate">{item.title}</p>
        <span className="text-[10px]" style={{ color: colors.text }}>{subjectLabel}</span>
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
    </div>
  );
}
