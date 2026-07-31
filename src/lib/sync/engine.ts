import {
  db,
  dirtyCategories,
  dirtyEntries,
  dirtyHabits,
  dirtyProjects,
  dirtyTasks,
  getMeta,
  setMeta,
} from "../db/local";
import { entryKey, idKey, mergeRows } from "./merge";
import type { Category, Habit, HabitEntry, Project, Task } from "../types";

const CURSOR = "syncCursor";
const LAST_SYNC = "lastSyncAt";

const BASE_INTERVAL_MS = 5 * 60_000;
const MAX_INTERVAL_MS = 30 * 60_000;

/** `dirty` is a local bookkeeping flag and has no meaning on the wire. */
function strip<T extends { dirty?: 1 | 0 }>(rows: T[]): Omit<T, "dirty">[] {
  return rows.map(({ dirty: _dirty, ...rest }) => rest);
}

type Local = { updatedAt: string; dirty?: 1 | 0 };

/**
 * True when the row sitting in Dexie right now is carrying an edit this
 * request did not send, and so must not be written over.
 *
 * Two cases, one test. The row is dirty and either it was never in the push
 * at all (`pushed` undefined — created after the snapshot was taken), or it
 * was pushed and has since moved (`updatedAt` differs — the user edited it
 * while the fetch was in flight). Either way the server has never seen the
 * value on screen, so overwriting it would lose the edit AND clear `dirty`,
 * which is the difference between "syncs a moment later" and "gone".
 *
 * The row-identity check this replaces only caught the case where the LOCAL
 * row won the merge. It could not catch the common one: the server stamps
 * every pushed row with its own time and the pull in the same request hands
 * it straight back, so the echo carries a later `updatedAt` than the tap
 * that produced it whenever the phone's clock trails the server's — the
 * echo wins, and the merge loop was writing it over the correction.
 */
function hasUnsentEdit(local: Local | undefined, pushed: Local | undefined) {
  return local?.dirty === 1 && local.updatedAt !== pushed?.updatedAt;
}

function byKey<T>(rows: T[], key: (row: T) => string): Map<string, T> {
  return new Map(rows.map((r) => [key(r), r]));
}

export async function sync(): Promise<{ pushed: number; pulled: number }> {
  const [cats, habs, ents, projs, tsks] = await Promise.all([
    dirtyCategories(),
    dirtyHabits(),
    dirtyEntries(),
    dirtyProjects(),
    dirtyTasks(),
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
      projects: strip(projs),
      tasks: strip(tsks),
    }),
  });

  if (!res.ok) throw new Error(`sync failed: ${res.status}`);

  const pulled = (await res.json()) as {
    serverTime: string;
    categories: Category[];
    habits: Habit[];
    entries: HabitEntry[];
    projects: Project[];
    tasks: Task[];
  };

  await db.transaction(
    "rw",
    [db.categories, db.habits, db.habitEntries, db.projects, db.tasks, db.meta],
    async () => {
      // Each merge loop writes the winner of last-write-wins back to Dexie
      // and clears `dirty`, because a row the server just handed back is by
      // definition on the server. Two rows are skipped instead: one holding
      // a local edit this request never carried (`hasUnsentEdit` — left
      // exactly as it is, dirty flag included, for the next sync to push),
      // and one the merge did not change at all (see the fast path below).
      if (pulled.categories.length > 0) {
        const local = await db.categories.toArray();
        const before = byKey(local, idKey);
        const sent = byKey(cats, idKey);
        for (const row of mergeRows(local, pulled.categories, idKey)) {
          if (hasUnsentEdit(before.get(row.id), sent.get(row.id))) continue;
          // Fast path: the same object reference means the merge changed
          // nothing, so the put would write back what is already there. It
          // has to be skipped, not merely allowed — the pull is non-empty on
          // essentially every sync (the server echoes the row you just
          // pushed), so without this every clean row in the table is
          // rewritten each time, and habitEntries grows at ~15 rows a day
          // forever. Must come after the unsent-edit guard: a dirty row can
          // also merge to itself, and skipping it here would be the right
          // action for the wrong reason.
          if (before.get(row.id) === row && row.dirty === 0) continue;
          await db.categories.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.habits.length > 0) {
        const local = await db.habits.toArray();
        const before = byKey(local, idKey);
        const sent = byKey(habs, idKey);
        for (const row of mergeRows(local, pulled.habits, idKey)) {
          if (hasUnsentEdit(before.get(row.id), sent.get(row.id))) continue;
          if (before.get(row.id) === row && row.dirty === 0) continue;
          await db.habits.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.entries.length > 0) {
        const local = await db.habitEntries.toArray();
        const before = byKey(local, entryKey);
        const sent = byKey(ents, entryKey);
        for (const row of mergeRows(local, pulled.entries, entryKey)) {
          const k = entryKey(row);
          if (hasUnsentEdit(before.get(k), sent.get(k))) continue;
          if (before.get(k) === row && row.dirty === 0) continue;
          await db.habitEntries.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.projects.length > 0) {
        const local = await db.projects.toArray();
        const before = byKey(local, idKey);
        const sent = byKey(projs, idKey);
        for (const row of mergeRows(local, pulled.projects, idKey)) {
          if (hasUnsentEdit(before.get(row.id), sent.get(row.id))) continue;
          if (before.get(row.id) === row && row.dirty === 0) continue;
          await db.projects.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.tasks.length > 0) {
        const local = await db.tasks.toArray();
        const before = byKey(local, idKey);
        const sent = byKey(tsks, idKey);
        for (const row of mergeRows(local, pulled.tasks, idKey)) {
          if (hasUnsentEdit(before.get(row.id), sent.get(row.id))) continue;
          if (before.get(row.id) === row && row.dirty === 0) continue;
          await db.tasks.put({ ...row, dirty: 0 });
        }
      }

      // Fallback, not the main path. A pushed row normally comes straight
      // back in the same response — the pull uses `updatedAt > cursor` and
      // the push just stamped it — so the merge loop above has already
      // cleared its `dirty` flag by the time we get here. This loop exists
      // for the rows that did NOT come back: the server can accept a row and
      // return nothing for it (an empty table short-circuits the loop above
      // entirely), and without this they would stay dirty forever and be
      // re-pushed on every sync. The `updatedAt` check is the same guard as
      // `hasUnsentEdit` in its unpushed-edit form: if the row has moved since
      // the snapshot, the edit on screen was never sent — leave it dirty.
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
      for (const p of projs) {
        const current = await db.projects.get(p.id);
        if (current?.updatedAt === p.updatedAt) {
          await db.projects.update(p.id, { dirty: 0 });
        }
      }
      for (const t of tsks) {
        const current = await db.tasks.get(t.id);
        if (current?.updatedAt === t.updatedAt) {
          await db.tasks.update(t.id, { dirty: 0 });
        }
      }

      await setMeta(CURSOR, pulled.serverTime);
      await setMeta(LAST_SYNC, pulled.serverTime);
    },
  );

  return {
    pushed: cats.length + habs.length + ents.length + projs.length + tsks.length,
    pulled:
      pulled.categories.length +
      pulled.habits.length +
      pulled.entries.length +
      pulled.projects.length +
      pulled.tasks.length,
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
