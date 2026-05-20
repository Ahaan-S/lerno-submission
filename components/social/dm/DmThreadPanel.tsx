"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { QuestionShareMetadata, SessionShareMetadata } from "@/lib/social/share-types";
import type { DmInboxThread, DmMessageRow } from "@/components/social/dm/dm-types";
import { DmQuestionShareCard } from "@/components/social/dm/DmQuestionShareCard";
import { DmSessionShareCard } from "@/components/social/dm/DmSessionShareCard";
import { formatPeerPresenceLine, formatSeenCaption, isPeerOnline } from "@/lib/social/dm-presence";

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Supabase / JSON may deliver jsonb as object or occasionally a string. */
function asJsonRecord(raw: unknown): Record<string, unknown> | null {
    if (typeof raw === "string") {
        try {
            const parsed: unknown = JSON.parse(raw);
            return isRecord(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
    return isRecord(raw) ? raw : null;
}

function asQuestionMeta(raw: unknown): QuestionShareMetadata | null {
    const r = asJsonRecord(raw);
    if (!r) return null;
    const id = r.question_id;
    if (typeof id !== "string") return null;
    return r as unknown as QuestionShareMetadata;
}

function asSessionMeta(raw: unknown): SessionShareMetadata | null {
    const r = asJsonRecord(raw);
    if (!r) return null;
    const sid = r.session_id;
    if (typeof sid !== "string") return null;
    return r as unknown as SessionShareMetadata;
}

function SeenReceipt({ readAt }: { readAt: string }) {
    return (
        <div className="flex justify-end pr-0.5 mt-0.5 max-w-[min(100%,420px)]">
            <span className="text-[11px] font-medium text-[var(--base-400)] tracking-tight">
                {formatSeenCaption(readAt)}
            </span>
        </div>
    );
}

function startOfLocalDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function localDayKey(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
}

/** Normalise API / Supabase row shape so grouping never drops a row. */
function messageTimestampIso(m: DmMessageRow): string {
    const r = m as unknown as Record<string, unknown>;
    const raw = r.created_at ?? r.createdAt;
    if (typeof raw === "string") return raw;
    if (raw != null && typeof raw !== "object") return String(raw);
    return "";
}

function messageTimeMs(m: DmMessageRow): number {
    const t = new Date(messageTimestampIso(m)).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/**
 * WhatsApp / Telegram–style day title: Today, Yesterday, weekday + month when same year,
 * full date with year when a different calendar year.
 */
function formatDmFloatingDayLabel(iso: string): string {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const d0 = startOfLocalDay(d);
    const n0 = startOfLocalDay(now);
    const diffDays = Math.round((n0 - d0) / 86_400_000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    const sameYear = d.getFullYear() === now.getFullYear();
    if (sameYear) {
        return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    }
    return d.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function formatMessageClock(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function groupMessagesByLocalDay(messages: DmMessageRow[]): { dayKey: string; label: string; items: DmMessageRow[] }[] {
    const out: { dayKey: string; label: string; items: DmMessageRow[] }[] = [];
    for (const m of messages) {
        const iso = messageTimestampIso(m);
        const key = localDayKey(iso) || "__nodate__";
        const label = formatDmFloatingDayLabel(iso) || "Messages";
        const last = out[out.length - 1];
        if (!last || last.dayKey !== key) {
            out.push({ dayKey: key, label, items: [m] });
        } else {
            last.items.push(m);
        }
    }
    return out;
}

function isNearBottom(el: HTMLDivElement, px = 120): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= px + 1;
}

/** Scroll the overflow message pane (nested scroll — `scrollIntoView` on a child is unreliable). */
function scrollThreadPaneToBottom(scrollEl: HTMLDivElement | null, behavior: ScrollBehavior = "smooth") {
    if (!scrollEl) return;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior });
        });
    });
}

