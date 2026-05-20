import type { TutorTaskType } from "@/lib/database.types";

/**
 * Heuristic task detection when the client did not send `task_type`.
 * Must stay in sync with `app/api/tutor/chat/route.ts` (legacy path).
 * Notes/summary should use `/api/tutor/generate-doc` — never hybrid RAG chat.
 */
export function detectAskTaskTypeFromMessage(message: string): TutorTaskType {
  const m = message.toLowerCase();
  if (m.startsWith("/quiz") || m.includes("quiz me") || m.includes("test me")) return "quiz";
  if (
    m.startsWith("/notes") ||
    m.includes("make notes") ||
    m.includes("give me notes") ||
    m.includes("generate notes") ||
    m.includes("revision notes")
  )
    return "notes";
  if (m.startsWith("/solve") || m.includes("solve this") || m.includes("calculate")) return "solve";
  if (m.startsWith("/summary") || m.includes("summarise") || m.includes("summarize")) return "summary";
  return "explain";
}
