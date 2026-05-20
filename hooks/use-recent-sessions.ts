"use client";

import useSWRInfinite from "swr/infinite";
import { mutate as globalMutate } from "swr";

export type RecentSession = {
    id: string;
    subject: string;
    title: string | null;
    starred: boolean;
    created_at: string;
    last_message_at: string;
    mode?: string;
};

type SessionsPage = { sessions: RecentSession[]; hasMore: boolean };

const PAGE_SIZE = 20;

function sessionKey(mode: "ask" | "learn", pageIndex: number): [string, string, number] {
    return ["/api/tutor/sessions", mode, pageIndex];
}

function sessionFetcher([, mode, page]: [string, string, number]): Promise<SessionsPage> {
    const offset = page * PAGE_SIZE;
    return fetch(
        `/api/tutor/sessions?limit=${PAGE_SIZE}&offset=${offset}&mode=${mode}`,
        { credentials: "include" }
    ).then((r) => (r.ok ? r.json() : { sessions: [], hasMore: false }));
}

/**
 * SWR-backed hook for the sidebar recent sessions list.
 *
 * Replaces the module-level `recentsCache` + manual `fetch` pattern in
 * DashboardShell. Benefits:
 * - Automatic deduplication (10 s window)
 * - revalidateOnFocus: true — session list refreshes when the user returns
 *   to the tab (no stale sidebar across tabs)
 * - Pagination via `loadMore()`
 * - `invalidate()` for instant refresh after create / rename / star / delete
 */
export function useRecentSessions(mode: "ask" | "learn") {
    const { data, isLoading, isValidating, size, setSize, mutate } =
        useSWRInfinite<SessionsPage>(
            (pageIndex) => sessionKey(mode, pageIndex),
            sessionFetcher,
            {
                revalidateOnFocus: true,
                revalidateOnReconnect: true,
                dedupingInterval: 10_000,
                // Refresh only the first page on focus so large lists don't spam the API.
                revalidateFirstPage: true,
            }
        );

    const sessions: RecentSession[] = (data ?? []).flatMap((page) => page.sessions);
    const lastPage = data?.[data.length - 1];
    const hasMore = lastPage?.hasMore ?? false;
    const loaded = !isLoading && data != null;
    const loadingMore = isValidating && size > 1;

    const loadMore = () => {
        if (!hasMore || loadingMore) return;
        void setSize((s) => s + 1);
    };

    const invalidate = () => void mutate();

    return { sessions, loaded, hasMore, loadingMore, loadMore, invalidate };
}

/**
 * Imperatively invalidate the sessions cache for a given mode.
 * Call this after any mutation that creates, renames, stars, or deletes a session.
 */
export function invalidateRecentSessions(mode: "ask" | "learn"): void {
    // Invalidate all pages by matching the key prefix.
    void globalMutate<SessionsPage>(
        (key: unknown) => Array.isArray(key) && key[0] === "/api/tutor/sessions" && key[1] === mode,
        undefined,
        { revalidate: true }
    );
}