/** Realtime payloads sometimes omit snake_case fields — normalise before merging into React state. */
function normalizeRealtimeDmRow(raw: Record<string, unknown>, fallbackThreadId: string): DmMessageRow | null {
    const id = raw.id;
    if (typeof id !== "string") return null;
    const thread_id =
        typeof raw.thread_id === "string"
            ? raw.thread_id
            : typeof raw.threadId === "string"
              ? raw.threadId
              : fallbackThreadId;
    const sender_id =
        typeof raw.sender_id === "string"
            ? raw.sender_id
            : typeof raw.senderId === "string"
              ? raw.senderId
              : "";
    if (!sender_id) return null;
    const content = typeof raw.content === "string" ? raw.content : "";
    const message_type =
        typeof raw.message_type === "string" ? raw.message_type : typeof raw.messageType === "string" ? raw.messageType : "text";
    const created_at =
        typeof raw.created_at === "string"
            ? raw.created_at
            : typeof raw.createdAt === "string"
              ? raw.createdAt
              : new Date().toISOString();
    let read_at: string | null = null;
    if (typeof raw.read_at === "string") read_at = raw.read_at;
    else if (raw.read_at === null) read_at = null;
    else if (typeof raw.readAt === "string") read_at = raw.readAt;
    return {
        id,
        thread_id,
        sender_id,
        content,
        message_type,
        metadata: raw.metadata ?? null,
        read_at,
        created_at,
    };
}

function StickyDayDivider({ label }: { label: string }) {
    return (
        <div
            className="sticky top-2 z-10 flex justify-center py-1.5 pointer-events-none"
            role="separator"
            aria-label={label}
        >
            <span className="rounded-full border border-[var(--base-200)] bg-white px-3 py-0.5 text-[11px] font-medium text-[var(--base-500)]">
                {label}
            </span>
        </div>
    );
}

