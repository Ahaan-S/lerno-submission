"use client";

import useSWR, { mutate } from "swr";

export interface ProfileMeData {
    user_id: string;
    email: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    grade: unknown;
    selected_subjects: string[] | null;
    notification_preferences: Record<string, boolean> | null;
    bio: string | null;
    profile_privacy: string;
    display_name: string | null;
}

const PROFILE_ME_KEY = "/api/profile/me";

const fetcher = (url: string): Promise<ProfileMeData | null> =>
    fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

/**
 * SWR hook for the current user's profile (/api/profile/me).
 *
 * - Deduplicates concurrent requests (30s window)
 * - Revalidates automatically on window focus (cross-tab freshness)
 * - Revalidates on network reconnect
 *
 * Call `invalidateProfileMe()` after any mutation that touches profiles
 * or social_profiles to push fresh data to all subscribed components
 * instantly — no custom events needed.
 */
export function useProfileMe() {
    return useSWR<ProfileMeData | null>(PROFILE_ME_KEY, fetcher, {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 30_000,
        // Show stale data immediately while revalidating in the background
        revalidateIfStale: true,
    });
}

/**
 * Imperatively invalidate and refetch the profile cache.
 * Call this after any mutation that writes to `profiles` or `social_profiles`.
 */
export function invalidateProfileMe(): Promise<ProfileMeData | null | undefined> {
    return mutate<ProfileMeData | null>(PROFILE_ME_KEY);
}
