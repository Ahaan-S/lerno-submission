import type { StudyEvent } from "./types";

export function isExamEvent(event: Pick<StudyEvent, "is_task" | "related_exam">): boolean {
  return event.is_task === false && !!event.related_exam?.trim();
}

