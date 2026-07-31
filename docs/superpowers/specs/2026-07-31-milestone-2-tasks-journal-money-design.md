# Milestone 2 — Tasks, Journal, Money, Settings

Status: design, awaiting review
Date: 2026-07-31
Supersedes: the export-first M2 direction abandoned on 2026-07-31

## 1. What is being built

Three new areas — Tasks, Journal, Money — each built to skeleton depth: it can
capture an item, list what has been captured, and sync it offline-first like
habits already do. Plus a Settings area that makes the lists behind those
captures editable without a deploy, and a Home screen that summarises all four.

Export is dropped from this milestone. It was insurance against the sync path;
the sync path has now run against real data on two environments without loss,
and the thing actually blocking use is that three quarters of the app does not
exist yet.

**The reason skeleton is the right depth:** starting 2026-08-01 the spreadsheet
and the app run side by side. The spreadsheet is the source of truth for a week
or two; the app's job is to find out what is actually needed. Filters, reports
and charts built now would be guesses. Built after a week of parallel use they
are answers.

Each area merges to production on its own once it survives real use. Nothing
waits for the last piece.

## 2. Decisions settled during brainstorming

| Question | Decision |
| --- | --- |
| Navigation | Home summary screen; HOME / HABITS / TASKS / MONEY in the bottom bar; JOURNAL and SETTINGS behind a hamburger, since neither is opened daily |
| Depth for 2026-08-01 | Skeleton: capture + list + sync. No filters, reports or charts |
| Rollout | One area at a time from `dev` to production |
| Settings scope | Habits, habit categories, task projects, money categories and accounts, plus app info and logout |
| Money scope | Personal only. Shop books stay out |
| Money entry | Amount, type (expense / income / transfer), category, subcategory, from-account, to-account, one date, note |
| Money dates | One date per entry — the transaction date, backfillable. The recording time is stamped invisibly |
| Accounts to seed | CASH, BANK, BANK 2, CREDIT CARD — all renamable |
| Journal shape | One entry per day, free text, backfillable |
| Journal privacy | A second server-verified PIN. A gate, not encryption — see §7 |

## 3. Data model

Every new table follows the pattern habits already established: a string id, an
`updatedAt` the server stamps, and a local-only `dirty: 1 | 0` that is stripped
before push. Dexie cannot index booleans, which is why `dirty` is not one.

### 3.1 Identity

All new rows get `crypto.randomUUID()` at creation and keep it forever. Ids are
never derived from names, so renaming a project or a category never orphans the
rows pointing at it. The one exception is seed data, which uses readable ids
(`cash`, `smashed`) because they are written once, by us, and appear in fixtures.

### 3.2 Tasks

```ts
interface Project {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;       // archived projects stay, so old tasks keep their tag
  updatedAt: string;
}

interface Task {
  id: string;
  title: string;
  priority: Priority;            // "P1" | "P2" | "P3" | "P4", already in types.ts
  projectId: string | null;      // null = unfiled
  due: ISODate | null;           // null is legitimate, not a missing value
  done: boolean;
  completedAt: string | null;    // when it was actually ticked
  createdAt: string;
  updatedAt: string;
  dirty?: 1 | 0;
}
```

Seed projects: `SMASHED`, `MINE`, `HOME`, `P_BRAND` — the four from the design
doc's mockup, editable from Settings on day one.

A completed task is never deleted. `done` plus `completedAt` is what makes a
future "what did I finish in July" possible; a delete makes it impossible.

### 3.3 Journal

```ts
interface JournalEntry {
  date: ISODate;         // primary key — a day owns exactly one entry
  body: string;
  updatedAt: string;
  dirty?: 1 | 0;
}
```

Same key shape as `HabitEntry`, minus the habit. Backfilling is opening an older
date and typing, exactly like ticking a past cell.

**Deleting is emptying.** Clearing the body leaves the row with `body: ""` and
the list hides it. This is deliberate: a real delete needs tombstones, because a
row that vanishes locally is indistinguishable to the sync engine from a row the
device has never seen, and the next pull would resurrect it. Empty-string rows
cost a few bytes and remove that entire class of bug.

