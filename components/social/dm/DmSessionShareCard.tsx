"use client";

import Link from "next/link";
import type { SessionShareMetadata } from "@/lib/social/share-types";

export function DmSessionShareCard({
    meta,
    isOwn,
}: {
    meta: SessionShareMetadata;
    isOwn: boolean;
}) {
    const token = meta.share_token?.trim();
    const href = token ? `/chat/s/${encodeURIComponent(token)}` : null;
    const modeLabel = meta.mode === "learn" ? "Learn" : "Ask";

    const inner = (
        <div
            className={`w-[min(100%,260px)] rounded-xl overflow-hidden border ${
                isOwn
                    ? "border-white/20 bg-[var(--primary-600)]"
                    : "border-[var(--base-200)] bg-[var(--primary-10)]"
            }`}
            style={{ fontFamily: "var(--font-inter)" }}
        >
            <div className="flex flex-col gap-1.5 p-3">
                <div className="flex items-center gap-1.5">
                    <span
                        className={`text-[10px] font-bold uppercase tracking-widest ${
                            isOwn ? "text-white/70" : "text-[var(--primary-400)]"
                        }`}
                    >
                        AI Tutor
                    </span>
                    <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            isOwn
                                ? "bg-white/15 text-white"
                                : "bg-[var(--primary-100)] text-[var(--primary-600)]"
                        }`}
                    >
                        {modeLabel}
                    </span>
                </div>
                <p
                    className={`text-[14px] font-bold leading-snug line-clamp-2 ${
                        isOwn ? "text-white" : "text-[var(--base-800)]"
                    }`}
                >
                    {meta.title?.trim() || meta.subject}
                </p>
                {meta.chapter_name && (
                    <p
                        className={`text-[12px] line-clamp-1 ${
                            isOwn ? "text-white/75" : "text-[var(--base-500)]"
                        }`}
                    >
                        {meta.chapter_name}
                    </p>
                )}
                <span
                    className={`mt-1 inline-flex items-center gap-1 text-[12px] font-semibold ${
                        isOwn ? "text-white/80" : "text-[var(--primary-500)]"
                    }`}
                >
                    {href ? "View shared chat" : "Shared chat (link unavailable)"}
                    {href && (
                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                    )}
                </span>
            </div>
        </div>
    );

    if (href) {
        return (
            <Link
                href={href}
                className="block w-fit max-w-full transition-opacity duration-150 hover:opacity-90 active:opacity-75"
            >
                {inner}
            </Link>
        );
    }

    return <div className="opacity-80">{inner}</div>;
}
