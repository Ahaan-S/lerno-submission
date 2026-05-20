"use client";

import Link from "next/link";
import type { QuestionShareMetadata } from "@/lib/social/share-types";

export function DmQuestionShareCard({
    meta,
    isOwn,
}: {
    meta: QuestionShareMetadata;
    isOwn: boolean;
}) {
    const href = `/study?question=${encodeURIComponent(meta.question_id)}`;

    return (
        <Link
            href={href}
            className={`block w-[min(100%,260px)] rounded-xl overflow-hidden border text-left transition-opacity duration-150 hover:opacity-90 active:opacity-75 ${
                isOwn
                    ? "border-white/20 bg-[var(--primary-600)]"
                    : "border-[var(--base-200)] bg-[var(--primary-10)]"
            }`}
            style={{ fontFamily: "var(--font-inter)" }}
        >
            <div className="flex flex-col gap-1.5 p-3">
                <span
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                        isOwn ? "text-white/70" : "text-[var(--primary-400)]"
                    }`}
                >
                    Study question
                </span>
                <p
                    className={`text-[12px] font-semibold leading-tight ${
                        isOwn ? "text-white/80" : "text-[var(--base-500)]"
                    }`}
                >
                    {meta.subject} · Ch. {meta.chapter_index}
                </p>
                <p
                    className={`text-[13px] leading-snug line-clamp-3 ${
                        isOwn ? "text-white" : "text-[var(--base-800)]"
                    }`}
                >
                    {meta.preview || "Tap to open in Study Feed."}
                </p>
                <span
                    className={`mt-1 inline-flex items-center gap-1 text-[12px] font-semibold ${
                        isOwn ? "text-white/80" : "text-[var(--primary-500)]"
                    }`}
                >
                    Open in Study Feed
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                </span>
            </div>
        </Link>
    );
}
