import { getSubjectColor } from "@/lib/planner/subject-colors";

/** Solid hex accent for DM share cards — safe inside inline `linear-gradient()` (avoids `var()` in gradients). */
export function dmShareCardAccentHex(subject: string): string {
    return getSubjectColor(subject.toLowerCase()).dot;
}

export const DM_SHARE_GRADIENT_MID = "#1e293b";
export const DM_SHARE_GRADIENT_DEEP = "#0f172a";
