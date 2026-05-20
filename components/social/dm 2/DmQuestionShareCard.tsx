"use client";

import Link from "next/link";
import type { QuestionShareMetadata } from "@/lib/social/share-types";
import {
    DM_SHARE_GRADIENT_DEEP,
    DM_SHARE_GRADIENT_MID,
    dmShareCardAccentHex,
} from "@/lib/social/dm-card-colors";

export function DmQuestionShareCard({
    meta,
    isOwn,
}: {
    meta: QuestionShareMetadata;
    isOwn: boolean;
}) {
    const accent = dmShareCardAccentHex(meta.subject);
    /** Public path — on `app.*` middleware prepends `/portal`, so `/portal/study` would double-prefix and 404. */
    const href = `/study?question=${encodeURIComponent(meta.question_id)}`;
    const showImg = Boolean(meta.has_image && meta.question_image_url);

    return (
        <Link
            href={href}
            className={`block w-[min(100%,280px)] min-w-[200px] max-w-[min(100%,280px)] rounded-2xl overflow-hidden border text-left transition-[transform,box-shadow] duration-200 motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.99] ${
                isOwn ? "border-white/30 ring-1 ring-white/20" : "border-[var(--primary-200)]/50 ring-1 ring-[var(--primary-10)]/90"
            }`}
            style={{
                boxShadow: isOwn
                    ? "0 10px 28px rgba(0, 119, 237, 0.22), 0 4px 12px rgba(15, 23, 42, 0.12)"
                    : "0 6px 20px rgba(15, 23, 42, 0.08)",
                fontFamily: "var(--font-inter)",
                backgroundColor: DM_SHARE_GRADIENT_DEEP,
            }}
        >
            <div
                className="relative min-h-[168px] w-full flex flex-col"
                style={{
                    background: `linear-gradient(165deg, ${accent} 0%, ${DM_SHARE_GRADIENT_MID} 45%, ${DM_SHARE_GRADIENT_DEEP} 100%)`,
                }}
            >
                {showImg && (
                    <div className="pointer-events-none absolute inset-0 opacity-35">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={meta.question_image_url!}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                    </div>
                )}
                <div className="relative z-[1] flex flex-col gap-2 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/90">
                        Study question
                    </span>
                    <p className="text-[13px] font-semibold text-white drop-shadow-sm line-clamp-2">
                        {meta.subject} · Ch. {meta.chapter_index}
                    </p>
                    <p className="text-[12px] text-white/95 drop-shadow-sm line-clamp-5 leading-snug">
                        {meta.preview || "Tap to open in Study Feed."}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[12px] font-semibold text-white backdrop-blur-[2px] drop-shadow-sm ring-1 ring-white/20">
                        Open in Study Feed
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                    </span>
                </div>
            </div>
        </Link>
    );
}