export function DmThreadPanel({
    thread,
    currentUserId,
    onBackMobile,
    showMobileBack,
    onInboxInvalidate,
}: {
    thread: DmInboxThread | null;
    currentUserId: string | null;
    onBackMobile?: () => void;
    showMobileBack?: boolean;
    onInboxInvalidate: () => void;
}) {
    const [messages, setMessages] = useState<DmMessageRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [peerLastSeenAt, setPeerLastSeenAt] = useState<string | null>(null);
    /** Re-render "Last seen Xm ago" periodically without polling presence every minute. */
    const [presenceTick, setPresenceTick] = useState(0);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    /** After send / realtime insert, scroll once `messages` has flushed to the DOM. */
    const scrollAfterMessagesRef = useRef<ScrollBehavior | null>(null);
    /** Latest messages for merge-poll without stale closures. */
    const messagesRef = useRef<DmMessageRow[]>([]);
    messagesRef.current = messages;
    /** Stale in-flight GETs must not apply after the user switches threads (avoids empty/wrong lists). */
    const activeThreadIdRef = useRef<string | null>(null);
    activeThreadIdRef.current = thread?.threadId ?? null;

    useEffect(() => {
        setPeerLastSeenAt(thread?.peerLastSeenAt ?? null);
    }, [thread?.threadId, thread?.peerLastSeenAt]);

    const bumpSelfPresence = useCallback(() => {
        void fetch("/api/friends/presence", { method: "POST", credentials: "include" });
    }, []);

    useEffect(() => {
        if (!thread?.threadId || !currentUserId) return;
        void bumpSelfPresence();
        const t = setInterval(() => void bumpSelfPresence(), 45_000);
        const onVis = () => {
            if (document.visibilityState === "visible") void bumpSelfPresence();
        };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            clearInterval(t);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [thread?.threadId, currentUserId, bumpSelfPresence]);

    useEffect(() => {
        const t = setInterval(() => setPresenceTick((x) => x + 1), 60_000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const peerId = thread?.peerUserId;
        if (!peerId) return;
        let cancelled = false;
        const pull = async () => {
            const res = await fetch(`/api/friends/presence?peerId=${encodeURIComponent(peerId)}`, {
                credentials: "include",
            });
            if (cancelled || !res.ok) return;
            const j = (await res.json()) as { lastSeenAt?: string | null };
            if (!cancelled) setPeerLastSeenAt(j.lastSeenAt ?? null);
        };
        void pull();
        const iv = setInterval(() => void pull(), 40_000);
        return () => {
            cancelled = true;
            clearInterval(iv);
        };
    }, [thread?.peerUserId]);

    useLayoutEffect(() => {
        const mode = scrollAfterMessagesRef.current;
        if (mode === null || !scrollRef.current) return;
        scrollAfterMessagesRef.current = null;
        scrollThreadPaneToBottom(scrollRef.current, mode);
    }, [messages]);

    const loadPage = useCallback(async (threadId: string, before: string | null, append: boolean) => {
        const stillHere = () => activeThreadIdRef.current === threadId;
        const params = new URLSearchParams({ limit: "40" });
        if (before) params.set("before", before);
        const res = await fetch(`/api/friends/messages/${threadId}?${params}`, {
            credentials: "include",
        });
        if (!stillHere()) return;
        if (!res.ok) return;
        let json: {
            messages?: DmMessageRow[];
            hasMore?: boolean;
            nextBefore?: string | null;
            peer?: { dmLastSeenAt?: string | null };
        };
        try {
            json = (await res.json()) as typeof json;
        } catch {
            return;
        }
        if (!stillHere()) return;
        const chunk = json.messages ?? [];
        if (!stillHere()) return;
        setHasMore(Boolean(json.hasMore));
        setBeforeCursor(json.nextBefore ?? null);
        if (!append && json.peer?.dmLastSeenAt !== undefined) {
            setPeerLastSeenAt(json.peer.dmLastSeenAt ?? null);
        }
        if (append) {
            setMessages((prev) => [...chunk, ...prev]);
        } else {
            /** Merge client rows for this thread not in this snapshot (GET vs POST race). */
            setMessages((prev) => {
                const extras = prev.filter(
                    (m) => m.thread_id === threadId && !chunk.some((s) => s.id === m.id)
                );
                return [...chunk, ...extras].sort((a, b) => messageTimeMs(a) - messageTimeMs(b));
            });
        }
    }, []);

    const markRead = useCallback(
        async (threadId: string) => {
            try {
                const res = await fetch(`/api/friends/messages/${encodeURIComponent(threadId)}/read`, {
                    method: "POST",
                    credentials: "include",
                });
                if (res.ok) onInboxInvalidate();
            } catch {
                /* ignore: abort, offline, devtools block */
            }
        },
        [onInboxInvalidate]
    );

    useEffect(() => {
        if (!thread?.threadId) {
            setMessages([]);
            setHasMore(false);
            setBeforeCursor(null);
            return;
        }
        const tid = thread.threadId;
        setLoading(true);
        void (async () => {
            scrollAfterMessagesRef.current = "auto";
            await loadPage(tid, null, false);
            if (activeThreadIdRef.current !== tid) return;
            setLoading(false);
            void markRead(tid);
        })();
    }, [thread?.threadId, loadPage, markRead]);

    useEffect(() => {
        if (!thread?.threadId || !currentUserId) return;
        const supabase = createClient();
        const tid = thread.threadId;
        const channel = supabase
            .channel(`dm:${tid}:${currentUserId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "direct_messages",
                    filter: `thread_id=eq.${tid}`,
                },
                (payload) => {
                    const raw = payload.new as Record<string, unknown>;
                    const row = normalizeRealtimeDmRow(raw, tid);
                    if (!row || row.thread_id !== activeThreadIdRef.current) return;
                    const wasNearBottom = scrollRef.current ? isNearBottom(scrollRef.current, 140) : true;
                    const isIncoming = row.sender_id !== currentUserId;
                    setMessages((prev) => {
                        if (prev.some((m) => m.id === row.id)) return prev;
                        return [...prev, row];
                    });
                    onInboxInvalidate();
                    if (isIncoming || wasNearBottom) {
                        scrollAfterMessagesRef.current = "smooth";
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "direct_messages",
                    filter: `thread_id=eq.${tid}`,
                },
                (payload) => {
                    const raw = payload.new as Record<string, unknown>;
                    const id = raw.id;
                    if (typeof id !== "string") return;
                    const readAt =
                        typeof raw.read_at === "string"
                            ? raw.read_at
                            : raw.read_at === null
                              ? null
                              : typeof raw.readAt === "string"
                                ? raw.readAt
                                : null;
                    setMessages((prev) =>
                        prev.map((m) => (m.id === id ? { ...m, read_at: readAt ?? m.read_at } : m))
                    );
                }
            )
            .subscribe((status, err) => {
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    console.warn("[dm realtime]", status, err?.message ?? err);
                }
            });

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [thread?.threadId, currentUserId, onInboxInvalidate]);

    /** Merge-poll: catches messages if Realtime drops an event (still feels “live” within a few seconds). */
    useEffect(() => {
        const tid = thread?.threadId;
        if (!tid) return;
        const POLL_MS = 6000;
        const iv = setInterval(() => {
            if (activeThreadIdRef.current !== tid) return;
            void (async () => {
                const res = await fetch(`/api/friends/messages/${tid}?limit=40`, { credentials: "include" });
                if (!res.ok || activeThreadIdRef.current !== tid) return;
                let json: { messages?: DmMessageRow[] };
                try {
                    json = (await res.json()) as { messages?: DmMessageRow[] };
                } catch {
                    return;
                }
                const chunk = json.messages ?? [];
                const prevIds = new Set(messagesRef.current.map((m) => m.id));
                const hadNew = chunk.some((m) => !prevIds.has(m.id));
                if (!hadNew) return;
                const nearBefore = scrollRef.current ? isNearBottom(scrollRef.current, 160) : true;
                if (nearBefore) scrollAfterMessagesRef.current = "smooth";
                setMessages((prev) => {
                    const byId = new Map(prev.map((m) => [m.id, m]));
                    for (const m of chunk) {
                        if (!byId.has(m.id)) byId.set(m.id, m);
                    }
                    return [...byId.values()].sort((a, b) => messageTimeMs(a) - messageTimeMs(b));
                });
            })();
        }, POLL_MS);
        return () => clearInterval(iv);
    }, [thread?.threadId]);

    const lastOwnReadMessageId = useMemo(() => {
        if (!currentUserId) return null;
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m.sender_id === currentUserId && m.read_at) return m.id;
        }
        return null;
    }, [messages, currentUserId]);

    const messagesByDay = useMemo(() => groupMessagesByLocalDay(messages), [messages]);

    const peerOnline = useMemo(
        () => isPeerOnline(peerLastSeenAt ?? undefined),
        [peerLastSeenAt, presenceTick]
    );
    const peerPresenceLine = useMemo(
        () => formatPeerPresenceLine(peerLastSeenAt ?? null),
        [peerLastSeenAt, presenceTick]
    );

    const send = useCallback(async () => {
        const text = draft.trim();
        if (!thread?.threadId || !text || sending) return;
        setSending(true);
        try {
            const res = await fetch(`/api/friends/messages/${thread.threadId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ content: text }),
            });
            if (res.ok) {
                let json: { message?: DmMessageRow };
                try {
                    json = (await res.json()) as { message?: DmMessageRow };
                } catch {
                    json = {};
                }
                scrollAfterMessagesRef.current = "smooth";
                if (json.message) {
                    setMessages((prev) => {
                        if (prev.some((m) => m.id === json.message!.id)) return prev;
                        return [...prev, json.message!];
                    });
                } else {
                    /** Row inserted but response empty (e.g. parse edge) — resync thread. */
                    scrollAfterMessagesRef.current = "auto";
                    await loadPage(thread.threadId, null, false);
                }
                setDraft("");
                onInboxInvalidate();
            }
        } finally {
            setSending(false);
        }
    }, [draft, thread?.threadId, sending, onInboxInvalidate, loadPage]);

    const loadOlder = useCallback(async () => {
        if (!thread?.threadId || !beforeCursor || loading) return;
        const tid = thread.threadId;
        const el = scrollRef.current;
        const prevHeight = el?.scrollHeight ?? 0;
        setLoading(true);
        await loadPage(tid, beforeCursor, true);
        if (activeThreadIdRef.current !== tid) return;
        setLoading(false);
        queueMicrotask(() => {
            if (el) {
                const h = el.scrollHeight;
                el.scrollTop = h - prevHeight;
            }
        });
    }, [thread?.threadId, beforeCursor, loading, loadPage]);

    if (!thread) {
        return (
            <div
                className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center"
                style={{ fontFamily: "var(--font-inter)" }}
            >
                <p className="text-[15px] font-semibold text-[var(--base-600)]">Select a conversation</p>
                <p className="text-[13px] text-[var(--base-400)] mt-1 max-w-xs">
                    Choose someone on the left to see your messages, or start from your friends list.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 min-w-0" style={{ fontFamily: "var(--font-inter)" }}>
            <header className="friends-dm-thread-header shrink-0 flex items-center gap-2 px-3 py-2.5 border-b">
                {showMobileBack && (
                    <button
                        type="button"
                        onClick={onBackMobile}
                        className="md:hidden size-9 rounded-full flex items-center justify-center text-[var(--base-600)] hover:bg-[var(--base-100)] cursor-pointer"
                        aria-label="Back to conversations"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                )}
                <div className="size-9 shrink-0 overflow-hidden rounded-full border border-[var(--base-200)] bg-[var(--base-100)]">
                    <ProfileAvatar
                        avatarUrl={thread.avatarUrl}
                        displayName={thread.displayName}
                        fullName={thread.fullName}
                        size={36}
                        className="!border-0 rounded-none"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[var(--base-800)] truncate">{thread.displayName}</p>
                    {peerOnline ? (
                        <p className="text-[11px] font-semibold text-[var(--green-200)] flex items-center gap-1.5 mt-0.5">
                            <span
                                className="inline-block size-2 shrink-0 rounded-full bg-[var(--green-200)] shadow-[0_0_0_2px_rgba(34,197,94,0.22)]"
                                aria-hidden
                            />
                            Active now
                        </p>
                    ) : (
                        <p className="text-[11px] text-[var(--base-400)] mt-0.5 truncate" title={peerPresenceLine}>
                            {peerPresenceLine}
                        </p>
                    )}
                </div>
            </header>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
                {hasMore && beforeCursor && (
                    <button
                        type="button"
                        onClick={() => void loadOlder()}
                        disabled={loading}
                        className="self-center text-[12px] font-medium text-[var(--primary-500)] py-1 cursor-pointer disabled:opacity-50"
                    >
                        {loading ? "Loading…" : "Load older messages"}
                    </button>
                )}
                {messagesByDay.map((group) => (
                    <div key={group.dayKey} className="flex flex-col gap-2">
                        <StickyDayDivider label={group.label} />
                        {group.items.map((m) => {
                            const own = m.sender_id === currentUserId;
                            const t = m.message_type === "text" ? "text" : m.message_type;
                            const showSeen = Boolean(own && m.read_at && m.id === lastOwnReadMessageId);

                            if (t === "question_share") {
                                const meta = asQuestionMeta(m.metadata);
                                if (!meta) {
                                    return (
                                        <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                                            <p className="text-[12px] text-[var(--base-400)]">
                                                Shared question (invalid payload)
                                            </p>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={m.id} className={`flex flex-col gap-0 ${own ? "items-end" : "items-start"}`}>
                                        <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
                                            <DmQuestionShareCard meta={meta} isOwn={own} />
                                        </div>
                                        {showSeen && m.read_at ? <SeenReceipt readAt={m.read_at} /> : null}
                                    </div>
                                );
                            }

                            if (t === "session_share") {
                                const meta = asSessionMeta(m.metadata);
                                if (!meta) {
                                    return (
                                        <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                                            <p className="text-[12px] text-[var(--base-400)]">
                                                Shared session (invalid payload)
                                            </p>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={m.id} className={`flex flex-col gap-0 ${own ? "items-end" : "items-start"}`}>
                                        <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
                                            <DmSessionShareCard meta={meta} isOwn={own} />
                                        </div>
                                        {showSeen && m.read_at ? <SeenReceipt readAt={m.read_at} /> : null}
                                    </div>
                                );
                            }

                            return (
                                <div key={m.id} className={`flex flex-col gap-0 ${own ? "items-end" : "items-start"}`}>
                                    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
                                        <div
                                            className={`max-w-[min(100%,420px)] rounded-2xl px-3.5 py-2.5 flex flex-col gap-1.5 ${
                                                own
                                                    ? "rounded-br-md text-white bg-[var(--primary-500)]"
                                                    : "rounded-bl-md bg-white text-[var(--base-800)] border border-[var(--base-200)]"
                                            }`}
                                        >
                                            <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">
                                                {m.content}
                                            </p>
                                            <p
                                                className={`text-[11px] self-end tabular-nums leading-none ${
                                                    own ? "text-white/72" : "text-[var(--base-400)]"
                                                }`}
                                            >
                                                {formatMessageClock(messageTimestampIso(m))}
                                            </p>
                                        </div>
                                    </div>
                                    {showSeen && m.read_at ? <SeenReceipt readAt={m.read_at} /> : null}
                                </div>
                            );
                        })}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <div className="friends-dm-composer-bar shrink-0 px-3 py-2.5 border-t border-[var(--base-200)]">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--base-200)] bg-white px-3 py-1.5">
                    <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void send();
                            }
                        }}
                        placeholder="Message…"
                        className="flex-1 h-9 bg-transparent text-[14px] text-[var(--base-800)] placeholder:text-[var(--base-400)] outline-none"
                        style={{ fontFamily: "var(--font-inter)" }}
                    />
                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={sending || !draft.trim()}
                        className="shrink-0 px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-[var(--primary-500)] hover:bg-[var(--primary-600)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors duration-150"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