### 3.4 Money

```ts
type TxnType = "expense" | "income" | "transfer";

interface Account {
  id: string;
  name: string;
  kind: "cash" | "bank" | "credit";
  sortOrder: number;
  active: boolean;
  updatedAt: string;
}

interface MoneyCategory {
  id: string;
  name: string;
  parentId: string | null;   // one level of nesting, no deeper
  flow: "expense" | "income";
  sortOrder: number;
  active: boolean;
  updatedAt: string;
}

interface Txn {
  id: string;
  type: TxnType;
  amountPaise: number;             // integer minor units — see below
  date: ISODate;                   // transaction date, backfillable
  categoryId: string | null;       // required except on transfers
  fromAccountId: string | null;
  toAccountId: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
  dirty?: 1 | 0;
}
```

**Money is stored as integer paise, never as a float.** `0.1 + 0.2` is
`0.30000000000000004` in JavaScript, and a ledger that drifts by a paisa per
hundred entries is worse than no ledger. Rupees exist only at the edges: parsed
on input, formatted with `Intl.NumberFormat("en-IN")` on output.

**Direction is enforced by type, and validated in one pure function:**

| Type | fromAccountId | toAccountId | categoryId |
| --- | --- | --- | --- |
| `expense` | required | null | required |
| `income` | null | required | required |
| `transfer` | required | required, ≠ from | null |

`validateTxn(txn): string[]` returns the problems. The capture sheet calls it to
enable the save button; the sync route calls it before writing. A rule enforced
only in the UI is not a rule.

`amountPaise` is always positive. Direction is `type`'s job. Signed amounts plus
a type is two sources of truth for one fact, and they eventually disagree.

Subcategories are one level deep by convention and by validation: a category
with a `parentId` may not itself be a parent. Arbitrary depth means recursive
rendering and recursive rollups for a personal expense log, which is not a
trade worth making.

Seed accounts: `CASH` (cash), `BANK` (bank), `BANK 2` (bank), `CREDIT CARD`
(credit). Seed categories, expense: FOOD, GROCERIES, EATING OUT, FUEL,
TRANSPORT, RENT, BILLS, HEALTH, SHOPPING, SUBSCRIPTIONS, OTHER. Income: SALARY,
BUSINESS, INTEREST, OTHER. All renamable and archivable from Settings.

Balances are **not** stored. A balance is `sum(in) − sum(out)` over the account,
computed on read. A stored balance is a cached aggregate that every backfilled
or edited transaction can silently invalidate — and backfilling is a stated
requirement.

### 3.5 Changes to existing tables

- `categories` gains `updatedAt` (Postgres `ALTER TABLE`, Dexie version 2), so
  it can sync like everything else rather than being seeded server-side.
- `habits.active` starts being used, for archiving from Settings.
- `HabitEntry` is untouched.

## 4. Screens

### 4.1 Shell

```
┌───────────────────────────────┐
│ [≡]  LIFE_OS · DEV            │   ← hamburger opens JOURNAL / SETTINGS / LOCK
│                               │
│           … area …            │
│                               │
│                        ( + )  │   ← FAB where the area has a capture
├───────────────────────────────┤
│ HOME  HABITS  [TASKS]  MONEY  │
└───────────────────────────────┘
```

Four bottom tabs at 44px minimum. Journal and Settings sit in the hamburger
because neither is a daily destination and a five-tab bar on a phone is a row of
mistaps. The hamburger is a full-height sheet, not a slide-out drawer — a sheet
is one component, dismisses by swipe-down like everything else in the app, and
needs no focus-trap library.

### 4.2 Home

```
┌───────────────────────────────┐
│ [≡]   THU 31 JUL              │
│                               │
│  HABITS              8 / 12   │
│  ████████████░░░░░░░  ›       │
│                               │
│  TASKS              9 OPEN    │
│  ■P1 MENU PRICING FIX  ›      │
│                               │
│  MONEY            JUL  ₹4,210 │
│  CASH ₹2,100 · BANK ₹18,400 › │
│                               │
│  JOURNAL           WRITTEN  › │
└───────────────────────────────┘
```

