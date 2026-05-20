"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileHoverCard } from "@/components/profile/ProfileHoverCard";

type MutualFriend = {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    grade: string | number | null;
};

type Props = {
    targetUserId: string;
    /** Pre-known count (from browse API) — used for the chip label before modal opens */
    count: number;
};

export function MutualFriendsChip({ targetUserId, count }: Props) {
    const [open, setOpen] = useState(false);
    const [mutual, setMutual] = useState<MutualFriend[] | null>(null);
    const [loading, setLoading] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    const fetch_ = useCallback(async () => {
        if (mutual !== null) return; // already loaded
        setLoading(true);
        try {
            const res = await fetch(`/api/users/mutual?targetId=${encodeURIComponent(targetUserId)}`, {
                credentials: "include",
            });
            const data = (await res.json()) as { mutual?: MutualFriend[] };
            setMutual(data.mutual ?? []);
        } catch {
            setMutual([]);
        } finally {
            setLoading(false);
        }
    }, [targetUserId, mutual]);

    const handleOpen = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen(true);
            void fetch_();
        },
        [fetch_]
    );

    const handleClose = useCallback(() => setOpen(false), []);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    if (count <= 0) return null;

    // Label: first loaded name + "and N others", or just "N mutual"
    const label = (() => {
        if (!mutual || mutual.length === 0) return `${count} mutual`;
        const first = mutual[0].displayName;
        const rest = count - 1;
        if (rest <= 0) return first;
        return `${first} and ${rest} other${rest > 1 ? "s" : ""}`;
    })();

    return (
        <>
            <button
                type="button"
                onClick={handleOpen}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--base-500)] hover:text-[var(--primary-600)] transition-colors cursor-pointer group/chip"
                style={{ fontFamily: "var(--font-inter)" }}
                aria-label={`${count} mutual friends`}
            >
                {/* Stacked tiny avatars from loaded data */}
                {mutual && mutual.length > 0 && (
                    <span className="inline-flex items-center -space-x-1.5 mr-0.5">
                        {mutual.slice(0, 3).map((m) => (
                            <span
                                key={m.id}
                                className="inline-block size-4 rounded-full border border-white overflow-hidden bg-[var(--base-100)] shrink-0"
                            >
                                <ProfileAvatar
                                    avatarUrl={m.avatarUrl}
                                    displayName={m.displayName}
                                    fullName={null}
                                    size={16}
                                    className="!border-0"
                                />
                            </span>
                        ))}
                    </span>
                )}
                {!mutual && (
                    <svg
                        className="w-3 h-3 shrink-0 text-[var(--base-400)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.48-3.897M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                        />
                    </svg>
                )}
                <span className="group-hover/chip:underline underline-offset-2">{label}</span>
            </button>

            {/* ── Modal overlay ──────────────────────────────────────────── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={overlayRef}
                        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={handleClose}
                        role="presentation"
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

                        {/* Sheet */}
                        <motion.div
                            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
                            initial={{ opacity: 0, y: 24, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.97 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal
                            aria-label="Mutual friends"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                                <div>
                                    <p className="text-[15px] font-bold text-[var(--base-800)]" style={{ fontFamily: "var(--font-inter)" }}>
                                        Mutual Friends
                                    </p>
                                    <p className="text-[12px] text-[var(--base-400)] mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>
                                        {count} friend{count !== 1 ? "s" : ""} in common
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="size-8 rounded-full flex items-center justify-center text-[var(--base-400)] hover:bg-[var(--base-100)] hover:text-[var(--base-700)] transition-colors cursor-pointer"
                                    aria-label="Close"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Body */}
                            <div
                                className="overflow-y-auto px-3 pb-4"
                                style={{ maxHeight: "min(60vh, 420px)" }}
                            >
                                {loading ? (
                                    <div className="flex flex-col gap-2 py-2">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="flex items-center gap-3 px-2 py-2.5 rounded-xl">
                                                <div className="size-9 rounded-full skeleton shrink-0" />
                                                <div className="flex-1 flex flex-col gap-1.5">
                                                    <div className="skeleton h-3 w-28 rounded" />
                                                    <div className="skeleton h-2.5 w-16 rounded" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : !mutual || mutual.length === 0 ? (
                                    <p
                                        className="text-[13px] text-[var(--base-400)] text-center py-8"
                                        style={{ fontFamily: "var(--font-inter)" }}
                                    >
                                        No mutual friends to show.
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-0.5 py-1">
                                        {mutual.map((m) => (
                                            <ProfileHoverCard
                                                key={m.id}
                                                userId={m.id}
                                                displayName={m.displayName}
                                            >
                                                <Link
                                                    href={`/portal/profile/${m.id}`}
                                                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[var(--base-100)] transition-colors"
                                                    style={{ fontFamily: "var(--font-inter)" }}
                                                    onClick={handleClose}
                                                >
                                                    <div className="size-9 shrink-0 overflow-hidden rounded-full border border-[var(--base-200)] bg-[var(--base-100)]">
                                                        <ProfileAvatar
                                                            avatarUrl={m.avatarUrl}
                                                            displayName={m.displayName}
                                                            fullName={null}
                                                            size={36}
                                                            className="!border-0"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[13.5px] font-semibold text-[var(--base-800)] truncate leading-tight">
                                                            {m.displayName}
                                                        </p>
                                                        {m.grade != null && (
                                                            <p className="text-[11.5px] text-[var(--base-400)] leading-tight">
                                                                Grade {String(m.grade)}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <svg
                                                        className="w-3.5 h-3.5 text-[var(--base-300)] shrink-0"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={2}
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                                    </svg>
                                                </Link>
                                            </ProfileHoverCard>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
