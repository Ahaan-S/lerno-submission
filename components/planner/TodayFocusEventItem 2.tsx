"use client";

import React from "react";
import { format } from "date-fns";
import type { StudyEvent } from "@/lib/planner/types";
import { getSubjectColor } from "@/lib/planner/subject-colors";
import { SUBJECT_LABELS } from "@/lib/chapters";

interface Props {
  event: StudyEvent;
  onComplete: (id: string) => void;
}

export default function TodayFocusEventItem({ event, onComplete }: Props) {
  const colors = getSubjectColor(event.subject);
  const subjectLabel = SUBJECT_LABELS[event.subject] ?? event.subject;
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const timeLabel = `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;

  return (
    <div
      className="flex items-start gap-2.5 py-2.5 border-b border-[var(--base-200)] last:border-0"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <button
        type="button"
        className="mt-0.5 w-4 h-4 shrink-0 rounded border-2 transition-colors cursor-pointer hover:border-[var(--primary-400)] hover:bg-blue-50 flex items-center justify-center"
        style={{ borderColor: "var(--base-300)" }}
        onClick={() => onComplete(event.id)}
        aria-label={`Mark complete: ${event.title}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--base-700)] truncate">{event.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px]" style={{ color: colors.text }}>{subjectLabel}</span>
          <span className="text-[11px]" style={{ color: "var(--base-400)" }}>·</span>
          <span className="text-[11px]" style={{ color: "var(--base-400)" }}>
            <svg className="w-2.5 h-2.5 inline mr-0.5 mb-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            {timeLabel}
          </span>
        </div>
      </div>
      <span
        className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}
      >
        Scheduled
      </span>
    </div>
  );
}