Each card taps into its area. The habits bar reuses the existing score logic.
Money shows the month's net and per-account balances, both computed on read.

Journal shows only `WRITTEN` or `NOT YET` — never a preview, never a word count.
Whoever is looking over your shoulder does not get the first line for free.

### 4.3 Tasks

The §4.4 design from the v1 spec, minus the project filter row, which is a
filter and therefore out of skeleton scope:

```
 TASK_LEDGER                 9 OPEN
─────────────────────────────────────
 [ ]  MENU PRICING FIX
      ■P1  (SMASHED)      TUE 28 JUL
 [ ]  ZOMATO SALES DIP
      ■P1  (SMASHED)  MON 20 JUL  +8d
─────────────────────────────────────
 DONE TODAY  2  ›
                              ( + )
```

**The shape rule holds and is not negotiable: priority is a filled solid block,
project is an outlined tag.** Two shapes, not two hues.

Two-line rows, tick target on the full-height left edge. Sorted by priority then
due date, undated last. Overdue as `+8d` right-aligned in the alert tone; the
row itself does not recolour. Ticking collapses the row with a five-second undo.
No confirmation dialogs anywhere in this app.

Capture is the §4.5 sheet: auto-focused title, P2 / last-used project / TODAY
preselected, `NONE` available for due. Target remains **title plus one tap**.

### 4.4 Money

```
 MONEY                     JULY
 CASH ₹2,100 · BANK ₹18,400
─────────────────────────────────────
 THU 31 JUL              −₹1,240
   ₹840   FOOD · LUNCH        CASH
   ₹400   FUEL               BANK
 WED 30 JUL                −₹310
   ₹310   GROCERIES          BANK
─────────────────────────────────────
                              ( + )
```

Grouped by date descending, day totals on the right. Expenses lead with `−`,
income with `+`, transfers render as `BANK → CASH` with no sign because nothing
left the system.

The capture sheet switches on type first, because type decides which other
fields exist:

```
 NEW ENTRY
  ■EXPENSE  ■INCOME  ■TRANSFER
 ┌─────────────────────────────┐
 │ ₹ ▌                         │
 └─────────────────────────────┘
 FROM      (CASH) (BANK) (BANK 2) …
 CATEGORY  (FOOD) (FUEL) (RENT) …
   └ SUB   (LUNCH) (DINNER) …        ← only if the category has children
 DATE      TODAY  YESTERDAY  PICK →
 NOTE      ┌───────────────────────┐
                            [ SAVE ]
```

Amount field first and auto-focused with a numeric keypad, because the amount is
the one field you always know. Type blocks are filled (a tier-like choice);
accounts and categories are outlined tags — the shape rule again.

### 4.5 Journal

```
┌───────────────────────────────┐
│ [≡]  JOURNAL                  │
│───────────────────────────────│
│ THU 31 JUL 2026               │
│ ▌                             │
│                               │
│───────────────────────────────│
│ WED 30 JUL   ·      142 words │
│ TUE 29 JUL   ·       38 words │
└───────────────────────────────┘
```

Today's entry is always open at the top for typing. Saving is automatic, on a
one-second debounce and on blur — an explicit save button is a way to lose
writing. Older dates are one line each and open in place.

Before any of this renders, the journal PIN gate stands in front of it (§7).

### 4.6 Settings

`/settings` is an index; each row pushes a full screen.

```
 SETTINGS
─────────────────────────────────────
 HABITS                    12  ›
 HABIT CATEGORIES           5  ›
 TASK PROJECTS              4  ›
 MONEY CATEGORIES          15  ›
 ACCOUNTS                   4  ›
─────────────────────────────────────
 LIFE_OS · DEV
 2,104 ENTRIES · SYNCED 14:32
 [ LOCK ]
─────────────────────────────────────
```

All five list screens share one component. Each row: name, a `›` to edit,
`↑ ↓` to reorder. No drag-and-drop — it is miserable on a phone and needs a
library. Each has a `( + )` to add.

