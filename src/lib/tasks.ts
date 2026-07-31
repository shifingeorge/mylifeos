import { formatHeader, type ISODate } from "./date";
import type { Priority, Task } from "./types";

const RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

const DAY_MS = 86_400_000;

/**
 * Priority, then due date, then creation order. Undated tasks sit last within
 * their priority band — never below a lower priority, because "no date" is not
 * "less important".
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const byPriority = RANK[a.priority] - RANK[b.priority];
    if (byPriority !== 0) return byPriority;

    if (a.due !== b.due) {
      if (a.due === null) return 1;
      if (b.due === null) return -1;
      return a.due < b.due ? -1 : 1;
    }

    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

/** Whole days past the due date, or 0 if it is not past. */
export function overdueDays(due: ISODate | null, today: ISODate): number {
  if (!due || due >= today) return 0;
  return Math.round((Date.parse(today) - Date.parse(due)) / DAY_MS);
}

/** `'TODAY'`, `'TOMORROW'`, or `'WED 05 AUG'`. */
export function formatDue(due: ISODate | null, today: ISODate): string {
  if (!due) return "";
  if (due === today) return "TODAY";
  const tomorrow = new Date(Date.parse(today) + DAY_MS)
    .toISOString()
    .slice(0, 10);
  if (due === tomorrow) return "TOMORROW";
  return formatHeader(due);
}
