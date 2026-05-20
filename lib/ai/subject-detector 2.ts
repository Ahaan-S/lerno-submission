export const KNOWN_SUBJECT_SLUGS = new Set([
  "science", "math", "social", "social_history", "social_geography",
  "social_civics", "social_economics", "physics", "chemistry", "economics",
  "business_studies",
]);

/** Returns the valid subject slugs for a given grade (used for auto-detection). */
export function getSubjectsForGrade(grade: number | string): string[] {
  const gradeNum =
    typeof grade === "string" && grade.startsWith("Class ")
      ? Number(grade.replace("Class ", ""))
      : Number(grade);
  return gradeNum === 11
    ? ["physics", "chemistry", "math", "economics", "business_studies"]
    : ["science", "math", "social_history", "social_geography", "social_civics", "social_economics"];
}
