import { db, dirtyEntries, getMeta, setMeta } from "../db/local";
import { mergeEntries } from "./merge";
import type { HabitEntry } from "../types";

const CURSOR = "syncCursor";
const LAST_SYNC = "lastSyncAt";

const BASE_INTERVAL_MS = 5 * 60_000;
const MAX_INTERVAL_MS = 30 * 60_000;

export async function sync(): Promise<{ pushed: number; pulled: number }> {
  const dirty = await dirtyEntries();
  const since = (await getMeta(CURSOR)) ?? null;

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      since,
      rows: dirty.map(({ dirty: _dirty, ...row }) => row),
    }),
  });

  if (!res.ok) throw new Error(`sync failed: ${res.status}`);

  const { rows, serverTime } = (await res.json()) as {
    rows: HabitEntry[];
    serverTime: string;
  };

  await db.transaction("rw", db.habitEntries, db.meta, async () => {
    if (rows.length > 0) {
      const local = await db.habitEntries.toArray();
      for (const merged of mergeEntries(local, rows)) {
        await db.habitEntries.put({ ...merged, dirty: 0 });
      }
    }

    // Anything we just pushed is now on the server.
    for (const d of dirty) {
      await db.habitEntries.update([d.habitId, d.date], { dirty: 0 });
    }

    await setMeta(CURSOR, serverTime);
    await setMeta(LAST_SYNC, serverTime);
  });

  return { pushed: dirty.length, pulled: rows.length };
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
