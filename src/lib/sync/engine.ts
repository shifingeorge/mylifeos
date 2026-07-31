import {
  db,
  dirtyCategories,
  dirtyEntries,
  dirtyHabits,
  getMeta,
  setMeta,
} from "../db/local";
import { entryKey, idKey, mergeRows } from "./merge";
import type { Category, Habit, HabitEntry } from "../types";

const CURSOR = "syncCursor";
const LAST_SYNC = "lastSyncAt";

const BASE_INTERVAL_MS = 5 * 60_000;
const MAX_INTERVAL_MS = 30 * 60_000;

/** `dirty` is a local bookkeeping flag and has no meaning on the wire. */
function strip<T extends { dirty?: 1 | 0 }>(rows: T[]): Omit<T, "dirty">[] {
  return rows.map(({ dirty: _dirty, ...rest }) => rest);
}

export async function sync(): Promise<{ pushed: number; pulled: number }> {
  const [cats, habs, ents] = await Promise.all([
    dirtyCategories(),
    dirtyHabits(),
    dirtyEntries(),
  ]);
  const since = (await getMeta(CURSOR)) ?? null;

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      since,
      categories: strip(cats),
      habits: strip(habs),
      entries: strip(ents),
    }),
  });

  if (!res.ok) throw new Error(`sync failed: ${res.status}`);

  const pulled = (await res.json()) as {
    serverTime: string;
    categories: Category[];
    habits: Habit[];
    entries: HabitEntry[];
  };

  await db.transaction(
    "rw",
    db.categories,
    db.habits,
    db.habitEntries,
    db.meta,
    async () => {
      if (pulled.categories.length > 0) {
        const local = await db.categories.toArray();
        for (const row of mergeRows(local, pulled.categories, idKey)) {
          await db.categories.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.habits.length > 0) {
        const local = await db.habits.toArray();
        for (const row of mergeRows(local, pulled.habits, idKey)) {
          await db.habits.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.entries.length > 0) {
        const local = await db.habitEntries.toArray();
        for (const row of mergeRows(local, pulled.entries, entryKey)) {
          await db.habitEntries.put({ ...row, dirty: 0 });
        }
      }

      // Anything just pushed is now on the server. This runs after the merge
      // writes above so a row that was dirty at push time and also came back
      // in the pull still ends up clean: the merge put() may have written a
      // stale `dirty` value from the remote copy, and this pass is what
      // guarantees the final state is 0, not whatever the merge left behind.
      for (const c of cats) await db.categories.update(c.id, { dirty: 0 });
      for (const h of habs) await db.habits.update(h.id, { dirty: 0 });
      for (const e of ents) {
        await db.habitEntries.update([e.habitId, e.date], { dirty: 0 });
      }

      await setMeta(CURSOR, pulled.serverTime);
      await setMeta(LAST_SYNC, pulled.serverTime);
    },
  );

  return {
    pushed: cats.length + habs.length + ents.length,
    pulled:
      pulled.categories.length + pulled.habits.length + pulled.entries.length,
  };
}

export async function lastSyncAt(): Promise<string | undefined> {
  return getMeta(LAST_SYNC);
}

/**
 * Runs on open, on focus, on the network returning, and every five minutes
 * while open. Failure is quiet: back off and retry, never block, never show
 * a dialog. The stale-sync warning in the footer is the only visible signal.
 */
export function startSyncLoop(onDone: () => void): () => void {
  let delay = BASE_INTERVAL_MS;
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;

  const run = async () => {
    if (stopped) return;
    try {
      await sync();
      delay = BASE_INTERVAL_MS;
      onDone();
    } catch {
      delay = Math.min(delay * 2, MAX_INTERVAL_MS);
    }
    if (!stopped) timer = setTimeout(run, delay);
  };

  const trigger = () => {
    void run();
  };

  window.addEventListener("focus", trigger);
  window.addEventListener("online", trigger);
  void run();

  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("focus", trigger);
    window.removeEventListener("online", trigger);
  };
}
