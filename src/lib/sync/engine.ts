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
        const before = new Map(local.map((r) => [r.id, r]));
        for (const row of mergeRows(local, pulled.categories, idKey)) {
          // Same reference means the local row won the merge — leave it
          // exactly as it is, dirty flag included. Rewriting it would clear
          // a pending edit that has not been pushed yet.
          if (before.get(row.id) === row) continue;
          await db.categories.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.habits.length > 0) {
        const local = await db.habits.toArray();
        const before = new Map(local.map((r) => [r.id, r]));
        for (const row of mergeRows(local, pulled.habits, idKey)) {
          if (before.get(row.id) === row) continue;
          await db.habits.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.entries.length > 0) {
        const local = await db.habitEntries.toArray();
        const before = new Map(local.map((r) => [entryKey(r), r]));
        for (const row of mergeRows(local, pulled.entries, entryKey)) {
          if (before.get(entryKey(row)) === row) continue;
          await db.habitEntries.put({ ...row, dirty: 0 });
        }
      }

      // Anything just pushed is now on the server — but only if it is still
      // the exact row we pushed. If the user edited it while the fetch was
      // in flight, `updatedAt` has moved: that edit was never sent, so
      // clearing `dirty` here would mark it synced when it isn't. Leave it
      // dirty so the next sync picks it up.
      for (const c of cats) {
        const current = await db.categories.get(c.id);
        if (current?.updatedAt === c.updatedAt) {
          await db.categories.update(c.id, { dirty: 0 });
        }
      }
      for (const h of habs) {
        const current = await db.habits.get(h.id);
        if (current?.updatedAt === h.updatedAt) {
          await db.habits.update(h.id, { dirty: 0 });
        }
      }
      for (const e of ents) {
        const current = await db.habitEntries.get([e.habitId, e.date]);
        if (current?.updatedAt === e.updatedAt) {
          await db.habitEntries.update([e.habitId, e.date], { dirty: 0 });
        }
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
