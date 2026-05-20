import { getSubjectColor } from "@/lib/planner/subject-colors";

/**
 * Maps tutor subject slugs to `app/globals.css` custom properties so profile, search,
 * and analytics stay aligned with the design tokens.
 */
const TUTOR_SUBJECT_CSS_VARS: Record<string, string> = {
  science: "--science",
  math: "--math",
  social: "--social",
  social_history: "--social-history",
  social_geography: "--social-geography",
  social_civics: "--social-civics",
  social_economics: "--social-economics",
  physics: "--physics",
  chemistry: "--chemistry",
  economics: "--economics",
  biology: "--biology",
  hindi: "--hindi",
  english: "--english",
  french: "--french",
  accountancy: "--accountancy",
  business_studies: "--business-studies",
  computer_science: "--computer-science",
};

export function getTutorSubjectDotColor(tutorSlug: string): string {
  const s = tutorSlug.toLowerCase();
  const key = TUTOR_SUBJECT_CSS_VARS[s];
  if (key) return `var(${key})`;
  return getSubjectColor(s).dot;
}
