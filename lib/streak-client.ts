/**
 * Shared streak fetch cache + post-activity refresh / celebration dispatch.
 */

import { mutate } from "swr";

export type WeekDay = {
  date: string;
  label: string;
  active: boolean;
  /** When true, this slot is “today” in the same calendar system as the API. */
  is_today?: boolean;
};

export type StreakData = {
  streak: number;
  week: WeekDay[];
  today: string;
};

let cachedData: StreakData | null = null;
let fetchPromise: Promise<StreakData> | null = null;

function normalizeWeek(week: unknown, todayKey: string): WeekDay[] {
  if (!Array.isArray(week)) return [];
  return week.map((raw) => {
    const w = raw as Record<string, unknown>;
    const date = typeof w.date === "string" ? w.date : "";
    const label = typeof w.label === "string" ? w.label : "";
    const active = Boolean(w.active);
    const explicit = w.is_today;
    const is_today =
      explicit === true ? true : explicit === false ? false : Boolean(todayKey && date === todayKey);
    return { date, label, active, is_today };
  });
}

export function normalizeStreakApi(data: unknown): StreakData {
  const d = (data ?? {}) as Record<string, unknown>;
  const today = typeof d.today === "string" ? d.today : "";
  return {
    streak: typeof d.streak === "number" && Number.isFinite(d.streak) ? d.streak : 0,
    week: normalizeWeek(d.week, today),
    today,
  };
}

export function getStreakData(): Promise<StreakData> {
  if (cachedData) return Promise.resolve(cachedData);
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/streak", { credentials: "include" })
    .then((r) => (r.ok ? r.json() : { streak: 0, week: [], today: "" }))
    .then((data) => {
      cachedData = normalizeStreakApi(data);
      fetchPromise = null;
      return cachedData;
    })
    .catch(() => {
      cachedData = { streak: 0, week: [], today: "" };
      fetchPromise = null;
      return cachedData;
    });
  return fetchPromise;
}

export function invalidateStreakCache(): void {
  cachedData = null;
  fetchPromise = null;
}

export const STREAK_DATA_EVENT = "lerno:streak-data";
export const STREAK_CELEBRATION_EVENT = "lerno:streak-celebration";

export type StreakDataEventDetail = { fresh: StreakData };

export type StreakCelebrationDetail = {
  previousStreak: number;
  newStreak: number;
  week: WeekDay[];
  today: string;
};

function weekTodayActive(week: WeekDay[], todayKey: string): boolean {
  if (!todayKey) return false;
  const row = week.find((w) => w.date === todayKey);
  return Boolean(row?.active);
}

/**
 * Call after tutor chat completes or a study attempt is logged.
 * Refetches streak via SWR invalidation (so all subscribers update automatically),
 * and may fire the global celebration event when today first becomes active and
 * the streak count increases.
 *
 * The celebration event is intentionally kept as a custom event — it's a one-shot
 * imperative side effect with old vs new streak comparison logic that doesn't belong
 * inside a React render cycle.
 */
export async function refreshStreakAfterActivity(): Promise<void> {
  const prior = cachedData;

  // Invalidate both the SWR cache (covers useStreak consumers across tabs) and the
  // legacy module-level cache (still used by getStreakData fallback callers).
  invalidateStreakCache();

  let fresh: StreakData;
  try {
    const r = await fetch("/api/streak", { credentials: "include" });
    fresh = normalizeStreakApi(r.ok ? await r.json() : {});
  } catch {
    fresh = { streak: 0, week: [], today: "" };
  }
  // Update module-level cache so legacy callers still work.
  cachedData = fresh;
  fetchPromise = null;

  // Push the fresh data into the SWR cache so all useStreak() subscribers
  // update immediately without each component re-fetching.
  void mutate<StreakData>("/api/streak", fresh, { revalidate: false });

  if (!fresh.today) return;

  const effPrior = prior ?? { streak: 0, week: [], today: fresh.today };
  const wasTodayActive = weekTodayActive(effPrior.week, effPrior.today || fresh.today);
  const nowTodayActive = weekTodayActive(fresh.week, fresh.today);

  if (fresh.streak > effPrior.streak && nowTodayActive && !wasTodayActive) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<StreakCelebrationDetail>(STREAK_CELEBRATION_EVENT, {
          detail: {
            previousStreak: effPrior.streak,
            newStreak: fresh.streak,
            week: fresh.week,
            today: fresh.today,
          },
        }),
      );
    }
  }
}
