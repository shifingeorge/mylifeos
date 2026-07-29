# Life OS v1 — Technical Design Spec

**Date:** 2026-07-29
**Owner:** Shifin
**Status:** Approved, ready for implementation planning
**Supersedes nothing.** Companion to `mylifeos_pwa design doc.md`, which remains the
product rationale. Where this spec and that document disagree, this spec wins and the
divergence is recorded in §9.

---

## 1. What is being built

A single-user PWA that replaces the spreadsheet for **habits and tasks only**. Installed
on an Android phone, and usable at the same URL in a laptop browser. Offline-first: every
tick writes locally and instantly, then syncs to Postgres in the background.

The app exists to fix capture. The design document's §1 diagnosis stands: the data model
works, the daily instrument does not, because capture requires sitting at a machine.

**v1 scope:** habit grid, month view, task ledger, task capture, backfill, PIN unlock, export.
**Out of v1:** finance, journal, content pipeline, notifications, streaks, search, settings, logout.

---

## 2. Decisions settled during brainstorming

| Decision | Answer | Note |
|---|---|---|
| Build order | Mobile-first, responsive, one codebase | Desktop-first would mean building it twice |
| Habit list | All 12 (Payout removed as an error) | |
| Habit grouping | Two axes: `tier` and `category` | |
| Grid grouping | **By category**, core marked `•` | |
| Day score | `CORE n/6 · +m growing` | |
| Miss recording | **Tap cycle** `none → done → missed → none` | Explicit, costs 6–10 taps/night |
| Time window | Rolling 5 days, today rightmost | No future cells exist |
| Database | Neon Postgres from day one | |
| Local store | IndexedDB via Dexie, source of truth | |
| Access control | 6-digit PIN, server-verified, per-device token | |
| Platform | Android only for v1 | Haptics work; iOS Safari cannot vibrate |
| Stack | Next.js App Router + TypeScript on Vercel | |

---

## 3. Data model

Identical shape in IndexedDB and Neon, so sync is a row copy with no translation.

```sql
categories
  id          text  primary key
  name        text                  -- 'HEALTH'
  color       text                  -- hue role, resolved per ground
  sort_order  int

habits
  id           text  primary key
  name         text                 -- 'EXERCISE (WALK)'
  tier         text                 -- 'core' | 'growing'
  category_id  text  null references categories(id)
  sort_order   int
  active       bool                 -- soft delete; history survives
  updated_at   timestamptz

habit_entries
  habit_id    text
  date        date                  -- the day it COUNTS FOR
  state       text                  -- 'done' | 'missed' | 'none'
  checked_at  timestamptz           -- when the tap actually happened
  updated_at  timestamptz
  primary key (habit_id, date)

tasks
  id          text  primary key
  name        text
  priority    text                  -- 'P1' | 'P2' | 'P3' | 'P4'
  project     text                  -- 'Smashed'|'Mine'|'Home'|'Personal Brand'|'Misc'
  due_date    date        null      -- nullable
  done_at     timestamptz null      -- null = open
  updated_at  timestamptz
  deleted_at  timestamptz null
```

### 3.1 Rationale for four non-obvious choices

**`date` and `checked_at` are separate.** `date` is the day the habit counts for;
`checked_at` is when the tap happened. "Slept at 11pm yesterday, ticked it at 9am today"
is `date = 2026-07-28, checked_at = 2026-07-29T09:04+05:30`. Several habits — Sleep at 11,
Wakeup at 6 — can *only* be logged the following morning. Retroactive logging is the
normal path for them, not an edge case.

**A row exists only once the cell is touched.** The spreadsheet stores `False` for every
habit × every day. Here an untouched cell has no row, which is what makes "not logged yet"
distinguishable from "missed" at zero cost.

**`state = 'none'` instead of deleting.** The tap cycle's third step clears a cell. Keeping
the row with `state = 'none'` avoids tombstones, which are the most error-prone part of any
sync implementation. A few dead rows is a fair trade.

**Soft deletes throughout** (`active`, `deleted_at`). Dropping a habit in October must not
punch holes in September's month view.

