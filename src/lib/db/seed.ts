import type { Category, Habit, Project } from "../types";

const T = "2026-07-29T00:00:00.000Z";

/**
 * Category order satisfies design doc §10.4 — body first, then business,
 * then output — and is the single canonical order applied to every month.
 */
export const SEED_CATEGORIES: Category[] = [
  { id: "health", name: "HEALTH", sortOrder: 1, updatedAt: T },
  { id: "mind", name: "MIND", sortOrder: 2, updatedAt: T },
  { id: "business", name: "BUSINESS", sortOrder: 3, updatedAt: T },
  { id: "output", name: "OUTPUT", sortOrder: 4, updatedAt: T },
  { id: "home", name: "HOME", sortOrder: 5, updatedAt: T },
];

const h = (
  id: string,
  name: string,
  tier: "core" | "growing",
  categoryId: string,
  sortOrder: number,
): Habit => ({ id, name, tier, categoryId, sortOrder, active: true, updatedAt: T });

/**
 * The twelve habits from the July sheet. `Payout` is absent deliberately —
 * it was entered into the Habits tab by mistake and is not a habit.
 *
 * Tier assignment follows what was actually logged in July: things done
 * regularly are core, things intended but not yet established are growing.
 * sortOrder keeps each category contiguous so the grid renders in one pass.
 */
export const SEED_HABITS: Habit[] = [
  h("wakeup", "WAKEUP AT 6", "growing", "health", 1),
  h("sleep", "SLEEP AT 11", "growing", "health", 2),
  h("exercise", "EXERCISE (WALK)", "core", "health", 3),

  h("meditate", "MEDITATION", "core", "mind", 4),
  h("read", "READ BOOK", "core", "mind", 5),

  h("sales", "SALES TRACKER", "core", "business", 6),
  h("customer", "CUSTOMER CHECKED", "core", "business", 7),
  h("inventory", "INVENTORY STOCK", "core", "business", 8),
  h("finance", "FINANCE LOG", "growing", "business", 9),

  h("post", "POST CONTENT", "growing", "output", 10),
  h("video", "VIDEO", "growing", "output", 11),

  h("birdfood", "BIRD FOOD", "growing", "home", 12),
];

/**
 * The four projects from the design doc's mockup. Editable from Settings on
 * day one, so these are a starting point rather than a decision.
 */
export const SEED_PROJECTS: Project[] = [
  { id: "smashed", name: "SMASHED", sortOrder: 1, active: true, updatedAt: T },
  { id: "mine", name: "MINE", sortOrder: 2, active: true, updatedAt: T },
  { id: "home", name: "HOME", sortOrder: 3, active: true, updatedAt: T },
  { id: "pbrand", name: "P_BRAND", sortOrder: 4, active: true, updatedAt: T },
];
