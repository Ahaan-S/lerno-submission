"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileHoverCard } from "@/components/profile/ProfileHoverCard";

function formatGrade(grade: string | number | null | undefined): string | null {
    if (grade == null) return null;
    const s = String(grade).trim();
    if (!s) return null;
    if (/^class\s/i.test(s)) return s;
    return `Class ${s}`;
}

export type FriendRow = {
    friendshipId: string;
    userId: string;
    displayName: string;
    fullName: string | null;
    grade: string | number | null;
    avatarUrl: string | null;
    friendsSince: string;
};

function MoreMenu({
    onUnfriend,
    onBlock,
    onClose,
}: {
    onUnfriend: () => void;
    onBlock: () => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) onClose();
        };
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", handler);
        document.addEventListener("keydown", keyHandler);
        return () => {
            document.removeEventListener("mousedown", handler);
            document.removeEventListener("keydown", keyHandler);
        };
    }, [onClose]);

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden"
            style={{
                backgroundColor: "#fff",
                boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",
                minWidth: 160,
                fontFamily: "var(--font-inter)",
            }}
            role="menu"
        >
            <button
                type="button"
                role="menuitem"
                onClick={() => { onClose(); onUnfriend(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] text-[var(--base-800)] hover:bg-[var(--base-100)] transition-colors cursor-pointer text-left"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 shrink-0 text-[var(--base-500)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                Unfriend
            </button>
            <div className="mx-3 h-px" style={{ backgroundColor: "var(--base-200)" }} />
            <button
                type="button"
                role="menuitem"
                onClick={() => { onClose(); onBlock(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] text-[var(--red-100)] hover:bg-[var(--red-10)] transition-colors cursor-pointer text-left"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Block
            </button>
        </motion.div>
    );
}

export function FriendCard({
    friend,
    onChanged,
    variant = "card",
    onMessage,
    isSelected,
}: {
    friend: FriendRow;
    onChanged: () => void;
    variant?: "card" | "list";
    /** List variant: entire row click handler */
    onMessage?: (friend: FriendRow) => void;
    /** List variant: highlight this row as the currently open chat */
    isSelected?: boolean;
}) {
    const [confirm, setConfirm] = useState<"unfriend" | "block" | null>(null);
    const [busy, setBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuBtnRef = useRef<HTMLButtonElement>(null);

    const unfriend = useCallback(async () => {
        setBusy(true);
        try {
            const res = await fetch(`/api/friends/${friend.userId}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) {
                setConfirm(null);
                onChanged();
            }
        } finally {
            setBusy(false);
        }
    }, [friend.userId, onChanged]);

    const block = useCallback(async () => {
        setBusy(true);
        try {
            const res = await fetch(`/api/friends/block/${friend.userId}`, {
                method: "POST",
                credentials: "include",
            });
            if (res.ok) {
                setConfirm(null);
                onChanged();
            }
        } finally {
            setBusy(false);
        }
    }, [friend.userId, onChanged]);

    const ConfirmDialog = confirm ? (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
            onClick={() => !busy && setConfirm(null)}
        >
            <div
                className="bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full flex flex-col gap-3"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal
            >
                <p className="text-[15px] font-semibold text-[var(--base-800)]" style={{ fontFamily: "var(--font-inter)" }}>
                    {confirm === "unfriend" ? `Unfriend ${friend.displayName}?` : `Block ${friend.displayName}?`}
                </p>
                <p className="text-[13px] text-[var(--base-600)]" style={{ fontFamily: "var(--font-inter)" }}>
                    {confirm === "unfriend"
                        ? "They won't be notified. You can send a new request later."
                        : "They won't be able to send you friend requests or messages."}
                </p>
                <div className="flex flex-col gap-2 pt-1">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => confirm === "unfriend" ? void unfriend() : void block()}
                        className="w-full py-2.5 rounded-xl text-[14px] font-medium text-white cursor-pointer disabled:opacity-50 transition-opacity hover:opacity-90"
                        style={{ backgroundColor: "var(--red-100)", fontFamily: "var(--font-inter)" }}
                    >
                        {busy ? "Working…" : confirm === "unfriend" ? "Unfriend" : "Block"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setConfirm(null)}
                        className="w-full py-2 text-[13px] text-[var(--base-500)] cursor-pointer"
                        style={{ fontFamily: "var(--font-inter)" }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    if (variant === "list") {
        return (
            <>
                <div
                    role={onMessage ? "button" : undefined}
                    tabIndex={onMessage ? 0 : undefined}
                    onClick={onMessage ? () => onMessage(friend) : undefined}
                    onKeyDown={
                        onMessage
                            ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      onMessage(friend);
                                  }
                              }
                            : undefined
                    }
                    className={`group relative flex items-center gap-3 px-2 py-2 rounded-lg transition-colors duration-150 ease-out ${
                        isSelected
                            ? "bg-[var(--primary-10)]"
                            : onMessage
                              ? "cursor-pointer hover:bg-[var(--base-100)]"
                              : "cursor-default hover:bg-[var(--base-100)]"
                    }`}
                    style={{ fontFamily: "var(--font-inter)" }}
                >
                    {/* Avatar with status dot */}
                    <div className="relative shrink-0">
                        <div className="size-9 overflow-hidden rounded-full border border-[var(--base-200)] bg-[var(--base-100)]">
                            <ProfileAvatar
                                avatarUrl={friend.avatarUrl}
                                displayName={friend.displayName}
                                fullName={friend.fullName}
                                size={36}
                                className="!border-0 rounded-none"
                            />
                        </div>
                        <div
                            className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white"
                            style={{ backgroundColor: "var(--base-300)" }}
                        />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                        <ProfileHoverCard
                            userId={friend.userId}
                            displayName={friend.displayName}
                            friendFullName={friend.fullName}
                            relationship="friends"
                        >
                            <p
                                className="text-[14px] font-semibold text-[var(--base-800)] truncate leading-tight w-fit max-w-full"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {friend.displayName}
                            </p>
                        </ProfileHoverCard>
                        <p className="text-[12px] text-[var(--base-400)] leading-tight">
                            {formatGrade(friend.grade) ?? "Offline"}
                        </p>
                    </div>

                    {/* Three-dot menu (stops row click propagation) */}
                    <div className="relative sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity shrink-0">
                        <button
                            ref={menuBtnRef}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen((o) => !o);
                            }}
                            className="size-9 rounded-full flex items-center justify-center text-[var(--base-500)] hover:bg-white hover:text-[var(--base-800)] cursor-pointer transition-colors"
                            aria-label="More options"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="currentColor"
                                className="w-[18px] h-[18px]"
                                viewBox="0 0 24 24"
                            >
                                <circle cx="5" cy="12" r="1.75" />
                                <circle cx="12" cy="12" r="1.75" />
                                <circle cx="19" cy="12" r="1.75" />
                            </svg>
                        </button>
                        <AnimatePresence>
                            {menuOpen && (
                                <MoreMenu
                                    onUnfriend={() => setConfirm("unfriend")}
                                    onBlock={() => setConfirm("block")}
                                    onClose={() => setMenuOpen(false)}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {ConfirmDialog}
            </>
        );
    }

    /* ── Card variant (used in other places) ────────────────────────────────── */
    return (
        <div
            className="rounded-2xl border border-[var(--base-200)] bg-white p-4 flex items-center gap-3 shadow-sm"
            style={{ fontFamily: "var(--font-inter)" }}
        >
            <div className="size-11 shrink-0 overflow-hidden rounded-full border border-[var(--base-200)] bg-[var(--base-100)]">
                <ProfileAvatar
                    avatarUrl={friend.avatarUrl}
                    displayName={friend.displayName}
                    fullName={friend.fullName}
                    size={44}
                    className="!border-0 rounded-none"
                />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[var(--base-800)] truncate">{friend.displayName}</p>
                {formatGrade(friend.grade) != null && (
                    <p className="text-[12px] text-[var(--base-500)]">{formatGrade(friend.grade)}</p>
                )}
            </div>
            <div className="relative shrink-0">
                <button
                    ref={menuBtnRef}
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--base-600)] border border-[var(--base-200)] hover:bg-[var(--base-100)] cursor-pointer"
                >
                    More
                </button>
                <AnimatePresence>
                    {menuOpen && (
                        <MoreMenu
                            onUnfriend={() => setConfirm("unfriend")}
                            onBlock={() => setConfirm("block")}
                            onClose={() => setMenuOpen(false)}
                        />
                    )}
                </AnimatePresence>
            </div>
            {ConfirmDialog}
        </div>
    );
}
