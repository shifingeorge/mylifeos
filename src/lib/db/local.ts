import Dexie, { type Table } from "dexie";
import type { Category, Habit, HabitEntry } from "../types";
import type { ISODate } from "../date";
import { SEED_CATEGORIES, SEED_HABITS } from "./seed";

interface Meta {
  key: string;
  value: string;
}

class LifeOSDB extends Dexie {
  categories!: Table<Category, string>;
  habits!: Table<Habit, string>;
  habitEntries!: Table<HabitEntry, [string, string]>;
  meta!: Table<Meta, string>;

  constructor() {
    super("lifeos");
    this.version(1).stores({
      categories: "id, sortOrder",
      habits: "id, categoryId, sortOrder, tier",
      // Compound primary key, so put() is an upsert and the tap cycle can
      // never produce two rows for the same cell. `dirty` is indexed to keep
      // the push query from scanning every row.
      habitEntries: "[habitId+date], date, habitId, dirty",
      meta: "key",
    });
  }
}

export const db = new LifeOSDB();

export async function seedIfEmpty(): Promise<void> {
  if ((await db.habits.count()) > 0) return;
  await db.transaction("rw", db.categories, db.habits, async () => {
    await db.categories.bulkPut(SEED_CATEGORIES);
    await db.habits.bulkPut(SEED_HABITS);
  });
}

export function getEntry(habitId: string, date: ISODate) {
  return db.habitEntries.get([habitId, date]);
}

export function entriesForDates(dates: ISODate[]) {
  return db.habitEntries.where("date").anyOf(dates).toArray();
}

/** Writes locally and marks the row for push. Never touches the network. */
export async function putEntry(entry: HabitEntry): Promise<void> {
  await db.habitEntries.put({ ...entry, dirty: 1 });
}

export function dirtyEntries() {
  return db.habitEntries.where("dirty").equals(1).toArray();
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}
