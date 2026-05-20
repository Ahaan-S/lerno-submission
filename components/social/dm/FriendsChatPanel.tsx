"use client";

import { useCallback, useEffect, useState } from "react";
import type { DmInboxThread } from "@/components/social/dm/dm-types";
import { DmThreadList } from "@/components/social/dm/DmThreadList";
import { DmThreadPanel } from "@/components/social/dm/DmThreadPanel";

export function FriendsChatPanel({
    currentUserId,
    focusPeerUserId,
    onFocusPeerConsumed,
    initialThreadId,
    onInitialThreadConsumed,
}: {
    currentUserId: string | null;
    focusPeerUserId: string | null;
    onFocusPeerConsumed: () => void;
    initialThreadId: string | null;
    onInitialThreadConsumed: () => void;
}) {
    const [threads, setThreads] = useState<DmInboxThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [mobileShowList, setMobileShowList] = useState(true);

    const loadInbox = useCallback(async () => {
        try {
            const res = await fetch("/api/friends/messages", { credentials: "include" });
            if (!res.ok) return;
            const json = (await res.json()) as { threads?: DmInboxThread[] };
            setThreads(json.threads ?? []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadInbox();
    }, [loadInbox]);

    useEffect(() => {
        if (!focusPeerUserId) return;
        let cancelled = false;
        void (async () => {
            const res = await fetch("/api/friends/messages/open", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ peerUserId: focusPeerUserId }),
            });
            if (cancelled) return;
            if (!res.ok) {
                onFocusPeerConsumed();
                return;
            }
            const json = (await res.json()) as { threadId?: string };
            if (cancelled) return;
            if (json.threadId) {
                setSelectedThreadId(json.threadId);
                setMobileShowList(false);
                await loadInbox();
            }
            if (!cancelled) onFocusPeerConsumed();
        })();
        return () => {
            cancelled = true;
        };
    }, [focusPeerUserId, loadInbox, onFocusPeerConsumed]);

    useEffect(() => {
        if (!initialThreadId) return;
        setSelectedThreadId(initialThreadId);
        setMobileShowList(false);
        onInitialThreadConsumed();
    }, [initialThreadId, onInitialThreadConsumed]);

    const [hydratedThread, setHydratedThread] = useState<DmInboxThread | null>(null);

    useEffect(() => {
        if (!selectedThreadId) {
            setHydratedThread(null);
            return;
        }
        if (threads.some((t) => t.threadId === selectedThreadId)) {
            setHydratedThread(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            const res = await fetch(`/api/friends/messages/${selectedThreadId}?limit=1`, {
                credentials: "include",
            });
            if (cancelled || !res.ok) return;
            const json = (await res.json()) as {
                peer?: {
                    userId: string;
                    displayName: string;
                    fullName: string | null;
                    grade: string | number | null;
                    avatarUrl: string | null;
                    dmLastSeenAt?: string | null;
                };
            };
            if (!json.peer) return;
            setHydratedThread({
                threadId: selectedThreadId,
                peerUserId: json.peer.userId,
                displayName: json.peer.displayName,
                fullName: json.peer.fullName,
                grade: json.peer.grade,
                avatarUrl: json.peer.avatarUrl,
                lastMessageAt: new Date().toISOString(),
                preview: "",
                unreadCount: 0,
                peerLastSeenAt: json.peer.dmLastSeenAt ?? null,
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedThreadId, threads]);

    const selected =
        threads.find((t) => t.threadId === selectedThreadId) ?? hydratedThread ?? null;

    const onSelect = useCallback((t: DmInboxThread) => {
        setSelectedThreadId(t.threadId);
        setMobileShowList(false);
    }, []);

    /** Must be referentially stable — DmThreadPanel’s effects depend on this via markRead. */
    const invalidateInbox = useCallback(() => {
        void loadInbox();
    }, [loadInbox]);

    return (
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
            <aside
                className={`friends-dm-messages-rail flex flex-col w-full lg:w-[min(100%,320px)] shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--base-200)] min-h-0 ${
                    mobileShowList ? "flex" : "hidden lg:flex"
                }`}
            >
                <div className="shrink-0 px-3 py-2.5 border-b border-[var(--base-200)]/90 bg-white/40 backdrop-blur-[6px]">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--primary-500)]">
                        Messages
                    </p>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                    <DmThreadList
                        threads={threads}
                        selectedThreadId={selectedThreadId}
                        onSelect={onSelect}
                        loading={loading}
                    />
                </div>
            </aside>

            <section
                className={`friends-dm-thread-surface flex flex-1 min-w-0 min-h-0 flex-col ${
                    !mobileShowList ? "flex" : "hidden lg:flex"
                }`}
            >
                <DmThreadPanel
                    thread={selected}
                    currentUserId={currentUserId}
                    showMobileBack={!mobileShowList}
                    onBackMobile={() => {
                        setMobileShowList(true);
                    }}
                    onInboxInvalidate={invalidateInbox}
                />
            </section>
        </div>
    );
}
