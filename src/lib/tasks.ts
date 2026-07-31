import { addDays, daysBetween, formatHeader, todayIST, type ISODate } from "./date";
import type { Priority, Task } from "./types";

const RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

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

    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? -1 : 1;
    }

    // Seeded or bulk-created tasks can share a createdAt millisecond. Without
    // this, the comparator returns non-zero for both (a,b) and (b,a) on a
    // full tie, which breaks the antisymmetry Array#sort relies on and
    // yields engine-dependent order. id is unique, so this is always total.
    return a.id.localeCompare(b.id);
  });
}

/** Whole days past the due date, or 0 if it is not past. */
export function overdueDays(due: ISODate | null, today: ISODate): number {
  if (!due || due >= today) return 0;
  return daysBetween(due, today);
}

/**
 * Count of tasks completed on the given IST calendar date.
 *
 * `completedAt` is a raw UTC ISO timestamp, not an IST date string, so it is
 * NOT safe to compare with `date` via `completedAt.slice(0, 10)` — that
 * slices the UTC calendar day, and UTC is 5h30m behind IST. A task ticked at
 * 02:00 IST is still 20:30 the previous UTC day, so the naive slice would
 * miss it on the very night it was completed. `todayIST` is the one place
 * the IST shift is applied (see date.ts's header); route completedAt through
 * it before comparing, same as `date` already has been.
 */
export function doneOnDate(tasks: Task[], date: ISODate): number {
  return tasks.filter(
    (t) => t.done && t.completedAt && todayIST(new Date(t.completedAt)) === date,
  ).length;
}

/** `'TODAY'`, `'TOMORROW'`, or `'WED 05 AUG'`. */
export function formatDue(due: ISODate | null, today: ISODate): string {
  if (!due) return "";
  if (due === today) return "TODAY";
  if (due === addDays(today, 1)) return "TOMORROW";
  return formatHeader(due);
}
