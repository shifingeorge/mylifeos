# Phase 0 + Phase 1 — Foundation and Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-screen habits app into a four-area shell with a Home summary, and ship a working Tasks ledger that captures, lists, completes and syncs offline.

**Architecture:** Phase 0 widens the existing sync machinery from "habit entries only" to "any table with an `updatedAt`", makes habits and categories syncable (deleting the server-side seeding that would otherwise resurrect archived rows), inverts the route guard from an allowlist to a denylist, and introduces the app shell — a bottom tab bar, a hamburger sheet, and a Home screen. Phase 1 then adds Tasks as the first area built on that foundation: local-first writes to Dexie, optimistic UI, sync as a background detail.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack), React 19.2.4, TypeScript, Tailwind v4, Dexie 4 (IndexedDB), Drizzle ORM 0.45 + Neon Postgres, Vitest + @testing-library/react, Playwright.

## Global Constraints

- **Next 16 renames `middleware.ts` to `proxy.ts`** and the exported function is `proxy`. Read `node_modules/next/dist/docs/` before touching framework APIs; this is not the Next.js in your training data.
- **All dates are `YYYY-MM-DD` strings in IST.** The offset is applied in exactly one place, `todayIST` in `src/lib/date.ts`. Never call `new Date()` for a calendar day anywhere else.
- **Dexie cannot index booleans.** Any field in a Dexie `stores()` index string must be a number or string. This is why `dirty` is `1 | 0`.
- **The server stamps every `updatedAt`.** A phone with a skewed clock must never win a merge.
- **Writes go to Dexie first and never block on the network.** The UI updates optimistically; sync is a background loop that fails silently.
- **The shape rule (design doc §5.3, non-negotiable): priority/tier is a filled solid block, project/category is an outlined tag.** Two shapes, not two hues.
- **Every tap target is at least 44px.** The target is the full cell or row, never the glyph.
- **No confirmation dialogs anywhere.** Destructive buttons say what they will do; completion is undoable for five seconds.
- **Colours come from CSS variables only** — `var(--ground)`, `var(--type)`, `var(--type-muted)`, `var(--rule)`, `var(--accent)`, `var(--alert)`, `var(--miss)`. Never a literal hex in a component.
- **`--alert` means urgency, never history.** A missed day is `--miss`.
- Commit after every task. Run `npm test` before every commit.
- Spec: `docs/superpowers/specs/2026-07-31-milestone-2-tasks-journal-money-design.md`.

---

## File Structure

**Phase 0 — created:**

| File | Responsibility |
| --- | --- |
| `src/app/(app)/layout.tsx` | Shared shell for every guarded screen: tab bar, hamburger sheet |
| `src/app/(app)/page.tsx` | Home summary screen |
| `src/components/TabBar.tsx` | Four bottom tabs, active state from the pathname |
| `src/components/MenuSheet.tsx` | Hamburger sheet holding the non-daily destinations |
| `src/components/AppHeader.tsx` | Hamburger button + screen title, shared by every area |
| `src/components/HomeCard.tsx` | One summary card; every area renders one |
| `tests/unit/route-guard.test.ts` | The proxy matcher, asserted path by path |

**Phase 0 — modified:**

| File | Change |
| --- | --- |
| `src/lib/sync/merge.ts` | Add generic `mergeRows`; `mergeEntries` becomes a wrapper |
| `src/lib/types.ts` | `Category` gains `updatedAt` and `dirty`; `Habit` gains `dirty` |
| `src/lib/db/seed.ts` | Seed categories gain `updatedAt` |
| `src/lib/db/local.ts` | Dexie v2; dirty-row helpers for categories and habits |
| `src/lib/db/schema.ts` | `categories` gains `updated_at` |
| `src/app/api/sync/route.ts` | Symmetric three-table envelope; `ensureSeeded` deleted |
| `src/lib/sync/engine.ts` | Push and merge three tables instead of one |
| `src/proxy.ts` | Allowlist matcher inverts to a denylist |
| `src/app/page.tsx` | Deleted — replaced by `(app)/page.tsx` |
| `src/app/habits/page.tsx` | Moved to `src/app/(app)/habits/page.tsx`, header removed |

**Phase 1 — created:**

| File | Responsibility |
| --- | --- |
| `src/lib/tasks.ts` | Pure task logic: sorting, overdue arithmetic, due labels |
| `src/app/(app)/tasks/page.tsx` | The task ledger screen |
| `src/app/(app)/settings/page.tsx` | Settings index |
| `src/app/(app)/settings/projects/page.tsx` | Project management |
| `src/components/TaskRow.tsx` | One two-line task row with its tick target |
| `src/components/CaptureSheet.tsx` | New-task sheet |
| `src/components/Sheet.tsx` | The bottom-sheet primitive both sheets use |
| `src/components/ListEditor.tsx` | Reorderable name list, shared by every Settings screen |
| `tests/unit/tasks.test.ts` | Sorting, overdue, due labels |
| `tests/unit/TaskRow.test.tsx` | Row rendering and the tick target |
| `tests/e2e/tasks.spec.ts` | Capture offline, sync, complete, undo |

**Phase 1 — modified:** `src/lib/types.ts`, `src/lib/db/local.ts` (v3), `src/lib/db/seed.ts`, `src/lib/db/schema.ts`, `src/app/api/sync/route.ts`, `src/lib/sync/engine.ts`, `src/app/(app)/page.tsx`, `src/app/api/auth/route.ts` (a `DELETE` to lock).

---

# PHASE 0 — FOUNDATION

### Task 1: Generic row merge

The merge is currently hard-wired to habit entries. Every table added from here needs the same last-write-wins rule, so the rule moves behind a key function. The existing tests must pass **unedited** — if they need changing, behaviour changed.

**Files:**
- Modify: `src/lib/sync/merge.ts`
- Test: `tests/unit/merge.test.ts` (append; do not edit existing cases)

**Interfaces:**
- Consumes: `HabitEntry` from `src/lib/types.ts`
- Produces: `mergeRows<T extends { updatedAt: string }>(local: T[], remote: T[], key: (row: T) => string): T[]`, `entryKey(e: HabitEntry): string`, `idKey<T extends { id: string }>(row: T): string`, and the unchanged `mergeEntries(local: HabitEntry[], remote: HabitEntry[]): HabitEntry[]`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/merge.test.ts`:

```typescript
import { mergeRows, idKey } from "@/lib/sync/merge";

interface Row {
  id: string;
  name: string;
  updatedAt: string;
}

const r = (id: string, name: string, updatedAt: string): Row => ({
  id,
  name,
  updatedAt,
});

