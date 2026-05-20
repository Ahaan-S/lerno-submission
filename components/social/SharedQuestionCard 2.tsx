"use client";

import { useRouter } from "next/navigation";
import type { QuestionShareMetadata } from "@/lib/social/share-types";

function formatSubjectLabel(s: string): string {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

/** Rich card for a shared study-feed question (e.g. in DM thread later). */
export function SharedQuestionCard({ metadata }: { metadata: QuestionShareMetadata }) {
    const router = useRouter();

    const openInStudyFeed = () => {
        try {
            sessionStorage.setItem(
                "studyFeedPrefillFilter",
                JSON.stringify({
                    subject: metadata.subject,
                    chapter_index: metadata.chapter_index,
                })
            );
        } catch {
            /* ignore */
        }
        router.push(`/study?question=${encodeURIComponent(metadata.question_id)}`);
    };

    return (
        <div
            className="rounded-xl border border-[var(--base-200)] bg-[#fafafa] p-4 max-w-md"
            style={{ fontFamily: "var(--font-inter)" }}
        >
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--primary-100)] text-[var(--primary-400)]">
                    {formatSubjectLabel(metadata.subject)}
                </span>
                <span className="text-[11px] text-[var(--base-500)]">{metadata.question_type}</span>
            </div>
            <p className="text-[13px] font-medium text-[var(--base-800)] mb-1 truncate" title={metadata.chapter_name}>
                {metadata.chapter_name}
            </p>
            <p className="text-[13px] text-[var(--base-600)] line-clamp-3 mb-3">{metadata.preview}</p>
            <button
                type="button"
                onClick={openInStudyFeed}
                className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[var(--primary-400)] text-white hover:opacity-90 cursor-pointer transition-opacity"
            >
                Practice in Study Feed
            </button>
        </div>
    );
}
