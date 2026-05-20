"use client";

import Link from "next/link";
import type { SessionShareMetadata } from "@/lib/social/share-types";

function formatSubjectLabel(s: string): string {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

/** Rich card for a shared AI tutor session (e.g. in DM thread later). */
export function SharedSessionCard({ metadata }: { metadata: SessionShareMetadata }) {
    const title = metadata.title?.trim() || formatSubjectLabel(metadata.subject);
    const isLearn = metadata.mode === "learn";
    const href =
        metadata.share_token?.trim()
            ? `/chat/s/${encodeURIComponent(metadata.share_token.trim())}`
            : isLearn
              ? `/learn/${encodeURIComponent(metadata.subject)}/session/${metadata.session_id}`
              : `/chat/${metadata.session_id}`;

    return (
        <div
            className="rounded-xl border border-[var(--base-200)] bg-[#fafafa] p-4 max-w-md"
            style={{ fontFamily: "var(--font-inter)" }}
        >
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--primary-100)] text-[var(--primary-400)]">
                    {formatSubjectLabel(metadata.subject)}
                </span>
                <span className="text-[11px] text-[var(--base-500)]">{isLearn ? "Learn" : "Ask"}</span>
                {metadata.grade != null && (
                    <span className="text-[11px] text-[var(--base-500)]">Class {metadata.grade}</span>
                )}
            </div>
            <p className="text-[14px] font-semibold text-[var(--base-800)] mb-1 line-clamp-2">{title}</p>
            {metadata.chapter_name && (
                <p className="text-[12px] text-[var(--base-600)] mb-3">{metadata.chapter_name}</p>
            )}
            <Link
                href={href}
                className="inline-flex px-4 py-2 rounded-xl text-[13px] font-medium bg-[var(--primary-400)] text-white hover:opacity-90 transition-opacity"
            >
                Open session
            </Link>
        </div>
    );
}
