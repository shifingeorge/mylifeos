import { describe, it, expect } from "vitest";
import { sortTasks, overdueDays, formatDue, doneOnDate } from "@/lib/tasks";
import type { Priority, Task } from "@/lib/types";

const t = (
  id: string,
  priority: Priority,
  due: string | null,
  createdAt = "2026-07-01T00:00:00Z",
): Task => ({
  id,
  title: id.toUpperCase(),
  priority,
  projectId: null,
  due,
  done: false,
  completedAt: null,
  createdAt,
  updatedAt: createdAt,
});

describe("sortTasks", () => {
  it("puts higher priority first", () => {
    const out = sortTasks([t("b", "P3", null), t("a", "P1", null)]);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("breaks a priority tie with the earlier due date", () => {
    const out = sortTasks([
      t("late", "P1", "2026-08-10"),
      t("soon", "P1", "2026-08-01"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["soon", "late"]);
  });

  it("puts undated tasks last within their priority", () => {
    const out = sortTasks([t("none", "P1", null), t("dated", "P1", "2026-08-01")]);
    expect(out.map((x) => x.id)).toEqual(["dated", "none"]);
  });

  it("does not let an undated P1 fall below a dated P2", () => {
    const out = sortTasks([t("p2", "P2", "2026-08-01"), t("p1", "P1", null)]);
    expect(out.map((x) => x.id)).toEqual(["p1", "p2"]);
  });

  it("breaks a full tie with creation order", () => {
    const out = sortTasks([
      t("second", "P1", "2026-08-01", "2026-07-02T00:00:00Z"),
      t("first", "P1", "2026-08-01", "2026-07-01T00:00:00Z"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["first", "second"]);
  });

  it("does not mutate its input", () => {
    const input = [t("b", "P3", null), t("a", "P1", null)];
    sortTasks(input);
    expect(input.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("handles an empty list", () => {
    expect(sortTasks([])).toEqual([]);
  });

  it("breaks a full tie (priority, due, createdAt) deterministically by id", () => {
    const out = sortTasks([
      t("b", "P1", "2026-08-01", "2026-07-01T00:00:00Z"),
      t("a", "P1", "2026-08-01", "2026-07-01T00:00:00Z"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("is antisymmetric: input order does not change the result for a full tie", () => {
    const a = t("a", "P1", "2026-08-01", "2026-07-01T00:00:00Z");
    const b = t("b", "P1", "2026-08-01", "2026-07-01T00:00:00Z");
    expect(sortTasks([a, b]).map((x) => x.id)).toEqual(
      sortTasks([b, a]).map((x) => x.id),
    );
  });
});

describe("overdueDays", () => {
  it("is zero for a task due today", () => {
    expect(overdueDays("2026-07-31", "2026-07-31")).toBe(0);
  });

  it("is zero for a future task", () => {
    expect(overdueDays("2026-08-05", "2026-07-31")).toBe(0);
  });

  it("is zero for an undated task", () => {
    expect(overdueDays(null, "2026-07-31")).toBe(0);
  });

  it("counts whole days past the due date", () => {
    expect(overdueDays("2026-07-23", "2026-07-31")).toBe(8);
  });

  it("counts correctly across a month boundary", () => {
    expect(overdueDays("2026-07-30", "2026-08-02")).toBe(3);
  });

  it("counts correctly across a year boundary", () => {
    expect(overdueDays("2025-12-30", "2026-01-02")).toBe(3);
  });
});

describe("formatDue", () => {
  it("reads TODAY for today", () => {
    expect(formatDue("2026-07-31", "2026-07-31")).toBe("TODAY");
  });

  it("reads TOMORROW for tomorrow", () => {
    expect(formatDue("2026-08-01", "2026-07-31")).toBe("TOMORROW");
  });

  it("uses the day-month header format otherwise", () => {
    expect(formatDue("2026-08-05", "2026-07-31")).toBe("WED 05 AUG");
  });

  it("is empty for an undated task", () => {
    expect(formatDue(null, "2026-07-31")).toBe("");
  });
});

describe("doneOnDate", () => {
  const done = (id: string, completedAt: string | null): Task => ({
    ...t(id, "P2", null),
    done: completedAt !== null,
    completedAt,
  });

  it("counts a task completed at 02:00 IST for that IST date", () => {
    // 02:00 IST on 1 Aug = 20:30 UTC on 31 Jul — the exact case a naive
    // `completedAt.slice(0, 10)` gets wrong.
    const tasks = [done("a", "2026-07-31T20:30:00.000Z")];
    expect(doneOnDate(tasks, "2026-08-01")).toBe(1);
  });

  it("counts a task completed at 23:00 IST for that same IST date", () => {
    // 23:00 IST on 31 Jul = 17:30 UTC on 31 Jul.
    const tasks = [done("a", "2026-07-31T17:30:00.000Z")];
    expect(doneOnDate(tasks, "2026-07-31")).toBe(1);
  });

  it("does not count a task completed the previous IST day", () => {
    const tasks = [done("a", "2026-07-30T12:00:00.000Z")];
    expect(doneOnDate(tasks, "2026-07-31")).toBe(0);
  });

  it("does not count an incomplete task with a null completedAt", () => {
    const tasks = [done("a", null)];
    expect(doneOnDate(tasks, "2026-07-31")).toBe(0);
  });
});