The editor is a sheet with the name field plus whatever that entity needs
(tier and category for a habit; kind for an account; parent and flow for a money
category). Its destructive button reads **DELETE** when nothing references the
row and **ARCHIVE** when something does, decided before the sheet renders. The
button saying what will happen removes the need for a confirmation dialog.

Deleting is refused inline where it would orphan data — `3 HABITS — MOVE THEM
FIRST` under a disabled button — rather than in a dialog after the tap.

## 5. Routing and guarding

New routes: `/` (home), `/tasks`, `/money`, `/journal`, `/settings`,
`/settings/{habits,habit-categories,projects,money-categories,accounts}`.

`proxy.ts` currently guards an explicit allowlist of two paths. With eleven
routes and more coming, an allowlist is a security bug waiting for the one route
someone forgets to add. It inverts to a denylist, so **new routes are guarded by
default**:

```ts
export const config = {
  matcher: [
    "/((?!unlock|api/auth|api/health|manifest.webmanifest|sw.js|icons/|_next/|favicon.ico).*)",
  ],
};
```

Everything excluded is excluded for a stated reason: `/unlock` and `/api/auth`
issue the token, `/api/health` must answer when auth is what is broken, and the
rest are static assets the service worker fetches without cookies.

This change is verified by test, not by inspection: a table of paths and their
expected guarded/unguarded status, asserted against the matcher.

## 6. Sync

### 6.1 One envelope

The request and response become symmetric and cover every table:

```ts
interface SyncPayload {
  categories: Category[];
  habits: Habit[];
  entries: HabitEntry[];
  projects: Project[];
  tasks: Task[];
  accounts: Account[];
  moneyCategories: MoneyCategory[];
  txns: Txn[];
}

// POST /api/sync   { since: string | null } & SyncPayload
// →                { serverTime: string } & SyncPayload
```

Journal is deliberately not in this envelope. See §7.

**Server write order is parents before children:** categories → habits →
entries, projects → tasks, accounts and money categories → txns. This is what
lets a brand-new project and its first task arrive in one request without
tripping the foreign key.

The server stamps `updatedAt` on every row it writes. A phone with a skewed
clock must not be able to win a merge by claiming the future.

### 6.2 Generic merge

`mergeEntries(local, remote)` generalises to:

```ts
mergeRows<T extends { updatedAt: string }>(
  local: T[], remote: T[], key: (row: T) => string,
): T[]
```

Entries key on `${habitId}|${date}`, journal on `date`, everything else on `id`.
Last write wins on the server-stamped `updatedAt`; the server wins exact ties,
because the server is the only clock all devices share.

The existing merge tests must keep passing **unchanged** — if generalising the
function needs its tests edited, the generalisation changed behaviour.

### 6.3 ensureSeeded is deleted

The sync route currently upserts habits and categories from the seed module on
every request. Once habits are editable from Settings, that code would resurrect
a habit the moment after it was archived. Seeding becomes client-only: a fresh
device seeds locally, and the first sync uploads it.

Production already holds the 12 habits with a server `updatedAt` newer than the
seed's fixed `2026-07-29T00:00:00.000Z`, so on the first sync after this change
the server rows win the merge and nothing visible happens. That is the correct
outcome and it is silent.

### 6.4 Failure

Unchanged from v1, and it matters more now: writes go to Dexie first and are
marked dirty; the sync loop pushes on open, focus, online and every five
minutes, backing off to thirty on failure. A failed sync is invisible except in
the footer's last-synced line. Nothing is ever lost by being offline, because
nothing is ever written to the network first.

## 7. The journal lock

A second PIN, `JOURNAL_PIN_HASH`, hashed with argon2id and verified server-side
by `POST /api/journal-auth`, reusing the existing rate limiter under its own
key — five attempts, then a lockout doubling to an hour. Success sets a second
HttpOnly cookie, `lifeos_journal`, valid for eight hours.

