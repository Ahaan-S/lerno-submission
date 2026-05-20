"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { FriendCard, type FriendRow } from "@/components/social/FriendCard";
import { FriendRequestCard, type IncomingRequest } from "@/components/social/FriendRequestCard";
import { SendFriendRequestButton } from "@/components/social/SendFriendRequestButton";
import { useFriendRealtime } from "@/components/social/useFriendRealtime";
import { DmThreadPanel } from "@/components/social/dm/DmThreadPanel";
import { BrowseStudentsPanel } from "@/components/social/BrowseStudentsPanel";
import { searchResultRelationship } from "@/components/social/search-result-relationship";
import type { DmInboxThread } from "@/components/social/dm/dm-types";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type OutgoingRequest = {
    id: string;
    message: string | null;
    createdAt: string;
    recipient: {
        id: string;
        fullName: string | null;
        email: string | null;
        grade: string | number | null;
    } | null;
};

type SearchUser = {
    id: string;
    displayName: string;
    fullName: string | null;
    grade: string | number | null;
    avatarUrl: string | null;
    allowFriendRequests: boolean;
};

type LeftTab = "all" | "pending";

type RightPanel =
    | { type: "idle" }
    | { type: "chat"; peer: FriendRow | null; threadId: string | null }
    | { type: "add" }
    | { type: "browse" };

/* ─── Content slide variants ────────────────────────────────────────────────── */
const slideVariants = {
    enter: { opacity: 0, x: 6 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -6 },
};

