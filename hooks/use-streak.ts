"use client";

import useSWR, { mutate } from "swr";
import type { StreakData } from "@/lib/streak-client";
import { normalizeStreakApi } from "@/lib/streak-client";

export const STREAK_KEY = "/api/streak";

function fetcher(url: string): Promise<StreakData> {
    return fetch(url, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { streak: 0, week: [], today: "" }))
        .then(normalizeStreakApi)
        .catch(() => ({ streak: 0, week: [], today: "" } as StreakData));
}

/**
 * SWR-backed streak hook.
 *
 * Replaces `getStreakData()` + `addEventListener(STREAK_DATA_EVENT)`.
 * Benefits:
 * - revalidateOnFocus: stays accurate across tabs without custom events
 * - dedupingInterval: multiple components share one request window
 * - `invalidateStreak()` triggers revalidation in all subscribers at once
 */
export function useStreak() {
    return useSWR<StreakData>(STREAK_KEY, fetcher, {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 30_000,
        revalidateIfStale: true,
    });
}

/**
 * Imperatively invalidate the streak SWR cache.
 * Call after any activity that may change the streak (chat send, study attempt).
 */
export function invalidateStreak(): Promise<StreakData | null | undefined> {
    return mutate<StreakData>(STREAK_KEY);
}
