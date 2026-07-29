# Life OS Milestone 1 — Habits Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable Android PWA at `dev.mylifeos.shiftd.in` where Shifin can tick 12 habits across a rolling 5-day grid, offline, with every tick syncing to Neon Postgres behind a PIN.

**Architecture:** IndexedDB (Dexie) is the source of truth — every tap writes locally and synchronously, then a background engine pushes dirty rows to Neon and pulls changes since a stored cursor. Conflict resolution is last-write-wins on a server-stamped `updated_at`. All date, cell-state, and score logic lives in pure functions with no React or database dependency, so the highest-bug-density code is unit-testable in isolation.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Dexie · Drizzle ORM · Neon Postgres · Serwist · Vitest · Playwright · `@node-rs/argon2`

**Spec:** `docs/superpowers/specs/2026-07-29-lifeos-v1-design.md`

---

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec.

- **Timezone is `Asia/Kolkata` everywhere.** Dates are `YYYY-MM-DD` strings computed in IST, never `Date` objects passed between modules. Never use the machine's local timezone.
- **44px minimum on every tick target.** The full cell is the target, not the glyph inside it. No exceptions.
- **Nothing animates longer than 150ms** on a capture action.
- **No confirmation dialogs anywhere.** Undo affordances instead.
- **No empty-state illustrations, no encouragement copy, no coaching text.**
- **A tap never touches the network.** Writes go to IndexedDB synchronously; sync is always background.
- **The server stamps `updated_at`, never the client.**
- **PIN verification is server-side only.** A client-side check is bypassed by calling the API directly.
- **PIN rate limit:** 5 failed attempts → 1-minute lockout, doubling per subsequent failure (1, 2, 4, 8 …) capped at 1 hour, keyed by IP, reset on successful unlock.
- **Secrets** (`DATABASE_URL`, `PIN_HASH`, `AUTH_SECRET`) never enter the repo. `.env` is already gitignored.
- **`noindex`** on both environments.
- **Fonts self-hosted** via `next/font` — no external requests, so they work offline.
- **Habit names render uppercase mono.** Type is DM Mono; Syne is used only for the date header and day score.
- **Grid is grouped by category**, ordered HEALTH → MIND → BUSINESS → OUTPUT → HOME. Core habits are marked `•`.
- **Cell states are `none` | `done` | `missed`.** `[ ]` is not a stored state — it is `none` rendered on today's date.
- **Future dates are never rendered**, therefore never tappable.
- **Commit at the end of every task. Push at the end of every task.** Branch is `dev`.

---

## File Structure

```
src/
  lib/
    date.ts               IST date helpers — pure, no deps
    habit-state.ts        tap-cycle state machine — pure
    score.ts              day + month score calculation — pure
    types.ts              shared domain types
    db/
      local.ts            Dexie schema, typed tables, seed
      schema.ts           Drizzle schema (mirrors local.ts)
      client.ts           Neon connection
    sync/
      engine.ts           pull/push orchestration, dirty queue
      merge.ts            last-write-wins row merge — pure
    auth/
      pin.ts              Argon2 verify + token sign/verify — pure-ish
      rate-limit.ts       attempt counter + lockout — pure
  app/
    layout.tsx            fonts, grounds, manifest wiring
    page.tsx              redirects to /habits
    habits/page.tsx       the default surface
    unlock/page.tsx       PIN screen
    api/
      auth/route.ts       POST — verify PIN, set cookie
      sync/route.ts       POST — pull + push
  components/
    HabitGrid.tsx         category groups, day columns
    HabitCell.tsx         one 44x44 tap target
    DayHeader.tsx         date + score, Syne
    PinPad.tsx            numeric keypad
    SyncFooter.tsx        LAST_SYNC line
  styles/
    globals.css           two grounds as CSS custom properties
tests/
  unit/                   Vitest — date, state, score, merge, rate-limit
  e2e/                    Playwright — one spine test
drizzle/                  generated migrations
```

Pure logic (`date`, `habit-state`, `score`, `merge`, `rate-limit`) has zero imports from React, Dexie, or Drizzle. That is what makes Tasks 2–4 fast to test and what keeps the bug-prone code out of the UI.

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/styles/globals.css`

**Interfaces:**
- Consumes: nothing
- Produces: a running Next.js dev server, `npm test` wired to Vitest, the two grounds as CSS custom properties

- [ ] **Step 1: Create the branch**

```bash
git checkout -b dev
```

- [ ] **Step 2: Scaffold Next.js**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir \
  --import-alias "@/*" --no-eslint --use-npm
```

Answer "yes" to overwriting if prompted — the repo currently holds only markdown, which git already tracks.

- [ ] **Step 3: Add test and runtime dependencies**

```bash
npm install dexie drizzle-orm @neondatabase/serverless @node-rs/argon2 jose
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react \
  @testing-library/jest-dom drizzle-kit @playwright/test
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Define the two grounds**

Replace `src/styles/globals.css` (or `src/app/globals.css` — use whichever the scaffold created, and keep that path consistently):

```css
@import "tailwindcss";

:root {
  --ground: #f5f2ec;
  --type: #0a0a0a;
  --type-muted: #6b6b6b;
  --rule: #d8d3c9;
  --accent: #a8d800;
  --alert: #c1121f;
  --miss: #a89f92;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ground: #0a0a0a;
    --type: #f5f2ec;
    --type-muted: #6b6b6b;
    --rule: #1e1e1e;
    --accent: #c8ff00;
    --alert: #ff4d4d;
    --miss: #4a4a4a;
  }
}

