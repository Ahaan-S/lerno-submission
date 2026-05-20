import type { StudyEvent } from "./types";

/** Study-event rows treat missing/undefined `is_task` as true (legacy clients). */
export function isPlannerTask(event: Pick<StudyEvent, "is_task">): boolean {
  return event.is_task !== false;
}
