"use client";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { DmInboxThread } from "@/components/social/dm/dm-types";
import { isPeerOnline } from "@/lib/social/dm-presence";

function formatListTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 86_400_000 && diffMs >= 0) {
        return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function DmThreadList({
    threads,
    selectedThreadId,
    onSelect,
    loading,
}: {
    threads: DmInboxThread[];
    selectedThreadId: string | null;
    onSelect: (t: DmInboxThread) => void;
    loading: boolean;
}) {
    if (loading && threads.length === 0) {
        return (
            <div className="flex flex-col gap-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-lg">
                        <div className="size-10 rounded-full skeleton shrink-0" />
                        <div className="flex-1 flex flex-col gap-1.5">
                            <div className="skeleton h-3.5 w-28 rounded" />
                            <div className="skeleton h-2.5 w-40 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (threads.length === 0) {
        return (
            <div className="px-4 py-10 text-center" style={{ fontFamily: "var(--font-inter)" }}>
                <p className="text-[14px] font-semibold text-[var(--base-600)]">No messages yet</p>
                <p className="text-[13px] text-[var(--base-400)] mt-1">
                    When you share a question or chat—or send a message—it will show up here.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-0 overflow-y-auto py-1">
            {threads.map((t) => {
                const active = t.threadId === selectedThreadId;
                const peerActive = isPeerOnline(t.peerLastSeenAt);
                return (
                    <button
                        key={t.threadId}
                        type="button"
                        onClick={() => onSelect(t)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200 cursor-pointer border-l-[3px] ${
                            active
                                ? "bg-[var(--primary-10)] border-l-[var(--primary-400)] shadow-[inset_0_0_0_1px_rgba(79,176,255,0.12)]"
                                : "border-l-transparent hover:bg-white/70"
                        }`}
                        style={{ fontFamily: "var(--font-inter)" }}
                    >
                        <div className="relative shrink-0">
                            <div className="size-10 overflow-hidden rounded-full border border-[var(--base-200)] bg-[var(--base-100)]">
                                <ProfileAvatar
                                    avatarUrl={t.avatarUrl}
                                    displayName={t.displayName}
                                    fullName={t.fullName}
                                    size={40}
                                    className="!border-0 rounded-none"
                                />
                            </div>
                            {t.unreadCount > 0 && (
                                <span
                                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center tabular-nums"
                                    style={{ backgroundColor: "var(--primary-400)" }}
                                >
                                    {t.unreadCount > 99 ? "99+" : t.unreadCount}
                                </span>
                            )}
                            {peerActive && (
                                <span
                                    className="absolute bottom-0 right-0 size-2.5 rounded-full bg-[var(--green-200)] border-2 border-white shadow-sm"
                                    title="Active now"
                                    aria-label="Active now"
                                />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="text-[14px] font-semibold text-[var(--base-800)] truncate">{t.displayName}</p>
                                <span className="text-[11px] text-[var(--base-400)] shrink-0 tabular-nums">
                                    {formatListTime(t.lastMessageAt)}
                                </span>
                            </div>
                            <p className="text-[12px] text-[var(--base-500)] truncate mt-0.5">{t.preview}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