### 3.2 Seed data

Twelve habits, five categories. `•` marks core.

| Category | Habits |
|---|---|
| HEALTH | Wakeup at 6 · Sleep at 11 · • Exercise (Walk) |
| MIND | • Meditation · • Read Book |
| BUSINESS | • Sales Tracker · • Customer Checked · • Inventory Stock · Finance Log |
| OUTPUT | Post Content · Video |
| HOME | Bird Food |

Core = 6, growing = 6. Category order (health → mind → business → output → home)
satisfies design doc §10.4's "body first, then business, then output" and becomes the
single canonical order applied to every month.

Categories are seeded in code for v1. Adding a sixth is a one-line change. There is no
UI to manage them — see §8.

Task seed data and full extraction notes: `docs/seed-data.md`.

### 3.3 Scale

12 habits × 365 days ≈ 4,400 entry rows/year worst case, realistically ~2,000, plus a few
hundred tasks. Comfortably inside Neon's free tier and unnoticeable in IndexedDB.

---

## 4. Screens

Five screens: two tabs, two pushed/overlaid, one shown once per device.

### 4.1 Unlock

Shown on first open per device only. Custom numeric keypad, not the OS keyboard — faster,
and the keys sit in the thumb zone. On success the server sets a long-lived token cookie.

### 4.2 Habits (default tab)

```
 LIFE_OS                      TUE 28 JUL
                          CORE 4/6 · +1
─────────────────────────────────────────
                    F    S    S    M    T
                   24   25   26   27   28
 HEALTH
   WAKEUP AT 6      ✕    ✕    ✕    ■   [ ]
   SLEEP AT 11      ✕    ✕    ·    ■   [ ]
 • EXERCISE (WALK)  ✕    ■    ✕    ■   [ ]
 MIND
 • MEDITATION       ✕    ✕    ■    ■   [■]
 • READ BOOK        ■    ■    ■    ■   [■]
 BUSINESS
 • SALES TRACKER    ■    ■    ✕    ■   [■]
 • CUSTOMER CHECKED ■    ■    ✕    ■   [ ]
 • INVENTORY STOCK  ■    ■    ·    ■   [■]
   FINANCE LOG      ■    ✕    ✕    ·   [ ]
 OUTPUT
   POST CONTENT     ✕    ✕    ✕    ✕   [ ]
   VIDEO            ·    ·    ·    ·   [ ]
 HOME
   BIRD FOOD        ✕    ✕    ■    ✕   [ ]
─────────────────────────────────────────
 VIEW MONTH →
─────────────────────────────────────────
      [ HABITS ]        TASKS
```

**Cell states — four:**

| Mark | Meaning | Stored as |
|---|---|---|
| `■` | done | `state='done'` |
| `✕` | marked missed | `state='missed'` |
| `·` | never logged | no row, or `state='none'` |
| `[ ]` | today, untouched | no row, and `date = today` |

`[ ]` is not a stored state — it is `·` rendered on today's date.

**Interaction.** Every cell is 44 × 44 and the whole cell is the target. Tap cycles
`none → done → missed → none`. Haptic on every step. Past columns behave identically to
today — backfill needs no special mode. Future dates cannot be rendered, so they cannot
be tapped.

**Vertical budget:** 12 habits × 44px + 5 category headers × 26px + header + tab bar
≈ 795px against roughly 860px available in an installed PWA. Fits. Habit names top out at
16 characters (`CUSTOMER CHECKED`), ~106px in DM Mono, leaving room for five 44px columns
even at a 360px viewport.

**Score** in Syne, the only display type on the screen.

### 4.3 Month (pushed from Habits)

Habits × 31 days, same category grouping, horizontal scroll with the habit-name column
pinned. All cells tappable for backfill. Per-category footer:

```
 HEALTH 12/93 · MIND 48/62 · BUSINESS 97/124 · OUTPUT 3/62 · HOME 19/31
```

