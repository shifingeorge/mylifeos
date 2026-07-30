import { daysElapsedInMonth, type ISODate } from "./date";
import type { Category, Habit, HabitEntry } from "./types";

export interface DayScore {
  coreDone: number;
  coreTotal: number;
  /** Counted, but never in the denominator. Ambitions must not drag the number down. */
  growingDone: number;
}

export interface CategoryScore {
  categoryId: string;
  name: string;
  done: number;
  possible: number;
}

export function dayScore(
  habits: Habit[],
  entries: HabitEntry[],
  date: ISODate,
): DayScore {
  const active = habits.filter((h) => h.active);
  const doneIds = new Set(
    entries
      .filter((e) => e.date === date && e.state === "done")
      .map((e) => e.habitId),
  );

  return {
    coreDone: active.filter((h) => h.tier === "core" && doneIds.has(h.id)).length,
    coreTotal: active.filter((h) => h.tier === "core").length,
    growingDone: active.filter(
      (h) => h.tier === "growing" && doneIds.has(h.id),
    ).length,
  };
}

/** `'CORE 4/6 · +1'`. Always shows the growing count so the layout is stable. */
export function formatDayScore(s: DayScore): string {
  return `CORE ${s.coreDone}/${s.coreTotal} · +${s.growingDone}`;
}

/**
 * Per-category totals for the month view — the thing categories actually buy,
 * and something the spreadsheet was never able to say.
 *
 * The denominator grows with the month (`habits × days elapsed`), so the ratio
 * reads honestly on the 2nd instead of looking like failure.
 */
export function monthScores(
  habits: Habit[],
  entries: HabitEntry[],
  categories: Category[],
  today: ISODate,
): CategoryScore[] {
  const active = habits.filter((h) => h.active);
  const elapsed = daysElapsedInMonth(today);
  const monthPrefix = today.slice(0, 7); // 'YYYY-MM'

  const doneInMonth = entries.filter(
    (e) => e.state === "done" && e.date.startsWith(monthPrefix),
  );

  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => {
      const ids = new Set(
        active.filter((h) => h.categoryId === c.id).map((h) => h.id),
      );
      return {
        categoryId: c.id,
        name: c.name,
        done: doneInMonth.filter((e) => ids.has(e.habitId)).length,
        possible: ids.size * elapsed,
      };
    });
}
