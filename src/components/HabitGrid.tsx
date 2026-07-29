"use client";

import { formatColumn } from "@/lib/date";
import type { Category, CellState, Habit, HabitEntry } from "@/lib/types";
import { HabitCell } from "./HabitCell";

/**
 * One shared template so the name column and every day column line up down
 * the whole grid. A ledger that does not align is not a ledger.
 */
const COLUMNS = (dayCount: number) =>
  `minmax(0, 1fr) repeat(${dayCount}, 44px)`;

export function HabitGrid({
  categories,
  habits,
  entries,
  dates,
  today,
  onTick,
}: {
  categories: Category[];
  habits: Habit[];
  entries: HabitEntry[];
  dates: string[];
  today: string;
  onTick: (habitId: string, date: string, next: CellState) => void;
}) {
  const stateOf = (habitId: string, date: string): CellState =>
    entries.find((e) => e.habitId === habitId && e.date === date)?.state ??
    "none";

  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const template = COLUMNS(dates.length);

  return (
    <div className="px-3">
      {/* Column heads. Today is the only accent on the screen. */}
      <div
        className="grid items-end pb-1"
        style={{ gridTemplateColumns: template }}
      >
        <span />
        {dates.map((d) => {
          const { dow, dom } = formatColumn(d);
          const isToday = d === today;
          return (
            <div
              key={d}
              className="text-center text-[10px] leading-tight"
              style={{
                color: isToday ? "var(--accent)" : "var(--type-muted)",
              }}
            >
              <div>{dow}</div>
              <div>{dom}</div>
            </div>
          );
        })}
      </div>

      {ordered.map((cat) => {
        const rows = habits
          .filter((h) => h.active && h.categoryId === cat.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        if (rows.length === 0) return null;

        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
            <h2
              id={`cat-${cat.id}`}
              className="pt-2 pb-1 text-[10px] tracking-[0.18em]"
              style={{
                color: "var(--type-muted)",
                borderTop: "1px solid var(--rule)",
              }}
            >
              {cat.name}
            </h2>

            {rows.map((habit) => (
              <div
                key={habit.id}
                className="grid items-center"
                style={{ gridTemplateColumns: template }}
              >
                <div className="flex min-w-0 items-center gap-1 pr-2">
                  {/* Core marker. Growing habits keep the indent so names align. */}
                  <span
                    aria-hidden="true"
                    className="w-2 shrink-0 text-[11px]"
                    style={{ color: "var(--accent)" }}
                  >
                    {habit.tier === "core" ? "•" : ""}
                  </span>
                  <span className="truncate text-[11px] tracking-[0.04em]">
                    {habit.name}
                  </span>
                </div>

                {dates.map((date) => (
                  <HabitCell
                    key={date}
                    habitId={habit.id}
                    habitName={habit.name}
                    date={date}
                    today={today}
                    state={stateOf(habit.id, date)}
                    onTick={onTick}
                  />
                ))}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
