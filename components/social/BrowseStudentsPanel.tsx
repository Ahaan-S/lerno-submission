"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileHoverCard } from "@/components/profile/ProfileHoverCard";
import { SendFriendRequestButton } from "@/components/social/SendFriendRequestButton";
import { MutualFriendsChip } from "@/components/social/MutualFriendsChip";
import { searchResultRelationship } from "@/components/social/search-result-relationship";

const EMPTY_USER_ID_SET: ReadonlySet<string> = new Set();

function formatGrade(grade: string | number | null | undefined): string | null {
    if (grade == null) return null;
    const s = String(grade).trim();
    if (!s) return null;
    if (/^class\s/i.test(s)) return s;
    return `Class ${s}`;
}

type BrowseStudent = {
    id: string;
    displayName: string;
    fullName: string | null;
    grade: string | number | null;
    avatarUrl: string | null;
    allowFriendRequests: boolean;
    mutualCount: number;
};

const LIMIT = 20;

export function BrowseStudentsPanel({
    onBack,
    onFriendListChanged,
    friendUserIds,
    outgoingRecipientIds,
    incomingSenderIds,
}: {
    onBack: () => void;
    onFriendListChanged: () => void;
    friendUserIds?: ReadonlySet<string>;
    outgoingRecipientIds?: ReadonlySet<string>;
    incomingSenderIds?: ReadonlySet<string>;
}) {
    const friendSet = friendUserIds ?? EMPTY_USER_ID_SET;
    const outgoingSet = outgoingRecipientIds ?? EMPTY_USER_ID_SET;
    const incomingSet = incomingSenderIds ?? EMPTY_USER_ID_SET;

    /* ── Browse (grade-based) state ──────────────────────────────────────── */
    const [students, setStudents] = useState<BrowseStudent[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);

    /* ── Search state ────────────────────────────────────────────────────── */
    const [q, setQ] = useState("");
    const [debounced, setDebounced] = useState("");
    const [searchResults, setSearchResults] = useState<BrowseStudent[] | null>(null);
    const [searching, setSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    /* ── Debounce ────────────────────────────────────────────────────────── */
    useEffect(() => {
        const t = setTimeout(() => setDebounced(q.trim()), 280);
        return () => clearTimeout(t);
    }, [q]);

    /* ── Grade-based browse fetch ────────────────────────────────────────── */
    const loadPage = useCallback(async (pageOffset: number, append: boolean) => {
        if (append) setLoadingMore(true);
        else setLoading(true);
        try {
            const res = await fetch(
                `/api/users/browse?limit=${LIMIT}&offset=${pageOffset}`,
                { credentials: "include" }
            );
            if (!res.ok) return;
            const json = (await res.json()) as { users?: BrowseStudent[]; hasMore?: boolean };
            const incoming = json.users ?? [];
            if (append) {
                setStudents((prev) => [...prev, ...incoming]);
            } else {
                setStudents(incoming);
            }
            setHasMore(json.hasMore ?? false);
            setOffset(pageOffset + incoming.length);
        } catch {
            /* ignore */
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPage(0, false);
    }, [loadPage]);

    /* ── Name search fetch ────────────────────────────────────────────────── */
    useEffect(() => {
        if (debounced.length < 2) {
            setSearchResults(null);
            return;
        }
        setSearching(true);
        const controller = new AbortController();
        void (async () => {
            try {
                const res = await fetch(
                    `/api/users/search?q=${encodeURIComponent(debounced)}`,
                    { credentials: "include", signal: controller.signal }
                );
                if (!res.ok) return;
                const json = (await res.json()) as {
                    users?: { id: string; displayName: string; fullName: string | null; grade: string | number | null; avatarUrl: string | null; allowFriendRequests: boolean }[];
                };
                if (!controller.signal.aborted) {
                    setSearchResults(
                        (json.users ?? []).map((u) => ({ ...u, mutualCount: 0 }))
                    );
                }
            } catch {
                /* ignore abort */
            } finally {
                if (!controller.signal.aborted) setSearching(false);
            }
        })();
        return () => controller.abort();
    }, [debounced]);

    const isSearching = debounced.length >= 2;
    const displayList = isSearching ? (searchResults ?? []) : students;

    /* ── Skeleton rows ─────────────────────────────────────────────────────── */
    const skeletonRows = (
        <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--base-200)]">
                    <div className="size-11 rounded-full skeleton shrink-0" />
                    <div className="flex-1 flex flex-col gap-1.5">
                        <div className="skeleton h-3.5 w-28 rounded" />
                        <div className="skeleton h-2.5 w-20 rounded" />
                    </div>
                    <div className="skeleton h-8 w-20 rounded-full" />
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col flex-1 min-h-0" style={{ fontFamily: "var(--font-inter)" }}>
            {/* Header */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--base-200)]">
                <button
                    type="button"
                    onClick={onBack}
                    className="size-8 rounded-full flex items-center justify-center text-[var(--base-500)] hover:bg-[var(--base-100)] transition-colors cursor-pointer shrink-0 -ml-1"
                    aria-label="Back to Add Friend"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-[var(--base-800)] truncate">Browse Students</p>
                    <p className="text-[12px] text-[var(--base-400)] leading-tight">Find study partners from your grade</p>
                </div>
            </div>

            {/* Search bar */}
            <div className="shrink-0 px-4 py-3 border-b border-[var(--base-200)]">
                <div className="flex items-center gap-0 rounded-xl border border-[var(--base-200)] overflow-hidden focus-within:border-[var(--primary-400)] focus-within:ring-2 focus-within:ring-[var(--primary-400)]/20 transition-all bg-white">
                    <svg
                        className="w-4 h-4 ml-3 shrink-0 text-[var(--base-400)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                        ref={inputRef}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search students by name…"
                        className="flex-1 px-3 py-2.5 text-[13.5px] text-[var(--base-800)] placeholder:text-[var(--base-400)] outline-none bg-transparent"
                    />
                    {q.length > 0 && (
                        <button
                            type="button"
                            onClick={() => { setQ(""); inputRef.current?.focus(); }}
                            className="mr-2 size-5 rounded-full flex items-center justify-center text-[var(--base-400)] hover:text-[var(--base-600)] hover:bg-[var(--base-100)] transition-colors cursor-pointer shrink-0"
                            aria-label="Clear search"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Loading states */}
                {!isSearching && loading && skeletonRows}
                {isSearching && searching && skeletonRows}

                {/* Empty states */}
                {!isSearching && !loading && students.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
                        <div className="size-14 rounded-2xl bg-[var(--base-100)] flex items-center justify-center">
                            <svg className="w-6 h-6 text-[var(--base-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.48-3.897M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[14px] font-semibold text-[var(--base-700)]">No students found</p>
                            <p className="text-[12px] text-[var(--base-400)] mt-1 max-w-xs">
                                No other Lerno students from your grade yet. Check back soon!
                            </p>
                        </div>
                    </div>
                )}

                {isSearching && !searching && searchResults !== null && searchResults.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-12 px-6 text-center">
                        <div className="size-12 rounded-full bg-[var(--base-100)] flex items-center justify-center">
                            <svg className="w-5 h-5 text-[var(--base-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>
                        <p className="text-[13px] text-[var(--base-500)]">No users found for &ldquo;{debounced}&rdquo;</p>
                    </div>
                )}

                {/* Student list */}
                {((isSearching && !searching && (searchResults?.length ?? 0) > 0) ||
                    (!isSearching && !loading && students.length > 0)) && (
                    <div className="p-4 flex flex-col gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--base-400)] mb-1 px-1">
                            {isSearching ? `Results for "${debounced}"` : "Students from your grade"}
                        </p>
                        {displayList.map((s) => {
                            const initialRelationship = searchResultRelationship(
                                s.id,
                                friendSet,
                                outgoingSet,
                                incomingSet
                            );
                            return (
                                <div
                                    key={s.id}
                                    className="flex items-center gap-3 p-3 rounded-xl border border-[var(--base-200)] bg-white hover:border-[var(--base-300)] hover:bg-[var(--base-50,#fafafa)] transition-colors"
                                >
                                    {/* Clickable avatar → profile */}
                                    <Link
                                        href={`/portal/profile/${s.id}`}
                                        className="size-11 shrink-0 overflow-hidden rounded-full border border-[var(--base-200)] bg-[var(--base-100)] hover:opacity-90 transition-opacity"
                                        tabIndex={-1}
                                        aria-label={`View ${s.displayName}'s profile`}
                                    >
                                        <ProfileAvatar
                                            avatarUrl={s.avatarUrl}
                                            displayName={s.displayName}
                                            fullName={s.fullName}
                                            size={44}
                                            className="!border-0 rounded-none"
                                        />
                                    </Link>

                                    {/* Name + meta */}
                                    <div className="min-w-0 flex-1">
                                        <ProfileHoverCard userId={s.id} displayName={s.displayName}>
                                            <Link
                                                href={`/portal/profile/${s.id}`}
                                                className="text-[14px] font-semibold text-[var(--base-800)] hover:text-[var(--primary-600)] hover:underline underline-offset-2 truncate leading-tight transition-colors"
                                            >
                                                {s.displayName}
                                            </Link>
                                        </ProfileHoverCard>

                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {formatGrade(s.grade) != null && (
                                                <span className="text-[12px] text-[var(--base-400)]">
                                                    {formatGrade(s.grade)}
                                                </span>
                                            )}
                                            {!isSearching && s.mutualCount > 0 && (
                                                <>
                                                    {s.grade != null && (
                                                        <span className="text-[var(--base-300)] text-[10px] leading-none">·</span>
                                                    )}
                                                    <MutualFriendsChip
                                                        targetUserId={s.id}
                                                        count={s.mutualCount}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Add friend button */}
                                    <SendFriendRequestButton
                                        key={`${s.id}-${initialRelationship}`}
                                        targetUserId={s.id}
                                        allowFriendRequests={s.allowFriendRequests}
                                        initialRelationship={initialRelationship}
                                        compact
                                        onSent={onFriendListChanged}
                                    />
                                </div>
                            );
                        })}

                        {!isSearching && hasMore && (
                            <button
                                type="button"
                                onClick={() => void loadPage(offset, true)}
                                disabled={loadingMore}
                                className="self-center mt-2 text-[13px] font-medium text-[var(--primary-500)] hover:text-[var(--primary-600)] py-2 cursor-pointer disabled:opacity-50 transition-colors"
                            >
                                {loadingMore ? "Loading…" : "Show more"}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
