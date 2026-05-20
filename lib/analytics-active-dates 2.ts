/** Shared with GET /api/analytics/summary and public profile APIs — keep streak parity. */

export function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function isoDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Streak: consecutive UTC calendar days ending today where the user had qualifying activity. */
export function currentStreakFromDates(activeDates: Set<string>, todayKey: string): number {
  let streak = 0;
  const start = new Date(`${todayKey}T12:00:00.000Z`);
  for (let i = 0; i < 120; i++) {
    const key = start.toISOString().slice(0, 10);
    if (activeDates.has(key)) {
      streak += 1;
      start.setUTCDate(start.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

type DailyRow = { activity_date: string; questions_answered?: number | null };
type AttemptRow = { attempted_at: string | null };

/**
 * Merge active study dates the same way as analytics/summary:
 * days with questions_answered > 0 in daily rollup, plus UTC dates from attempts in the window.
 */
export function mergeActiveStudyDatesFromRows(
  dailyRows: DailyRow[],
  attemptRows: AttemptRow[],
  isoDateFromAttemptedAt: (iso: string) => string = isoDateKey
): Set<string> {
  const activeDates = new Set<string>();
  for (const row of dailyRows) {
    const q = row.questions_answered ?? 0;
    if (q > 0) activeDates.add(row.activity_date);
  }
  for (const row of attemptRows) {
    const at = row.attempted_at;
    if (at) activeDates.add(isoDateFromAttemptedAt(at));
  }
  return activeDates;
}