**Journal data does not travel on `/api/sync`.** It has its own endpoint,
`/api/journal`, guarded by both cookies. The reason is that a lock which only
hides the UI is not a lock: the text would already be sitting in IndexedDB,
readable from devtools in ten seconds. Keeping it on a separate channel means it
never reaches the device until the journal PIN has been entered.

**What this protects and what it does not**, stated plainly so it is not
mistaken for more than it is:

- It protects against someone holding your unlocked phone with the app open.
- It protects against the journal text being pulled onto a device that has never
  unlocked it.
- It does **not** hide the text from anyone with the database. Neon stores
  plaintext. Encryption was offered and declined, correctly — the cost is that a
  forgotten PIN destroys every entry permanently.
- Once unlocked on a device, entries are cached in IndexedDB so the journal
  works offline. They are cleared on lock and on logout.

`JOURNAL_PIN_HASH` must be set in both environments before `/journal` ships.
Generate it with `node scripts/hash-pin.mjs <pin>` — the PIN is never sent to
anyone, only the hash.

## 8. Build order

Each phase ends at a mergeable state. Phases 1–3 merge to production
independently, as agreed.

**Phase 0 — foundation.** Dexie v2 with the new tables, the Drizzle migration,
the generic `mergeRows`, the widened sync envelope, `ensureSeeded` removed, the
inverted proxy matcher, the app shell with the tab bar and hamburger, and the
Home screen reading only habits at first. No new user-facing data yet; this is
the floor the three areas stand on.

**Phase 1 — Tasks.** Types, validation, Dexie queries, list, capture sheet,
complete-with-undo, `/settings/projects`. Home's task card lights up. → merge.

**Phase 2 — Money.** Paise arithmetic and formatting, `validateTxn`, list,
capture sheet, balances, `/settings/money-categories`, `/settings/accounts`.
Home's money card lights up. → merge.

**Phase 3 — Journal.** Second PIN, `/api/journal-auth`, `/api/journal`, the gate,
the editor with debounced save, the date list. Home's journal card lights up.
→ merge.

**Phase 4 — Settings completion.** Habit and habit-category management, app info,
lock. → merge.

Phase 1 is the one that has to land for 2026-08-01. Phases 2 and 3 follow within
days.

## 9. Verification

Written test-first, following the existing suite's shape.

**Unit.** Paise parsing and formatting round-trips, including `0.1 + 0.2` and
values that would round badly as floats. `validateTxn` across all three types
and every missing-field case. Task sorting: priority then due, undated last.
Overdue day counts across an IST month boundary. `mergeRows` for each key
function, plus the existing entry-merge tests passing unedited. The proxy
matcher table. Journal word count on empty, whitespace-only and multi-paragraph
bodies.

**Integration.** A sync round-trip carrying a new project and a task referencing
it in one request, proving the write order. A transfer between two accounts
producing zero net change across balances. An archived habit staying archived
across a sync — the regression `ensureSeeded` would have caused.

**End-to-end (Playwright, Pixel 7).** Unlock → capture a task → go offline →
capture another → come back online → both present after a reload. And: journal
unreachable without the second PIN, including a direct `GET /api/journal` with
only the main cookie, which must be refused.

**Physical, on the phone.** Capture a task and a transaction one-handed on the
first try. Confirm the amount field raises the numeric keypad. Confirm the
journal gate appears after a cold start rather than being remembered forever.

## 10. Divergences from earlier decisions

**A home screen now exists.** `src/app/page.tsx` currently redirects to
`/habits` with the comment "No home screen, no dashboard, no summary. The app
opens directly into the thing you came to do." That was right when habits were
the only thing to come to. With four areas there is no single thing, and a
summary that answers "where do I stand today" in one screen is worth the extra
tap. The redirect and its comment are replaced.

**Export moves out of this milestone**, having been the whole of the previous
M2 draft. See §1.

## 11. Deferred, deliberately

Task filters and project tag row · month and week money reports · charts ·
recurring tasks · task edit after creation (delete and re-add works at this
volume) · shop books · budgets · attachments and receipt photos · journal search
· export, until the parallel-spreadsheet period says what shape it should take ·
the month habit view (v1 §4.3) · the laptop layout.