Denominators are `habits_in_category × days_elapsed_in_month`, counting the current day.
The example above shows a completed 31-day month: HEALTH holds 3 habits, so 3 × 31 = 93.
Mid-month on the 10th the same category reads `n/30`. Denominators grow as the month runs,
so the ratio stays honest rather than looking like failure on the 2nd.

This is the Sunday review surface and the main thing categories buy.

### 4.4 Tasks

```
 LIFE_OS · TASK_LEDGER              9 OPEN
 (ALL) (SMASHED) (MINE) (HOME) (P_BRAND) …
─────────────────────────────────────────
 [ ]  MENU PRICING FIX
      ■P1  (SMASHED)          TUE 28 JUL
 [ ]  ZOMATO SALES DIPPED REASON
      ■P1  (SMASHED)     MON 20 JUL  +8d
─────────────────────────────────────────
                                   ( + )
      HABITS            [ TASKS ]
```

**The shape rule (design doc §5.3, non-negotiable): priority is a filled solid block,
project is an outlined tag.** Two shapes, not two hues. Both existing mockups render them
as matching outlined boxes, which is precisely the failure §5.3 was written to prevent.

Two-line rows ~72px, tick target on the full-height left edge. Sorted priority then due
date. Overdue as `+8d`, right-aligned, alert tone; the row itself does not change colour.
Completing collapses the row with a 5-second undo. No confirmation dialogs anywhere.

Project filter tags across the top, horizontally scrollable, single-select, `(ALL)` default.

### 4.5 Capture (sheet over Tasks, from the FAB)

```
 NEW TASK
 ┌─────────────────────────────────────┐
 │ ▌                                   │
 └─────────────────────────────────────┘
 PRIORITY  ■P1  ■P2  ■P3  ■P4
 PROJECT   (SMASHED) (MINE) (HOME) …
 DUE       TODAY  TOMORROW  PICK →  NONE
                              [ SAVE ]
```

Name field auto-focused, keyboard up immediately. P2 / last-used project / TODAY
preselected. `NONE` exists because the sheet already contains a task with no due date.

**Target: name + one tap to save.**

### 4.6 Laptop layout

Same URL, same components, wider breakpoint. Full month grid natively with no horizontal
scroll; wider task rows; the two-tab bar moves from the bottom to a left rail. Keyboard
shortcuts for tick and capture. This is where the existing desktop mockups' visual
language belongs, with the shape rule applied.

---

## 5. Sync and offline

### 5.1 Write path

```
tap cell
  → write to IndexedDB      (synchronous, ~1ms)
  → UI re-renders           (optimistic)
  → haptic fires
  → row marked dirty
  ⋯ background ⋯
  → push dirty rows to Neon
  → mark clean
```

A tap never touches the network. Nothing animates longer than 150ms on a capture action.

### 5.2 Sync triggers

App open, network regained, tab focus, and every 5 minutes while open. Pull rows changed
since the stored cursor; push all dirty rows.

### 5.3 Conflict resolution

Last-write-wins on `updated_at`. Single user, so simultaneous conflicting edits are not a
realistic scenario. CRDTs and sync engines are explicitly rejected as unnecessary.

**The server stamps `updated_at`, not the client.** A phone with a skewed clock would
otherwise silently lose writes.

### 5.4 Failure handling

Never blocks, never shows an error dialog. Quiet exponential backoff. The footer carries
the state:

```
 TOTAL_ENTRIES: 09          LAST_SYNC: 14:02 IST
```

If the last successful sync is **more than 24 hours old**, that line switches to the alert
tone. Silent failure over a week is how a month of history disappears unnoticed.

### 5.5 Export

A button on the laptop layout downloads all tables as JSON. Insurance against Android
clearing IndexedDB and against Neon being unreachable. Roughly an hour of work; ships in
the first milestone.

### 5.6 Service worker updates

On launch, check for a new version in the background. If found, install and apply on the
**next** launch, with a quiet one-line footer note. Never mid-session — an app that
reloads while you are ticking is worse than one that is a day behind.

---

## 6. Security

