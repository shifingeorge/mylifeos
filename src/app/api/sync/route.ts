import { NextResponse } from "next/server";
import { gt, sql } from "drizzle-orm";
import { dbServer } from "@/lib/db/client";
import { categories, habits, habitEntries } from "@/lib/db/schema";
import { SEED_CATEGORIES, SEED_HABITS } from "@/lib/db/seed";
import type { HabitEntry } from "@/lib/types";

export const runtime = "nodejs";

interface PushRow {
  habitId: string;
  date: string;
  state: string;
  checkedAt: string;
}

/**
 * habit_entries references habits, so the first push from a fresh client
 * would violate the foreign key against an empty server. Seeding from the
 * same module the client seeds from keeps both sides on one canonical list,
 * and the upsert makes it idempotent — it costs one no-op statement per sync.
 */
async function ensureSeeded(db: ReturnType<typeof dbServer>) {
  await db
    .insert(categories)
    .values(SEED_CATEGORIES)
    .onConflictDoNothing({ target: categories.id });

  await db
    .insert(habits)
    .values(
      SEED_HABITS.map((h) => ({
        id: h.id,
        name: h.name,
        tier: h.tier,
        categoryId: h.categoryId,
        sortOrder: h.sortOrder,
        active: h.active,
      })),
    )
    .onConflictDoNothing({ target: habits.id });
}

export async function POST(req: Request) {
  const db = dbServer();
  const { since, rows } = (await req.json()) as {
    since: string | null;
    rows: PushRow[];
  };

  const serverTime = new Date();

  await ensureSeeded(db);

  // Push. The server stamps updated_at — a skewed phone clock must not win.
  if (Array.isArray(rows) && rows.length > 0) {
    await db
      .insert(habitEntries)
      .values(
        rows.map((r) => ({
          habitId: r.habitId,
          date: r.date,
          state: r.state,
          checkedAt: new Date(r.checkedAt),
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

  // Pull everything changed since the client's cursor.
  const changed = since
    ? await db
        .select()
        .from(habitEntries)
        .where(gt(habitEntries.updatedAt, new Date(since)))
    : await db.select().from(habitEntries);

  const payload: HabitEntry[] = changed.map((r) => ({
    habitId: r.habitId,
    date: r.date,
    state: r.state as HabitEntry["state"],
    checkedAt: r.checkedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return NextResponse.json({
    serverTime: serverTime.toISOString(),
    rows: payload,
  });
}
