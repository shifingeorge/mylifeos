import {
  pgTable,
  text,
  integer,
  boolean,
  date,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Mirrors the Dexie schema in `local.ts`, so sync is a row copy with no
 * translation step. If one changes, the other must change with it.
 */

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  // Categories are editable from Settings now, so they sync like everything
  // else rather than being seeded server-side.
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const habits = pgTable("habits", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  sortOrder: integer("sort_order").notNull(),
  // Soft delete, so dropping a habit does not punch holes in past months.
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const habitEntries = pgTable(
  "habit_entries",
  {
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id),
    /** The day this counts for, not the day it was tapped. */
    date: date("date").notNull(),
    state: text("state").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    /** Always stamped by the server. A skewed phone clock must not win. */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.date] })],
);
