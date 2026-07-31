import { describe, it, expect } from "vitest";
import { entryKey, mergeRows } from "@/lib/sync/merge";
import type { HabitEntry, CellState } from "@/lib/types";

const e = (
  habitId: string,
  date: string,
  state: CellState,
  updatedAt: string,
): HabitEntry => ({
  habitId,
  date,
  state,
  checkedAt: updatedAt,
  updatedAt,
});

/**
 * Entries are the table with a compound identity, so they get their own pass
 * over `mergeRows` — everything else is keyed by a plain id.
 */
const mergeEntries = (local: HabitEntry[], remote: HabitEntry[]) =>
  mergeRows(local, remote, entryKey);

describe("mergeRows with entryKey", () => {
  it("keeps the row with the later updatedAt", () => {
    const local = [e("a", "2026-07-28", "done", "2026-07-28T10:00:00Z")];
    const remote = [e("a", "2026-07-28", "missed", "2026-07-28T11:00:00Z")];
    expect(mergeEntries(local, remote)[0].state).toBe("missed");
  });

  it("keeps the local row when it is newer", () => {
    const local = [e("a", "2026-07-28", "done", "2026-07-28T12:00:00Z")];
    const remote = [e("a", "2026-07-28", "missed", "2026-07-28T11:00:00Z")];
    expect(mergeEntries(local, remote)[0].state).toBe("done");
  });

  it("includes rows present on only one side", () => {
    const local = [e("a", "2026-07-28", "done", "2026-07-28T10:00:00Z")];
    const remote = [e("b", "2026-07-28", "done", "2026-07-28T10:00:00Z")];
    expect(mergeEntries(local, remote)).toHaveLength(2);
  });

  it("treats habitId and date together as the identity", () => {
    const local = [e("a", "2026-07-28", "done", "2026-07-28T10:00:00Z")];
    const remote = [e("a", "2026-07-27", "done", "2026-07-28T11:00:00Z")];
    expect(mergeEntries(local, remote)).toHaveLength(2);
  });

  it("prefers remote on an exact timestamp tie — the server is authoritative", () => {
    const t = "2026-07-28T10:00:00Z";
    const local = [e("a", "2026-07-28", "done", t)];
    const remote = [e("a", "2026-07-28", "missed", t)];
    expect(mergeEntries(local, remote)[0].state).toBe("missed");
  });

  it("returns local rows unchanged when remote is empty", () => {
    const local = [e("a", "2026-07-28", "done", "2026-07-28T10:00:00Z")];
    expect(mergeEntries(local, [])).toEqual(local);
  });

  it("returns remote rows when local is empty", () => {
    const remote = [e("a", "2026-07-28", "done", "2026-07-28T10:00:00Z")];
    expect(mergeEntries([], remote)).toEqual(remote);
  });

  it("propagates a cleared cell rather than resurrecting the old value", () => {
    const local = [e("a", "2026-07-28", "done", "2026-07-28T10:00:00Z")];
    const remote = [e("a", "2026-07-28", "none", "2026-07-28T11:00:00Z")];
    expect(mergeEntries(local, remote)[0].state).toBe("none");
  });

  it("is empty when both sides are empty", () => {
    expect(mergeEntries([], [])).toEqual([]);
  });
});

import { idKey } from "@/lib/sync/merge";

interface Row {
  id: string;
  name: string;
  updatedAt: string;
}

const r = (id: string, name: string, updatedAt: string): Row => ({
  id,
  name,
  updatedAt,
});

describe("mergeRows", () => {
  it("keeps the row with the later updatedAt", () => {
    const local = [r("a", "OLD", "2026-07-28T10:00:00Z")];
    const remote = [r("a", "NEW", "2026-07-28T11:00:00Z")];
    expect(mergeRows(local, remote, idKey)[0].name).toBe("NEW");
  });

  it("keeps the local row when it is newer", () => {
    const local = [r("a", "LOCAL", "2026-07-28T12:00:00Z")];
    const remote = [r("a", "REMOTE", "2026-07-28T11:00:00Z")];
    expect(mergeRows(local, remote, idKey)[0].name).toBe("LOCAL");
  });

  it("prefers remote on an exact tie — the server is authoritative", () => {
    const t = "2026-07-28T10:00:00Z";
    expect(
      mergeRows([r("a", "LOCAL", t)], [r("a", "REMOTE", t)], idKey)[0].name,
    ).toBe("REMOTE");
  });

  it("includes rows present on only one side", () => {
    const local = [r("a", "A", "2026-07-28T10:00:00Z")];
    const remote = [r("b", "B", "2026-07-28T10:00:00Z")];
    expect(mergeRows(local, remote, idKey)).toHaveLength(2);
  });

  it("uses the supplied key, not object identity", () => {
    const local = [r("a", "A", "2026-07-28T10:00:00Z")];
    const remote = [r("a", "A2", "2026-07-28T11:00:00Z")];
    // Keying on name instead of id makes these two distinct rows.
    expect(mergeRows(local, remote, (row) => row.name)).toHaveLength(2);
  });

  it("is empty when both sides are empty", () => {
    expect(mergeRows<Row>([], [], idKey)).toEqual([]);
  });

  // Not load-bearing for the engine any more — it compares `updatedAt`
  // against the snapshot it pushed rather than object identity (see
  // `hasUnsentEdit` in engine.ts, and the round trip in engine.test.ts).
  // Kept because a merge that copied rows for no reason would be a
  // regression worth noticing.
  it("returns the same object reference when the local row wins on a later updatedAt", () => {
    const local = [r("a", "LOCAL", "2026-07-28T12:00:00Z")];
    const remote = [r("a", "REMOTE", "2026-07-28T11:00:00Z")];
    expect(mergeRows(local, remote, idKey)[0]).toBe(local[0]);
  });

  it("returns the same object reference for a local row absent from remote", () => {
    const local = [r("a", "A", "2026-07-28T10:00:00Z")];
    const remote: Row[] = [];
    expect(mergeRows(local, remote, idKey)[0]).toBe(local[0]);
  });
});
