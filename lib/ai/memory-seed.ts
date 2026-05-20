import type { SupabaseClient } from "@supabase/supabase-js";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { normalizeMemorySubjectSlug } from "@/lib/tutor-subject";

interface ProfileForSeed {
  full_name?: string | null;
  first_name?: string | null;
  learning_style?: string[] | null;
  weak_subjects?: string[] | null;
  strong_subjects?: string[] | null;
  topic_strengths?: Record<string, string[]> | null;
  topic_weaknesses?: Record<string, string[]> | null;
  additional_info?: string | null;
}

/**
 * Seeds student_ai_memory from onboarding profile data.
 * Called once per subject on the student's first session on that subject.
 *
 * Creates a memory row with context from onboarding and memory_entries with
 * confidence='onboarding' for each discrete fact (style, goal, self-reported topics).
 *
 * Does NOT set weak_topics or strong_topics — those come from quiz results only.
 * Requires admin/service-role client to bypass RLS on memory_entries.
 */
export async function seedMemoryFromOnboarding(
  userId: string,
  subject: string,
  grade: number | string,
  profile: ProfileForSeed,
  supabase: SupabaseClient
): Promise<void> {
  const memoryKey = normalizeMemorySubjectSlug(subject);
  const subjectLabel = SUBJECT_LABELS[memoryKey] ?? SUBJECT_LABELS[subject] ?? subject;
  const firstName = profile.first_name ?? profile.full_name?.split(" ")[0] ?? "Student";

  console.log("[memory-seed] Seeding memory from onboarding | user:", userId, "| subject:", memoryKey, "| grade:", grade);

  // Build an initial memory summary from onboarding data
  const summaryParts: string[] = [];
  summaryParts.push(`${firstName} is a Class ${grade} student studying ${subjectLabel}.`);

  if (profile.learning_style && profile.learning_style.length > 0) {
    summaryParts.push(`Self-reported learning style: ${profile.learning_style.join(", ")}.`);
  }
  if (profile.weak_subjects?.includes(memoryKey)) {
    summaryParts.push(`Student self-reported ${subjectLabel} as a weak subject.`);
  }
  if (profile.strong_subjects?.includes(memoryKey)) {
    summaryParts.push(`Student self-reported ${subjectLabel} as a strong subject.`);
  }
  if (profile.additional_info) {
    summaryParts.push(`Additional context from student: ${profile.additional_info}`);
  }

  const memorySummary =
    summaryParts.join(" ") +
    " (Seeded from onboarding — AI behavioral observations will develop over sessions.)";

  // Upsert the student_ai_memory row
  const { error: memoryErr } = await supabase.from("student_ai_memory").upsert(
    {
      user_id: userId,
      subject: memoryKey,
      memory_summary: memorySummary,
      weak_topics: [],           // empty — quiz results will populate this
      strong_topics: [],         // empty — quiz results will populate this
      recently_discussed_topics: [],
      common_mistakes: [],
      struggle_patterns: [],
      learning_pace: "medium",
      preferred_style: profile.learning_style?.[0] ?? "explanation",
      chapters_visited: [],
      total_sessions: 0,
      total_messages: 0,
      onboarding_seeded: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,subject" }
  );

  if (memoryErr) {
    console.error("[memory-seed] Failed to upsert student_ai_memory:", memoryErr.message);
    return; // do not crash the chat request
  }

  console.log("[memory-seed] student_ai_memory upserted for user:", userId, "| subject:", memoryKey);

  // Seed the global row with behavioral defaults from onboarding.
  // ignoreDuplicates: true — never overwrite if global row already exists from a previous subject.
  const { error: globalErr } = await supabase.from("student_ai_memory").upsert(
    {
      user_id:         userId,
      subject:         "__global__",
      memory_summary:  `${firstName} is a Class ${grade} student. Self-reported learning style: ${profile.learning_style?.join(", ") ?? "not specified"}. (Seeded from onboarding — AI observations will develop over sessions.)`,
      learning_pace:   "medium",
      preferred_style: profile.learning_style?.[0] ?? "explanation",
      weak_topics:               [],
      strong_topics:             [],
      recently_discussed_topics: [],
      common_mistakes:           [],
      struggle_patterns:         [],
      chapters_visited:          [],
      total_sessions:  0,
      total_messages:  0,
      onboarding_seeded: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,subject", ignoreDuplicates: true }
  );

  if (globalErr) {
    console.warn("[memory-seed] Failed to upsert global memory row (non-fatal):", globalErr.message);
  } else {
    console.log("[memory-seed] Global memory row seeded for user:", userId);
  }

  // Build discrete memory_entries for the onboarding facts
  const entries: Array<{
    user_id: string;
    subject: string;
    entry_type: string;
    content: string;
    confidence: string;
    source: string;
  }> = [];

  if (profile.learning_style && profile.learning_style.length > 0) {
    entries.push({
      user_id: userId,
      subject: "global",
      entry_type: "style_preference",
      content: `Self-reported learning style: ${profile.learning_style.join(", ")}`,
      confidence: "onboarding",
      source: "onboarding",
    });
  }

  if (profile.additional_info) {
    entries.push({
      user_id: userId,
      subject: "global",
      entry_type: "onboarding_fact",
      content: `Additional info: ${profile.additional_info}`,
      confidence: "onboarding",
      source: "onboarding",
    });
  }

  // Self-reported weak topics for this subject
  const subjectWeakTopics =
    profile.topic_weaknesses?.[memoryKey] ??
    profile.topic_weaknesses?.[subject] ??
    profile.topic_weaknesses?.[subjectLabel] ??
    [];
  for (const topic of subjectWeakTopics) {
    entries.push({
      user_id: userId,
      subject: memoryKey,
      entry_type: "onboarding_fact",
      content: `Self-reported weak topic: ${topic}`,
      confidence: "onboarding",
      source: "onboarding",
    });
  }

  // Self-reported strong topics for this subject
  const subjectStrongTopics =
    profile.topic_strengths?.[memoryKey] ??
    profile.topic_strengths?.[subject] ??
    profile.topic_strengths?.[subjectLabel] ??
    [];
  for (const topic of subjectStrongTopics) {
    entries.push({
      user_id: userId,
      subject: memoryKey,
      entry_type: "onboarding_fact",
      content: `Self-reported strong topic: ${topic}`,
      confidence: "onboarding",
      source: "onboarding",
    });
  }

  if (entries.length > 0) {
    const { error: entriesErr } = await supabase.from("memory_entries").insert(entries);
    if (entriesErr) {
      // Non-fatal — memory_entries are observability/log, not critical path
      console.warn("[memory-seed] Failed to insert memory_entries (non-fatal):", entriesErr.message);
    } else {
      console.log("[memory-seed] Inserted", entries.length, "memory_entries for user:", userId);
    }
  }
}
