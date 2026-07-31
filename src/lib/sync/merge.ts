import type { HabitEntry } from "../types";

/**
 * Last-write-wins on `updatedAt`, with the server winning an exact tie.
 *
 * One person cannot edit the same row on two devices in the same second,
 * so conflicts are not a realistic scenario here. CRDTs and sync engines
 * would be solving a problem this app does not have.
 *
 * The key function is what makes this work for every table: entries are
 * identified by habit and date, everything else by id.
 */
export function mergeRows<T extends { updatedAt: string }>(
  local: T[],
  remote: T[],
  key: (row: T) => string,
): T[] {
  const out = new Map<string, T>();

  for (const l of local) out.set(key(l), l);

  for (const r of remote) {
    const existing = out.get(key(r));
    if (!existing || r.updatedAt >= existing.updatedAt) out.set(key(r), r);
  }

  return [...out.values()];
}

export const entryKey = (e: HabitEntry) => `${e.habitId}|${e.date}`;

export const idKey = <T extends { id: string }>(row: T) => row.id;

export function mergeEntries(
  local: HabitEntry[],
  remote: HabitEntry[],
): HabitEntry[] {
  return mergeRows(local, remote, entryKey);
}