body {
  background: var(--ground);
  color: var(--type);
}
```

`--miss` is deliberately not `--alert`. Spec §9 divergence 4: a miss is history, not urgency.

- [ ] **Step 6: Wire the fonts and metadata**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { DM_Mono, Syne } from 'next/font/google'
import './globals.css'

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
})

const syne = Syne({
  weight: ['600', '700'],
  subsets: ['latin'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'LIFE_OS',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} ${syne.variable}`}>
      <body className="font-[family-name:var(--font-mono)]">{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: Create `.env.example`**

```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
PIN_HASH=$argon2id$v=19$m=19456,t=2,p=1$...
AUTH_SECRET=generate-with-openssl-rand-base64-32
```

- [ ] **Step 8: Verify it runs**

Run: `npm run dev`
Expected: server starts, `http://localhost:3000` renders without error.

Run: `npm test`
Expected: "No test files found" — Vitest is wired but nothing exists yet.

- [ ] **Step 9: Commit and push**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, Vitest, and the two grounds"
git push -u origin dev
```

---

### Task 2: IST date logic

The highest-bug-density module in the app. Pure functions, no dependencies.

**Files:**
- Create: `src/lib/date.ts`
- Test: `tests/unit/date.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type ISODate = string` — `'YYYY-MM-DD'`
  - `todayIST(now?: Date): ISODate`
  - `rollingWindow(today: ISODate, days?: number): ISODate[]` — oldest first, today last
  - `isFuture(date: ISODate, today: ISODate): boolean`
  - `formatColumn(date: ISODate): { dow: string; dom: string }` — `{ dow: 'TUE', dom: '28' }`
  - `formatHeader(date: ISODate): string` — `'TUE 28 JUL'`
  - `daysElapsedInMonth(today: ISODate): number`
  - `monthDates(today: ISODate): ISODate[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/date.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  todayIST, rollingWindow, isFuture, formatColumn,
  formatHeader, daysElapsedInMonth, monthDates,
} from '@/lib/date'

describe('todayIST', () => {
  it('uses IST, not the machine timezone', () => {
    // 2026-07-28T20:00Z is 2026-07-29T01:30 IST — already the next day
    expect(todayIST(new Date('2026-07-28T20:00:00Z'))).toBe('2026-07-29')
  })

  it('is still the previous day just before IST midnight', () => {
    // 2026-07-28T18:29Z is 2026-07-28T23:59 IST
    expect(todayIST(new Date('2026-07-28T18:29:00Z'))).toBe('2026-07-28')
  })

  it('rolls over at exactly IST midnight', () => {
    // 2026-07-28T18:30Z is 2026-07-29T00:00 IST
    expect(todayIST(new Date('2026-07-28T18:30:00Z'))).toBe('2026-07-29')
  })
})

describe('rollingWindow', () => {
  it('returns five days ending with today, oldest first', () => {
    expect(rollingWindow('2026-07-28')).toEqual([
      '2026-07-24', '2026-07-25', '2026-07-26', '2026-07-27', '2026-07-28',
    ])
  })

  it('never includes a future date', () => {
    const today = '2026-07-28'
    for (const d of rollingWindow(today)) {
      expect(isFuture(d, today)).toBe(false)
    }
  })

  it('crosses a month boundary correctly', () => {
    expect(rollingWindow('2026-08-02')).toEqual([
      '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02',
    ])
  })

  it('crosses a leap day correctly', () => {
    expect(rollingWindow('2028-03-01')).toEqual([
      '2028-02-26', '2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01',
    ])
  })

  it('honours a custom window size', () => {
    expect(rollingWindow('2026-07-28', 3)).toEqual([
      '2026-07-26', '2026-07-27', '2026-07-28',
    ])
  })
})

describe('isFuture', () => {
  it('is false for today', () => {
    expect(isFuture('2026-07-28', '2026-07-28')).toBe(false)
  })
  it('is false for the past', () => {
    expect(isFuture('2026-07-27', '2026-07-28')).toBe(false)
  })
  it('is true for tomorrow', () => {
    expect(isFuture('2026-07-29', '2026-07-28')).toBe(true)
  })
})

describe('formatColumn', () => {
  it('returns a three-letter uppercase weekday and a zero-padded day', () => {
    expect(formatColumn('2026-07-28')).toEqual({ dow: 'TUE', dom: '28' })
  })
  it('zero-pads single-digit days', () => {
    expect(formatColumn('2026-07-05')).toEqual({ dow: 'SUN', dom: '05' })
  })
})

describe('formatHeader', () => {
  it('formats as DOW DD MON', () => {
    expect(formatHeader('2026-07-28')).toBe('TUE 28 JUL')
  })
})

describe('daysElapsedInMonth', () => {
  it('counts the current day', () => {
    expect(daysElapsedInMonth('2026-07-28')).toBe(28)
  })
  it('is 1 on the first', () => {
    expect(daysElapsedInMonth('2026-07-01')).toBe(1)
  })
})

describe('monthDates', () => {
  it('returns every day of the month containing the date', () => {
    const dates = monthDates('2026-07-28')
    expect(dates).toHaveLength(31)
    expect(dates[0]).toBe('2026-07-01')
    expect(dates[30]).toBe('2026-07-31')
  })
  it('handles February in a leap year', () => {
    expect(monthDates('2028-02-10')).toHaveLength(29)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- date`
Expected: FAIL — `Failed to resolve import "@/lib/date"`

- [ ] **Step 3: Implement the module**

Create `src/lib/date.ts`:

```typescript
export type ISODate = string // 'YYYY-MM-DD'

const IST_OFFSET_MINUTES = 330 // +05:30, no DST in India
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
             'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Parse 'YYYY-MM-DD' into a UTC-midnight Date. Calendar maths only. */
function parse(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

export function todayIST(now: Date = new Date()): ISODate {
  return toISO(new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000))
}

export function rollingWindow(today: ISODate, days = 5): ISODate[] {
  const end = parse(today)
  const out: ISODate[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push(toISO(new Date(end.getTime() - i * 86_400_000)))
  }
  return out
}

export function isFuture(date: ISODate, today: ISODate): boolean {
  return date > today // lexicographic comparison is correct for ISO dates
}

export function formatColumn(date: ISODate): { dow: string; dom: string } {
  const d = parse(date)
  return { dow: DOW[d.getUTCDay()], dom: date.slice(8, 10) }
}

export function formatHeader(date: ISODate): string {
  const d = parse(date)
  return `${DOW[d.getUTCDay()]} ${date.slice(8, 10)} ${MON[d.getUTCMonth()]}`
}

export function daysElapsedInMonth(today: ISODate): number {
  return Number(today.slice(8, 10))
}

export function monthDates(today: ISODate): ISODate[] {
  const d = parse(today)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return Array.from({ length: count }, (_, i) =>
    toISO(new Date(Date.UTC(year, month, i + 1))))
}
```

Note: `parse` intentionally produces UTC midnight. All arithmetic is calendar arithmetic on dates that already represent IST days — the IST shift happens exactly once, in `todayIST`. Shifting twice is the classic off-by-one in this kind of code.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- date`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/date.ts tests/unit/date.test.ts
git commit -m "feat: add IST date helpers with rolling-window and month logic"
git push
```

---

### Task 3: Domain types and the tap-cycle state machine

**Files:**
- Create: `src/lib/types.ts`, `src/lib/habit-state.ts`
- Test: `tests/unit/habit-state.test.ts`

**Interfaces:**
- Consumes: `ISODate`, `isFuture` from `@/lib/date`
- Produces:
  - `type CellState = 'none' | 'done' | 'missed'`
  - `type Tier = 'core' | 'growing'`
  - `type Priority = 'P1' | 'P2' | 'P3' | 'P4'`
  - `interface Category { id: string; name: string; sortOrder: number }`
  - `interface Habit { id: string; name: string; tier: Tier; categoryId: string; sortOrder: number; active: boolean; updatedAt: string }`
  - `interface HabitEntry { habitId: string; date: ISODate; state: CellState; checkedAt: string; updatedAt: string; dirty?: 1 | 0 }`
  - `nextState(current: CellState): CellState`
  - `cycle(current: CellState, date: ISODate, today: ISODate): CellState` — throws on a future date
  - `renderMark(state: CellState, date: ISODate, today: ISODate): '■' | '✕' | '·' | '[ ]'`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/habit-state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { nextState, cycle, renderMark } from '@/lib/habit-state'

describe('nextState', () => {
  it('cycles none -> done -> missed -> none', () => {
    expect(nextState('none')).toBe('done')
    expect(nextState('done')).toBe('missed')
    expect(nextState('missed')).toBe('none')
  })

  it('returns to the start after three taps', () => {
    expect(nextState(nextState(nextState('none')))).toBe('none')
  })
})

describe('cycle', () => {
  const today = '2026-07-28'

  it('advances on today', () => {
    expect(cycle('none', today, today)).toBe('done')
  })

  it('advances identically on a past date — backfill needs no special mode', () => {
    expect(cycle('none', '2026-07-25', today)).toBe('done')
    expect(cycle('done', '2026-07-25', today)).toBe('missed')
  })

  it('throws on a future date', () => {
    expect(() => cycle('none', '2026-07-29', today))
      .toThrow('Cannot tick a future date')
  })
})

describe('renderMark', () => {
  const today = '2026-07-28'

  it('renders done as a filled block on any date', () => {
    expect(renderMark('done', today, today)).toBe('■')
    expect(renderMark('done', '2026-07-25', today)).toBe('■')
  })

  it('renders missed as a cross', () => {
    expect(renderMark('missed', '2026-07-25', today)).toBe('✕')
  })

  it('renders none on a past date as a hairline dot', () => {
    expect(renderMark('none', '2026-07-25', today)).toBe('·')
  })

  it('renders none on today as the open invitation', () => {
    expect(renderMark('none', today, today)).toBe('[ ]')
  })

  it('never treats today-untouched as a miss', () => {
    expect(renderMark('none', today, today)).not.toBe('✕')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- habit-state`
Expected: FAIL — cannot resolve `@/lib/habit-state`

- [ ] **Step 3: Write the types**

Create `src/lib/types.ts`:

```typescript
import type { ISODate } from './date'

export type CellState = 'none' | 'done' | 'missed'
export type Tier = 'core' | 'growing'
export type Priority = 'P1' | 'P2' | 'P3' | 'P4'

export interface Category {
  id: string
  name: string
  sortOrder: number
}

export interface Habit {
  id: string
  name: string
  tier: Tier
  categoryId: string
  sortOrder: number
  active: boolean
  updatedAt: string
}

export interface HabitEntry {
  habitId: string
  date: ISODate
  state: CellState
  checkedAt: string
  updatedAt: string
  /** 1 = pending push to the server. Dexie cannot index booleans. */
  dirty?: 1 | 0
}
```

- [ ] **Step 4: Write the state machine**

Create `src/lib/habit-state.ts`:

```typescript
import { isFuture, type ISODate } from './date'
import type { CellState } from './types'

const CYCLE: Record<CellState, CellState> = {
  none: 'done',
  done: 'missed',
  missed: 'none',
}

export function nextState(current: CellState): CellState {
  return CYCLE[current]
}

export function cycle(current: CellState, date: ISODate, today: ISODate): CellState {
  if (isFuture(date, today)) {
    throw new Error('Cannot tick a future date')
  }
  return nextState(current)
}

export function renderMark(
  state: CellState,
  date: ISODate,
  today: ISODate,
): '■' | '✕' | '·' | '[ ]' {
  if (state === 'done') return '■'
  if (state === 'missed') return '✕'
  return date === today ? '[ ]' : '·'
}
```

`cycle` guarding against future dates is belt-and-braces: the grid never renders a future column, so this should be unreachable. It exists because "unreachable" states become reachable the moment the month view lands.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- habit-state`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit and push**

```bash
git add src/lib/types.ts src/lib/habit-state.ts tests/unit/habit-state.test.ts
git commit -m "feat: add domain types and the tap-cycle state machine"
git push
```

---

### Task 4: Score calculation

**Files:**
- Create: `src/lib/score.ts`
- Test: `tests/unit/score.test.ts`

**Interfaces:**
- Consumes: `Habit`, `HabitEntry`, `Category` from `@/lib/types`; `ISODate`, `daysElapsedInMonth` from `@/lib/date`
- Produces:
  - `interface DayScore { coreDone: number; coreTotal: number; growingDone: number }`
  - `dayScore(habits: Habit[], entries: HabitEntry[], date: ISODate): DayScore`
  - `formatDayScore(s: DayScore): string` — `'CORE 4/6 · +1'`
  - `interface CategoryScore { categoryId: string; name: string; done: number; possible: number }`
  - `monthScores(habits, entries, categories, today): CategoryScore[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/score.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { dayScore, formatDayScore, monthScores } from '@/lib/score'
import type { Habit, HabitEntry, Category } from '@/lib/types'

const cat = (id: string, name: string, sortOrder: number): Category =>
  ({ id, name, sortOrder })

const habit = (
  id: string, tier: 'core' | 'growing', categoryId: string, active = true,
): Habit => ({
  id, name: id.toUpperCase(), tier, categoryId,
  sortOrder: 0, active, updatedAt: '2026-07-01T00:00:00Z',
})

const entry = (
  habitId: string, date: string, state: 'done' | 'missed' | 'none',
): HabitEntry => ({
  habitId, date, state,
  checkedAt: '2026-07-28T09:00:00Z', updatedAt: '2026-07-28T09:00:00Z',
})

const HABITS: Habit[] = [
  habit('a', 'core', 'health'),
  habit('b', 'core', 'health'),
  habit('c', 'core', 'mind'),
  habit('d', 'growing', 'mind'),
  habit('e', 'growing', 'output'),
]

describe('dayScore', () => {
  it('counts only done core habits against the core total', () => {
    const entries = [entry('a', '2026-07-28', 'done'), entry('b', '2026-07-28', 'missed')]
    expect(dayScore(HABITS, entries, '2026-07-28'))
      .toEqual({ coreDone: 1, coreTotal: 3, growingDone: 0 })
  })

  it('counts growing habits separately and never in the denominator', () => {
    const entries = [entry('d', '2026-07-28', 'done'), entry('e', '2026-07-28', 'done')]
    expect(dayScore(HABITS, entries, '2026-07-28'))
      .toEqual({ coreDone: 0, coreTotal: 3, growingDone: 2 })
  })

  it('ignores entries for other dates', () => {
    const entries = [entry('a', '2026-07-27', 'done')]
    expect(dayScore(HABITS, entries, '2026-07-28').coreDone).toBe(0)
  })

  it('treats missed and none identically for scoring', () => {
    const missed = [entry('a', '2026-07-28', 'missed')]
    const none = [entry('a', '2026-07-28', 'none')]
    expect(dayScore(HABITS, missed, '2026-07-28').coreDone)
      .toBe(dayScore(HABITS, none, '2026-07-28').coreDone)
  })

  it('excludes inactive habits from the total', () => {
    const habits = [...HABITS, habit('f', 'core', 'health', false)]
    expect(dayScore(habits, [], '2026-07-28').coreTotal).toBe(3)
  })

  it('returns a zero total when there are no habits', () => {
    expect(dayScore([], [], '2026-07-28'))
      .toEqual({ coreDone: 0, coreTotal: 0, growingDone: 0 })
  })
})

describe('formatDayScore', () => {
  it('formats with the growing count', () => {
    expect(formatDayScore({ coreDone: 4, coreTotal: 6, growingDone: 1 }))
      .toBe('CORE 4/6 · +1')
  })

  it('still shows +0 so the layout does not jump', () => {
    expect(formatDayScore({ coreDone: 4, coreTotal: 6, growingDone: 0 }))
      .toBe('CORE 4/6 · +0')
  })
})

describe('monthScores', () => {
  const CATEGORIES = [cat('health', 'HEALTH', 1), cat('mind', 'MIND', 2)]
  const H = [habit('a', 'core', 'health'), habit('b', 'core', 'health'),
             habit('c', 'core', 'mind')]

  it('uses habits-in-category times days-elapsed as the denominator', () => {
    // 10 July: 2 health habits x 10 days = 20 possible
    const result = monthScores(H, [], CATEGORIES, '2026-07-10')
    expect(result.find(r => r.categoryId === 'health')!.possible).toBe(20)
    expect(result.find(r => r.categoryId === 'mind')!.possible).toBe(10)
  })

  it('counts done entries within the month only', () => {
    const entries = [
      entry('a', '2026-07-05', 'done'),
      entry('a', '2026-07-06', 'done'),
      entry('a', '2026-06-30', 'done'), // previous month, must not count
    ]
    const result = monthScores(H, entries, CATEGORIES, '2026-07-10')
    expect(result.find(r => r.categoryId === 'health')!.done).toBe(2)
  })

  it('does not count missed entries as done', () => {
    const entries = [entry('a', '2026-07-05', 'missed')]
    expect(monthScores(H, entries, CATEGORIES, '2026-07-10')
      .find(r => r.categoryId === 'health')!.done).toBe(0)
  })

  it('returns categories in sortOrder', () => {
    expect(monthScores(H, [], CATEGORIES, '2026-07-10').map(r => r.name))
      .toEqual(['HEALTH', 'MIND'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- score`
Expected: FAIL — cannot resolve `@/lib/score`

- [ ] **Step 3: Implement the module**

Create `src/lib/score.ts`:

```typescript
import { daysElapsedInMonth, type ISODate } from './date'
import type { Category, Habit, HabitEntry } from './types'

export interface DayScore {
  coreDone: number
  coreTotal: number
  growingDone: number
}

export interface CategoryScore {
  categoryId: string
  name: string
  done: number
  possible: number
}

export function dayScore(
  habits: Habit[], entries: HabitEntry[], date: ISODate,
): DayScore {
  const active = habits.filter(h => h.active)
  const doneIds = new Set(
    entries.filter(e => e.date === date && e.state === 'done').map(e => e.habitId),
  )

  return {
    coreDone: active.filter(h => h.tier === 'core' && doneIds.has(h.id)).length,
    coreTotal: active.filter(h => h.tier === 'core').length,
    growingDone: active.filter(h => h.tier === 'growing' && doneIds.has(h.id)).length,
  }
}

export function formatDayScore(s: DayScore): string {
  return `CORE ${s.coreDone}/${s.coreTotal} · +${s.growingDone}`
}

export function monthScores(
  habits: Habit[], entries: HabitEntry[],
  categories: Category[], today: ISODate,
): CategoryScore[] {
  const active = habits.filter(h => h.active)
  const elapsed = daysElapsedInMonth(today)
  const monthPrefix = today.slice(0, 7) // 'YYYY-MM'

  const doneInMonth = entries.filter(
    e => e.state === 'done' && e.date.startsWith(monthPrefix),
  )

  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(c => {
      const ids = new Set(active.filter(h => h.categoryId === c.id).map(h => h.id))
      return {
        categoryId: c.id,
        name: c.name,
        done: doneInMonth.filter(e => ids.has(e.habitId)).length,
        possible: ids.size * elapsed,
      }
    })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- score`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/score.ts tests/unit/score.test.ts
git commit -m "feat: add day and per-category month score calculation"
git push
```

---

### Task 5: Dexie local store and seed data

**Files:**
- Create: `src/lib/db/local.ts`, `src/lib/db/seed.ts`
- Test: `tests/unit/seed.test.ts`

**Interfaces:**
- Consumes: types from `@/lib/types`
- Produces:
  - `db` — a `Dexie` instance with `categories`, `habits`, `habitEntries`, `meta` tables
  - `SEED_CATEGORIES: Category[]`, `SEED_HABITS: Habit[]`
  - `seedIfEmpty(): Promise<void>`
  - `getEntry(habitId, date): Promise<HabitEntry | undefined>`
  - `putEntry(entry: HabitEntry): Promise<void>` — marks dirty
  - `getMeta(key): Promise<string | undefined>` / `setMeta(key, value): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/seed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { SEED_CATEGORIES, SEED_HABITS } from '@/lib/db/seed'

describe('seed data', () => {
  it('has exactly 12 habits', () => {
    expect(SEED_HABITS).toHaveLength(12)
  })

  it('has 6 core and 6 growing', () => {
    expect(SEED_HABITS.filter(h => h.tier === 'core')).toHaveLength(6)
    expect(SEED_HABITS.filter(h => h.tier === 'growing')).toHaveLength(6)
  })

  it('does not contain Payout — it was never a habit', () => {
    expect(SEED_HABITS.some(h => /payout/i.test(h.name))).toBe(false)
  })

  it('orders categories health, mind, business, output, home', () => {
    expect([...SEED_CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder)
      .map(c => c.name))
      .toEqual(['HEALTH', 'MIND', 'BUSINESS', 'OUTPUT', 'HOME'])
  })

  it('assigns every habit to a category that exists', () => {
    const ids = new Set(SEED_CATEGORIES.map(c => c.id))
    for (const h of SEED_HABITS) expect(ids.has(h.categoryId)).toBe(true)
  })

  it('keeps every habit name within 16 characters so the grid fits', () => {
    for (const h of SEED_HABITS) expect(h.name.length).toBeLessThanOrEqual(16)
  })

  it('marks every habit active', () => {
    expect(SEED_HABITS.every(h => h.active)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- seed`
Expected: FAIL — cannot resolve `@/lib/db/seed`

- [ ] **Step 3: Write the seed data**

Create `src/lib/db/seed.ts`:

```typescript
import type { Category, Habit } from '../types'

const T = '2026-07-29T00:00:00.000Z'

export const SEED_CATEGORIES: Category[] = [
  { id: 'health',   name: 'HEALTH',   sortOrder: 1 },
  { id: 'mind',     name: 'MIND',     sortOrder: 2 },
  { id: 'business', name: 'BUSINESS', sortOrder: 3 },
  { id: 'output',   name: 'OUTPUT',   sortOrder: 4 },
  { id: 'home',     name: 'HOME',     sortOrder: 5 },
]

const h = (
  id: string, name: string, tier: 'core' | 'growing',
  categoryId: string, sortOrder: number,
): Habit => ({ id, name, tier, categoryId, sortOrder, active: true, updatedAt: T })

export const SEED_HABITS: Habit[] = [
  h('wakeup',    'WAKEUP AT 6',      'growing', 'health',   1),
  h('sleep',     'SLEEP AT 11',      'growing', 'health',   2),
  h('exercise',  'EXERCISE (WALK)',  'core',    'health',   3),
  h('meditate',  'MEDITATION',       'core',    'mind',     4),
  h('read',      'READ BOOK',        'core',    'mind',     5),
  h('sales',     'SALES TRACKER',    'core',    'business', 6),
  h('customer',  'CUSTOMER CHECKED', 'core',    'business', 7),
  h('inventory', 'INVENTORY STOCK',  'core',    'business', 8),
  h('finance',   'FINANCE LOG',      'growing', 'business', 9),
  h('post',      'POST CONTENT',     'growing', 'output',  10),
  h('video',     'VIDEO',            'growing', 'output',  11),
  h('birdfood',  'BIRD FOOD',        'growing', 'home',    12),
]
```

- [ ] **Step 4: Write the Dexie store**

Create `src/lib/db/local.ts`:

```typescript
import Dexie, { type Table } from 'dexie'
import type { Category, Habit, HabitEntry } from '../types'
import type { ISODate } from '../date'
import { SEED_CATEGORIES, SEED_HABITS } from './seed'

interface Meta { key: string; value: string }

class LifeOSDB extends Dexie {
  categories!: Table<Category, string>
  habits!: Table<Habit, string>
  habitEntries!: Table<HabitEntry, [string, string]>
  meta!: Table<Meta, string>

  constructor() {
    super('lifeos')
    this.version(1).stores({
      categories: 'id, sortOrder',
      habits: 'id, categoryId, sortOrder, tier',
      // compound primary key; `dirty` indexed so the push query is cheap
      habitEntries: '[habitId+date], date, habitId, dirty',
      meta: 'key',
    })
  }
}

export const db = new LifeOSDB()

export async function seedIfEmpty(): Promise<void> {
  if (await db.habits.count() > 0) return
  await db.transaction('rw', db.categories, db.habits, async () => {
    await db.categories.bulkPut(SEED_CATEGORIES)
    await db.habits.bulkPut(SEED_HABITS)
  })
}

export function getEntry(habitId: string, date: ISODate) {
  return db.habitEntries.get([habitId, date])
}

export function entriesForDates(dates: ISODate[]) {
  return db.habitEntries.where('date').anyOf(dates).toArray()
}

/** Writes locally and marks the row for push. Never touches the network. */
export async function putEntry(entry: HabitEntry): Promise<void> {
  await db.habitEntries.put({ ...entry, dirty: 1 })
}

export function dirtyEntries() {
  return db.habitEntries.where('dirty').equals(1).toArray()
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.value
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value })
}
```

Two notes for the implementer. Dexie cannot index booleans, which is why `dirty` is `1 | 0` — indexing it is what keeps the push query from scanning every row. And `habitEntries` uses a compound primary key `[habitId+date]`, so `put` is an upsert and the tap cycle never creates duplicate rows for the same cell.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- seed`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit and push**

```bash
git add src/lib/db/ tests/unit/seed.test.ts
git commit -m "feat: add Dexie local store with 12-habit seed data"
git push
```

---

### Task 6: The habits grid UI

**Files:**
- Create: `src/components/HabitCell.tsx`, `src/components/HabitGrid.tsx`, `src/components/DayHeader.tsx`, `src/app/habits/page.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/unit/HabitCell.test.tsx`

**Interfaces:**
- Consumes: `renderMark`, `cycle` from `@/lib/habit-state`; `rollingWindow`, `todayIST`, `formatColumn`, `formatHeader` from `@/lib/date`; `dayScore`, `formatDayScore` from `@/lib/score`; `db`, `seedIfEmpty`, `putEntry`, `entriesForDates` from `@/lib/db/local`
- Produces: a working, offline habits grid at `/habits`

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/HabitCell.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HabitCell } from '@/components/HabitCell'

describe('HabitCell', () => {
  const base = {
    habitId: 'read', habitName: 'READ BOOK',
    date: '2026-07-25', today: '2026-07-28', state: 'none' as const,
  }

  it('renders the hairline dot for an untouched past cell', () => {
    render(<HabitCell {...base} onTick={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('·')
  })

  it('renders the open invitation on today', () => {
    render(<HabitCell {...base} date="2026-07-28" onTick={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('[ ]')
  })

  it('calls onTick with the next state when tapped', () => {
    const onTick = vi.fn()
    render(<HabitCell {...base} onTick={onTick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onTick).toHaveBeenCalledWith('read', '2026-07-25', 'done')
  })

  it('cycles done to missed', () => {
    const onTick = vi.fn()
    render(<HabitCell {...base} state="done" onTick={onTick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onTick).toHaveBeenCalledWith('read', '2026-07-25', 'missed')
  })

  it('has an accessible label naming the habit and date', () => {
    render(<HabitCell {...base} onTick={vi.fn()} />)
    expect(screen.getByRole('button'))
      .toHaveAccessibleName('READ BOOK 2026-07-25 not logged')
  })

  it('meets the 44px minimum tick target', () => {
    render(<HabitCell {...base} onTick={vi.fn()} />)
    const style = screen.getByRole('button').style
    expect(style.minWidth).toBe('44px')
    expect(style.minHeight).toBe('44px')
  })
})
```

Add `import '@testing-library/jest-dom'` to a `tests/setup.ts` and reference it from `vitest.config.ts` via `test.setupFiles: ['./tests/setup.ts']`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- HabitCell`
Expected: FAIL — cannot resolve `@/components/HabitCell`

- [ ] **Step 3: Implement HabitCell**

Create `src/components/HabitCell.tsx`:

```tsx
'use client'

import { cycle, renderMark } from '@/lib/habit-state'
import type { CellState } from '@/lib/types'

const LABEL: Record<CellState, string> = {
  none: 'not logged',
  done: 'done',
  missed: 'missed',
}

export function HabitCell({
  habitId, habitName, date, today, state, onTick,
}: {
  habitId: string
  habitName: string
  date: string
  today: string
  state: CellState
  onTick: (habitId: string, date: string, next: CellState) => void
}) {
  function handleTap() {
    // Haptic first — it must feel instant even if React re-renders slowly.
    navigator.vibrate?.(10)
    onTick(habitId, date, cycle(state, date, today))
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-label={`${habitName} ${date} ${LABEL[state]}`}
      style={{ minWidth: '44px', minHeight: '44px' }}
      className="flex items-center justify-center text-sm select-none
                 transition-colors duration-100"
    >
      <span style={{
        color: state === 'missed' ? 'var(--miss)'
             : state === 'none' ? 'var(--type-muted)'
             : 'var(--type)',
      }}>
        {renderMark(state, date, today)}
      </span>
    </button>
  )
}
```

`navigator.vibrate?.(10)` is optional-called because it is absent in jsdom and on desktop browsers. The spec's Android-only scope is what makes this a real feature rather than a no-op.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- HabitCell`
Expected: PASS, 6 tests.

- [ ] **Step 5: Implement DayHeader**

Create `src/components/DayHeader.tsx`:

```tsx
import { formatHeader } from '@/lib/date'
import { formatDayScore, type DayScore } from '@/lib/score'

export function DayHeader({ today, score }: { today: string; score: DayScore }) {
  return (
    <header className="flex items-baseline justify-between px-3 py-3"
            style={{ borderBottom: '1px solid var(--rule)' }}>
      <span className="text-sm tracking-wide">LIFE_OS</span>
      <div className="text-right font-[family-name:var(--font-display)]">
        <div className="text-sm">{formatHeader(today)}</div>
        <div className="text-lg" style={{ color: 'var(--accent)' }}>
          {formatDayScore(score)}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 6: Implement HabitGrid**

Create `src/components/HabitGrid.tsx`:

```tsx
'use client'

import { formatColumn } from '@/lib/date'
import type { Category, CellState, Habit, HabitEntry } from '@/lib/types'
import { HabitCell } from './HabitCell'

export function HabitGrid({
  categories, habits, entries, dates, today, onTick,
}: {
  categories: Category[]
  habits: Habit[]
  entries: HabitEntry[]
  dates: string[]
  today: string
  onTick: (habitId: string, date: string, next: CellState) => void
}) {
  const stateOf = (habitId: string, date: string): CellState =>
    entries.find(e => e.habitId === habitId && e.date === date)?.state ?? 'none'

  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="px-3">
      <div className="flex" style={{ paddingLeft: '9.5rem' }}>
        {dates.map(d => {
          const { dow, dom } = formatColumn(d)
          const isToday = d === today
          return (
            <div key={d} style={{ minWidth: '44px', color: isToday ? 'var(--accent)' : 'var(--type-muted)' }}
                 className="text-center text-[10px] leading-tight py-1">
              <div>{dow}</div>
              <div>{dom}</div>
            </div>
          )
        })}
      </div>

      {ordered.map(cat => {
        const rows = habits
          .filter(h => h.active && h.categoryId === cat.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        if (rows.length === 0) return null

        return (
          <section key={cat.id}>
            <h2 className="text-[10px] tracking-widest py-1"
                style={{ color: 'var(--type-muted)' }}>
              {cat.name}
            </h2>
            {rows.map(habit => (
              <div key={habit.id} className="flex items-center">
                <div className="flex items-center text-[11px] truncate"
                     style={{ width: '9.5rem' }}>
                  <span style={{ color: 'var(--accent)', width: '0.75rem' }}>
                    {habit.tier === 'core' ? '•' : ''}
                  </span>
                  <span className="truncate">{habit.name}</span>
                </div>
                {dates.map(date => (
                  <HabitCell
                    key={date}
                    habitId={habit.id}
                    habitName={habit.name}
                    date={date}
                    today={today}
                    state={stateOf(habit.id, date)}
                    onTick={onTick}
                  />
                ))}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7: Wire the page**

Create `src/app/habits/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { rollingWindow, todayIST } from '@/lib/date'
import { dayScore } from '@/lib/score'
import { db, entriesForDates, putEntry, seedIfEmpty } from '@/lib/db/local'
import type { Category, CellState, Habit, HabitEntry } from '@/lib/types'
import { HabitGrid } from '@/components/HabitGrid'
import { DayHeader } from '@/components/DayHeader'

export default function HabitsPage() {
  const [today] = useState(() => todayIST())
  const [categories, setCategories] = useState<Category[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [entries, setEntries] = useState<HabitEntry[]>([])

  const dates = rollingWindow(today)

  useEffect(() => {
    (async () => {
      await seedIfEmpty()
      setCategories(await db.categories.toArray())
      setHabits(await db.habits.toArray())
      setEntries(await entriesForDates(dates))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleTick(habitId: string, date: string, next: CellState) {
    const now = new Date().toISOString()
    const row: HabitEntry = {
      habitId, date, state: next, checkedAt: now, updatedAt: now,
    }
    // Optimistic: update the UI before the write resolves.
    setEntries(prev => [
      ...prev.filter(e => !(e.habitId === habitId && e.date === date)),
      row,
    ])
    await putEntry(row)
  }

  return (
    <main className="min-h-dvh pb-16">
      <DayHeader today={today} score={dayScore(habits, entries, today)} />
      <HabitGrid
        categories={categories} habits={habits} entries={entries}
        dates={dates} today={today} onTick={handleTick}
      />
    </main>
  )
}
```

Replace `src/app/page.tsx` with a redirect:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/habits')
}
```

- [ ] **Step 8: Verify by hand**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: redirects to `/habits`, shows five category headings and twelve habits, today's column is the accent colour and rightmost, tapping a cell cycles `[ ] → ■ → ✕ → [ ]`, and a reload preserves what you ticked.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS, all tests green.

- [ ] **Step 10: Commit and push**

```bash
git add src/components/ src/app/
git commit -m "feat: add offline habits grid with category grouping and tap cycle"
git push
```

---

### Task 7: Drizzle schema and Neon migrations

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/db/client.ts`, `drizzle.config.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `sql` (Neon client), `categories`, `habits`, `habitEntries` Drizzle tables, and applied migrations on the `dev` Neon branch

- [ ] **Step 1: Create the Neon project and branches**

In the Neon console: create a project named `mylifeos`. It ships with a `main` branch. Create a second branch named `dev` from it. Copy both connection strings.

Put the `dev` string in local `.env` as `DATABASE_URL`.

- [ ] **Step 2: Write the Drizzle schema**

Create `src/lib/db/schema.ts`:

```typescript
import { pgTable, text, integer, boolean, date, timestamp, primaryKey }
  from 'drizzle-orm/pg-core'

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
})

export const habits = pgTable('habits', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tier: text('tier').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  sortOrder: integer('sort_order').notNull(),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const habitEntries = pgTable('habit_entries', {
  habitId: text('habit_id').notNull().references(() => habits.id),
  date: date('date').notNull(),
  state: text('state').notNull(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  pk: primaryKey({ columns: [t.habitId, t.date] }),
}))
```

- [ ] **Step 3: Write the client**

Create `src/lib/db/client.ts`:

```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

export const dbServer = drizzle(neon(url), { schema })
```

- [ ] **Step 4: Configure drizzle-kit**

Create `drizzle.config.ts`:

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config
```

Add scripts to `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 5: Generate and apply migrations**

Run: `npm run db:generate && npm run db:migrate`
Expected: a migration file appears in `drizzle/`, and the three tables exist on the Neon `dev` branch.

- [ ] **Step 6: Verify against the database**

Run: `npx drizzle-kit studio` (or query in the Neon console).
Expected: `categories`, `habits`, `habit_entries` present, all empty.

- [ ] **Step 7: Commit and push**

```bash
git add src/lib/db/schema.ts src/lib/db/client.ts drizzle.config.ts drizzle/ package.json
git commit -m "feat: add Drizzle schema and Neon migrations"
git push
```

---

### Task 8: PIN authentication

Security-critical. The rate limiter is the most important part of this task.

**Files:**
- Create: `src/lib/auth/rate-limit.ts`, `src/lib/auth/pin.ts`, `src/app/api/auth/route.ts`, `src/app/unlock/page.tsx`, `src/components/PinPad.tsx`, `src/middleware.ts`, `scripts/hash-pin.mjs`
- Test: `tests/unit/rate-limit.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `recordFailure(state: AttemptState | undefined, now: number): AttemptState`
  - `isLockedOut(state: AttemptState | undefined, now: number): boolean`
  - `lockoutRemainingMs(state, now): number`
  - `interface AttemptState { failures: number; lockedUntil: number }`
  - `signToken(): Promise<string>` / `verifyToken(t: string): Promise<boolean>`
  - `POST /api/auth` — `{ pin: string }` → 204 + cookie, or 401, or 429

- [ ] **Step 1: Write the failing rate-limit tests**

Create `tests/unit/rate-limit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { recordFailure, isLockedOut, lockoutRemainingMs } from '@/lib/auth/rate-limit'

const T0 = 1_000_000

describe('rate limiting', () => {
  it('allows the first four failures without locking out', () => {
    let s = undefined
    for (let i = 0; i < 4; i++) s = recordFailure(s, T0)
    expect(isLockedOut(s, T0)).toBe(false)
  })

  it('locks out for one minute on the fifth failure', () => {
    let s = undefined
    for (let i = 0; i < 5; i++) s = recordFailure(s, T0)
    expect(isLockedOut(s, T0)).toBe(true)
    expect(lockoutRemainingMs(s, T0)).toBe(60_000)
  })

  it('doubles the lockout on each subsequent failure', () => {
    let s = undefined
    for (let i = 0; i < 5; i++) s = recordFailure(s, T0)
    s = recordFailure(s, T0 + 60_000)
    expect(lockoutRemainingMs(s, T0 + 60_000)).toBe(120_000)
    s = recordFailure(s, T0 + 180_000)
    expect(lockoutRemainingMs(s, T0 + 180_000)).toBe(240_000)
  })

  it('caps the lockout at one hour', () => {
    let s = undefined
    let now = T0
    for (let i = 0; i < 20; i++) { s = recordFailure(s, now); now += 3_600_000 }
    expect(lockoutRemainingMs(s, now - 3_600_000)).toBe(3_600_000)
  })

  it('is not locked out once the window has passed', () => {
    let s = undefined
    for (let i = 0; i < 5; i++) s = recordFailure(s, T0)
    expect(isLockedOut(s, T0 + 60_001)).toBe(false)
  })

  it('treats an absent state as not locked out', () => {
    expect(isLockedOut(undefined, T0)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- rate-limit`
Expected: FAIL — cannot resolve `@/lib/auth/rate-limit`

- [ ] **Step 3: Implement the rate limiter**

Create `src/lib/auth/rate-limit.ts`:

```typescript
export interface AttemptState {
  failures: number
  lockedUntil: number
}

const FREE_ATTEMPTS = 5
const BASE_LOCKOUT_MS = 60_000
const MAX_LOCKOUT_MS = 3_600_000

export function recordFailure(
  state: AttemptState | undefined, now: number,
): AttemptState {
  const failures = (state?.failures ?? 0) + 1
  if (failures < FREE_ATTEMPTS) return { failures, lockedUntil: 0 }

  const step = failures - FREE_ATTEMPTS
  const duration = Math.min(BASE_LOCKOUT_MS * 2 ** step, MAX_LOCKOUT_MS)
  return { failures, lockedUntil: now + duration }
}

export function isLockedOut(state: AttemptState | undefined, now: number): boolean {
  return (state?.lockedUntil ?? 0) > now
}

export function lockoutRemainingMs(
  state: AttemptState | undefined, now: number,
): number {
  return Math.max(0, (state?.lockedUntil ?? 0) - now)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- rate-limit`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the PIN hashing script**

Create `scripts/hash-pin.mjs`:

```javascript
import { hash } from '@node-rs/argon2'

const pin = process.argv[2]
if (!pin || !/^\d{6}$/.test(pin)) {
  console.error('Usage: node scripts/hash-pin.mjs <6-digit-pin>')
  process.exit(1)
}

console.log(await hash(pin))
```

Run it with your chosen PIN and put the output in `.env` as `PIN_HASH`. Never commit the PIN itself.

- [ ] **Step 6: Implement token signing**

Create `src/lib/auth/pin.ts`:

```typescript
import { SignJWT, jwtVerify } from 'jose'

const secret = () => {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(s)
}

export const COOKIE_NAME = 'lifeos_token'

export async function signToken(): Promise<string> {
  return new SignJWT({ sub: 'shifin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(secret())
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    await jwtVerify(token, secret())
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 7: Implement the auth route**

Create `src/app/api/auth/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { verify } from '@node-rs/argon2'
import { COOKIE_NAME, signToken } from '@/lib/auth/pin'
import {
  recordFailure, isLockedOut, lockoutRemainingMs, type AttemptState,
} from '@/lib/auth/rate-limit'

// In-memory. Single-user app on a single region; a restart clearing the
// counter is acceptable because the lockout still throttles any real attack.
const attempts = new Map<string, AttemptState>()

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local'
  const now = Date.now()

  if (isLockedOut(attempts.get(ip), now)) {
    return NextResponse.json(
      { error: 'locked', retryInMs: lockoutRemainingMs(attempts.get(ip), now) },
      { status: 429 },
    )
  }

  const { pin } = await req.json().catch(() => ({ pin: '' }))
  const hash = process.env.PIN_HASH
  if (!hash) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const ok = typeof pin === 'string' && await verify(hash, pin).catch(() => false)

  if (!ok) {
    attempts.set(ip, recordFailure(attempts.get(ip), now))
    return NextResponse.json({ error: 'invalid' }, { status: 401 })
  }

  attempts.delete(ip)
  const res = new NextResponse(null, { status: 204 })
  res.cookies.set(COOKIE_NAME, await signToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
```

- [ ] **Step 8: Implement the PIN pad and unlock page**

Create `src/components/PinPad.tsx`:

```tsx
'use client'

import { useState } from 'react'

export function PinPad({ onSubmit }: { onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('')

  function press(d: string) {
    navigator.vibrate?.(8)
    const next = pin + d
    setPin(next)
    if (next.length === 6) {
      onSubmit(next)
      setPin('')
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="text-lg"
                style={{ color: i < pin.length ? 'var(--accent)' : 'var(--rule)' }}>
            ■
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) =>
          k === '' ? <span key={i} /> : (
            <button
              key={i}
              type="button"
              onClick={() => k === '⌫' ? setPin(p => p.slice(0, -1)) : press(k)}
              style={{ minWidth: '64px', minHeight: '56px' }}
              className="text-base"
            >
              {k}
            </button>
          ))}
      </div>
    </div>
  )
}
```

Create `src/app/unlock/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PinPad } from '@/components/PinPad'

export default function UnlockPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  async function submit(pin: string) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin }),
    })

    if (res.status === 204) { router.replace('/habits'); return }
    if (res.status === 429) {
      const { retryInMs } = await res.json()
      setError(`LOCKED ${Math.ceil(retryInMs / 1000)}S`)
      return
    }
    setError('INVALID')
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <div className="text-sm tracking-widest">LIFE_OS</div>
        <div className="text-xs mt-1" style={{ color: 'var(--type-muted)' }}>
          ENTER PIN
        </div>
      </div>
      <PinPad onSubmit={submit} />
      <div className="text-xs h-4" style={{ color: 'var(--alert)' }}>{error}</div>
    </main>
  )
}
```

- [ ] **Step 9: Guard the app with middleware**

Create `src/middleware.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_NAME, verifyToken } from '@/lib/auth/pin'

export async function middleware(req: NextRequest) {
  if (await verifyToken(req.cookies.get(COOKIE_NAME)?.value)) {
    return NextResponse.next()
  }
  return NextResponse.redirect(new URL('/unlock', req.url))
}

export const config = {
  matcher: ['/habits/:path*', '/api/sync/:path*'],
}
```

`/api/auth` is deliberately absent from the matcher — it is the route that issues the token.

- [ ] **Step 10: Verify by hand**

Run: `npm run dev`, visit `http://localhost:3000/habits`.
Expected: redirects to `/unlock`. A wrong PIN shows `INVALID`. Five wrong PINs show `LOCKED 60S`. The correct PIN lands on the grid and survives a reload.

- [ ] **Step 11: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 12: Commit and push**

```bash
git add src/lib/auth/ src/app/api/auth/ src/app/unlock/ src/components/PinPad.tsx \
        src/middleware.ts scripts/hash-pin.mjs tests/unit/rate-limit.test.ts
git commit -m "feat: add PIN auth with server-side rate limiting and signed token"
git push
```

---

### Task 9: Sync engine

**Files:**
- Create: `src/lib/sync/merge.ts`, `src/lib/sync/engine.ts`, `src/app/api/sync/route.ts`, `src/components/SyncFooter.tsx`
- Modify: `src/app/habits/page.tsx`
- Test: `tests/unit/merge.test.ts`

**Interfaces:**
- Consumes: `dirtyEntries`, `getMeta`, `setMeta`, `db` from `@/lib/db/local`; `dbServer`, `habitEntries` from `@/lib/db/`
- Produces:
  - `mergeEntries(local: HabitEntry[], remote: HabitEntry[]): HabitEntry[]`
  - `sync(): Promise<{ pushed: number; pulled: number }>`
  - `POST /api/sync` — `{ since: string | null, rows: HabitEntry[] }` → `{ rows: HabitEntry[], serverTime: string }`

- [ ] **Step 1: Write the failing merge tests**

Create `tests/unit/merge.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mergeEntries } from '@/lib/sync/merge'
import type { HabitEntry } from '@/lib/types'

const e = (
  habitId: string, date: string, state: 'done' | 'missed' | 'none', updatedAt: string,
): HabitEntry => ({
  habitId, date, state, checkedAt: updatedAt, updatedAt,
})

describe('mergeEntries', () => {
  it('keeps the row with the later updatedAt', () => {
    const local = [e('a', '2026-07-28', 'done', '2026-07-28T10:00:00Z')]
    const remote = [e('a', '2026-07-28', 'missed', '2026-07-28T11:00:00Z')]
    expect(mergeEntries(local, remote)[0].state).toBe('missed')
  })

  it('keeps the local row when it is newer', () => {
    const local = [e('a', '2026-07-28', 'done', '2026-07-28T12:00:00Z')]
    const remote = [e('a', '2026-07-28', 'missed', '2026-07-28T11:00:00Z')]
    expect(mergeEntries(local, remote)[0].state).toBe('done')
  })

  it('includes rows present on only one side', () => {
    const local = [e('a', '2026-07-28', 'done', '2026-07-28T10:00:00Z')]
    const remote = [e('b', '2026-07-28', 'done', '2026-07-28T10:00:00Z')]
    expect(mergeEntries(local, remote)).toHaveLength(2)
  })

  it('treats habitId and date together as the identity', () => {
    const local = [e('a', '2026-07-28', 'done', '2026-07-28T10:00:00Z')]
    const remote = [e('a', '2026-07-27', 'done', '2026-07-28T11:00:00Z')]
    expect(mergeEntries(local, remote)).toHaveLength(2)
  })

  it('prefers remote on an exact timestamp tie — the server is authoritative', () => {
    const t = '2026-07-28T10:00:00Z'
    const local = [e('a', '2026-07-28', 'done', t)]
    const remote = [e('a', '2026-07-28', 'missed', t)]
    expect(mergeEntries(local, remote)[0].state).toBe('missed')
  })

  it('returns local rows unchanged when remote is empty', () => {
    const local = [e('a', '2026-07-28', 'done', '2026-07-28T10:00:00Z')]
    expect(mergeEntries(local, [])).toEqual(local)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- merge`
Expected: FAIL — cannot resolve `@/lib/sync/merge`

- [ ] **Step 3: Implement the merge**

Create `src/lib/sync/merge.ts`:

```typescript
import type { HabitEntry } from '../types'

const key = (e: HabitEntry) => `${e.habitId}|${e.date}`

/** Last-write-wins. On an exact tie the server row wins. */
export function mergeEntries(
  local: HabitEntry[], remote: HabitEntry[],
): HabitEntry[] {
  const out = new Map<string, HabitEntry>()
  for (const e of local) out.set(key(e), e)

  for (const r of remote) {
    const existing = out.get(key(r))
    if (!existing || r.updatedAt >= existing.updatedAt) out.set(key(r), r)
  }

  return [...out.values()]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- merge`
Expected: PASS, 6 tests.

- [ ] **Step 5: Implement the sync API route**

Create `src/app/api/sync/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { gt, sql } from 'drizzle-orm'
import { dbServer } from '@/lib/db/client'
import { habitEntries } from '@/lib/db/schema'

export async function POST(req: Request) {
  const { since, rows } = await req.json()
  const serverTime = new Date().toISOString()

  // Push. The server stamps updated_at — never trust a client clock.
  if (Array.isArray(rows) && rows.length > 0) {
    await dbServer.insert(habitEntries).values(
      rows.map((r: { habitId: string; date: string; state: string; checkedAt: string }) => ({
        habitId: r.habitId,
        date: r.date,
        state: r.state,
        checkedAt: new Date(r.checkedAt),
        updatedAt: new Date(serverTime),
      })),
    ).onConflictDoUpdate({
      target: [habitEntries.habitId, habitEntries.date],
      set: {
        state: sql`excluded.state`,
        checkedAt: sql`excluded.checked_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
  }

  // Pull everything changed since the client's cursor.
  const changed = since
    ? await dbServer.select().from(habitEntries)
        .where(gt(habitEntries.updatedAt, new Date(since)))
    : await dbServer.select().from(habitEntries)

  return NextResponse.json({
    serverTime,
    rows: changed.map(r => ({
      habitId: r.habitId,
      date: r.date,
      state: r.state,
      checkedAt: r.checkedAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  })
}
```

- [ ] **Step 6: Implement the sync engine**

Create `src/lib/sync/engine.ts`:

```typescript
import { db, dirtyEntries, getMeta, setMeta } from '../db/local'
import { mergeEntries } from './merge'
import type { HabitEntry } from '../types'

const CURSOR = 'syncCursor'
const LAST_SYNC = 'lastSyncAt'

export async function sync(): Promise<{ pushed: number; pulled: number }> {
  const dirty = await dirtyEntries()
  const since = await getMeta(CURSOR) ?? null

  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      since,
      rows: dirty.map(({ dirty: _d, ...row }) => row),
    }),
  })

  if (!res.ok) throw new Error(`sync failed: ${res.status}`)

  const { rows, serverTime } = await res.json() as {
    rows: HabitEntry[]; serverTime: string
  }

  await db.transaction('rw', db.habitEntries, db.meta, async () => {
    if (rows.length > 0) {
      const local = await db.habitEntries.toArray()
      for (const merged of mergeEntries(local, rows)) {
        await db.habitEntries.put({ ...merged, dirty: 0 })
      }
    }
    // Rows we just pushed are now clean.
    for (const d of dirty) {
      await db.habitEntries.update([d.habitId, d.date], { dirty: 0 })
    }
    await setMeta(CURSOR, serverTime)
    await setMeta(LAST_SYNC, serverTime)
  })

  return { pushed: dirty.length, pulled: rows.length }
}

export async function lastSyncAt(): Promise<string | undefined> {
  return getMeta(LAST_SYNC)
}

/** Quiet exponential backoff. Never throws to the caller. */
export function startSyncLoop(onDone: () => void): () => void {
  let delay = 5 * 60_000
  let timer: ReturnType<typeof setTimeout>
  let stopped = false

  const run = async () => {
    if (stopped) return
    try {
      await sync()
      delay = 5 * 60_000
      onDone()
    } catch {
      delay = Math.min(delay * 2, 30 * 60_000)
    }
    timer = setTimeout(run, delay)
  }

  const onFocus = () => { void run() }
  window.addEventListener('focus', onFocus)
  window.addEventListener('online', onFocus)
  void run()

  return () => {
    stopped = true
    clearTimeout(timer)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onFocus)
  }
}
```

- [ ] **Step 7: Implement the sync footer**

Create `src/components/SyncFooter.tsx`:

```tsx
'use client'

const STALE_MS = 24 * 60 * 60 * 1000

export function SyncFooter({ lastSync }: { lastSync?: string }) {
  const stale = !lastSync || Date.now() - new Date(lastSync).getTime() > STALE_MS

  const label = lastSync
    ? new Date(lastSync).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : 'NEVER'

  return (
    <footer className="px-3 py-2 text-[10px] flex justify-end"
            style={{
              borderTop: '1px solid var(--rule)',
              color: stale ? 'var(--alert)' : 'var(--type-muted)',
            }}>
      LAST_SYNC: {label} IST
    </footer>
  )
}
```

- [ ] **Step 8: Wire sync into the habits page**

In `src/app/habits/page.tsx`, add to the imports:

```tsx
import { startSyncLoop, lastSyncAt } from '@/lib/sync/engine'
import { SyncFooter } from '@/components/SyncFooter'
```

Add state and an effect:

```tsx
const [lastSync, setLastSync] = useState<string | undefined>()

useEffect(() => {
  const stop = startSyncLoop(async () => {
    setLastSync(await lastSyncAt())
    setEntries(await entriesForDates(dates))
  })
  return stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

Render `<SyncFooter lastSync={lastSync} />` as the last child of `<main>`.

- [ ] **Step 9: Verify by hand**

Run: `npm run dev`. Tick three habits, wait for a sync, and confirm the rows appear in the Neon `dev` branch.

Then open DevTools → Network → Offline, tick two more, confirm the UI updates instantly with no error, go back online, and confirm they arrive.

- [ ] **Step 10: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 11: Commit and push**

```bash
git add src/lib/sync/ src/app/api/sync/ src/components/SyncFooter.tsx \
        src/app/habits/page.tsx tests/unit/merge.test.ts
git commit -m "feat: add offline-first sync engine with last-write-wins merge"
git push
```

---

### Task 10: PWA — manifest, service worker, install

**Files:**
- Create: `public/manifest.json`, `src/app/sw.ts`, `public/icon-192.png`, `public/icon-512.png`
- Modify: `next.config.ts`, `src/app/layout.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: an installable PWA that launches offline

- [ ] **Step 1: Install Serwist**

```bash
npm install @serwist/next serwist
```

- [ ] **Step 2: Write the manifest**

Create `public/manifest.json`. `NEXT_PUBLIC_ENV_LABEL` distinguishes preview from production — this is what stops a week of ticks landing in the wrong database.

```json
{
  "name": "LIFE_OS",
  "short_name": "LIFE_OS",
  "start_url": "/habits",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

For the `dev` environment, create `public/manifest.dev.json` identical except `"name": "LIFE_OS · DEV"`, `"short_name": "LIFE_OS DEV"`, and pointing at `icon-dev-192.png` / `icon-dev-512.png`. Reference the right one from `layout.tsx` based on `process.env.NEXT_PUBLIC_ENV_LABEL`.

Icons: black square, accent `#c8ff00` `LOS` monogram for production; the same outlined rather than filled for dev, so they are distinguishable at a glance on the home screen.

- [ ] **Step 3: Write the service worker**

Create `src/app/sw.ts`:

```typescript
import { defaultCache } from '@serwist/next/worker'
import { Serwist } from 'serwist'

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: Array<{ url: string; revision: string | null }>
}

new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Do NOT skipWaiting: a new version installs now and activates on the
  // NEXT launch. An app that reloads mid-tick is worse than one a day behind.
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching: defaultCache,
}).addEventListeners()
```

- [ ] **Step 4: Wire Serwist into the Next config**

`next.config.ts`:

```typescript
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

export default withSerwist({})
```

- [ ] **Step 5: Link the manifest**

In `src/app/layout.tsx`, extend `metadata`:

```tsx
export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_ENV_LABEL === 'dev' ? 'LIFE_OS · DEV' : 'LIFE_OS',
  robots: { index: false, follow: false },
  manifest: process.env.NEXT_PUBLIC_ENV_LABEL === 'dev'
    ? '/manifest.dev.json' : '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
}

export const viewport = {
  themeColor: '#0a0a0a',
  viewportFit: 'cover' as const,
}
```

- [ ] **Step 6: Request persistent storage**

Add to `src/app/habits/page.tsx`, inside the mount effect:

```tsx
// Android can clear IndexedDB under storage pressure. Ask it not to.
void navigator.storage?.persist?.()
```

- [ ] **Step 7: Verify the build**

Run: `npm run build && npm start`
Expected: build succeeds, `public/sw.js` is generated, and Chrome DevTools → Application → Manifest shows the app as installable.

- [ ] **Step 8: Commit and push**

```bash
git add public/ src/app/sw.ts next.config.ts src/app/layout.tsx src/app/habits/page.tsx package.json
git commit -m "feat: make the app installable with an offline service worker"
git push
```

---

### Task 11: End-to-end spine test

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/spine.spec.ts`

**Interfaces:**
- Consumes: the running app
- Produces: one Playwright test covering unlock → tick → persist → offline → sync

- [ ] **Step 1: Configure Playwright**

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
```

Run `npx playwright install chromium` once.

- [ ] **Step 2: Write the spine test**

Create `tests/e2e/spine.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

const PIN = process.env.E2E_PIN ?? '123456'

test('unlock, tick, persist, go offline, tick, come back online', async ({ page, context }) => {
  await page.goto('/habits')
  await expect(page).toHaveURL(/\/unlock/)

  for (const d of PIN) await page.getByRole('button', { name: d, exact: true }).click()
  await expect(page).toHaveURL(/\/habits/)

  const cell = page.getByRole('button', { name: /READ BOOK 2026-.*/ }).last()
  await cell.click()
  await expect(cell).toHaveText('■')

  await page.reload()
  await expect(page.getByRole('button', { name: /READ BOOK .* done/ }).last())
    .toHaveText('■')

  await context.setOffline(true)
  const offlineCell = page.getByRole('button', { name: /MEDITATION .*/ }).last()
  await offlineCell.click()
  await expect(offlineCell).toHaveText('■')

  await context.setOffline(false)
  await page.reload()
  await expect(page.getByRole('button', { name: /MEDITATION .* done/ }).last())
    .toHaveText('■')
})
```

- [ ] **Step 3: Run it**

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test: add end-to-end spine test covering unlock, tick, and offline sync"
git push
```

---

### Task 12: Deploy to preview

**Files:**
- Create: `vercel.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above
- Produces: a live, installable app at `dev.mylifeos.shiftd.in`

- [ ] **Step 1: Create the Vercel project**

Import `shifingeorge/mylifeos` in the Vercel dashboard. Set the production branch to `main`.

- [ ] **Step 2: Set environment variables**

In Vercel → Settings → Environment Variables, for **Preview** scope:

```
DATABASE_URL           <Neon dev branch string>
PIN_HASH               <argon2 hash>
AUTH_SECRET            <openssl rand -base64 32>
NEXT_PUBLIC_ENV_LABEL  dev
```

For **Production** scope, the same four with the Neon `main` string, a separately generated `AUTH_SECRET`, and `NEXT_PUBLIC_ENV_LABEL=prod`.

- [ ] **Step 3: Add the domains**

In Vercel → Settings → Domains, add `mylifeos.shiftd.in` assigned to `main`, and `dev.mylifeos.shiftd.in` assigned to the `dev` branch. Vercel shows the exact CNAME records to create in the `shiftd.in` DNS.

- [ ] **Step 4: Run the production migration**

```bash
DATABASE_URL=<Neon main branch string> npm run db:migrate
```

- [ ] **Step 5: Protect `main`**

In GitHub → Settings → Branches, require a pull request before merging to `main`. This is what stops anything reaching production without passing through preview.

- [ ] **Step 6: Verify on the real phone**

Open `https://dev.mylifeos.shiftd.in` on your Android. Enter the PIN. Install to the home screen. Confirm the icon reads `LIFE_OS DEV` and is visually distinct.

Then run the physical checks from spec §10.3:
- Stopwatch the morning tick — target under 10 seconds
- Measure a tick target — 44px minimum
- Airplane mode: tick a full day, close the app, reopen, restore the network, confirm everything arrives
- Confirm `navigator.storage.persisted()` returns `true` in `chrome://inspect`

- [ ] **Step 7: Commit and push**

```bash
git add vercel.json README.md
git commit -m "chore: add deploy config and preview environment documentation"
git push
```

---

## Self-Review

**Spec coverage.** Every §7.5 milestone-1 item maps to a task: habits grid (6), rolling 5 days (2, 6), tap cycle (3, 6), IndexedDB (5), Neon sync (7, 9), PIN (8), haptics (6). Spec §5.4's stale-sync alert is Task 9 step 7. §5.6's update policy is Task 10 step 3. §10.1's five test areas are Tasks 2, 3, 4, 8, 9. §10.2's E2E is Task 11.

**Deliberately deferred to later milestones**, per spec §7.5 — not gaps:
- Export button — milestone 2
- Tasks ledger and capture — milestone 3
- Month view and per-category totals — milestone 4. `monthScores` and `monthDates` are built and tested in Tasks 2 and 4 because they are pure functions with no UI cost, and building them alongside their siblings is cheaper than returning later.
- Laptop layout — milestone 5
- Palette refinement — milestone 6. Task 1's CSS variables are placeholders sized for correct structure, not validated contrast.

**Type consistency.** `CellState`, `Habit`, `HabitEntry`, and `Category` are defined once in Task 3 and imported everywhere after. `ISODate` is defined in Task 2. `dirty` is `1 | 0` consistently in Tasks 5 and 9 because Dexie cannot index booleans. `mergeEntries`, `sync`, `dayScore`, `monthScores`, `renderMark`, and `cycle` keep the same signatures across every task that references them.

**Known limitation, accepted.** The Task 8 rate limiter holds state in memory, so a serverless cold start resets the counter. For a single-user app this is an acceptable trade — an attacker still cannot exceed five attempts per warm instance, and the lockout throttles any sustained attempt. Moving it to a Neon table is a one-task change if it ever matters.
