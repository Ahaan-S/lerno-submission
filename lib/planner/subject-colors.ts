export const PLANNER_SUBJECT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  // ── Grade 10 ──────────────────────────────────────────────────────────────
  science:          { bg: "#E0F9FF", border: "#67E8F9", text: "#0E7490", dot: "#0891B2" },
  math:             { bg: "#F5F3FF", border: "#C4B5FD", text: "#6D28D9", dot: "#7C3AED" },
  social:           { bg: "#FFFBEB", border: "#FCD34D", text: "#92400E", dot: "#D97706" },
  social_history:   { bg: "#FFF1F2", border: "#FECDD3", text: "#BE123C", dot: "#E11D48" },
  social_geography: { bg: "#ECFDF5", border: "#6EE7B7", text: "#065F46", dot: "#059669" },
  social_civics:    { bg: "#FFF7ED", border: "#FDBA74", text: "#9A3412", dot: "#EA580C" },
  social_economics: { bg: "#F0FDFA", border: "#5EEAD4", text: "#0F766E", dot: "#0D9488" },
  english:          { bg: "#F0FDF4", border: "#86EFAC", text: "#15803D", dot: "#22C55E" },
  hindi:            { bg: "#FDF4FF", border: "#E879F9", text: "#86198F", dot: "#D946EF" },
  french:           { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8", dot: "#3B82F6" },

  // ── Grade 11 (palette reused where domain overlaps) ───────────────────────
  physics:          { bg: "#EEF2FF", border: "#818CF8", text: "#3730A3", dot: "#4338CA" },
  chemistry:        { bg: "#E0F9FF", border: "#67E8F9", text: "#0E7490", dot: "#0891B2" }, // same as science
  biology:          { bg: "#ECFDF5", border: "#6EE7B7", text: "#065F46", dot: "#059669" }, // same as social_geography
  economics:        { bg: "#F0FDFA", border: "#5EEAD4", text: "#0F766E", dot: "#0D9488" }, // same as social_economics
  accountancy:      { bg: "#FEFCE8", border: "#FEF08A", text: "#713F12", dot: "#A16207" },
  business_studies: { bg: "#FFF7ED", border: "#FDBA74", text: "#9A3412", dot: "#C2410C" }, // same as social_civics
  computer_science: { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569", dot: "#64748B" },
};

// No subject → primary blue
export const DEFAULT_SUBJECT_COLOR = {
  bg: "#EBF5FF",
  border: "#93C5FD",
  text: "#005BB5",
  dot: "#0077ED",
};

export function getSubjectColor(subject?: string | null) {
  if (!subject) return DEFAULT_SUBJECT_COLOR;
  return PLANNER_SUBJECT_COLORS[subject.toLowerCase()] ?? DEFAULT_SUBJECT_COLOR;
}

export const SUBJECT_EMOJI: Record<string, string> = {
  science: "🔬",
  math: "📐",
  social: "🌍",
  social_history: "📜",
  social_geography: "🗺️",
  social_civics: "⚖️",
  social_economics: "📊",
  english: "📚",
  hindi: "🇮🇳",
  french: "🇫🇷",
  physics: "⚛️",
  chemistry: "⚗️",
  biology: "🌿",
  economics: "💰",
  accountancy: "🧾",
  business_studies: "💼",
  computer_science: "💻",
};