describe("mergeRows", () => {
  it("keeps the row with the later updatedAt", () => {
    const local = [r("a", "OLD", "2026-07-28T10:00:00Z")];
    const remote = [r("a", "NEW", "2026-07-28T11:00:00Z")];
    expect(mergeRows(local, remote, idKey)[0].name).toBe("NEW");
  });

  it("keeps the local row when it is newer", () => {
    const local = [r("a", "LOCAL", "2026-07-28T12:00:00Z")];
    const remote = [r("a", "REMOTE", "2026-07-28T11:00:00Z")];
    expect(mergeRows(local, remote, idKey)[0].name).toBe("LOCAL");
  });

  it("prefers remote on an exact tie — the server is authoritative", () => {
    const t = "2026-07-28T10:00:00Z";
    expect(
      mergeRows([r("a", "LOCAL", t)], [r("a", "REMOTE", t)], idKey)[0].name,
    ).toBe("REMOTE");
  });

  it("includes rows present on only one side", () => {
    const local = [r("a", "A", "2026-07-28T10:00:00Z")];
    const remote = [r("b", "B", "2026-07-28T10:00:00Z")];
    expect(mergeRows(local, remote, idKey)).toHaveLength(2);
  });

  it("uses the supplied key, not object identity", () => {
    const local = [r("a", "A", "2026-07-28T10:00:00Z")];
    const remote = [r("a", "A2", "2026-07-28T11:00:00Z")];
    // Keying on name instead of id makes these two distinct rows.
    expect(mergeRows(local, remote, (row) => row.name)).toHaveLength(2);
  });

  it("is empty when both sides are empty", () => {
    expect(mergeRows<Row>([], [], idKey)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run tests/unit/merge.test.ts`
Expected: FAIL — `mergeRows` is not exported from `@/lib/sync/merge`.

- [ ] **Step 3: Implement**

Replace the whole of `src/lib/sync/merge.ts`:

```typescript
import type { HabitEntry } from "../types";

/**
 * Last-write-wins on `updatedAt`, with the server winning an exact tie.
 *
 * One person cannot edit the same row on two devices in the same second,
 * so conflicts are not a realistic scenario here. CRDTs and sync engines
 * would be solving a problem this app does not have.
 *
 * The key function is what makes this work for every table: entries are
 * identified by habit and date, everything else by id.
 */
export function mergeRows<T extends { updatedAt: string }>(
  local: T[],
  remote: T[],
  key: (row: T) => string,
): T[] {
  const out = new Map<string, T>();

  for (const l of local) out.set(key(l), l);

  for (const r of remote) {
    const existing = out.get(key(r));
    if (!existing || r.updatedAt >= existing.updatedAt) out.set(key(r), r);
  }

  return [...out.values()];
}

export const entryKey = (e: HabitEntry) => `${e.habitId}|${e.date}`;

export const idKey = <T extends { id: string }>(row: T) => row.id;

export function mergeEntries(
  local: HabitEntry[],
  remote: HabitEntry[],
): HabitEntry[] {
  return mergeRows(local, remote, entryKey);
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS, including all nine original `mergeEntries` cases with no edits.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/merge.ts tests/unit/merge.test.ts
git commit -m "refactor: generalise the merge to any table with updatedAt"
```

---

### Task 2: Categories and habits become syncable rows

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/db/seed.ts`, `src/lib/db/schema.ts`
- Create: a Drizzle migration under `drizzle/` (generated, not hand-written)

**Interfaces:**
- Consumes: nothing new
- Produces: `Category` with `updatedAt: string` and `dirty?: 1 | 0`; `Habit` with `dirty?: 1 | 0`; Postgres `categories.updated_at`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/seed.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/seed.test.ts`
Expected: FAIL — `updatedAt` is `undefined` on categories.

- [ ] **Step 3: Update the types**

In `src/lib/types.ts`, replace the `Category` interface and add `dirty` to `Habit`:

```typescript
export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: string;
  /** 1 = pending push. Dexie cannot index booleans, so this is not a bool. */
  dirty?: 1 | 0;
}

export interface Habit {
  id: string;
  name: string;
  tier: Tier;
  categoryId: string;
  sortOrder: number;
  /** Soft delete. Dropping a habit must not punch holes in past months. */
  active: boolean;
  updatedAt: string;
  dirty?: 1 | 0;
}
```

- [ ] **Step 4: Stamp the seed categories**

In `src/lib/db/seed.ts`, replace the `SEED_CATEGORIES` array:

```typescript
export const SEED_CATEGORIES: Category[] = [
  { id: "health", name: "HEALTH", sortOrder: 1, updatedAt: T },
  { id: "mind", name: "MIND", sortOrder: 2, updatedAt: T },
  { id: "business", name: "BUSINESS", sortOrder: 3, updatedAt: T },
  { id: "output", name: "OUTPUT", sortOrder: 4, updatedAt: T },
  { id: "home", name: "HOME", sortOrder: 5, updatedAt: T },
];
```

- [ ] **Step 5: Add the column to the server schema**

In `src/lib/db/schema.ts`, replace the `categories` table:

```typescript
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
```

- [ ] **Step 6: Generate and apply the migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: a new file in `drizzle/` containing `ALTER TABLE "categories" ADD COLUMN "updated_at"`, applied to the **dev** Neon branch (the one in `.env`). Production is migrated by hand at merge time — do not point this at production.

- [ ] **Step 7: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/db/seed.ts src/lib/db/schema.ts drizzle tests/unit/seed.test.ts
git commit -m "feat: give categories an updatedAt so they can sync"
```

---

### Task 3: Dexie version 2

Bumping a Dexie version is the one step here that touches data already on the phone. The upgrade backfills the new field on rows that predate it.

**Files:**
- Modify: `src/lib/db/local.ts`

**Interfaces:**
- Consumes: `Category`, `Habit` from Task 2
- Produces: `dirtyCategories(): Promise<Category[]>`, `dirtyHabits(): Promise<Habit[]>`, `putCategory(c: Category): Promise<void>`, `putHabit(h: Habit): Promise<void>`

- [ ] **Step 1: Add version 2 and the helpers**

In `src/lib/db/local.ts`, add after the existing `this.version(1)` block inside the constructor — **keep version 1 exactly as it is**, Dexie needs the full history to upgrade an existing device:

```typescript
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
```

Then add these exports at the end of the file:

```typescript
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
```

Add `Category` and `Habit` to the existing type import at the top of the file if they are not already there.

- [ ] **Step 2: Also mark seeded rows clean**

In the same file, replace `seedIfEmpty` so a fresh device pushes its seed on the first sync:

```typescript
export async function seedIfEmpty(): Promise<void> {
  if ((await db.habits.count()) > 0) return;
  await db.transaction("rw", db.categories, db.habits, async () => {
    // dirty: 1 — the server no longer seeds itself, so a fresh device is
    // what populates an empty database.
    await db.categories.bulkPut(SEED_CATEGORIES.map((c) => ({ ...c, dirty: 1 as const })));
    await db.habits.bulkPut(SEED_HABITS.map((h) => ({ ...h, dirty: 1 as const })));
  });
}
```

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 4: Verify the upgrade on a real browser**

Run: `npm run dev`, open the app in a browser that already has the `lifeos` database, unlock, and confirm the habits grid still renders with its data. Then in devtools → Application → IndexedDB → `lifeos` → `categories`, confirm every row now has `updatedAt` and `dirty: 0`.

An upgrade that throws leaves Dexie unusable and the app blank — this check is not optional.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/local.ts
git commit -m "feat: dexie v2 with dirty flags on categories and habits"
```

---

### Task 4: The three-table sync envelope

**Files:**
- Modify: `src/app/api/sync/route.ts`

**Interfaces:**
- Consumes: `mergeRows` (Task 1), the schema from Task 2
- Produces: `POST /api/sync` accepting `{ since: string | null, categories: Category[], habits: Habit[], entries: HabitEntry[] }` and returning `{ serverTime: string, categories: Category[], habits: Habit[], entries: HabitEntry[] }`

- [ ] **Step 1: Rewrite the route**

Replace the whole of `src/app/api/sync/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { gt, sql } from "drizzle-orm";
import { dbServer } from "@/lib/db/client";
import { categories, habits, habitEntries } from "@/lib/db/schema";
import type { Category, Habit, HabitEntry } from "@/lib/types";

export const runtime = "nodejs";

interface Envelope {
  categories: Category[];
  habits: Habit[];
  entries: HabitEntry[];
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

  const cursor = since ? new Date(since) : null;

  const [catRows, habitRows, entryRows] = await Promise.all([
    cursor
      ? db.select().from(categories).where(gt(categories.updatedAt, cursor))
      : db.select().from(categories),
    cursor
      ? db.select().from(habits).where(gt(habits.updatedAt, cursor))
      : db.select().from(habits),
    cursor
      ? db.select().from(habitEntries).where(gt(habitEntries.updatedAt, cursor))
      : db.select().from(habitEntries),
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
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sync/route.ts
git commit -m "feat: sync categories and habits, and stop seeding server-side"
```

---

### Task 5: The engine pushes and merges three tables

**Files:**
- Modify: `src/lib/sync/engine.ts`

**Interfaces:**
- Consumes: `mergeRows`, `idKey`, `entryKey` (Task 1); `dirtyCategories`, `dirtyHabits`, `dirtyEntries` (Task 3); the envelope (Task 4)
- Produces: `sync(): Promise<{ pushed: number; pulled: number }>` — signature unchanged, so `startSyncLoop` and every caller keep working

- [ ] **Step 1: Replace the `sync` function**

In `src/lib/sync/engine.ts`, replace the imports and the `sync` function (leave `lastSyncAt` and `startSyncLoop` untouched):

```typescript
import {
  db,
  dirtyCategories,
  dirtyEntries,
  dirtyHabits,
  getMeta,
  setMeta,
} from "../db/local";
import { entryKey, idKey, mergeRows } from "./merge";
import type { Category, Habit, HabitEntry } from "../types";

const CURSOR = "syncCursor";
const LAST_SYNC = "lastSyncAt";

const BASE_INTERVAL_MS = 5 * 60_000;
const MAX_INTERVAL_MS = 30 * 60_000;

/** `dirty` is a local bookkeeping flag and has no meaning on the wire. */
function strip<T extends { dirty?: 1 | 0 }>(rows: T[]): Omit<T, "dirty">[] {
  return rows.map(({ dirty: _dirty, ...rest }) => rest);
}

export async function sync(): Promise<{ pushed: number; pulled: number }> {
  const [cats, habs, ents] = await Promise.all([
    dirtyCategories(),
    dirtyHabits(),
    dirtyEntries(),
  ]);
  const since = (await getMeta(CURSOR)) ?? null;

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      since,
      categories: strip(cats),
      habits: strip(habs),
      entries: strip(ents),
    }),
  });

  if (!res.ok) throw new Error(`sync failed: ${res.status}`);

  const pulled = (await res.json()) as {
    serverTime: string;
    categories: Category[];
    habits: Habit[];
    entries: HabitEntry[];
  };

  await db.transaction(
    "rw",
    db.categories,
    db.habits,
    db.habitEntries,
    db.meta,
    async () => {
      if (pulled.categories.length > 0) {
        const local = await db.categories.toArray();
        for (const row of mergeRows(local, pulled.categories, idKey)) {
          await db.categories.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.habits.length > 0) {
        const local = await db.habits.toArray();
        for (const row of mergeRows(local, pulled.habits, idKey)) {
          await db.habits.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.entries.length > 0) {
        const local = await db.habitEntries.toArray();
        for (const row of mergeRows(local, pulled.entries, entryKey)) {
          await db.habitEntries.put({ ...row, dirty: 0 });
        }
      }

      // Anything just pushed is now on the server.
      for (const c of cats) await db.categories.update(c.id, { dirty: 0 });
      for (const h of habs) await db.habits.update(h.id, { dirty: 0 });
      for (const e of ents) {
        await db.habitEntries.update([e.habitId, e.date], { dirty: 0 });
      }

      await setMeta(CURSOR, pulled.serverTime);
      await setMeta(LAST_SYNC, pulled.serverTime);
    },
  );

  return {
    pushed: cats.length + habs.length + ents.length,
    pulled:
      pulled.categories.length + pulled.habits.length + pulled.entries.length,
  };
}
```

- [ ] **Step 2: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 3: Verify a real round trip against dev Neon**

Run `npm run dev`, unlock in the browser, tick a habit, and wait for or trigger a sync (switching tabs away and back fires the focus trigger). Then confirm the write landed:

```bash
node --env-file=.env -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`select count(*) from habit_entries\`.then(r => console.log(r));
"
```

Expected: the count includes the tick you just made. If the request 500s, read the server log — a foreign key error here means the write order is wrong.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync/engine.ts
git commit -m "feat: sync pushes and merges all three tables"
```

---

### Task 6: Guard by default

Eleven routes are coming. An allowlist is a security bug waiting for the one route someone forgets to add, so the matcher inverts: everything is guarded unless it is explicitly public, and each exception has a stated reason.

**Files:**
- Modify: `src/proxy.ts`
- Test: `tests/unit/route-guard.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `config.matcher` — a single regex string, importable and testable

- [ ] **Step 1: Write the failing test**

Create `tests/unit/route-guard.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { config } from "@/proxy";

/**
 * The matcher is the whole guard. Reading it and believing it is how a route
 * ships unguarded, so every path is asserted.
 */
const matches = (path: string) =>
  new RegExp(`^${config.matcher[0]}$`).test(path);

describe("proxy matcher", () => {
  const guarded = [
    "/",
    "/habits",
    "/tasks",
    "/money",
    "/journal",
    "/settings",
    "/settings/projects",
    "/api/sync",
    "/api/journal",
    "/some/route/nobody/has/written/yet",
  ];

  for (const path of guarded) {
    it(`guards ${path}`, () => {
      expect(matches(path)).toBe(true);
    });
  }

  const publicPaths = [
    "/unlock",
    "/api/auth",
    "/api/health",
    "/manifest.webmanifest",
    "/sw.js",
    "/icons/icon-192.png",
    "/_next/static/chunk.js",
    "/favicon.ico",
  ];

  for (const path of publicPaths) {
    it(`leaves ${path} public`, () => {
      expect(matches(path)).toBe(false);
    });
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/route-guard.test.ts`
Expected: FAIL — the current allowlist matcher does not match `/` or `/tasks`.

- [ ] **Step 3: Invert the matcher**

In `src/proxy.ts`, replace the `config` export (leave the `proxy` function alone):

```typescript
export const config = {
  /**
   * A denylist, not an allowlist: a route added tomorrow is guarded unless
   * somebody deliberately excludes it. Every exception below has a reason.
   *
   *   unlock, api/auth  — the pages that issue the token
   *   api/health        — must answer when auth is what is broken
   *   manifest, sw.js,  — static assets the service worker fetches without
   *   icons, _next,       cookies; guarding them breaks install and offline
   *   favicon
   */
  matcher: [
    "/((?!unlock|api/auth|api/health|manifest|sw\\.js|icons/|_next/|favicon\\.ico).*)",
  ],
};
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/route-guard.test.ts`
Expected: PASS, all 18 cases.

- [ ] **Step 5: Verify in the browser, not just in the test**

Run `npm run dev`. In a private window, visit `/tasks` — expect a redirect to `/unlock`. Visit `/api/health` — expect JSON, no redirect. Unlock, then confirm the CSS renders and no static asset 404s appear in the network tab. A matcher that swallows `_next/` produces an app with no styling.

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts tests/unit/route-guard.test.ts
git commit -m "feat: guard every route by default"
```

---

### Task 7: The app shell

Four areas need one frame. The route group `(app)` shares a layout without appearing in any URL.

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/TabBar.tsx`, `src/components/MenuSheet.tsx`, `src/components/AppHeader.tsx`
- Move: `src/app/habits/page.tsx` → `src/app/(app)/habits/page.tsx`
- Delete: `src/app/page.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `<TabBar />`, `<MenuSheet />`, `<AppHeader title={string} right={ReactNode} />`, and the `(app)` layout that renders the tab bar under every guarded screen

- [ ] **Step 1: Build the tab bar**

Create `src/components/TabBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Four tabs, because five 44px targets on a phone is a row of mistaps.
 * Journal and Settings live in the hamburger — neither is a daily
 * destination.
 */
const TABS = [
  { href: "/", label: "HOME" },
  { href: "/habits", label: "HABITS" },
  { href: "/tasks", label: "TASKS" },
  { href: "/money", label: "MONEY" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 grid grid-cols-4"
      style={{
        borderTop: "1px solid var(--rule)",
        background: "var(--ground)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="flex h-11 items-center justify-center text-[10px] tracking-[0.14em]"
            style={{ color: active ? "var(--accent)" : "var(--type-muted)" }}
          >
            {active ? `[${tab.label}]` : tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Build the menu sheet**

Create `src/components/MenuSheet.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * A full-height sheet rather than a slide-out drawer: one component, dismissed
 * by tapping away like everything else in the app, and no focus-trap library.
 */
export function MenuSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="h-11 w-11 text-[15px]"
      >
        ≡
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "var(--ground)" }}
        >
          <div
            className="flex items-center justify-between px-3"
            style={{ borderBottom: "1px solid var(--rule)" }}
          >
            <span className="text-[13px] tracking-[0.12em]">LIFE_OS</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="h-11 w-11 text-[15px]"
            >
              ✕
            </button>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex h-14 items-center px-3 text-[12px] tracking-[0.12em]"
            style={{ borderBottom: "1px solid var(--rule)" }}
          >
            SETTINGS
          </Link>
        </div>
      )}
    </>
  );
}
```

Journal is added to this list in Phase 3. It is absent rather than disabled — a greyed-out row that does nothing is clutter.

- [ ] **Step 3: Build the shared header**

Create `src/components/AppHeader.tsx`:

```tsx
import type { ReactNode } from "react";
import { MenuSheet } from "./MenuSheet";

export function AppHeader({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  return (
    <header
      className="flex items-center justify-between gap-4 pr-3"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <div className="flex items-center gap-1">
        <MenuSheet />
        <span className="text-[13px] tracking-[0.12em]">{title}</span>
      </div>
      {right}
    </header>
  );
}
```

- [ ] **Step 4: Add the group layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { TabBar } from "@/components/TabBar";

/**
 * The frame every guarded screen sits in. The route group `(app)` shares this
 * layout without adding a segment to any URL — `/habits` stays `/habits`.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col">
      <div className="flex-1">{children}</div>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 5: Move the habits screen into the group**

```bash
mkdir -p "src/app/(app)/habits"
git mv src/app/habits/page.tsx "src/app/(app)/habits/page.tsx"
git rm src/app/page.tsx
```

Then in `src/app/(app)/habits/page.tsx`, replace the outer `<main>` so the shell owns the width and the header gains the hamburger:

```tsx
  return (
    <main className="w-full pb-6">
      <AppHeader
        title="LIFE_OS"
        right={<DayHeaderScore today={today} score={dayScore(habits, entries, today)} />}
      />
      <HabitGrid
        categories={categories}
        habits={habits}
        entries={entries}
        dates={dates}
        today={today}
        onTick={handleTick}
      />
      <SyncFooter lastSync={lastSync} />
    </main>
  );
```

Import `AppHeader` from `@/components/AppHeader`, and **replace** the whole of `src/components/DayHeader.tsx` — `AppHeader` now owns the frame and the `LIFE_OS` label, so the old `DayHeader` is dead code and goes:

```tsx
import { formatHeader } from "@/lib/date";
import { formatDayScore, type DayScore } from "@/lib/score";

/**
 * The date and the one number that matters today. The only display type on
 * the screen (Syne) — design doc §5.2, one display moment per screen.
 *
 * The frame that used to live here belongs to AppHeader now.
 */
export function DayHeaderScore({
  today,
  score,
}: {
  today: string;
  score: DayScore;
}) {
  return (
    <div className="text-right">
      <div
        className="text-[11px] tracking-[0.08em]"
        style={{ color: "var(--type-muted)" }}
      >
        {formatHeader(today)}
      </div>
      <div
        className="text-[17px] leading-tight"
        style={{
          fontFamily: "var(--font-syne), sans-serif",
          color: "var(--accent)",
        }}
      >
        {formatDayScore(score)}
      </div>
    </div>
  );
}
```

The e2e spine test asserts on the rendered score text (`/CORE \d+\/6 · \+\d+/`), which `DayHeaderScore` still produces, so it keeps passing.

- [ ] **Step 6: Check it renders**

Run: `npm run dev`, unlock, and confirm `/habits` shows the grid with a `≡` at top left and four tabs at the bottom, HABITS reading `[HABITS]`. Tap `≡` and confirm the sheet opens and closes.

- [ ] **Step 7: Commit**

```bash
git add -A src/app src/components
git commit -m "feat: app shell with tab bar and menu sheet"
```

---

### Task 8: Home

**Files:**
- Create: `src/app/(app)/page.tsx`, `src/components/HomeCard.tsx`

**Interfaces:**
- Consumes: `dayScore`, `formatDayScore` from `@/lib/score`; `<AppHeader />`
- Produces: `<HomeCard href={string} label={string} value={string} detail={ReactNode} />` — Phases 1, 2 and 3 each add one card and change nothing else

- [ ] **Step 1: Build the card**

Create `src/components/HomeCard.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One row of the Home summary. Every area renders exactly one, so the screen
 * grows by a card rather than by a rewrite.
 */
export function HomeCard({
  href,
  label,
  value,
  detail,
}: {
  href: string;
  label: string;
  value: string;
  detail?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block px-3 py-4"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span
          className="text-[10px] tracking-[0.18em]"
          style={{ color: "var(--type-muted)" }}
        >
          {label}
        </span>
        <span className="text-[13px]" style={{ color: "var(--accent)" }}>
          {value}
        </span>
      </div>
      {detail && (
        <div className="pt-1 text-[11px] tracking-[0.04em]">{detail}</div>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Build the screen**

Create `src/app/(app)/page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatHeader, rollingWindow, todayIST } from "@/lib/date";
import { dayScore, formatDayScore } from "@/lib/score";
import { db, entriesForDates, seedIfEmpty } from "@/lib/db/local";
import type { Habit, HabitEntry } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { HomeCard } from "@/components/HomeCard";

/**
 * Where do I stand today, in one screen. The habits-only redirect this
 * replaced was right when habits were the only thing to come to.
 */
export default function HomePage() {
  const [today] = useState(() => todayIST());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);

  const dates = useMemo(() => rollingWindow(today, 1), [today]);

  useEffect(() => {
    void (async () => {
      await navigator.storage?.persist?.();
      await seedIfEmpty();
      setHabits(await db.habits.toArray());
      setEntries(await entriesForDates(dates));
    })();
  }, [dates]);

  const score = dayScore(habits, entries, today);

  return (
    <main className="w-full pb-6">
      <AppHeader title={formatHeader(today)} />
      <HomeCard
        href="/habits"
        label="HABITS"
        value={`${score.coreDone} / ${score.coreTotal}`}
        detail={formatDayScore(score)}
      />
    </main>
  );
}
```

- [ ] **Step 3: Check it**

Run: `npm run dev`, unlock, and confirm `/` shows the date, the habits card, and `[HOME]` active in the tab bar. Tapping the card goes to `/habits`.

- [ ] **Step 4: Run everything**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass. The build is what catches a client component missing `"use client"`.

- [ ] **Step 5: Commit and push**

```bash
git add -A src/app src/components
git commit -m "feat: home summary screen"
git push origin dev
```

Phase 0 is complete. Confirm the preview deployment builds and `/` renders before starting Phase 1.

---

# PHASE 1 — TASKS

### Task 9: Task types and pure task logic

Sorting and overdue arithmetic are pure functions with no React and no Dexie, so they are the part worth testing hardest.

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/tasks.ts`, `tests/unit/tasks.test.ts`

**Interfaces:**
- Consumes: `ISODate` from `@/lib/date`, `Priority` from `@/lib/types`
- Produces: `Project`, `Task` types; `sortTasks(tasks: Task[]): Task[]`, `overdueDays(due: ISODate | null, today: ISODate): number`, `formatDue(due: ISODate | null, today: ISODate): string`

- [ ] **Step 1: Add the types**

Append to `src/lib/types.ts`:

```typescript
export interface Project {
  id: string;
  name: string;
  sortOrder: number;
  /** Archived projects stay, so old tasks keep their tag. */
  active: boolean;
  updatedAt: string;
  dirty?: 1 | 0;
}

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  /** null = unfiled, which is a real state and not a missing value. */
  projectId: string | null;
  due: ISODate | null;
  /**
   * A plain boolean, unlike `dirty`, because it is never a Dexie index —
   * task volume is tens of rows and filtering happens in memory.
   */
  done: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  dirty?: 1 | 0;
}
```

`ISODate` is already imported at the top of the file.

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/tasks.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sortTasks, overdueDays, formatDue } from "@/lib/tasks";
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
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run tests/unit/tasks.test.ts`
Expected: FAIL — `@/lib/tasks` does not exist.

- [ ] **Step 4: Implement**

Create `src/lib/tasks.ts`:

```typescript
import { formatHeader, type ISODate } from "./date";
import type { Priority, Task } from "./types";

const RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

const DAY_MS = 86_400_000;

/**
 * Priority, then due date, then creation order. Undated tasks sit last within
 * their priority band — never below a lower priority, because "no date" is not
 * "less important".
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const byPriority = RANK[a.priority] - RANK[b.priority];
    if (byPriority !== 0) return byPriority;

    if (a.due !== b.due) {
      if (a.due === null) return 1;
      if (b.due === null) return -1;
      return a.due < b.due ? -1 : 1;
    }

    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

/** Whole days past the due date, or 0 if it is not past. */
export function overdueDays(due: ISODate | null, today: ISODate): number {
  if (!due || due >= today) return 0;
  return Math.round((Date.parse(today) - Date.parse(due)) / DAY_MS);
}

/** `'TODAY'`, `'TOMORROW'`, or `'WED 05 AUG'`. */
export function formatDue(due: ISODate | null, today: ISODate): string {
  if (!due) return "";
  if (due === today) return "TODAY";
  const tomorrow = new Date(Date.parse(today) + DAY_MS)
    .toISOString()
    .slice(0, 10);
  if (due === tomorrow) return "TOMORROW";
  return formatHeader(due);
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/tasks.test.ts`
Expected: PASS, all 17 cases.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/tasks.ts tests/unit/tasks.test.ts
git commit -m "feat: task sorting and overdue arithmetic"
```

---

### Task 10: Storage for tasks, both sides

**Files:**
- Modify: `src/lib/db/local.ts` (Dexie v3), `src/lib/db/seed.ts`, `src/lib/db/schema.ts`
- Create: a generated migration in `drizzle/`

**Interfaces:**
- Consumes: `Project`, `Task` (Task 9)
- Produces: `db.projects`, `db.tasks`; `SEED_PROJECTS: Project[]`; `dirtyProjects()`, `dirtyTasks()`, `putProject(p)`, `putTask(t)`; Postgres `projects` and `tasks` tables

- [ ] **Step 1: Write the failing seed test**

Append to `tests/unit/seed.test.ts`:

```typescript
import { SEED_PROJECTS } from "@/lib/db/seed";

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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/seed.test.ts`
Expected: FAIL — `SEED_PROJECTS` is not exported.

- [ ] **Step 3: Add the seed**

Append to `src/lib/db/seed.ts`, and add `Project` to the type import on line 1:

```typescript
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
```

- [ ] **Step 4: Add Dexie version 3**

In `src/lib/db/local.ts`, add the table declarations to the class:

```typescript
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
```

and add version 3 after version 2 in the constructor:

```typescript
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
```

Then extend `seedIfEmpty` to cover projects and add the helpers:

```typescript
export async function seedIfEmpty(): Promise<void> {
  if ((await db.habits.count()) === 0) {
    await db.transaction("rw", db.categories, db.habits, async () => {
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
```

Import `Project`, `Task` and `SEED_PROJECTS` at the top of the file.

- [ ] **Step 5: Add the server tables**

Append to `src/lib/db/schema.ts`:

```typescript
export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  priority: text("priority").notNull(),
  /** Nullable: unfiled is a real state. */
  projectId: text("project_id").references(() => projects.id),
  due: date("due"),
  // A completed task is never deleted — it is the only record of what got
  // finished.
  done: boolean("done").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 6: Generate and apply the migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: a new `drizzle/` file creating both tables, applied to the dev branch.

- [ ] **Step 7: Test and verify the upgrade**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

Then `npm run dev`, unlock, and check devtools → IndexedDB → `lifeos` shows `projects` holding four rows and an empty `tasks` table. A device that already had v2 data must still show its habits.

- [ ] **Step 8: Commit**

```bash
git add -A src/lib/db drizzle tests/unit/seed.test.ts
git commit -m "feat: project and task storage, local and server"
```

---

### Task 11: Tasks join the sync envelope

**Files:**
- Modify: `src/app/api/sync/route.ts`, `src/lib/sync/engine.ts`

**Interfaces:**
- Consumes: the three-table envelope (Tasks 4 and 5)
- Produces: the envelope gains `projects: Project[]` and `tasks: Task[]` in both directions

- [ ] **Step 1: Extend the route**

In `src/app/api/sync/route.ts`, add `projects, tasks` to the schema import, extend the `Envelope` interface with `projects: Project[]` and `tasks: Task[]`, add `Project, Task` to the type import, and insert these two blocks **after** the habit-entries block (projects before tasks — the foreign key runs that way):

```typescript
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
```

Add both to the pull, alongside the existing three:

```typescript
    cursor
      ? db.select().from(projects).where(gt(projects.updatedAt, cursor))
      : db.select().from(projects),
    cursor
      ? db.select().from(tasks).where(gt(tasks.updatedAt, cursor))
      : db.select().from(tasks),
```

and to the response:

```typescript
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
```

- [ ] **Step 2: Extend the engine**

In `src/lib/sync/engine.ts`: import `dirtyProjects, dirtyTasks`, add them to the `Promise.all`, add `projects: strip(projs)` and `tasks: strip(tsks)` to the request body, add both to the pulled response type, add `db.projects, db.tasks` to the transaction's table list, and add the merge and clear-dirty blocks following the pattern already there:

```typescript
      if (pulled.projects.length > 0) {
        const local = await db.projects.toArray();
        for (const row of mergeRows(local, pulled.projects, idKey)) {
          await db.projects.put({ ...row, dirty: 0 });
        }
      }

      if (pulled.tasks.length > 0) {
        const local = await db.tasks.toArray();
        for (const row of mergeRows(local, pulled.tasks, idKey)) {
          await db.tasks.put({ ...row, dirty: 0 });
        }
      }
```

```typescript
      for (const p of projs) await db.projects.update(p.id, { dirty: 0 });
      for (const t of tsks) await db.tasks.update(t.id, { dirty: 0 });
```

Include both in the returned `pushed` and `pulled` counts.

- [ ] **Step 3: Prove the write order with a round trip**

Run `npm run dev`, unlock, and in the browser console create a project and a task referencing it in one go, then sync:

```javascript
const now = new Date().toISOString();
const pid = crypto.randomUUID();
await db.projects.put({ id: pid, name: "TEMP", sortOrder: 9, active: true, updatedAt: now, dirty: 1 });
await db.tasks.put({ id: crypto.randomUUID(), title: "FK CHECK", priority: "P2", projectId: pid, due: null, done: false, completedAt: null, createdAt: now, updatedAt: now, dirty: 1 });
```

(`db` is not on `window`; run this from the Sources panel with a breakpoint inside the app, or add a temporary `window.db = db` line and remove it after.)

Expected: the sync returns 200. A 500 with `violates foreign key constraint "tasks_project_id_projects_id_fk"` means the project insert is not running before the task insert.

Delete the temporary rows afterwards.

- [ ] **Step 4: Test and commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add src/app/api/sync/route.ts src/lib/sync/engine.ts
git commit -m "feat: sync projects and tasks"
```

---

### Task 12: The task row

**Files:**
- Create: `src/components/TaskRow.tsx`, `tests/unit/TaskRow.test.tsx`

**Interfaces:**
- Consumes: `formatDue`, `overdueDays` (Task 9)
- Produces: `<TaskRow task={Task} projectName={string | null} today={ISODate} onToggle={(id: string) => void} />`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/TaskRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "@/components/TaskRow";
import type { Task } from "@/lib/types";

const task: Task = {
  id: "t1",
  title: "MENU PRICING FIX",
  priority: "P1",
  projectId: "smashed",
  due: "2026-07-23",
  done: false,
  completedAt: null,
  createdAt: "2026-07-20T00:00:00Z",
  updatedAt: "2026-07-20T00:00:00Z",
};

const today = "2026-07-31";

describe("TaskRow", () => {
  it("shows the title, priority and project", () => {
    render(
      <TaskRow task={task} projectName="SMASHED" today={today} onToggle={() => {}} />,
    );
    expect(screen.getByText("MENU PRICING FIX")).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("SMASHED")).toBeInTheDocument();
  });

  it("shows the overdue count for a past due date", () => {
    render(
      <TaskRow task={task} projectName="SMASHED" today={today} onToggle={() => {}} />,
    );
    expect(screen.getByText("+8d")).toBeInTheDocument();
  });

  it("shows no overdue marker for a task due today", () => {
    render(
      <TaskRow
        task={{ ...task, due: today }}
        projectName="SMASHED"
        today={today}
        onToggle={() => {}}
      />,
    );
    expect(screen.queryByText(/\+\d+d/)).not.toBeInTheDocument();
  });

  it("renders nothing for the project when the task is unfiled", () => {
    render(
      <TaskRow
        task={{ ...task, projectId: null }}
        projectName={null}
        today={today}
        onToggle={() => {}}
      />,
    );
    expect(screen.queryByText("SMASHED")).not.toBeInTheDocument();
  });

  it("calls onToggle with the task id when the tick target is pressed", async () => {
    const onToggle = vi.fn();
    render(
      <TaskRow task={task} projectName="SMASHED" today={today} onToggle={onToggle} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /MENU PRICING FIX/ }));
    expect(onToggle).toHaveBeenCalledWith("t1");
  });

  it("marks a completed task as checked for assistive technology", () => {
    render(
      <TaskRow
        task={{ ...task, done: true }}
        projectName="SMASHED"
        today={today}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /MENU PRICING FIX/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
```

If `@testing-library/user-event` is not installed, run `npm install -D @testing-library/user-event` first and include `package.json` and `package-lock.json` in this task's commit.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/TaskRow.test.tsx`
Expected: FAIL — `@/components/TaskRow` does not exist.

- [ ] **Step 3: Implement**

Create `src/components/TaskRow.tsx`:

```tsx
"use client";

import { formatDue, overdueDays } from "@/lib/tasks";
import type { Task } from "@/lib/types";

/**
 * The shape rule, design doc §5.3 and non-negotiable: priority is a FILLED
 * solid block, project is an OUTLINED tag. Two shapes, not two hues — a
 * colour-only distinction disappears for half the people who look at it and
 * for all of us in sunlight.
 *
 * The whole row is the tick target, not the little box.
 */
export function TaskRow({
  task,
  projectName,
  today,
  onToggle,
}: {
  task: Task;
  projectName: string | null;
  today: string;
  onToggle: (id: string) => void;
}) {
  const late = overdueDays(task.due, today);

  return (
    <button
      type="button"
      aria-pressed={task.done}
      onClick={() => onToggle(task.id)}
      className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 py-2 text-left"
      style={{ borderBottom: "1px solid var(--rule)", minHeight: "72px" }}
    >
      <span
        aria-hidden="true"
        className="flex h-full items-center justify-center text-[13px]"
        style={{ color: task.done ? "var(--accent)" : "var(--type-muted)" }}
      >
        {task.done ? "■" : "[ ]"}
      </span>

      <span className="min-w-0">
        <span
          className="block truncate text-[12px] tracking-[0.04em]"
          style={{ color: task.done ? "var(--type-muted)" : "var(--type)" }}
        >
          {task.title}
        </span>

        <span className="flex items-center gap-2 pt-1">
          {/* Filled block — priority. */}
          <span
            className="px-1 text-[10px] tracking-[0.1em]"
            style={{ background: "var(--accent)", color: "var(--ground)" }}
          >
            {task.priority}
          </span>

          {/* Outlined tag — project. */}
          {projectName && (
            <span
              className="px-1 text-[10px] tracking-[0.1em]"
              style={{
                border: "1px solid var(--rule)",
                color: "var(--type-muted)",
              }}
            >
              {projectName}
            </span>
          )}
        </span>
      </span>

      <span className="pr-3 text-right text-[10px] tracking-[0.08em]">
        <span className="block" style={{ color: "var(--type-muted)" }}>
          {formatDue(task.due, today)}
        </span>
        {/* Overdue is urgency, so it earns --alert. The row itself does not
            recolour — a wall of red stops meaning anything. */}
        {late > 0 && (
          <span className="block" style={{ color: "var(--alert)" }}>
            +{late}d
          </span>
        )}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/TaskRow.test.tsx`
Expected: PASS, all six cases.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskRow.tsx tests/unit/TaskRow.test.tsx package.json package-lock.json
git commit -m "feat: task row with the priority-block, project-tag shape rule"
```

---

### Task 13: The sheet primitive and the capture sheet

Target: **title plus one tap to save.**

**Files:**
- Create: `src/components/Sheet.tsx`, `src/components/CaptureSheet.tsx`

**Interfaces:**
- Consumes: `Project`, `Priority`, `Task`; `todayIST` from `@/lib/date`
- Produces: `<Sheet open={boolean} title={string} onClose={() => void}>{children}</Sheet>`; `<CaptureSheet open projects={Project[]} defaultProjectId={string | null} onSave={(t: Task) => void} onClose={() => void} />`

- [ ] **Step 1: Build the sheet primitive**

Create `src/components/Sheet.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

/** A bottom sheet. Tap the backdrop to dismiss — no confirmation, ever. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1"
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      <div
        role="dialog"
        aria-label={title}
        className="px-3 pb-6 pt-3"
        style={{
          background: "var(--ground)",
          borderTop: "1px solid var(--rule)",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <h2
          className="pb-3 text-[10px] tracking-[0.18em]"
          style={{ color: "var(--type-muted)" }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the capture sheet**

Create `src/components/CaptureSheet.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { todayIST } from "@/lib/date";
import type { Priority, Project, Task } from "@/lib/types";
import { Sheet } from "./Sheet";

const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P4"];

type DueChoice = "today" | "tomorrow" | "none";

export function CaptureSheet({
  open,
  projects,
  defaultProjectId,
  onSave,
  onClose,
}: {
  open: boolean;
  projects: Project[];
  defaultProjectId: string | null;
  onSave: (task: Task) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("P2");
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [due, setDue] = useState<DueChoice>("today");
  const input = useRef<HTMLInputElement>(null);

  // Keyboard up the moment the sheet opens. Anything slower and the capture
  // costs a second tap.
  useEffect(() => {
    if (open) {
      setTitle("");
      setPriority("P2");
      setProjectId(defaultProjectId);
      setDue("today");
      input.current?.focus();
    }
  }, [open, defaultProjectId]);

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const today = todayIST();
    const now = new Date().toISOString();
    const dueDate =
      due === "none"
        ? null
        : due === "today"
          ? today
          : new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);

    onSave({
      id: crypto.randomUUID(),
      title: trimmed.toUpperCase(),
      priority,
      projectId,
      due: dueDate,
      done: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    onClose();
  };

  return (
    <Sheet open={open} title="NEW TASK" onClose={onClose}>
      <input
        ref={input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        aria-label="Task title"
        className="w-full bg-transparent px-2 py-3 text-[13px] outline-none"
        style={{ border: "1px solid var(--rule)", color: "var(--type)" }}
      />

      <Field label="PRIORITY">
        {PRIORITIES.map((p) => (
          <Block key={p} on={priority === p} onClick={() => setPriority(p)}>
            {p}
          </Block>
        ))}
      </Field>

      <Field label="PROJECT">
        {projects
          .filter((p) => p.active)
          .map((p) => (
            <Tag
              key={p.id}
              on={projectId === p.id}
              onClick={() => setProjectId(projectId === p.id ? null : p.id)}
            >
              {p.name}
            </Tag>
          ))}
      </Field>

      <Field label="DUE">
        <Tag on={due === "today"} onClick={() => setDue("today")}>TODAY</Tag>
        <Tag on={due === "tomorrow"} onClick={() => setDue("tomorrow")}>TOMORROW</Tag>
        <Tag on={due === "none"} onClick={() => setDue("none")}>NONE</Tag>
      </Field>

      <button
        type="button"
        onClick={save}
        disabled={!title.trim()}
        className="mt-4 h-11 w-full text-[12px] tracking-[0.14em] disabled:opacity-40"
        style={{ background: "var(--accent)", color: "var(--ground)" }}
      >
        SAVE
      </button>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pt-3">
      <span
        className="w-16 shrink-0 text-[10px] tracking-[0.14em]"
        style={{ color: "var(--type-muted)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** Filled block — a tier-like choice. Design doc §5.3. */
function Block({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="h-11 shrink-0 px-2 text-[11px] tracking-[0.1em]"
      style={{
        background: on ? "var(--accent)" : "transparent",
        color: on ? "var(--ground)" : "var(--type-muted)",
      }}
    >
      {children}
    </button>
  );
}

/** Outlined tag — a category-like choice. Design doc §5.3. */
function Tag({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="h-11 shrink-0 px-2 text-[11px] tracking-[0.1em]"
      style={{
        border: `1px solid ${on ? "var(--accent)" : "var(--rule)"}`,
        color: on ? "var(--accent)" : "var(--type-muted)",
      }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sheet.tsx src/components/CaptureSheet.tsx
git commit -m "feat: capture sheet, title plus one tap to save"
```

---

### Task 14: The tasks screen

**Files:**
- Create: `src/app/(app)/tasks/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 9–13
- Produces: the `/tasks` route

- [ ] **Step 1: Build the screen**

Create `src/app/(app)/tasks/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { todayIST } from "@/lib/date";
import { sortTasks } from "@/lib/tasks";
import {
  db,
  getMeta,
  putTask,
  seedIfEmpty,
  setMeta,
} from "@/lib/db/local";
import type { Project, Task } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { CaptureSheet } from "@/components/CaptureSheet";
import { SyncFooter } from "@/components/SyncFooter";
import { TaskRow } from "@/components/TaskRow";
import { lastSyncAt, startSyncLoop } from "@/lib/sync/engine";

const LAST_PROJECT = "lastProjectId";
const UNDO_MS = 5000;

export default function TasksPage() {
  const [today] = useState(() => todayIST());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastProject, setLastProject] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [undo, setUndo] = useState<Task | null>(null);
  const [lastSync, setLastSync] = useState<string | undefined>();

  const reload = useCallback(async () => {
    setTasks(await db.tasks.toArray());
    setProjects(await db.projects.toArray());
    setLastSync(await lastSyncAt());
  }, []);

  useEffect(() => {
    void (async () => {
      await seedIfEmpty();
      setLastProject((await getMeta(LAST_PROJECT)) ?? null);
      await reload();
    })();
  }, [reload]);

  useEffect(() => startSyncLoop(() => void reload()), [reload]);

  // The undo window closes on its own. Nothing is deleted either way — the
  // row is only marked done — so a missed undo costs one tap to reverse.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const handleSave = async (task: Task) => {
    setTasks((prev) => [...prev, task]);
    await putTask(task);
    if (task.projectId) {
      setLastProject(task.projectId);
      await setMeta(LAST_PROJECT, task.projectId);
    }
  };

  const handleToggle = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const now = new Date().toISOString();
    const next: Task = {
      ...task,
      done: !task.done,
      completedAt: task.done ? null : now,
      updatedAt: now,
    };

    setTasks((prev) => prev.map((t) => (t.id === id ? next : t)));
    await putTask(next);
    setUndo(next.done ? task : null);
  };

  const handleUndo = async () => {
    if (!undo) return;
    const restored: Task = { ...undo, updatedAt: new Date().toISOString() };
    setTasks((prev) => prev.map((t) => (t.id === restored.id ? restored : t)));
    await putTask(restored);
    setUndo(null);
  };

  const open = sortTasks(tasks.filter((t) => !t.done));
  const doneToday = tasks.filter(
    (t) => t.done && t.completedAt && t.completedAt.slice(0, 10) === today,
  ).length;

  const projectName = (id: string | null) =>
    projects.find((p) => p.id === id)?.name ?? null;

  return (
    <main className="w-full pb-6">
      <AppHeader
        title="TASK_LEDGER"
        right={
          <span className="text-[11px]" style={{ color: "var(--accent)" }}>
            {open.length} OPEN
          </span>
        }
      />

      {open.length === 0 ? (
        <p
          className="px-3 py-8 text-center text-[11px] tracking-[0.1em]"
          style={{ color: "var(--type-muted)" }}
        >
          NOTHING OPEN
        </p>
      ) : (
        open.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            projectName={projectName(task.projectId)}
            today={today}
            onToggle={handleToggle}
          />
        ))
      )}

      {doneToday > 0 && (
        <p
          className="px-3 py-3 text-[10px] tracking-[0.14em]"
          style={{ color: "var(--type-muted)" }}
        >
          DONE TODAY {doneToday}
        </p>
      )}

      <SyncFooter lastSync={lastSync} />

      {undo && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-11 z-40 mx-auto flex max-w-2xl items-center justify-between px-3 py-3"
          style={{
            background: "var(--type)",
            color: "var(--ground)",
          }}
        >
          <span className="truncate text-[11px]">{undo.title} DONE</span>
          <button
            type="button"
            onClick={handleUndo}
            className="h-11 px-2 text-[11px] tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            UNDO
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label="New task"
        onClick={() => setCapturing(true)}
        className="fixed bottom-16 right-4 z-30 h-14 w-14 rounded-full text-[20px]"
        style={{ background: "var(--accent)", color: "var(--ground)" }}
      >
        +
      </button>

      <CaptureSheet
        open={capturing}
        projects={projects}
        defaultProjectId={lastProject}
        onSave={handleSave}
        onClose={() => setCapturing(false)}
      />
    </main>
  );
}
```

- [ ] **Step 2: Use it**

Run: `npm run dev`, unlock, go to `/tasks`. Capture three tasks with different priorities and due dates. Confirm they sort P1 first, that an overdue one shows `+Nd` in the alert tone, that ticking collapses it into `DONE TODAY` with an undo bar, and that undo brings it back.

- [ ] **Step 3: Check it survives a reload and reaches the server**

Reload the page — the tasks must still be there. Then confirm they landed:

```bash
node --env-file=.env -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`select id, title, priority, due, done from tasks order by created_at\`.then(r => console.table(r));
"
```

- [ ] **Step 4: Test and commit**

Run: `npx tsc --noEmit && npm test && npm run build`

```bash
git add "src/app/(app)/tasks/page.tsx"
git commit -m "feat: task ledger with capture, complete and undo"
```

---

### Task 15: Settings and project management

**Files:**
- Create: `src/components/ListEditor.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/projects/page.tsx`
- Modify: `src/app/api/auth/route.ts`

**Interfaces:**
- Consumes: `putProject`, `db` from `@/lib/db/local`
- Produces: `<ListEditor items={ListItem[]} onRename={(id, name) => void} onReorder={(id, direction: -1 | 1) => void} onAdd={(name) => void} onArchive={(id) => void} />` where `ListItem = { id: string; name: string; blocked?: string | null }` — the blocked reason travels on the item, not as a separate callback; `DELETE /api/auth` clearing the cookie

- [ ] **Step 1: Build the shared list editor**

Create `src/components/ListEditor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";

export interface ListItem {
  id: string;
  name: string;
  /** Non-null means archive-only, and says why. */
  blocked?: string | null;
}

/**
 * Every Settings list is this component. Reorder is `↑ ↓`, not drag and drop —
 * dragging is miserable on a phone and needs a library.
 *
 * The destructive button reads DELETE or ARCHIVE depending on whether anything
 * references the row, decided before the sheet opens. A button that says what
 * it will do removes the need for a confirmation dialog.
 */
export function ListEditor({
  items,
  onRename,
  onReorder,
  onAdd,
  onArchive,
}: {
  items: ListItem[];
  onRename: (id: string, name: string) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
  onAdd: (name: string) => void;
  onArchive: (id: string) => void;
}) {
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const openEditor = (item: ListItem) => {
    setDraft(item.name);
    setEditing(item);
  };

  return (
    <>
      {items.map((item, i) => (
        <div
          key={item.id}
          className="flex items-center gap-1 px-3"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <span className="min-w-0 flex-1 truncate text-[12px] tracking-[0.04em]">
            {item.name}
          </span>
          <button
            type="button"
            aria-label={`Move ${item.name} up`}
            disabled={i === 0}
            onClick={() => onReorder(item.id, -1)}
            className="h-11 w-8 text-[12px] disabled:opacity-25"
            style={{ color: "var(--type-muted)" }}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move ${item.name} down`}
            disabled={i === items.length - 1}
            onClick={() => onReorder(item.id, 1)}
            className="h-11 w-8 text-[12px] disabled:opacity-25"
            style={{ color: "var(--type-muted)" }}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={`Edit ${item.name}`}
            onClick={() => openEditor(item)}
            className="h-11 w-8 text-[12px]"
            style={{ color: "var(--type-muted)" }}
          >
            ›
          </button>
        </div>
      ))}

      <button
        type="button"
        aria-label="Add"
        onClick={() => {
          setDraft("");
          setAdding(true);
        }}
        className="fixed bottom-16 right-4 z-30 h-14 w-14 rounded-full text-[20px]"
        style={{ background: "var(--accent)", color: "var(--ground)" }}
      >
        +
      </button>

      <Sheet
        open={adding || editing !== null}
        title={adding ? "NEW" : "EDIT"}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Name"
          className="w-full bg-transparent px-2 py-3 text-[13px] outline-none"
          style={{ border: "1px solid var(--rule)", color: "var(--type)" }}
        />

        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => {
            const name = draft.trim().toUpperCase();
            if (adding) onAdd(name);
            else if (editing) onRename(editing.id, name);
            setAdding(false);
            setEditing(null);
          }}
          className="mt-4 h-11 w-full text-[12px] tracking-[0.14em] disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--ground)" }}
        >
          SAVE
        </button>

        {editing && (
          <>
            <button
              type="button"
              onClick={() => {
                onArchive(editing.id);
                setEditing(null);
              }}
              className="mt-2 h-11 w-full text-[12px] tracking-[0.14em]"
              style={{
                border: "1px solid var(--alert)",
                color: "var(--alert)",
              }}
            >
              ARCHIVE
            </button>
            {editing.blocked && (
              <p
                className="pt-2 text-center text-[10px] tracking-[0.1em]"
                style={{ color: "var(--type-muted)" }}
              >
                {editing.blocked}
              </p>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
```

Archive rather than delete is always safe here, which is why this component has no delete path: a project with tasks must not vanish, and a project without tasks costs nothing to keep. Habits in Phase 4 get the delete-or-archive split, because a never-used habit really is worth deleting.

- [ ] **Step 2: Build the projects screen**

Create `src/app/(app)/settings/projects/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { db, putProject, seedIfEmpty } from "@/lib/db/local";
import type { Project, Task } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { ListEditor, type ListItem } from "@/components/ListEditor";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const reload = useCallback(async () => {
    setProjects((await db.projects.toArray()).sort((a, b) => a.sortOrder - b.sortOrder));
    setTasks(await db.tasks.toArray());
  }, []);

  useEffect(() => {
    void (async () => {
      await seedIfEmpty();
      await reload();
    })();
  }, [reload]);

  const stamp = () => new Date().toISOString();

  const items: ListItem[] = projects
    .filter((p) => p.active)
    .map((p) => {
      const count = tasks.filter((t) => t.projectId === p.id).length;
      return {
        id: p.id,
        name: p.name,
        blocked: count > 0 ? `${count} TASKS KEEP THIS TAG` : null,
      };
    });

  const onRename = async (id: string, name: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    await putProject({ ...p, name, updatedAt: stamp() });
    await reload();
  };

  const onAdd = async (name: string) => {
    const max = projects.reduce((m, p) => Math.max(m, p.sortOrder), 0);
    await putProject({
      id: crypto.randomUUID(),
      name,
      sortOrder: max + 1,
      active: true,
      updatedAt: stamp(),
    });
    await reload();
  };

  const onArchive = async (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    await putProject({ ...p, active: false, updatedAt: stamp() });
    await reload();
  };

  /** Swapping sortOrder with the neighbour keeps the values dense. */
  const onReorder = async (id: string, direction: -1 | 1) => {
    const active = projects.filter((p) => p.active);
    const i = active.findIndex((p) => p.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= active.length) return;

    const a = active[i];
    const b = active[j];
    const now = stamp();
    await putProject({ ...a, sortOrder: b.sortOrder, updatedAt: now });
    await putProject({ ...b, sortOrder: a.sortOrder, updatedAt: now });
    await reload();
  };

  return (
    <main className="w-full pb-24">
      <AppHeader title="PROJECTS" />
      <ListEditor
        items={items}
        onRename={onRename}
        onReorder={onReorder}
        onAdd={onAdd}
        onArchive={onArchive}
      />
    </main>
  );
}
```

- [ ] **Step 3: Build the settings index**

Create `src/app/(app)/settings/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/db/local";
import { lastSyncAt } from "@/lib/sync/engine";
import { AppHeader } from "@/components/AppHeader";

const ENV_LABEL =
  process.env.NEXT_PUBLIC_ENV_LABEL === "dev" ? "LIFE_OS · DEV" : "LIFE_OS";

export default function SettingsPage() {
  const [counts, setCounts] = useState({ projects: 0, tasks: 0, entries: 0 });
  const [synced, setSynced] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      setCounts({
        projects: await db.projects.filter((p) => p.active).count(),
        tasks: await db.tasks.count(),
        entries: await db.habitEntries.count(),
      });
      setSynced(await lastSyncAt());
    })();
  }, []);

  const lock = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/unlock";
  };

  return (
    <main className="w-full pb-6">
      <AppHeader title="SETTINGS" />

      <Link
        href="/settings/projects"
        className="flex items-center justify-between px-3 py-4 text-[12px] tracking-[0.08em]"
        style={{ borderBottom: "1px solid var(--rule)" }}
      >
        <span>TASK PROJECTS</span>
        <span style={{ color: "var(--type-muted)" }}>{counts.projects} ›</span>
      </Link>

      <p
        className="px-3 pt-6 text-[10px] leading-relaxed tracking-[0.1em]"
        style={{ color: "var(--type-muted)" }}
      >
        {ENV_LABEL}
        <br />
        {counts.entries} TICKS · {counts.tasks} TASKS
        <br />
        SYNCED{" "}
        {synced
          ? new Date(synced).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            })
          : "NEVER"}
      </p>

      <button
        type="button"
        onClick={lock}
        className="mx-3 mt-6 h-11 w-[calc(100%-1.5rem)] text-[12px] tracking-[0.14em]"
        style={{ border: "1px solid var(--rule)", color: "var(--type)" }}
      >
        LOCK
      </button>
    </main>
  );
}
```

Habits, habit categories, money categories and accounts join this index in their own phases. Listing them now as dead rows would be clutter.

- [ ] **Step 4: Add the lock handler**

Append to `src/app/api/auth/route.ts`:

```typescript
/**
 * Locking clears the token. Local data is deliberately left alone — the whole
 * point of the ledger is that it survives, and the next unlock needs no
 * network.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
```

Check the existing imports at the top of that file already include `NextResponse` and `COOKIE_NAME`; add whichever is missing.

- [ ] **Step 5: Use it**

Run: `npm run dev`, unlock, open `≡` → SETTINGS. Rename a project, reorder two, add one, archive one, and confirm `/tasks` capture reflects each change. Then tap LOCK and confirm you land on `/unlock` and cannot reach `/tasks` without the PIN.

- [ ] **Step 6: Test and commit**

Run: `npx tsc --noEmit && npm test && npm run build`

```bash
git add -A "src/app/(app)/settings" src/components/ListEditor.tsx src/app/api/auth/route.ts
git commit -m "feat: settings with project management and lock"
```

---

### Task 16: The Home task card

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `sortTasks` (Task 9), `<HomeCard />` (Task 8)
- Produces: nothing new

- [ ] **Step 1: Add the card**

In `src/app/(app)/page.tsx`, add to the imports:

```typescript
import { sortTasks } from "@/lib/tasks";
import type { Project, Task } from "@/lib/types";
```

add state and loading:

```typescript
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
```

inside the existing `useEffect`, after `setEntries(...)`:

```typescript
      setTasks(await db.tasks.toArray());
      setProjects(await db.projects.toArray());
```

before the `return`:

```typescript
  const open = sortTasks(tasks.filter((t) => !t.done));
  const next = open[0];
  const nextProject =
    projects.find((p) => p.id === next?.projectId)?.name ?? null;
```

and after the habits card:

```tsx
      <HomeCard
        href="/tasks"
        label="TASKS"
        value={`${open.length} OPEN`}
        detail={
          next ? (
            <span className="flex items-center gap-2">
              <span
                className="px-1 text-[10px] tracking-[0.1em]"
                style={{ background: "var(--accent)", color: "var(--ground)" }}
              >
                {next.priority}
              </span>
              <span className="truncate">{next.title}</span>
              {nextProject && (
                <span
                  className="shrink-0 px-1 text-[10px] tracking-[0.1em]"
                  style={{
                    border: "1px solid var(--rule)",
                    color: "var(--type-muted)",
                  }}
                >
                  {nextProject}
                </span>
              )}
            </span>
          ) : (
            "NOTHING OPEN"
          )
        }
      />
```

- [ ] **Step 2: Check it**

Run: `npm run dev`, unlock, and confirm `/` shows both cards and the task card names the highest-priority open task.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat: task summary on home"
```

---

### Task 17: End-to-end proof

The spine test proves habits survive going offline. This proves the same for tasks, which is the whole claim the app makes.

**Files:**
- Create: `tests/e2e/tasks.spec.ts`

**Interfaces:**
- Consumes: the running app
- Produces: nothing

- [ ] **Step 1: Write the test**

Create `tests/e2e/tasks.spec.ts`:

```typescript
import { test, expect, type Page } from "@playwright/test";

const PIN = process.env.E2E_PIN ?? "123456";

async function unlock(page: Page) {
  await page.goto("/unlock");
  for (const digit of PIN) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.waitForURL("**/habits");
}

async function capture(page: Page, title: string) {
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByLabel("Task title").fill(title);
  await page.getByRole("button", { name: "SAVE" }).click();
}

test("captures, completes and undoes a task", async ({ page }) => {
  await unlock(page);
  await page.goto("/tasks");

  await capture(page, "buy filters");
  const row = page.getByRole("button", { name: /BUY FILTERS/ });
  await expect(row).toBeVisible();
  // Capture uppercases, because the whole ledger is uppercase.
  await expect(page.getByText("BUY FILTERS")).toBeVisible();

  // Survives a reload: the write went to IndexedDB, not just React state.
  await page.reload();
  await expect(page.getByRole("button", { name: /BUY FILTERS/ })).toBeVisible();

  // Completing collapses it out of the open list, with an undo.
  await page.getByRole("button", { name: /BUY FILTERS/ }).click();
  await expect(page.getByRole("status")).toContainText("DONE");
  await expect(page.getByText("DONE TODAY 1")).toBeVisible();

  await page.getByRole("button", { name: "UNDO" }).click();
  await expect(page.getByRole("button", { name: /BUY FILTERS/ })).toBeVisible();
});

test("captures with no connection and keeps it", async ({ page, context }) => {
  await unlock(page);
  await page.goto("/tasks");

  await context.setOffline(true);
  await capture(page, "offline task");
  await expect(page.getByText("OFFLINE TASK")).toBeVisible();

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText("OFFLINE TASK")).toBeVisible();
});

test("guards the tasks screen behind the PIN", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/unlock/);
});

test("guards settings behind the PIN", async ({ page }) => {
  await page.goto("/settings/projects");
  await expect(page).toHaveURL(/\/unlock/);
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e`
Expected: PASS, including the existing spine tests.

If the capture test fails because the sheet's SAVE button is ambiguous with another button of the same name, scope the locator to the dialog: `page.getByRole("dialog").getByRole("button", { name: "SAVE" })`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/tasks.spec.ts
git commit -m "test: end-to-end task capture, offline and complete"
```

---

### Task 18: Ship Phase 1

**Files:** none — this task is verification and deployment.

- [ ] **Step 1: Run everything**

```bash
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
```

Expected: all four clean. Do not proceed past a failure; a red suite here means the phone gets a broken app.

- [ ] **Step 2: Push to dev**

```bash
git push origin dev
```

- [ ] **Step 3: Verify the preview deployment**

```bash
curl -s https://dev.mylifeos.shiftd.in/api/health
```

Expected: `{"ok":true,"env":"dev",...}` with `dbHost` pointing at the **dev** Neon branch (`ep-flat-unit-…`). If it names the production host, stop and fix the environment variables before going further.

Then on the phone: open the dev PWA, capture a task, put the phone in airplane mode, capture another, reopen the app, and confirm both are there. Come back online and confirm they reach the server.

- [ ] **Step 4: Migrate production, then merge**

The production database needs the same schema **before** the code that expects it goes live:

```bash
DATABASE_URL="<production connection string>" npm run db:migrate
```

Expected: the `categories.updated_at`, `projects` and `tasks` migrations applied. Verify:

```bash
DATABASE_URL="<production string>" node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`select table_name from information_schema.tables where table_schema='public'\`.then(r => console.log(r));
"
```

Expected: `categories`, `habits`, `habit_entries`, `projects`, `tasks`.

Only then:

```bash
git checkout main
git merge dev
git push origin main
git checkout dev
```

- [ ] **Step 5: Verify production**

```bash
curl -s https://mylifeos.shiftd.in/api/health
```

Then open the production PWA on the phone, confirm the 12 habits and their existing ticks are intact, and capture one real task.

The order matters: migrating after merging leaves the live app querying tables that do not exist, and every sync 500s until it is fixed.

---

## Self-Review

**Spec coverage.** §3.1 identity — Tasks 13 and 15 use `crypto.randomUUID()`, seeds keep readable ids. §3.2 tasks and projects — Tasks 9, 10, 12, 13, 14. §3.5 existing tables — Task 2 (`categories.updatedAt`), Task 3 (Dexie v2). §4.1 shell — Task 7. §4.2 Home — Tasks 8 and 16 (habits and tasks cards; money and journal cards belong to their phases). §4.3 Tasks — Tasks 12–14, filter row deferred as the spec states. §4.6 Settings — Task 15, limited to projects plus app info and lock, as the phase plan says. §5 routing — Task 6. §6.1 envelope — Tasks 4 and 11; money tables are absent because money does not exist until Phase 2, which is the YAGNI-correct reading of "widened envelope". §6.2 generic merge — Task 1. §6.3 `ensureSeeded` removed — Task 4. §9 verification — Tasks 1, 9, 12, 17, 18. §7 journal and §3.4 money are Phase 2 and Phase 3, deliberately out of this plan.

**Placeholders.** None. Every code step carries the code, every verification step carries the command and the expected result.

**Type consistency.** `mergeRows(local, remote, key)` and `idKey` / `entryKey` are used with those exact names in Tasks 4, 5 and 11. `putTask` / `putProject` / `dirtyTasks` / `dirtyProjects` match `local.ts` in Task 10 and their call sites in Tasks 14 and 15. `Task.done` is `boolean` everywhere and never appears in a Dexie index string, which is why it may stay a boolean while `dirty` may not. `<HomeCard href label value detail>` matches between Tasks 8 and 16. `<ListEditor items onRename onReorder onAdd onArchive>` matches between Tasks 15's definition and its use. `SEED_PROJECTS` is defined in Task 10 and consumed in the same task.

**One deviation from the spec worth naming:** the spec's §6.1 envelope lists all eight tables. This plan wires five (categories, habits, entries, projects, tasks) and leaves accounts, money categories and transactions to Phase 2, because building a wire format for tables that do not exist is guesswork that would need rewriting anyway. The envelope's shape is unchanged; only the field count differs.
