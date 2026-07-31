import type { ISODate } from "./date";

/**
 * Three stored states. `[ ]` — today, untouched — is not one of them: it is
 * `none` rendered on today's date. See `renderMark`.
 */
export type CellState = "none" | "done" | "missed";

export type Tier = "core" | "growing";

export type Priority = "P1" | "P2" | "P3" | "P4";

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: string;
  /** 1 = pending push. Dexie cannot index booleans, so this is not a bool. */
  dirty?: 1 | 0;
}

export interface Habit {
  id: string;
  name: string;
  tier: Tier;
  categoryId: string;
  sortOrder: number;
  /** Soft delete. Dropping a habit must not punch holes in past months. */
  active: boolean;
  updatedAt: string;
  dirty?: 1 | 0;
}

export interface HabitEntry {
  habitId: string;
  /** The day this counts for — not necessarily the day it was tapped. */
  date: ISODate;
  state: CellState;
  /** When the tap actually happened. Reveals reconstruction vs tracking. */
  checkedAt: string;
  updatedAt: string;
  /** 1 = pending push. Dexie cannot index booleans, so this is not a bool. */
  dirty?: 1 | 0;
}
