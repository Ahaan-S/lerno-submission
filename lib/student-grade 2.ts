import type { User } from "@supabase/supabase-js";

/**
 * Resolves numeric class (9–12) for portal routes.
 * Matches `/portal/learn` home: `profiles.grade` first, then `auth.users.user_metadata.grade`.
 * Without this, `/learn/[subject]` SSR can assume Class 10 when the profile row has no grade yet,
 * which incorrectly blocks Class 11-only subjects (e.g. `business_studies`).
 */
export function resolveStudentGradeNumber(
  profileGrade: number | string | null | undefined,
  user: User | null
): number {
  const metaGrade = (user?.user_metadata as { grade?: number | string } | undefined)?.grade;
  const rawGrade = profileGrade ?? metaGrade ?? 9;
  let grade =
    typeof rawGrade === "string" && rawGrade.startsWith("Class ")
      ? parseInt(rawGrade.replace("Class ", ""), 10)
      : Number(rawGrade);
  if (Number.isNaN(grade) || grade < 1 || grade > 12) grade = 9;
  return grade;
}
