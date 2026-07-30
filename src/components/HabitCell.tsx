"use client";

import { cycle, renderMark } from "@/lib/habit-state";
import type { CellState } from "@/lib/types";

const LABEL: Record<CellState, string> = {
  none: "not logged",
  done: "done",
  missed: "missed",
};

const MARK_COLOR: Record<CellState, string> = {
  done: "var(--type)",
  missed: "var(--miss)",
  none: "var(--type-muted)",
};

export function HabitCell({
  habitId,
  habitName,
  date,
  today,
  state,
  onTick,
}: {
  habitId: string;
  habitName: string;
  date: string;
  today: string;
  state: CellState;
  onTick: (habitId: string, date: string, next: CellState) => void;
}) {
  function handleTap() {
    // Haptic first: it must land instantly, independent of React's render.
    navigator.vibrate?.(10);
    onTick(habitId, date, cycle(state, date, today));
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-label={`${habitName} ${date} ${LABEL[state]}`}
      style={{ minWidth: "44px", minHeight: "44px" }}
      className="flex shrink-0 items-center justify-center select-none
                 text-[13px] leading-none
                 transition-[color,opacity] duration-100
                 motion-reduce:transition-none
                 focus-visible:outline focus-visible:outline-2
                 focus-visible:outline-offset-[-2px]
                 focus-visible:outline-[var(--accent)]"
    >
      <span style={{ color: MARK_COLOR[state] }}>
        {renderMark(state, date, today)}
      </span>
    </button>
  );
}
