"use client";

import Link from "next/link";
import type { SessionShareMetadata } from "@/lib/social/share-types";
import {
    DM_SHARE_GRADIENT_DEEP,
    DM_SHARE_GRADIENT_MID,
    dmShareCardAccentHex,
} from "@/lib/social/dm-card-colors";

export function DmSessionShareCard({
    meta,
    isOwn,
}: {
    meta: SessionShareMetadata;
    isOwn: boolean;
}) {
    const accent = dmShareCardAccentHex(meta.subject);
    const token = meta.share_token?.trim();
    /** Public path — avoid `/portal/...` in links on `app.*` (middleware already maps `/chat` → `/portal/chat`). */
    const href = token ? `/chat/s/${encodeURIComponent(token)}` : null;
    const modeLabel = meta.mode === "learn" ? "Learn" : "Ask";

    const inner = (
        <div
            className={`relative w-[min(100%,280px)] min-w-[200px] max-w-[min(100%,280px)] rounded-2xl overflow-hidden border ${
                isOwn ? "border-white/25" : "border-[var(--base-200)]"
            }`}
            style={{
                boxShadow: isOwn ? "0 8px 24px rgba(0,0,0,0.12)" : "0 4px 14px rgba(0,0,0,0.06)",
                fontFamily: "var(--font-inter)",
                backgroundColor: DM_SHARE_GRADIENT_DEEP,
            }}
        >
            <div
                className="min-h-[168px] w-full flex flex-col p-4"
                style={{
                    background: `linear-gradient(160deg, ${accent} 0%, ${DM_SHARE_GRADIENT_MID} 55%, ${DM_SHARE_GRADIENT_DEEP} 100%)`,
                }}
            >
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/75">AI tutor</span>
                <span
                    className="mt-2 self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}
                >
                    {modeLabel}
                </span>
                <p className="mt-3 text-[15px] font-bold text-white leading-snug line-clamp-3">
                    {meta.title?.trim() || meta.subject}
                </p>
                {meta.chapter_name && (
                    <p className="mt-1 text-[12px] text-white/75 line-clamp-2">{meta.chapter_name}</p>
                )}
                <div className="flex-1" />
                <span className="text-[12px] font-semibold text-white inline-flex items-center gap-1">
                    {href ? "View shared chat" : "Shared chat (link unavailable)"}
                    {href && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                className="block w-fit max-w-full transition-transform motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.99]"
            >
                {inner}
            </Link>
        );
    }

    return <div className="opacity-90">{inner}</div>;
}