The app sits at a public URL with shop data behind it. A PIN implemented casually is worse
than none, because it feels like protection while providing none.

- **Server-side verification only.** Every API route validates the token. A browser-side
  check is bypassed by opening the network tab.
- **Argon2 hash** of the PIN, stored in an environment variable. Never in the repo, never
  in the database in plaintext.
- **Rate limiting is mandatory.** Six digits is one million combinations — brute-forced in
  minutes by an unthrottled script. Five failed attempts trigger a 1-minute lockout;
  each subsequent failure doubles it (1, 2, 4, 8 … capped at 1 hour). The counter is keyed
  by IP and resets on a successful unlock. Enforced server-side, since a client-side
  counter is bypassed by calling the API directly. This is the most important requirement
  in this section and it has a dedicated test.
- **Signed, HTTP-only, Secure cookie**, one-year expiry. HTTP-only blocks script access;
  Secure prevents transmission over plain HTTP.
- **Offline**, the app trusts the cookie it holds. Sync re-validates when the network
  returns.
- **`noindex`** on both environments.

**Stated limitation.** This protects against strangers on the internet, which is the real
threat. It does *not* protect against someone holding the unlocked phone — the app will
already be signed in, like an email client. That is the correct trade for a tool opened at
6am, but it is a trade being made deliberately.

---

## 7. Stack, environments, deployment

### 7.1 Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Local store | Dexie over IndexedDB |
| Server DB | Neon Postgres + Drizzle ORM |
| Service worker | Serwist (`next-pwa` is effectively abandoned) |
| Styling | Tailwind + CSS custom properties for the two grounds |
| Fonts | DM Mono + Syne, self-hosted via `next/font` |
| Host | Vercel |

### 7.2 Environments

| | Production | Preview |
|---|---|---|
| URL | `mylifeos.shiftd.in` | `dev.mylifeos.shiftd.in` |
| Branch | `main` | `dev` |
| Database | Neon `main` branch | Neon `dev` branch |
| App name | `LIFE_OS` | `LIFE_OS · DEV` |
| Icon | accent on black | **visibly different** |

Separate databases are required, not preferred: a shared database means test writes land
in real habit history. The icon difference is equally load-bearing — both are installable
PWAs on the same phone, and without it a week of ticks eventually goes into the wrong
database.

Per-PR deploys get automatic Vercel URLs and share the `dev` database.

`mylifeos.vercel.app` was checked on 2026-07-29 and is **taken** (live app, 307 → `/dashboard`),
as is `mylifeos-app.vercel.app`. Custom subdomains under `shiftd.in` avoid the namespace
entirely.

### 7.3 Environment variables

```
DATABASE_URL      Neon connection string      (per environment)
PIN_HASH          Argon2 hash of the PIN      (per environment)
AUTH_SECRET       cookie signing key          (per environment)
```

None committed. Set in the Vercel dashboard per environment; locally in `.env`, already
gitignored.

### 7.4 Flow

```
build on dev → dev.mylifeos.shiftd.in → install on phone → stopwatch §7 flows
            → merge dev to main → production
```

Branch protection on `main` so nothing skips the preview step.

### 7.5 Build order

Strictly sequential. Each step ships to preview and gets used on a real phone before the
next begins.

1. **Habits grid** — phone layout, rolling 5 days, tap cycle, IndexedDB, Neon sync, PIN, haptics
2. **Export button**
3. **Tasks ledger + capture sheet**
4. **Month view** with per-category totals
5. **Laptop layout** — where the existing desktop mockups land
6. **Palette refinement** — the 18 contrast validations

Finance, Journal, and Content do not appear in the navigation until they exist
(design doc §2: "nothing inert ships").

---

## 8. Deferred

Recorded so they are decisions, not omissions.

- **Settings screen and logout** — explicitly requested for later. Nothing to configure in
  v1; the PIN is set by environment variable and categories are seeded in code.
