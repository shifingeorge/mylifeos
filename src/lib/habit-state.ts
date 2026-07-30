import { isFuture, type ISODate } from "./date";
import type { CellState } from "./types";

const CYCLE: Record<CellState, CellState> = {
  none: "done",
  done: "missed",
  missed: "none",
};

export function nextState(current: CellState): CellState {
  return CYCLE[current];
}

/**
 * Advance one cell. Past dates behave identically to today, which is what
 * makes backfill an ordinary tap rather than a separate mode — necessary
 * because "slept at 11" can only ever be logged the next morning.
 */
export function cycle(
  current: CellState,
  date: ISODate,
  today: ISODate,
): CellState {
  if (isFuture(date, today)) {
    throw new Error("Cannot tick a future date");
  }
  return nextState(current);
}

/**
 * Four marks from three states plus the date.
 *
 *   ■    done
 *   ✕    explicitly missed
 *   ·    never logged
 *   [ ]  today, untouched — an invitation, not a miss
 */
export function renderMark(
  state: CellState,
  date: ISODate,
  today: ISODate,
): "■" | "✕" | "·" | "[ ]" {
  if (state === "done") return "■";
  if (state === "missed") return "✕";
  return date === today ? "[ ]" : "·";
}
