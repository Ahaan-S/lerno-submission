"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { FriendRow } from "@/components/social/FriendCard";

/* ─── Inner component — mounts/unmounts with the modal ──────────────────────
   Splitting here means state (q, activeIndex) auto-resets each time the
   switcher opens, avoiding the react-hooks/set-state-in-effect warning. */
function QuickSwitcherInner({
    onClose,
    friends,
    onPickPeer,
}: {
    onClose: () => void;
    friends: FriendRow[];
    onPickPeer?: (peerUserId: string) => void;
}) {
    const [q, setQ] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = q.trim()
        ? friends.filter(
              (f) =>
                  f.displayName.toLowerCase().includes(q.toLowerCase()) ||
                  (f.fullName?.toLowerCase().includes(q.toLowerCase()) ?? false)
          )
        : friends;

    /* Focus input on mount */
    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 60);
        return () => clearTimeout(t);
    }, []);

    /* Keyboard navigation */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
                const f = filtered[activeIndex];
                if (f) {
                    onPickPeer?.(f.userId);
                    onClose();
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose, onPickPeer, filtered, activeIndex]);

    return (
        <motion.div
            className="absolute inset-0 flex items-start justify-center"
            style={{ paddingTop: "13vh" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            role="presentation"
        >
            <motion.div
                className="w-full mx-4 rounded-2xl overflow-hidden"
                style={{
                    maxWidth: 480,
                    backgroundColor: "#ffffff",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
                    fontFamily: "var(--font-inter)",
                }}
                initial={{ scale: 0.96, y: -10, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, y: -10, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal
                aria-label="Find or start a conversation"
            >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--base-200)]">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4 shrink-0 text-[var(--base-400)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                        />
                    </svg>
                    <input
                        ref={inputRef}
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setActiveIndex(0); }}
                        placeholder="Find or start a conversation"
                        className="flex-1 text-[15px] text-[var(--base-800)] placeholder:text-[var(--base-400)] bg-transparent outline-none"
                    />
                    {q && (
                        <button
                            type="button"
                            onClick={() => { setQ(""); setActiveIndex(0); }}
                            className="p-0.5 rounded text-[var(--base-400)] hover:text-[var(--base-600)] cursor-pointer transition-colors"
                            aria-label="Clear"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Results */}
                <div className="max-h-[320px] overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="py-10 px-4 text-center">
                            <p className="text-[14px] text-[var(--base-400)]">
                                {q ? "No friends match that search." : "No friends yet."}
                            </p>
                        </div>
                    ) : (
                        <>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--base-400)] px-4 pt-3 pb-1.5">
                                {q ? "Results" : "Friends"}
                            </p>
                            {filtered.map((f, i) => (
                                <button
                                    key={f.friendshipId}
                                    type="button"
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors ${
                                        i === activeIndex
                                            ? "bg-[var(--base-100)]"
                                            : "hover:bg-[var(--base-100)]"
                                    }`}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    onClick={() => {
                                        onPickPeer?.(f.userId);
                                        onClose();
                                    }}
                                >
                                    <div className="relative shrink-0">
                                        <div className="size-9 overflow-hidden rounded-full border border-[var(--base-200)] bg-[var(--base-100)]">
                                            <ProfileAvatar
                                                avatarUrl={f.avatarUrl}
                                                displayName={f.displayName}
                                                fullName={f.fullName}
                                                size={36}
                                                className="!border-0 rounded-none"
                                            />
                                        </div>
                                        <div
                                            className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white"
                                            style={{ backgroundColor: "var(--base-300)" }}
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[14px] font-semibold text-[var(--base-800)] truncate leading-tight">
                                            {f.displayName}
                                        </p>
                                        <p className="text-[12px] text-[var(--base-400)] leading-tight">
                                            {f.grade != null ? `Grade ${String(f.grade)}` : "Offline"}
                                        </p>
                                    </div>
                                    {i === activeIndex && (
                                        <div
                                            className="shrink-0 size-5 rounded flex items-center justify-center border border-[var(--base-200)]"
                                            style={{ backgroundColor: "#fff" }}
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="w-3 h-3 text-[var(--base-500)]"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M19 9l-7 7-7-7"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </>
                    )}
                </div>

                {/* Footer hints */}
                <div
                    className="px-4 py-2.5 border-t border-[var(--base-200)] flex items-center gap-4 flex-wrap"
                    style={{ backgroundColor: "var(--base-100)" }}
                >
                    {[
                        { key: "↑↓", label: "Navigate" },
                        { key: "↵", label: "Select" },
                        { key: "Esc", label: "Dismiss" },
                    ].map(({ key, label }) => (
                        <span
                            key={label}
                            className="text-[11px] text-[var(--base-400)] flex items-center gap-1.5"
                        >
                            <kbd
                                className="px-1.5 py-0.5 rounded text-[10px]"
                                style={{
                                    backgroundColor: "#fff",
                                    border: "1px solid var(--base-300)",
                                    fontFamily: "monospace",
                                }}
                            >
                                {key}
                            </kbd>
                            {label}
                        </span>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ─── Public component ───────────────────────────────────────────────────── */
export function ConversationQuickSwitcher({
    open,
    onClose,
    friends,
    onPickPeer,
}: {
    open: boolean;
    onClose: () => void;
    friends: FriendRow[];
    onPickPeer?: (peerUserId: string) => void;
}) {
    return (
        <AnimatePresence>
            {open && (
                <div
                    className="fixed inset-0 z-[200]"
                    style={{ backdropFilter: "blur(2px)", backgroundColor: "rgba(0,0,0,0.35)" }}
                >
                    <QuickSwitcherInner onClose={onClose} friends={friends} onPickPeer={onPickPeer} />
                </div>
            )}
        </AnimatePresence>
    );
}
