import { describe, it, expect } from "vitest";
import { dayScore, formatDayScore, monthScores } from "@/lib/score";
import type { Habit, HabitEntry, Category, CellState } from "@/lib/types";

const cat = (id: string, name: string, sortOrder: number): Category => ({
  id,
  name,
  sortOrder,
});

const habit = (
  id: string,
  tier: "core" | "growing",
  categoryId: string,
  active = true,
): Habit => ({
  id,
  name: id.toUpperCase(),
  tier,
  categoryId,
  sortOrder: 0,
  active,
  updatedAt: "2026-07-01T00:00:00Z",
});

const entry = (
  habitId: string,
  date: string,
  state: CellState,
): HabitEntry => ({
  habitId,
  date,
  state,
  checkedAt: "2026-07-28T09:00:00Z",
  updatedAt: "2026-07-28T09:00:00Z",
});

const HABITS: Habit[] = [
  habit("a", "core", "health"),
  habit("b", "core", "health"),
  habit("c", "core", "mind"),
  habit("d", "growing", "mind"),
  habit("e", "growing", "output"),
];

describe("dayScore", () => {
  it("counts only done core habits against the core total", () => {
    const entries = [
      entry("a", "2026-07-28", "done"),
      entry("b", "2026-07-28", "missed"),
    ];
    expect(dayScore(HABITS, entries, "2026-07-28")).toEqual({
      coreDone: 1,
      coreTotal: 3,
      growingDone: 0,
    });
  });

  it("counts growing habits separately and never in the denominator", () => {
    const entries = [
      entry("d", "2026-07-28", "done"),
      entry("e", "2026-07-28", "done"),
    ];
    expect(dayScore(HABITS, entries, "2026-07-28")).toEqual({
      coreDone: 0,
      coreTotal: 3,
      growingDone: 2,
    });
  });

  it("ignores entries for other dates", () => {
    const entries = [entry("a", "2026-07-27", "done")];
    expect(dayScore(HABITS, entries, "2026-07-28").coreDone).toBe(0);
  });

  it("treats missed and none identically for scoring", () => {
    const missed = [entry("a", "2026-07-28", "missed")];
    const none = [entry("a", "2026-07-28", "none")];
    expect(dayScore(HABITS, missed, "2026-07-28").coreDone).toBe(
      dayScore(HABITS, none, "2026-07-28").coreDone,
    );
  });

  it("excludes inactive habits from the total", () => {
    const habits = [...HABITS, habit("f", "core", "health", false)];
    expect(dayScore(habits, [], "2026-07-28").coreTotal).toBe(3);
  });

  it("does not count a done entry belonging to an inactive habit", () => {
    const habits = [...HABITS, habit("f", "core", "health", false)];
    const entries = [entry("f", "2026-07-28", "done")];
    expect(dayScore(habits, entries, "2026-07-28").coreDone).toBe(0);
  });

  it("returns a zero total when there are no habits", () => {
    expect(dayScore([], [], "2026-07-28")).toEqual({
      coreDone: 0,
      coreTotal: 0,
      growingDone: 0,
    });
  });
});

describe("formatDayScore", () => {
  it("formats with the growing count", () => {
    expect(
      formatDayScore({ coreDone: 4, coreTotal: 6, growingDone: 1 }),
    ).toBe("CORE 4/6 · +1");
  });

  it("still shows +0 so the layout does not jump", () => {
    expect(
      formatDayScore({ coreDone: 4, coreTotal: 6, growingDone: 0 }),
    ).toBe("CORE 4/6 · +0");
  });
});

describe("monthScores", () => {
  const CATEGORIES = [cat("health", "HEALTH", 1), cat("mind", "MIND", 2)];
  const H = [
    habit("a", "core", "health"),
    habit("b", "core", "health"),
    habit("c", "core", "mind"),
  ];

  it("uses habits-in-category times days-elapsed as the denominator", () => {
    // 10 July: 2 health habits x 10 days elapsed = 20 possible
    const result = monthScores(H, [], CATEGORIES, "2026-07-10");
    expect(result.find((r) => r.categoryId === "health")!.possible).toBe(20);
    expect(result.find((r) => r.categoryId === "mind")!.possible).toBe(10);
  });

  it("counts done entries within the month only", () => {
    const entries = [
      entry("a", "2026-07-05", "done"),
      entry("a", "2026-07-06", "done"),
      entry("a", "2026-06-30", "done"), // previous month, must not count
    ];
    const result = monthScores(H, entries, CATEGORIES, "2026-07-10");
    expect(result.find((r) => r.categoryId === "health")!.done).toBe(2);
  });

  it("does not count missed entries as done", () => {
    const entries = [entry("a", "2026-07-05", "missed")];
    expect(
      monthScores(H, entries, CATEGORIES, "2026-07-10").find(
        (r) => r.categoryId === "health",
      )!.done,
    ).toBe(0);
  });

  it("returns categories in sortOrder", () => {
    expect(
      monthScores(H, [], CATEGORIES, "2026-07-10").map((r) => r.name),
    ).toEqual(["HEALTH", "MIND"]);
  });

  it("returns zero possible for a category with no habits", () => {
    const cats = [...CATEGORIES, cat("home", "HOME", 3)];
    expect(
      monthScores(H, [], cats, "2026-07-10").find(
        (r) => r.categoryId === "home",
      )!.possible,
    ).toBe(0);
  });

  it("excludes inactive habits from the denominator", () => {
    const H2 = [...H, habit("z", "growing", "health", false)];
    expect(
      monthScores(H2, [], CATEGORIES, "2026-07-10").find(
        (r) => r.categoryId === "health",
      )!.possible,
    ).toBe(20);
  });
});