- **Category management UI** — adding a category is a one-line seed change until it isn't.
- **Habit reordering UI** — canonical order is seeded.
- **"Close the day"** — the eventual single evening flow for journal + finance. The v2 headline.
- **Content planner**, **public build-in-public page** — per design doc §11.
- **Notifications** — revisit only after 30 days prove the app doesn't get opened unprompted.

---

## 9. Divergences from the product design document

Every one of these is deliberate.

| # | Design doc says | This spec does | Why |
|---|---|---|---|
| 1 | §10.1 "triage the list, don't build the feature" | Keeps 12 habits, adds a core/growing split | Owner wants the ambitions visible; the split is one column and one heading, not a system |
| 2 | §6.1 three cell states | Four states — adds explicit `missed` | Blank conflated "didn't do it" with "haven't logged yet"; the two are indistinguishable on a Sunday review |
| 3 | §2 "no accounts, no onboarding" | One PIN screen per device | §2 assumed a local-only app; a public URL with shop data behind it needs server-side protection |
| 4 | §5.3.5 alert tone reserved for overdue | Alert tone extended to one more use: a stale-sync warning (§5.4). Miss marks get their own, quieter treatment | Overdue and stale-sync are both *urgency* — the same semantic the alert tone is reserved for. A habit miss is *history*, not urgency, so it must not share that tone. Miss gets a muted or outlined mark, settled during palette work |
| 5 | §1 "day two logged 3/12" | Actual is 6/12; 2/12 on Jul 29 | Sheet data. The argument holds; the figures were wrong |
| 6 | §6.3 mockup "12 OPEN" | 9 open | Sheet data |
| 7 | §6.4 capture always has a due date | Adds `NONE` | The sheet already contains a task with no due date |
| 8 | Habits screen spends colour only on the accent | Adds quiet category colour | Different screen from Tasks, so no conflict with the priority/project budget |

`Payout` was removed from the habit list entirely on 2026-07-29 — it was entered into the
Habits tab by mistake and is not a habit. This brings July to 12 habits, which reconciles
design doc §1's "7/12".

---

## 10. Verification

### 10.1 Automated, written test-first

| Area | Why it earns a test |
|---|---|
| Date logic | Highest bug density in any habit tracker. Rolling-window membership, "today" at 23:59 and 00:01 IST, backfill landing on the right date, no future cell ever produced |
| Tap cycle | `none → done → missed → none`, on today and past dates, never on a future date |
| Score calculation | `CORE n/6 · +m` and per-category month totals. Subtly easy to get wrong, and it is the number being trusted |
| Sync merge | LWW picks the right row; a dirty row survives a failed push; an offline queue survives app close and reopen |
| PIN rate limiting | Security-critical. Five wrong attempts locks out, lockout doubles, tokens cannot be forged |

Not tested: layout, colour, spacing. Machines judge these badly and the tests would break
on every design tweak.

### 10.2 One end-to-end path

Playwright: unlock → tick three habits → reload → ticks persist → go offline → tick another
→ return online → it reaches the database. One test covering the spine of the app.

### 10.3 Physical checks

1. **Stopwatch the five §7 flows** — real phone, one-handed, standing. Morning tick <10s,
   task close <5s, capture <15s, backfill <10s. Over target means redesign before merging to `main`.
2. **Touch-target audit** — every tick target measured. 44px, no exceptions.
3. **Both grounds in real conditions** — 7am Kerala sunlight, 11pm dark room.
4. **Airplane mode** — network off, tick a full day, close, reopen, network on, confirm
   everything arrives. The most important manual test; it is the promise the architecture rests on.
5. **Two-device check** — tick on phone, confirm on laptop within a minute, then the reverse.
6. **Storage persistence** — confirm the browser granted persistent storage after install.
   If it did not, Android can still clear the data.
7. **The thirty-day test** — thirty consecutive days without opening the spreadsheet for
   habits or tasks. Every time it *is* opened, write down what the app made awkward. That
   list is v2.

### 10.4 Definition of done for v1

Not "the code works":

> The app has been installed on the phone for thirty days, the spreadsheet has not been
> opened for habits or tasks in that time, and the five stopwatch targets are met on real
> hardware.
