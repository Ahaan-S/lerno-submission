import { SUBJECT_LABELS } from "@/lib/chapters";

/**
 * Generate a session title from the first user message (legacy fallback).
 * Used when TITLE: extraction fails or for cache hits.
 */
export function generateSessionTitle(message: string, taskType: string, _subject: string): string {
  const clean = message
    .replace(/^\/(explain|quiz|notes|solve|summary)\s*/i, "")
    .trim();

  const truncated =
    clean.length > 40 ? clean.substring(0, clean.lastIndexOf(" ", 40)) : clean;

  const prefixes: Record<string, string> = {
    quiz: "Quiz — ",
    notes: "Notes — ",
    solve: "Solve — ",
    summary: "Summary — ",
    explain: "",
  };

  const withPrefix = (prefixes[taskType] ?? "") + truncated;
  return withPrefix.charAt(0).toUpperCase() + withPrefix.slice(1) || "New chat";
}

export interface ChunkForFallback {
  chapter_index?: string;
  chapter_name?: string;
}

/**
 * Fallback title from dominant chapter in retrieved chunks.
 * When no chunks: `${subject} Session`.
 */
export function getFallbackTitle(
  chunks: ChunkForFallback[],
  subject: string
): string {
  if (chunks.length === 0) {
    const label = SUBJECT_LABELS[subject] ?? subject;
    return `${label} Session`;
  }
  const chapterCounts: Record<string, { name: string; count: number }> = {};
  for (const c of chunks) {
    const key = c.chapter_index ?? "unknown";
    const name = c.chapter_name ?? "Unknown Chapter";
    if (!chapterCounts[key]) chapterCounts[key] = { name, count: 0 };
    chapterCounts[key].count++;
  }
  const dominant = Object.values(chapterCounts).sort((a, b) => b.count - a.count)[0];
  const label = SUBJECT_LABELS[subject] ?? subject;
  return dominant?.name ?? `${label} Session`;
}

/** Greeting pattern — skip TITLE instruction, use fallback directly */
const GREETING_PATTERN = /^(hi|hello|hey|hiya|hi there|hey there|hola|sup|yo)\s*[!.]?$/i;

export function isGreeting(message: string): boolean {
  return GREETING_PATTERN.test(message.trim());
}

/**
 * Parse TITLE: from start of AI response. Returns { title, content } or null if not found.
 */
export function parseTitleFromResponse(response: string): { title: string; content: string } | null {
  const firstNewline = response.indexOf("\n");
  if (firstNewline === -1) return null;
  const firstLine = response.slice(0, firstNewline).trim();
  if (!firstLine.startsWith("TITLE:")) return null;
  const title = firstLine.replace(/^TITLE:\s*/i, "").trim();
  if (!title) return null;
  const rest = response.slice(firstNewline + 1).replace(/^\s*\n?/, "");
  return { title, content: rest };
}
