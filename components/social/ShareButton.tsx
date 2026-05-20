"use client";

import { useState } from "react";
import { FriendPickerModal } from "@/components/social/FriendPickerModal";

/** Instagram-style paper-plane share icon (outline). */
export function IconInstagramShare({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <line x1="22" x2="11" y1="2" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    );
}

export function ShareButton({
    resourceType,
    resourceId,
    variant = "default",
}: {
    resourceType: "question" | "session";
    resourceId: string;
    variant?: "default" | "icon";
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {variant === "icon" ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex items-center justify-center size-8 rounded-lg border border-[var(--base-200)] text-[var(--base-600)] hover:bg-[var(--base-100)] transition-colors cursor-pointer shrink-0"
                    aria-label="Share"
                    title="Share"
                >
                    <IconInstagramShare className="w-[18px] h-[18px]" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--base-700)] border border-[var(--base-200)] hover:bg-[var(--base-100)] cursor-pointer transition-colors"
                    style={{ fontFamily: "var(--font-inter)" }}
                >
                    <IconInstagramShare className="w-4 h-4 shrink-0" />
                    Share
                </button>
            )}
            <FriendPickerModal
                open={open}
                onClose={() => setOpen(false)}
                shareKind={resourceType}
                resourceId={resourceId}
            />
        </>
    );
}
