import Dexie, { type Table } from "dexie";
import type { Category, Habit, HabitEntry, Project, Task } from "../types";
import type { ISODate } from "../date";
import { SEED_CATEGORIES, SEED_HABITS, SEED_PROJECTS } from "./seed";

interface Meta {
  key: string;
  value: string;
}

class LifeOSDB extends Dexie {
  categories!: Table<Category, string>;
  habits!: Table<Habit, string>;
  habitEntries!: Table<HabitEntry, [string, string]>;
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
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

    // Categories and habits become editable, so they need the same dirty
    // flag entries already carry. Existing rows predate `updatedAt`, so the
    // upgrade stamps them at the epoch — the server copy is authoritative
    // and must win the first merge after this ships.
    this.version(2)
      .stores({
        categories: "id, sortOrder, dirty",
        habits: "id, categoryId, sortOrder, tier, dirty",
        habitEntries: "[habitId+date], date, habitId, dirty",
        meta: "key",
      })
      .upgrade(async (tx) => {
        const epoch = new Date(0).toISOString();
        await tx
          .table("categories")
          .toCollection()
          .modify((c) => {
            c.updatedAt = epoch;
            c.dirty = 0;
          });
        await tx
          .table("habits")
          .toCollection()
          .modify((h) => {
            h.dirty = 0;
          });
      });

    // `done` is deliberately not indexed — Dexie cannot index booleans, and
    // at tens of rows filtering in memory costs nothing.
    this.version(3).stores({
      categories: "id, sortOrder, dirty",
      habits: "id, categoryId, sortOrder, tier, dirty",
      habitEntries: "[habitId+date], date, habitId, dirty",
      projects: "id, sortOrder, dirty",
      tasks: "id, projectId, due, dirty",
      meta: "key",
    });
  }
}

export const db = new LifeOSDB();

export async function seedIfEmpty(): Promise<void> {
  if ((await db.habits.count()) === 0) {
    await db.transaction("rw", db.categories, db.habits, async () => {
      // dirty: 1 — the server no longer seeds itself, so a fresh device is
      // what populates an empty database.
      await db.categories.bulkPut(
        SEED_CATEGORIES.map((c) => ({ ...c, dirty: 1 as const })),
      );
      await db.habits.bulkPut(
        SEED_HABITS.map((h) => ({ ...h, dirty: 1 as const })),
      );
    });
  }

  // Separate check: a device upgrading from v2 already has habits but has
  // never seen a project.
  if ((await db.projects.count()) === 0) {
    await db.projects.bulkPut(
      SEED_PROJECTS.map((p) => ({ ...p, dirty: 1 as const })),
    );
  }
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

export function dirtyCategories() {
  return db.categories.where("dirty").equals(1).toArray();
}

export function dirtyHabits() {
  return db.habits.where("dirty").equals(1).toArray();
}

/** Writes locally and marks the row for push. Never touches the network. */
export async function putCategory(c: Category): Promise<void> {
  await db.categories.put({ ...c, dirty: 1 });
}

export async function putHabit(h: Habit): Promise<void> {
  await db.habits.put({ ...h, dirty: 1 });
}

export function dirtyProjects() {
  return db.projects.where("dirty").equals(1).toArray();
}

export function dirtyTasks() {
  return db.tasks.where("dirty").equals(1).toArray();
}

export async function putProject(p: Project): Promise<void> {
  await db.projects.put({ ...p, dirty: 1 });
}

export async function putTask(t: Task): Promise<void> {
  await db.tasks.put({ ...t, dirty: 1 });
}

export function openTasks() {
  return db.tasks.filter((t) => !t.done).toArray();
}
