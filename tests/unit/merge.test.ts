import { describe, it, expect } from "vitest";
import { mergeEntries } from "@/lib/sync/merge";
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

describe("mergeEntries", () => {
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
