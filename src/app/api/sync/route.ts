import { NextResponse } from "next/server";
import { gt, sql } from "drizzle-orm";
import { dbServer } from "@/lib/db/client";
import { categories, habits, habitEntries, projects, tasks } from "@/lib/db/schema";
import type { Category, Habit, HabitEntry, Project, Task } from "@/lib/types";

export const runtime = "nodejs";

interface Envelope {
  categories: Category[];
  habits: Habit[];
  entries: HabitEntry[];
  projects: Project[];
  tasks: Task[];
}

/**
 * There is deliberately no server-side seeding here any more. Once habits are
 * editable from Settings, an upsert-from-seed on every request would resurrect
 * a habit the moment after it was archived. A fresh device seeds itself and
 * the first sync uploads it.
 */
export async function POST(req: Request) {
  const db = dbServer();
  const body = (await req.json()) as { since: string | null } & Partial<Envelope>;
  const since = body.since ?? null;
  const serverTime = new Date();

  // Parents before children. This is what lets a brand-new category and a
  // habit inside it arrive in one request without tripping the foreign key.
  if (body.categories?.length) {
    await db
      .insert(categories)
      .values(
        body.categories.map((c) => ({
          id: c.id,
          name: c.name,
          sortOrder: c.sortOrder,
          updatedAt: serverTime,
        })),
      )
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: sql`excluded.name`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  if (body.habits?.length) {
    await db
      .insert(habits)
      .values(
        body.habits.map((h) => ({
          id: h.id,
          name: h.name,
          tier: h.tier,
          categoryId: h.categoryId,
          sortOrder: h.sortOrder,
          active: h.active,
          updatedAt: serverTime,
        })),
      )
      .onConflictDoUpdate({
        target: habits.id,
        set: {
          name: sql`excluded.name`,
          tier: sql`excluded.tier`,
          categoryId: sql`excluded.category_id`,
          sortOrder: sql`excluded.sort_order`,
          active: sql`excluded.active`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  if (body.entries?.length) {
    await db
      .insert(habitEntries)
      .values(
        body.entries.map((e) => ({
          habitId: e.habitId,
          date: e.date,
          state: e.state,
          checkedAt: new Date(e.checkedAt),
          updatedAt: serverTime,
        })),
      )
      .onConflictDoUpdate({
        target: [habitEntries.habitId, habitEntries.date],
        set: {
          state: sql`excluded.state`,
          checkedAt: sql`excluded.checked_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  if (body.projects?.length) {
    await db
      .insert(projects)
      .values(
        body.projects.map((p) => ({
          id: p.id,
          name: p.name,
          sortOrder: p.sortOrder,
          active: p.active,
          updatedAt: serverTime,
        })),
      )
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          name: sql`excluded.name`,
          sortOrder: sql`excluded.sort_order`,
          active: sql`excluded.active`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  if (body.tasks?.length) {
    await db
      .insert(tasks)
      .values(
        body.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          projectId: t.projectId,
          due: t.due,
          done: t.done,
          completedAt: t.completedAt ? new Date(t.completedAt) : null,
          createdAt: new Date(t.createdAt),
          updatedAt: serverTime,
        })),
      )
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          title: sql`excluded.title`,
          priority: sql`excluded.priority`,
          projectId: sql`excluded.project_id`,
          due: sql`excluded.due`,
          done: sql`excluded.done`,
          completedAt: sql`excluded.completed_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  const cursor = since ? new Date(since) : null;

  const [catRows, habitRows, entryRows, projectRows, taskRows] = await Promise.all([
    cursor
      ? db.select().from(categories).where(gt(categories.updatedAt, cursor))
      : db.select().from(categories),
    cursor
      ? db.select().from(habits).where(gt(habits.updatedAt, cursor))
      : db.select().from(habits),
    cursor
      ? db.select().from(habitEntries).where(gt(habitEntries.updatedAt, cursor))
      : db.select().from(habitEntries),
    cursor
      ? db.select().from(projects).where(gt(projects.updatedAt, cursor))
      : db.select().from(projects),
    cursor
      ? db.select().from(tasks).where(gt(tasks.updatedAt, cursor))
      : db.select().from(tasks),
  ]);

  return NextResponse.json({
    serverTime: serverTime.toISOString(),
    categories: catRows.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      updatedAt: c.updatedAt.toISOString(),
    })),
    habits: habitRows.map((h) => ({
      id: h.id,
      name: h.name,
      tier: h.tier as Habit["tier"],
      categoryId: h.categoryId as string,
      sortOrder: h.sortOrder,
      active: h.active,
      updatedAt: h.updatedAt.toISOString(),
    })),
    entries: entryRows.map((e) => ({
      habitId: e.habitId,
      date: e.date,
      state: e.state as HabitEntry["state"],
      checkedAt: e.checkedAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    projects: projectRows.map((p) => ({
      id: p.id,
      name: p.name,
      sortOrder: p.sortOrder,
      active: p.active,
      updatedAt: p.updatedAt.toISOString(),
    })),
    tasks: taskRows.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority as Task["priority"],
      projectId: t.projectId,
      due: t.due,
      done: t.done,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}
