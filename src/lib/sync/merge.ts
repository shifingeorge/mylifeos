import type { HabitEntry } from "../types";

const key = (e: HabitEntry) => `${e.habitId}|${e.date}`;

/**
 * Last-write-wins on `updated_at`, with the server winning an exact tie.
 *
 * One person cannot tick the same cell on two devices in the same second,
 * so conflicts are not a realistic scenario here. CRDTs and sync engines
 * would be solving a problem this app does not have.
 */
export function mergeEntries(
  local: HabitEntry[],
  remote: HabitEntry[],
): HabitEntry[] {
  const out = new Map<string, HabitEntry>();

  for (const e of local) out.set(key(e), e);

  for (const r of remote) {
    const existing = out.get(key(r));
    if (!existing || r.updatedAt >= existing.updatedAt) out.set(key(r), r);
  }

  return [...out.values()];
}
