import { chat } from "@/lib/ai/llm";
import { SUBJECT_LABELS } from "@/lib/chapters";
import {
  computeUrgenciesForSuggestion,
  formatPlannerBundleForLlm,
  loadPlannerProgressBundle,
} from "./planner-context";
import type { AiSuggestion } from "./types";

const SUGGESTION_SYSTEM_PROMPT = `You are Lerno's study planner assistant. You help students organize their study schedule based on their actual progress data.

You have access to the student's:
- Chapter completion status across all subjects
- Weak topics identified from quiz results
- Study history from the past 14 days (Learn sessions + completed calendar events)
- Upcoming scheduled calendar blocks

Your role:
- Suggest what to study and when, based on real data
- Keep responses concise and actionable (1-2 sentences max)
- Be specific: mention the subject name and a time recommendation

Do NOT teach NCERT content here. Format suggestions as short, direct recommendations.
Output ONLY a single natural-language suggestion sentence.`;

const cache = new Map<string, { expires: number; value: AiSuggestion }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(userId: string, currentDate: string, subject?: string) {
  return `${userId}:${currentDate}:${subject ?? "__all__"}`;
}

export async function generateAiSuggestion(
  userId: string,
  currentDate: string,
  options?: { subject?: string }
): Promise<AiSuggestion> {
  const focus = options?.subject?.trim().toLowerCase();
  const ck = cacheKey(userId, currentDate, focus);
  const hit = cache.get(ck);
  if (hit && hit.expires > Date.now()) return hit.value;

  const bundle = await loadPlannerProgressBundle(userId);
  if (!bundle) {
    return {
      suggestion: "Start a study session today to keep your momentum going.",
      recommended_subject: focus ?? "science",
      recommended_duration_minutes: 45,
      urgency: "low",
    };
  }

  const urgencies = computeUrgenciesForSuggestion(bundle, focus);
  const sorted = [...urgencies].sort((a, b) => b.urgencyScore - a.urgencyScore);

  if (sorted.length === 0) {
    const out: AiSuggestion = {
      suggestion: "Start your first study session today to build momentum!",
      recommended_subject: focus ?? "science",
      recommended_duration_minutes: 45,
      urgency: "low",
    };
    cache.set(ck, { expires: Date.now() + CACHE_TTL_MS, value: out });
    return out;
  }

  const top = sorted[0];
  const subjectLabel = SUBJECT_LABELS[top.subject] ?? top.subject;

  const urgencyLevel: "low" | "medium" | "high" =
    top.urgencyScore >= 0.65 ? "high" : top.urgencyScore >= 0.35 ? "medium" : "low";

  const recommendedDuration = top.daysSinceStudied > 7 ? 60 : top.weakTopicCount > 3 ? 60 : 45;

  const dataBlock = formatPlannerBundleForLlm(bundle);

  const contextForAI = `
${dataBlock}

Focus for this suggestion: ${focus ? `the student selected "${subjectLabel}" (${focus}).` : "pick the highest-need subject overall."}
Primary candidate: ${subjectLabel}
- Days since last activity in this subject: ${top.daysSinceStudied}
- Weak topic rows (from progress): ${top.weakTopicCount}
- Chapter completion (approx): ${Math.round(top.completionPct * 100)}%
- Urgency score: ${top.urgencyScore.toFixed(2)} (0-1)
- Recommended duration: ${recommendedDuration} minutes

Student local date context: ${currentDate}

Generate ONE short, specific suggestion sentence (1-2 sentences max) for this student.
`.trim();

  let suggestion =
    top.daysSinceStudied > 3
      ? `You haven't studied ${subjectLabel} in ${top.daysSinceStudied} days. A ${recommendedDuration}-minute session now would help.`
      : `Review your ${subjectLabel} progress with a ${recommendedDuration}-minute session today.`;

  try {
    const response = await chat(
      [
        { role: "system", content: SUGGESTION_SYSTEM_PROMPT },
        { role: "user", content: contextForAI },
      ],
      { temperature: 0.6, maxTokens: 120 }
    );
    if (response?.trim()) suggestion = response.trim();
  } catch {
    // fallback to template suggestion
  }

  const out: AiSuggestion = {
    suggestion,
    recommended_subject: top.subject,
    recommended_duration_minutes: recommendedDuration,
    urgency: urgencyLevel,
  };
  cache.set(ck, { expires: Date.now() + CACHE_TTL_MS, value: out });
  return out;
}
