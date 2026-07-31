import { describe, it, expect } from "vitest";
import { SEED_CATEGORIES, SEED_HABITS, SEED_PROJECTS } from "@/lib/db/seed";

describe("seed data", () => {
  it("has exactly 12 habits", () => {
    expect(SEED_HABITS).toHaveLength(12);
  });

  it("has 6 core and 6 growing", () => {
    expect(SEED_HABITS.filter((h) => h.tier === "core")).toHaveLength(6);
    expect(SEED_HABITS.filter((h) => h.tier === "growing")).toHaveLength(6);
  });

  it("does not contain Payout — it was never a habit", () => {
    expect(SEED_HABITS.some((h) => /payout/i.test(h.name))).toBe(false);
  });

  it("orders categories health, mind, business, output, home", () => {
    expect(
      [...SEED_CATEGORIES]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => c.name),
    ).toEqual(["HEALTH", "MIND", "BUSINESS", "OUTPUT", "HOME"]);
  });

  it("assigns every habit to a category that exists", () => {
    const ids = new Set(SEED_CATEGORIES.map((c) => c.id));
    for (const h of SEED_HABITS) {
      expect(ids.has(h.categoryId)).toBe(true);
    }
  });

  it("keeps every habit name within 16 characters so the grid fits", () => {
    for (const h of SEED_HABITS) {
      expect(h.name.length).toBeLessThanOrEqual(16);
    }
  });

  it("names every habit in uppercase", () => {
    for (const h of SEED_HABITS) {
      expect(h.name).toBe(h.name.toUpperCase());
    }
  });

  it("marks every habit active", () => {
    expect(SEED_HABITS.every((h) => h.active)).toBe(true);
  });

  it("gives every habit a unique id", () => {
    expect(new Set(SEED_HABITS.map((h) => h.id)).size).toBe(SEED_HABITS.length);
  });

  it("gives every habit a unique sortOrder", () => {
    expect(new Set(SEED_HABITS.map((h) => h.sortOrder)).size).toBe(
      SEED_HABITS.length,
    );
  });

  it("orders habits so categories are contiguous, matching the grid", () => {
    const byOrder = [...SEED_HABITS].sort((a, b) => a.sortOrder - b.sortOrder);
    const seen = new Set<string>();
    let previous = "";
    for (const h of byOrder) {
      if (h.categoryId !== previous) {
        expect(seen.has(h.categoryId)).toBe(false);
        seen.add(h.categoryId);
        previous = h.categoryId;
      }
    }
  });

  it("covers every category with at least one habit", () => {
    const used = new Set(SEED_HABITS.map((h) => h.categoryId));
    for (const c of SEED_CATEGORIES) {
      expect(used.has(c.id)).toBe(true);
    }
  });

  it("stamps every seed category with an updatedAt", () => {
    for (const c of SEED_CATEGORIES) {
      expect(c.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("uses one fixed timestamp across all seed rows", () => {
    const stamps = new Set([
      ...SEED_CATEGORIES.map((c) => c.updatedAt),
      ...SEED_HABITS.map((h) => h.updatedAt),
    ]);
    expect(stamps.size).toBe(1);
  });
});

describe("seed projects", () => {
  it("has the four projects from the design doc", () => {
    expect(
      [...SEED_PROJECTS].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.name),
    ).toEqual(["SMASHED", "MINE", "HOME", "P_BRAND"]);
  });

  it("marks every project active", () => {
    expect(SEED_PROJECTS.every((p) => p.active)).toBe(true);
  });

  it("gives every project a unique id", () => {
    expect(new Set(SEED_PROJECTS.map((p) => p.id)).size).toBe(
      SEED_PROJECTS.length,
    );
  });
});