/* ─── Tab button ─────────────────────────────────────────────────────────────── */
function TabButton({
    children,
    active,
    onClick,
    badge,
}: {
    children: React.ReactNode;
    active: boolean;
    onClick: () => void;
    badge?: number;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13.5px] font-semibold transition-all duration-150 cursor-pointer ${
                active
                    ? "bg-[var(--primary-10)] text-[var(--primary-600)] ring-1 ring-[var(--primary-200)]/70"
                    : "text-[var(--base-500)] hover:bg-[var(--base-100)] hover:text-[var(--base-800)]"
            }`}
            style={{ fontFamily: "var(--font-inter)" }}
        >
            {children}
            {badge != null && badge > 0 && (
                <span
                    className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums"
                    style={{ backgroundColor: "var(--red-100)" }}
                >
                    {badge > 99 ? "99+" : badge}
                </span>
            )}
        </button>
    );
}

/* ─── Add Friend panel ─────────────────────────────────────────────────────── */
function AddFriendPanel({
    onFriendListChanged,
    onBrowse,
    onMobileBack,
    friendUserIds,
    outgoingRecipientIds,
    incomingSenderIds,
}: {
    onFriendListChanged: () => void;
    onBrowse: () => void;
    onMobileBack?: () => void;
    friendUserIds: ReadonlySet<string>;
    outgoingRecipientIds: ReadonlySet<string>;
    incomingSenderIds: ReadonlySet<string>;
}) {
    const [q, setQ] = useState("");
    const [debounced, setDebounced] = useState("");
    const [users, setUsers] = useState<SearchUser[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    const runSearch = useCallback(async () => {
        if (debounced.length < 2) {
            setUsers([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(debounced)}`, {
                credentials: "include",
            });
            const data = (await res.json()) as { users?: SearchUser[] };
            setUsers(data.users ?? []);
        } catch {
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [debounced]);

    useEffect(() => {
        void runSearch();
    }, [runSearch]);

    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="flex flex-col flex-1 min-h-0" style={{ fontFamily: "var(--font-inter)" }}>
            {/* Mobile back row */}
            {onMobileBack && (
                <div className="md:hidden shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-[var(--base-200)]">
                    <button
                        type="button"
                        onClick={onMobileBack}
                        className="size-8 rounded-full flex items-center justify-center text-[var(--base-500)] hover:bg-[var(--base-100)] transition-colors cursor-pointer"
                        aria-label="Back to friends"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <span className="text-[13px] font-semibold text-[var(--base-700)]">Add Friend</span>
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-5 sm:px-6 py-6">
                    {/* Heading */}
                    <div className="mb-5">
                        <h2 className="text-[18px] font-bold text-[var(--base-800)] tracking-tight">
                            Add Friend
                        </h2>
                        <p className="text-[13px] text-[var(--base-500)] mt-1">
                            You can add friends with their Lerno display name or full name.
                        </p>
                    </div>

                    {/* Search bar — full panel width */}
                    <div className="flex items-center gap-0 rounded-xl border border-[var(--base-200)] overflow-hidden focus-within:border-[var(--primary-400)] focus-within:ring-2 focus-within:ring-[var(--primary-400)]/20 transition-all bg-white">
                        <input
                            ref={inputRef}
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search for someone…"
                            className="flex-1 px-4 py-2.5 text-[14px] text-[var(--base-800)] placeholder:text-[var(--base-400)] outline-none bg-transparent"
                        />
                        <button
                            type="button"
                            disabled={q.trim().length < 2 || loading}
                            className="shrink-0 mx-2 px-4 py-1.5 rounded-lg text-[13px] font-semibold bg-[var(--primary-500)] text-white hover:bg-[var(--primary-600)] disabled:opacity-40 transition-colors cursor-pointer"
                        >
                            {loading ? "Searching…" : "Search"}
                        </button>
                    </div>

                    {/* Results */}
                    <AnimatePresence mode="wait">
                        {debounced.length >= 2 && (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                                className="mt-4"
                            >
                                {loading ? (
                                    <div className="flex flex-col gap-2">
                                        {[1, 2, 3].map((i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--base-200)]"
                                            >
                                                <div className="size-10 rounded-full skeleton shrink-0" />
                                                <div className="flex-1 flex flex-col gap-1.5">
                                                    <div className="skeleton h-3.5 w-32 rounded" />
                                                    <div className="skeleton h-2.5 w-20 rounded" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : users.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 py-8">
                                        <div className="size-12 rounded-full flex items-center justify-center bg-[var(--base-100)]">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="w-5 h-5 text-[var(--base-400)]"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
                                                />
                                            </svg>
                                        </div>
                                        <p className="text-[14px] text-[var(--base-500)]">
                                            No users found for &ldquo;{debounced}&rdquo;
                                        </p>
                                        <p className="text-[12px] text-[var(--base-400)]">
                                            Make sure the name is spelled correctly.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {users.map((u) => {
                                            const initialRelationship = searchResultRelationship(
                                                u.id,
                                                friendUserIds,
                                                outgoingRecipientIds,
                                                incomingSenderIds
                                            );
                                            return (
                                                <div
                                                    key={u.id}
                                                    className="flex items-center gap-3 p-3 rounded-xl border border-[var(--base-200)] hover:border-[var(--base-300)] hover:bg-[var(--base-100)] transition-colors"
                                                >
                                                    <div className="size-10 shrink-0 overflow-hidden rounded-full border border-[var(--base-200)] bg-[var(--base-100)]">
                                                        <ProfileAvatar
                                                            avatarUrl={u.avatarUrl}
                                                            displayName={u.displayName}
                                                            fullName={u.fullName}
                                                            size={40}
                                                            className="!border-0 rounded-none"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[14px] font-semibold text-[var(--base-800)] truncate">
                                                            {u.displayName}
                                                        </p>
                                                        {u.grade != null && (
                                                            <p className="text-[12px] text-[var(--base-400)]">
                                                                Grade {String(u.grade)}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <SendFriendRequestButton
                                                        key={`${u.id}-${initialRelationship}`}
                                                        targetUserId={u.id}
                                                        allowFriendRequests={u.allowFriendRequests}
                                                        initialRelationship={initialRelationship}
                                                        compact
                                                        onSent={onFriendListChanged}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {debounced.length < 2 && (
                            <motion.div
                                key="placeholder"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="mt-8"
                            >
                                <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--base-400)] mb-3">
                                    Other places to connect
                                </p>
                                <button
                                    type="button"
                                    onClick={onBrowse}
                                    className="w-full flex items-center gap-3.5 p-4 rounded-xl border border-[var(--base-200)] cursor-pointer hover:bg-[var(--base-100)] hover:border-[var(--base-300)] transition-colors text-left"
                                >
                                    <div
                                        className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-[var(--primary-10)]"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-5 h-5 text-[var(--primary-500)]"
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
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-semibold text-[var(--base-800)]">
                                            Browse Lerno students
                                        </p>
                                        <p className="text-[12px] text-[var(--base-500)]">
                                            Find study partners from your grade and subject
                                        </p>
                                    </div>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-4 h-4 text-[var(--base-400)] shrink-0"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                    </svg>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

/* ─── Right panel: DM thread ─────────────────────────────────────────────────── */
function RightPanelDmThread({
    peer,
    initialThreadId,
    currentUserId,
    onBack,
    showMobileBack,
}: {
    peer: FriendRow | null;
    initialThreadId: string | null;
    currentUserId: string | null;
    onBack: () => void;
    showMobileBack: boolean;
}) {
    const [thread, setThread] = useState<DmInboxThread | null>(null);
    const [hydrating, setHydrating] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setHydrating(true);
        setThread(null);

        void (async () => {
            try {
                if (peer && !initialThreadId) {
                    // Open (or get existing) thread for this peer
                    const res = await fetch("/api/friends/messages/open", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ peerUserId: peer.userId }),
                    });
                    if (cancelled || !res.ok) return;
                    const json = (await res.json()) as { threadId?: string };
                    if (!cancelled && json.threadId) {
                        setThread({
                            threadId: json.threadId,
                            peerUserId: peer.userId,
                            displayName: peer.displayName,
                            fullName: peer.fullName,
                            grade: peer.grade,
                            avatarUrl: peer.avatarUrl,
                            lastMessageAt: new Date().toISOString(),
                            preview: "",
                            unreadCount: 0,
                        });
                    }
                } else if (peer && initialThreadId) {
                    setThread({
                        threadId: initialThreadId,
                        peerUserId: peer.userId,
                        displayName: peer.displayName,
                        fullName: peer.fullName,
                        grade: peer.grade,
                        avatarUrl: peer.avatarUrl,
                        lastMessageAt: new Date().toISOString(),
                        preview: "",
                        unreadCount: 0,
                    });
                } else if (!peer && initialThreadId) {
                    // Hydrate peer from the thread endpoint (URL-based deep link)
                    const res = await fetch(`/api/friends/messages/${initialThreadId}?limit=1`, {
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
                    if (!cancelled && json.peer) {
                        setThread({
                            threadId: initialThreadId,
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
                    }
                }
            } finally {
                if (!cancelled) setHydrating(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [peer?.userId, initialThreadId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (hydrating) {
        return (
            <div
                className="flex-1 flex items-center justify-center"
                style={{ fontFamily: "var(--font-inter)" }}
            >
                <p className="text-[14px] text-[var(--base-400)]">Opening chat…</p>
            </div>
        );
    }

    return (
        <DmThreadPanel
            thread={thread}
            currentUserId={currentUserId}
            showMobileBack={showMobileBack}
            onBackMobile={onBack}
            onInboxInvalidate={() => {}}
        />
    );
}

/* ─── Empty friends state ─────────────────────────────────────────────────── */
function EmptyFriends({ onAddFriend }: { onAddFriend: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
            <div className="size-14 rounded-2xl flex items-center justify-center bg-[var(--base-100)]">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6 text-[var(--base-400)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.48-3.897M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                    />
                </svg>
            </div>
            <div>
                <p className="text-[15px] font-semibold text-[var(--base-700)]" style={{ fontFamily: "var(--font-inter)" }}>
                    No friends yet
                </p>
                <p className="text-[13px] text-[var(--base-400)] mt-1 max-w-xs" style={{ fontFamily: "var(--font-inter)" }}>
                    Add classmates and study together — share sessions, questions and more.
                </p>
            </div>
            <button
                type="button"
                onClick={onAddFriend}
                className="px-4 py-2 rounded-full text-[13px] font-semibold bg-[var(--primary-500)] text-white hover:bg-[var(--primary-600)] transition-colors cursor-pointer"
                style={{ fontFamily: "var(--font-inter)" }}
            >
                Add Friend
            </button>
        </div>
    );
}

/* ─── Idle welcome state (right panel) ────────────────────────────────────── */
function IdleWelcome() {
    return (
        <div
            className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3"
            style={{ fontFamily: "var(--font-inter)" }}
        >
            <div className="size-14 rounded-2xl bg-[var(--base-100)] flex items-center justify-center">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6 text-[var(--base-400)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                    />
                </svg>
            </div>
            <p className="text-[14px] font-semibold text-[var(--base-600)]">Select a friend to chat</p>
            <p className="text-[13px] text-[var(--base-400)] max-w-[220px]">
                Click any friend on the left to open a conversation.
            </p>
        </div>
    );
}

/* ─── Main page ─────────────────────────────────────────────────────────────── */
export function FriendsListPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlThread = searchParams.get("thread")?.trim() || null;
    const urlPeer = searchParams.get("peer")?.trim() || null;

    const [leftTab, setLeftTab] = useState<LeftTab>("all");
    const [rightPanel, setRightPanel] = useState<RightPanel>({ type: "idle" });
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
    const [mobileShowRight, setMobileShowRight] = useState(false);

    const [userId, setUserId] = useState<string | null>(null);
    const [friends, setFriends] = useState<FriendRow[]>([]);
    const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
    const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasHandledInitialUrl = useRef(false);

    const clearFriendsQuery = useCallback(() => {
        if (!searchParams.has("thread") && !searchParams.has("peer")) return;
        router.replace("/friends", { scroll: false });
    }, [router, searchParams]);

    /* ── Data loading ────────────────────────────────────────────────────── */
    const load = useCallback(async () => {
        setError(null);
        try {
            const [fr, inc, out] = await Promise.all([
                fetch("/api/friends", { credentials: "include" }),
                fetch("/api/friends/requests", { credentials: "include" }),
                fetch("/api/friends/requests/outgoing", { credentials: "include" }),
            ]);

            if (!fr.ok || !inc.ok || !out.ok) {
                setError("Could not load friends data.");
                return;
            }

            const frJson = (await fr.json()) as { friends?: FriendRow[] };
            const incJson = (await inc.json()) as { requests?: IncomingRequest[] };
            const outJson = (await out.json()) as { requests?: OutgoingRequest[] };

            setFriends(frJson.friends ?? []);
            setIncoming(incJson.requests ?? []);
            setOutgoing(outJson.requests ?? []);
        } catch {
            setError("Network error.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void createClient()
            .auth.getUser()
            .then(({ data: { user } }) => setUserId(user?.id ?? null));
    }, []);

    useEffect(() => {
        queueMicrotask(() => void load());
    }, [load]);

    useFriendRealtime(userId, load);

    useEffect(() => {
        const bump = () => void fetch("/api/friends/presence", { method: "POST", credentials: "include" });
        void bump();
        const t = setInterval(bump, 90_000);
        return () => clearInterval(t);
    }, []);

    /* ── Handle URL deep-link params after friends load ─────────────────── */
    useEffect(() => {
        if (loading) return;
        if (hasHandledInitialUrl.current) return;
        if (!urlPeer && !urlThread) return;

        hasHandledInitialUrl.current = true;

        if (urlPeer) {
            const friend = friends.find((f) => f.userId === urlPeer);
            if (friend) {
                setSelectedFriendId(friend.userId);
                setRightPanel({ type: "chat", peer: friend, threadId: null });
                setMobileShowRight(true);
            }
        } else if (urlThread) {
            setRightPanel({ type: "chat", peer: null, threadId: urlThread });
            setMobileShowRight(true);
        }
        clearFriendsQuery();
    }, [loading, friends, urlPeer, urlThread, clearFriendsQuery]);

    const cancelOutgoing = useCallback(
        async (id: string) => {
            const res = await fetch(`/api/friends/requests/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) void load();
        },
        [load]
    );

    const pendingTotal = incoming.length + outgoing.length;

    const friendUserIds = useMemo(() => new Set(friends.map((f) => f.userId)), [friends]);
    const outgoingRecipientIds = useMemo(
        () =>
            new Set(
                outgoing
                    .map((r) => r.recipient?.id)
                    .filter((id): id is string => typeof id === "string" && id.length > 0)
            ),
        [outgoing]
    );
    const incomingSenderIds = useMemo(
        () =>
            new Set(
                incoming
                    .map((r) => r.sender?.id)
                    .filter((id): id is string => typeof id === "string" && id.length > 0)
            ),
        [incoming]
    );

    /* ── Friend click handler ────────────────────────────────────────────── */
    const onFriendClick = useCallback((friend: FriendRow) => {
        setSelectedFriendId(friend.userId);
        setRightPanel({ type: "chat", peer: friend, threadId: null });
        setMobileShowRight(true);
    }, []);

    const onAddFriendClick = useCallback(() => {
        setSelectedFriendId(null);
        setRightPanel({ type: "add" });
        setMobileShowRight(true);
    }, []);

    const onMobileBack = useCallback(() => {
        setMobileShowRight(false);
    }, []);

    /* ── Resizable left panel ────────────────────────────────────────────── */
    const MIN_LEFT_W = 180;
    const MAX_LEFT_W = 480;
    const DEFAULT_LEFT_W = 260;
    const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_W);
    const containerRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);

    const onResizerMouseDown = useCallback((e: ReactMouseEvent) => {
        e.preventDefault();
        draggingRef.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        const onMove = (ev: MouseEvent) => {
            if (!draggingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const newW = ev.clientX - rect.left;
            setLeftWidth(Math.max(MIN_LEFT_W, Math.min(MAX_LEFT_W, newW)));
        };

        const onUp = () => {
            draggingRef.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, []);

    /* ── Compute right panel key for remounting on peer change ───────────── */
    const rightPanelKey =
        rightPanel.type === "chat"
            ? `chat-${rightPanel.peer?.userId ?? "nouser"}-${rightPanel.threadId ?? "nothread"}`
            : rightPanel.type;

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full" style={{ fontFamily: "var(--font-inter)" }}>
            {/* ── Full-width header bar ──────────────────────────────────── */}
            <header
                className="flex items-center shrink-0 px-4 border-b border-[var(--base-200)] bg-white gap-0"
                style={{ minHeight: 49 }}
            >
                {/* Friends icon + title */}
                <div className="flex items-center gap-2 shrink-0">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5 text-[var(--primary-500)]"
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
                    <span className="text-[15px] font-bold text-[var(--base-800)] tracking-tight">Friends</span>
                </div>

                {/* Separator */}
                <div className="w-px h-5 bg-[var(--base-200)] mx-4 shrink-0" />

                {/* Tabs: All + Pending only */}
                <nav className="flex items-center gap-0.5">
                    <TabButton active={leftTab === "all"} onClick={() => setLeftTab("all")}>
                        All
                    </TabButton>
                    <TabButton
                        active={leftTab === "pending"}
                        onClick={() => setLeftTab("pending")}
                        badge={pendingTotal > 0 ? pendingTotal : undefined}
                    >
                        Pending
                    </TabButton>
                </nav>

                <div className="flex-1" />

                {/* Add Friend button */}
                <button
                    type="button"
                    onClick={onAddFriendClick}
                    className={`shrink-0 inline-flex items-center gap-2 rounded-full text-[13px] font-semibold transition-colors duration-150 cursor-pointer pl-3 pr-4 py-1.5 ${
                        rightPanel.type === "add" || rightPanel.type === "browse"
                            ? "bg-[var(--primary-500)] text-white"
                            : "bg-[var(--primary-10)] text-[var(--primary-600)] ring-1 ring-[var(--primary-200)]/70 hover:bg-[var(--primary-100)]"
                    }`}
                >
                    <svg
                        className="w-4 h-4 shrink-0"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                        />
                    </svg>
                    Add Friend
                </button>
            </header>

            {/* ── Two-panel body ────────────────────────────────────────── */}
            <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left panel — friend/pending list */}
                <aside
                    className={`flex flex-col shrink-0 min-h-0 overflow-hidden w-full ${
                        mobileShowRight ? "hidden md:flex" : "flex"
                    }`}
                    style={{ width: leftWidth }}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {leftTab === "all" && (
                            <motion.div
                                key="all"
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                                className="flex flex-col flex-1 min-h-0 overflow-hidden"
                            >
                                {error && (
                                    <p className="text-[12px] text-[var(--red-100)] px-4 py-2 shrink-0">{error}</p>
                                )}
                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    {loading ? (
                                        <div className="flex flex-col gap-0 px-3 py-2">
                                            {Array.from({ length: 6 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg"
                                                >
                                                    <div className="size-9 rounded-full skeleton shrink-0" />
                                                    <div className="flex-1 flex flex-col gap-1.5">
                                                        <div
                                                            className="skeleton h-3.5 rounded"
                                                            style={{ width: `${45 + (i % 4) * 10}%` }}
                                                        />
                                                        <div className="skeleton h-2.5 w-20 rounded" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : friends.length === 0 ? (
                                        <EmptyFriends onAddFriend={onAddFriendClick} />
                                    ) : (
                                        <div className="px-3 pt-3 pb-4">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--base-400)] mb-1.5 px-2">
                                                All Friends — {friends.length}
                                            </p>
                                            {friends.map((f) => (
                                                <FriendCard
                                                    key={f.friendshipId}
                                                    friend={f}
                                                    onChanged={load}
                                                    variant="list"
                                                    isSelected={selectedFriendId === f.userId}
                                                    onMessage={onFriendClick}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {leftTab === "pending" && (
                            <motion.div
                                key="pending"
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                                className="flex-1 min-h-0 overflow-y-auto"
                            >
                                <div className="px-3 pt-4 pb-8 flex flex-col gap-5">
                                    {/* Incoming */}
                                    <section>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--base-400)] mb-1.5 px-2">
                                            Incoming — {incoming.length}
                                        </p>
                                        {incoming.length === 0 ? (
                                            <p className="text-[13px] text-[var(--base-400)] px-2 py-3">
                                                No incoming requests.
                                            </p>
                                        ) : (
                                            incoming.map((r) => (
                                                <FriendRequestCard key={r.id} request={r} onChanged={load} />
                                            ))
                                        )}
                                    </section>

                                    {/* Outgoing */}
                                    <section>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--base-400)] mb-1.5 px-2">
                                            Sent — {outgoing.length}
                                        </p>
                                        {outgoing.length === 0 ? (
                                            <p className="text-[13px] text-[var(--base-400)] px-2 py-3">
                                                No pending outgoing requests.
                                            </p>
                                        ) : (
                                            outgoing.map((r) => {
                                                const name = r.recipient?.fullName?.trim() || "User";
                                                return (
                                                    <div
                                                        key={r.id}
                                                        className="group flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[var(--base-100)] transition-colors"
                                                    >
                                                        <div className="relative shrink-0">
                                                            <div className="size-9 rounded-full bg-[var(--base-100)] border border-[var(--base-200)] flex items-center justify-center">
                                                                <svg className="w-4 h-4 text-[var(--base-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                                                </svg>
                                                            </div>
                                                            <div
                                                                className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white"
                                                                style={{ backgroundColor: "var(--base-300)" }}
                                                            />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[14px] font-semibold text-[var(--base-800)] truncate leading-tight">
                                                                {name}
                                                            </p>
                                                            <p className="text-[12px] text-[var(--base-400)] leading-tight">
                                                                Outgoing Friend Request
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => void cancelOutgoing(r.id)}
                                                            className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 px-3 py-1.5 rounded-full text-[12px] font-semibold text-[var(--red-100)] border border-[var(--red-100)]/20 hover:bg-[var(--red-10)] transition-all cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </section>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </aside>

                {/* Drag handle — desktop only */}
                <div
                    role="separator"
                    aria-orientation="vertical"
                    className="hidden md:flex shrink-0 w-[5px] cursor-col-resize group relative select-none items-stretch"
                    onMouseDown={onResizerMouseDown}
                >
                    {/* Visual line */}
                    <div className="absolute inset-y-0 left-[2px] w-px bg-[var(--base-200)] group-hover:bg-[var(--primary-300)] transition-colors duration-150" />
                    {/* Wider invisible grab zone */}
                    <div className="absolute inset-y-0 -left-1 -right-1" />
                    {/* Drag pill — shows on hover */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                        <div className="w-[3px] h-[3px] rounded-full bg-[var(--primary-400)]" />
                        <div className="w-[3px] h-[3px] rounded-full bg-[var(--primary-400)]" />
                        <div className="w-[3px] h-[3px] rounded-full bg-[var(--primary-400)]" />
                        <div className="w-[3px] h-[3px] rounded-full bg-[var(--primary-400)]" />
                    </div>
                </div>

                {/* Right panel — contextual content */}
                <main
                    className={`flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden ${
                        mobileShowRight ? "flex" : "hidden md:flex"
                    }`}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={rightPanelKey}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className="flex flex-col flex-1 min-h-0"
                        >
                            {rightPanel.type === "idle" && <IdleWelcome />}

                            {rightPanel.type === "chat" && (
                                <RightPanelDmThread
                                    peer={rightPanel.peer}
                                    initialThreadId={rightPanel.threadId}
                                    currentUserId={userId}
                                    onBack={onMobileBack}
                                    showMobileBack={mobileShowRight}
                                />
                            )}

                            {rightPanel.type === "add" && (
                                <AddFriendPanel
                                    onFriendListChanged={() => void load()}
                                    onBrowse={() => setRightPanel({ type: "browse" })}
                                    onMobileBack={onMobileBack}
                                    friendUserIds={friendUserIds}
                                    outgoingRecipientIds={outgoingRecipientIds}
                                    incomingSenderIds={incomingSenderIds}
                                />
                            )}

                            {rightPanel.type === "browse" && (
                                <BrowseStudentsPanel
                                    onBack={() => setRightPanel({ type: "add" })}
                                    onFriendListChanged={() => void load()}
                                    friendUserIds={friendUserIds}
                                    outgoingRecipientIds={outgoingRecipientIds}
                                    incomingSenderIds={incomingSenderIds}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}
