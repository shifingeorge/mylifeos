// Must come first: it installs the in-memory `indexedDB` global that Dexie
// binds to when `@/lib/db/local` opens the database below.
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, getMeta, setMeta } from "@/lib/db/local";
import { sync } from "@/lib/sync/engine";
import type { Task } from "@/lib/types";

/**
 * The engine's invariants used to live only in comments, and a comment
 * cannot fail a build. These are the round trips that matter: what happens
 * to a row that is edited while its own push is in flight, what happens to
 * one that isn't, and what happens when the request never lands at all.
 */

const T0 = "2026-07-31T10:00:00.000Z";
/** Later than T0 — the server stamps everything it accepts. */
const SERVER_TIME = "2026-07-31T10:00:01.000Z";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "ORIGINAL",
  priority: "P2",
  projectId: null,
  due: null,
  done: false,
  completedAt: null,
  createdAt: T0,
  updatedAt: T0,
  ...over,
});

/** The shape `/api/sync` returns. Everything not named comes back empty. */
function response(over: Partial<Record<string, unknown>> = {}) {
  return {
    ok: true,
    json: async () => ({
      serverTime: SERVER_TIME,
      categories: [],
      habits: [],
      entries: [],
      projects: [],
      tasks: [],
      ...over,
    }),
  };
}

/** Strips the local-only bookkeeping flag, the way the wire format does. */
function echoed(t: Task, updatedAt: string) {
  const { dirty: _dirty, ...rest } = t;
  return { ...rest, updatedAt };
}

beforeEach(async () => {
  await db.open();
  await Promise.all([
    db.categories.clear(),
    db.habits.clear(),
    db.habitEntries.clear(),
    db.projects.clear(),
    db.tasks.clear(),
    db.meta.clear(),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sync", () => {
  it("keeps a mid-flight edit and leaves the row dirty", async () => {
    // The failure this test exists for: tick, sync starts, tap again 150ms
    // later while the request is still open. The server echoes the pushed
    // row back with its own (later) stamp, so the echo wins the merge — and
    // the correction, which was never sent, must not be overwritten by it.
    const pushed = task({ dirty: 1 });
    await db.tasks.put(pushed);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        // The user's second tap, while the request is in flight.
        await db.tasks.put({
          ...pushed,
          title: "CORRECTED",
          updatedAt: "2026-07-31T10:00:00.150Z",
          dirty: 1,
        });
        return response({ tasks: [echoed(pushed, SERVER_TIME)] });
      }),
    );

    await sync();

    const after = await db.tasks.get("t1");
    expect(after?.title).toBe("CORRECTED");
    // Still dirty: the correction has never reached the server.
    expect(after?.dirty).toBe(1);
  });

  it("marks a pushed row clean when nothing edited it mid-flight", async () => {
    await db.tasks.put(task({ dirty: 1 }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ tasks: [echoed(task(), SERVER_TIME)] })),
    );

    await sync();

    const after = await db.tasks.get("t1");
    expect(after?.dirty).toBe(0);
    expect(after?.updatedAt).toBe(SERVER_TIME);
  });

  it("overwrites a clean local row with a newer pulled one", async () => {
    await db.tasks.put(task({ dirty: 0 }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          tasks: [echoed(task({ title: "FROM SERVER" }), SERVER_TIME)],
        }),
      ),
    );

    await sync();

    const after = await db.tasks.get("t1");
    expect(after?.title).toBe("FROM SERVER");
    expect(after?.dirty).toBe(0);
  });

  it("does not rewrite clean rows the merge left alone", async () => {
    // The pull is non-empty on essentially every sync, because the server
    // echoes back whatever was just pushed. If an unchanged row still took a
    // put, every sync would rewrite the whole table row by row inside one
    // IndexedDB transaction — and habitEntries grows ~15 rows a day forever.
    await db.tasks.bulkPut([
      task({ id: "a", dirty: 0 }),
      task({ id: "b", dirty: 0 }),
      task({ id: "c", dirty: 0 }),
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          tasks: [echoed(task({ id: "unrelated" }), SERVER_TIME)],
        }),
      ),
    );

    const put = vi.spyOn(db.tasks, "put");
    await sync();
    const written = put.mock.calls.map(([row]) => (row as Task).id);
    put.mockRestore();

    // Only the row that actually arrived. a/b/c merged to themselves.
    expect(written).toEqual(["unrelated"]);
  });

  it("leaves every dirty row dirty and the cursor untouched when the request fails", async () => {
    await setMeta("syncCursor", T0);
    await db.tasks.put(task({ dirty: 1 }));
    await db.habitEntries.put({
      habitId: "h1",
      date: "2026-07-31",
      state: "done",
      checkedAt: T0,
      updatedAt: T0,
      dirty: 1,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 })),
    );

    await expect(sync()).rejects.toThrow(/sync failed/);

    expect((await db.tasks.get("t1"))?.dirty).toBe(1);
    expect((await db.habitEntries.get(["h1", "2026-07-31"]))?.dirty).toBe(1);
    expect(await getMeta("syncCursor")).toBe(T0);
  });
});
