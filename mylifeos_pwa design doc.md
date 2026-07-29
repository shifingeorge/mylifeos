# Life OS — PWA Design Document

**Stage:** Ideation / design. No technical architecture in this document.
**Date:** 2026-07-29
**Owner:** Shifin

---

## 1. Context

The Life OS currently lives in a spreadsheet (`My Life OS.xlsx`, mirrored to Google Sheets) with six tabs: Habits, Task, Finance, WHD, Content to post, Settings. It was built 2026-07-26 and it works — as a data model. It fails as a *daily instrument*, for one reason: it is unusable on a phone, and most of the day happens away from a laptop — at the shop, at the counter, on the bike.

The evidence is in the sheet itself. Day one logged 7/12 habits. Day two logged 3/12. Twelve tasks sit open, one P1 overdue by eight days. The data isn't being captured, because capturing it requires sitting down at a machine.

**The app exists to fix capture, not to replace the spreadsheet wholesale.** Anything in the sheet that is genuinely an at-rest, end-of-day, sit-down activity stays in the sheet for now.

A stated risk, recorded honestly: building a Life OS app is a near-perfect avoidance vehicle — infinite scope, feels productive, produces nothing. This document is deliberately constrained to counter that. The scope boundary in §3 is the point of the document, not an afterthought.

---

## 2. Decisions locked

| Decision | Answer |
|---|---|
| Audience | Just Shifin. No accounts, no onboarding, no settings screens, no pricing. |
| Core job | Capture things that happen **while in motion during the day**. |
| v1 scope | **Habits + Tasks.** Nothing else. |
| "Website" | Same app, two layouts — installed PWA on phone, wide layout at the same URL on laptop. |
| Navigation | Two tabs. The bar grows when modules land; nothing inert ships. |
| Colour | Priority **and** project both carry colour, disambiguated by shape (§5.3). |
| Ground | Both — paper (light) and terminal (dark), following OS preference. |

---

## 3. Scope boundary

**In v1:** Habit grid, task ledger, month view, task capture, backfill.

**Explicitly out, with reasons:**

- **Finance** — the sheet's Finance tab is a stack of pre-filled date rows. That's a sit-down-and-fill-the-day structure, not a log-at-the-pump one. At-rest activity.
- **WHD (journal)** — evening reflection, two prose fields. Needs a keyboard and a settled mind.
- **Content pipeline + drafts** — writing 200 words of LinkedIn copy is a desk activity. A draft editor is a week of design for something never used one-handed.
- **Notifications / reminders** — a nag you wrote for yourself is a nag you dismiss. Revisit only after 30 days of real use prove the app doesn't get opened unprompted.
- **Streak counters, badges, scores beyond the day total** — gamification on a personal tool becomes guilt UI. The 5-day strip is already the streak.
- **Search** — twelve habits and twelve tasks. Search is decoration at this size.

**The v1 test:** thirty consecutive days where the spreadsheet is never opened for habits or tasks. If it is opened even once, the design failed and the reason gets written down.

---

## 4. Information architecture

```
LIFE OS (PWA)
│
├── HABITS  (default tab, opens here always)
│     └── MONTH  (full grid, pushed from Habits)
│
└── TASKS
      └── CAPTURE  (sheet over Tasks, from FAB)
```

Two tabs. Habits is the default landing surface — it is the more frequent, more time-sensitive job. There is no home screen, no dashboard, no summary view. The app opens directly into the thing you came to do.

**Why two tabs and not one scrolling screen:** habits and tasks are different interaction objects. A habit row is a *grid* — multiple day-columns, wide, ticked repeatedly. A task row is a *list item with metadata hanging off it*. Stacking them means scrolling past one dense pattern to reach a different dense pattern, and neither gets full width. Separate tabs let each own the screen.

---

## 5. Visual system

The direction is **ledger** — receipt, dot-matrix, terminal register. This is not an arbitrary aesthetic choice: `shiftd.growth`'s existing brand system is already DM Mono body text, `#0a0a0a` / `#f5f2ec`, one acid accent. The ledger look *is* the brand, applied to a tool.

### 5.1 Grounds

Two full palettes, switched by OS preference.

| Role | Paper (light) | Terminal (dark) |
|---|---|---|
| Ground | `#f5f2ec` off-white | `#0a0a0a` near-black |
| Type | `#0a0a0a` | `#f5f2ec` |
| Muted type | ~`#6b6b6b` | ~`#6b6b6b` |
| Hairline rules | ~`#d8d3c9` | ~`#1e1e1e` |
| Accent | `#a8d800` (dimmed for light ground) | `#c8ff00` |

The accent is used for exactly one thing per screen — today's column marker on Habits, the active tab in the bar. It is not decoration.

### 5.2 Type

- **DM Mono** — everything structural. Task names, habit names, dates, tags, numbers, column heads. Monospace is what makes date and count columns align without effort, and it is what makes the ledger read as a ledger.
- **Syne** — the date header and day score only. One display moment per screen, nothing more.
- **Instrument Serif** — not used. It belongs to the brand's editorial voice, not to a capture tool.

Task and habit names set in uppercase mono. It suits the register metaphor and it removes the visual noise of mixed-case entries typed in a hurry.

### 5.3 Colour and the shape rule

Both priority and project carry colour. This is a deliberate trade: nine hues costs visual calm, and buys pre-attentive scanning on both axes — you see P1 before you read it.

**The rule that makes nine hues survivable — non-negotiable:**

> **Priority is a filled solid block. Project is an outlined tag.**

Two different *shapes*, not just two different hues. Without this, nine colours sit at equal visual weight and nothing wins the eye — which is the specific failure in the current ledger mockup. With it, priority dominates, project recedes to a categorising label, and the hierarchy holds even when six colours are on screen at once.

**Priority roles** (fixed, four): P1 alert red · P2 amber · P3 blue · P4 muted violet.
**Project roles** (five): Smashed · Personal Brand · Mine · Home · Misc.

**Palette construction method — this is the real work of the design:**

1. Fix the nine hues by role first, as hue angles only. Do not pick hex values yet.
2. Hold chroma constant across all four priority hues so no one priority looks louder than its rank warrants.
3. Derive lightness *from the ground*, not absolutely. On paper, priority blocks land dark (~45–50% L) with off-white labels. On terminal, the same hues lift (~65–70% L) with near-black labels.
4. Validate every combination in both grounds: label-on-block ≥ 4.5:1, block-against-ground ≥ 3:1. Project tags are outlined so they need only ≥ 3:1 on the border.
5. Overdue markers are the one place colour signals *urgency* rather than *category*. Reserve the alert tone and never spend it on anything else.

If step 4 fails for any pair in either ground, the hue moves — do not lower the contrast target.

### 5.4 Density and touch

- **44px minimum** on every tick target. Both current mockups fail this badly; it is the single most important correction.
- Habit cell: 44 × 44, the full cell is the target, not the glyph inside it.
- Task row: two lines, ~72px, with the tick target occupying the full-height left edge.
- Ten task rows visible on a standard phone screen. The current ledger mockup fits six at four rows each — compress to two.

---

## 6. Screens

### 6.1 Habits (default)

Structure adapted from the first mockup — the correct one — with the corrections below.

```
LIFE_OS                                    TUE 28 JUL   3/12
─────────────────────────────────────────────────────────────
                          F    S    S    M    T
                         24   25   26   27   28
  WAKEUP AT 6             ·    ·    ·    ·   [ ]
  MEDITATION              ·    ·    ·    ■   [■]
  EXERCISE (WALK)         ·    ·    ·    ■   [ ]
  READ BOOK               ·    ·    ·    ■   [■]
  BIRD FOOD               ·    ·    ·    ·   [■]
  POST CONTENT            ·    ·    ·    ·   [ ]
  ...
─────────────────────────────────────────────────────────────
  VIEW MONTH →
```

**Rolling 5-day window, today always the rightmost column.** This is the key structural decision. Reading left-to-right runs the chain *into* today, which is how a streak actually feels. It also removes an entire state — there are no future cells, so nothing to grey out or explain.

**Cell states — three, no more:**
- Filled block `■` — done
- Solid outline `[ ]` — today, untouched. An invitation.
- Hairline dot `·` — past, missed. Present but quiet.

The distinction between *today untouched* and *past missed* matters. Making a miss visible is honest and it is the point of a chain. Making it loud turns the app into something you avoid opening. Hairline, not red.

**Past columns are tappable.** Backfill is not an edge case — the sheet already shows two days logged out of the last three. If backfill is hard, the app stops being trusted the first time a day is missed.

Day score `3/12` in the header, set in Syne. It is the only number on the screen and it is the one that stings usefully.

**Removed from the mockup:** the search icon (decoration at twelve items), the red row outline (reads as error, not selection), and the "AUGUST 2026 — your monthly grid is ready, track consistency to build lasting routines" card. That last one is marketing copy inside a personal tool. It becomes the plain `VIEW MONTH →` line.

### 6.2 Month

The full sheet view: habits × 31 days. Horizontally scrollable on phone, fits natively on the laptop layout. Cells tappable for backfill.

This screen is what makes the app *feel* like it replaced the spreadsheet rather than partially covering it. It's also the Sunday Life Review surface.

One canonical habit order, applied to every month. The current sheet has July and August in different orders with different habit counts, which makes month-over-month comparison meaningless. The app fixes this by construction.

### 6.3 Tasks

Structure adapted from the second mockup — the correct one — compressed and with an explicit tick target.

```
LIFE_OS · TASK_LEDGER                              12 OPEN
  (ALL) (SMASHED) (MINE) (HOME) (PERSONAL_BRAND) (MISC)
─────────────────────────────────────────────────────────────
 [ ]  MENU PRICING FIX
      ■P1  (SMASHED)                          TUE 28 JUL
 [ ]  ZOMATO SALES DIPPED REASON
      ■P1  (SMASHED)                    MON 20 JUL   +8d
 [ ]  CONTENT GEN SVG BRAND THEME
      ■P2  (PERSONAL_BRAND)                   THU 23 JUL
 [ ]  UPSTOX ACCOUNT CLOSURE
      ■P2  (MINE)                             TUE 28 JUL
─────────────────────────────────────────────────────────────
                                                     ( + )
```

- Sorted priority first, then due date.
- Filled priority block, outlined project tag — the shape rule doing its job.
- Overdue expressed as `+8d` in the alert tone, right-aligned. The row itself does not change colour; colour is already fully spent on priority and project.
- Project filter tags across the top, horizontally scrollable, single-select with `(ALL)` default.
- Completing a task collapses the row with a 5-second undo. No confirmation dialogs anywhere in the app — undo instead.

### 6.4 Capture

A sheet over Tasks, opened by the FAB.

```
  NEW TASK
  ┌───────────────────────────────────────────┐
  │ ▌                                         │
  └───────────────────────────────────────────┘
  PRIORITY   ■P1   ■P2   ■P3   ■P4
  PROJECT    (SMASHED) (MINE) (HOME) (P_BRAND) (MISC)
  DUE        TODAY   TOMORROW   PICK →
                                      [ SAVE ]
```

Name field auto-focused, keyboard up immediately. P2 preselected, last-used project preselected, TODAY preselected. Everything is already a valid task the moment you finish typing the name.

**Target: name + one tap to save.** Adjustments are optional, not steps.

---

## 7. Core flows

| Flow | Target | Path |
|---|---|---|
| Morning tick | < 10s | Open → lands on Habits, today's column → tick 3–4 cells → close |
| Close a task in the shop | < 5s | Open → Tasks tab → tick → done |
| Capture a task | < 15s | FAB → type name → SAVE |
| Backfill a missed day | < 10s | Habits → tap past column cells directly |
| Sunday review | — | Habits → VIEW MONTH → read the grid |

These are stopwatch targets, tested one-handed on a real phone. They are the acceptance criteria for the design, not aspirations.

---

## 8. Interaction principles

1. **Offline-first, always.** Every tick writes locally and instantly. There is never a spinner on a tick — the shop has patchy signal and a tick that waits is a tick that doesn't happen.
2. **Optimistic state.** The UI changes before anything syncs. Sync failure is a quiet retry, never a blocking error.
3. **Haptic on every tick.** The tactile confirmation is a large part of what will make this feel faster than the spreadsheet.
4. **Nothing animates longer than 150ms** on a capture action. Transitions between tabs may be longer; ticks may not.
5. **No confirmation dialogs.** Undo toasts instead, 5 seconds.
6. **No empty-state illustrations, no encouragement copy, no coaching text.** Personal tool. You know what it does.
7. **Thumb zone.** Tick targets and the FAB live in the lower two-thirds. Headers are for reading, not tapping.

---

## 9. Laptop layout

Same URL, same app, wider layout. Used for review and bulk work, not capture.

- **Habits** — the full month grid natively, no horizontal scroll. This is the spreadsheet view, restored.
- **Tasks** — same single-column ledger, wider rows, more visible at once. Keyboard shortcuts for tick and capture.
- The two-tab bar moves from bottom to a left rail or a top strip.

No separate marketing site, no public page. One app, two layouts.

---

## 10. Open design questions

Recorded, not resolved. None of these block v1.

1. **Twelve habits is probably too many.** Day one hit 7/12, day two 3/12. The app is the natural moment to triage down to five or six that are genuinely daily. The design question: does the app support a core/optional split with a visual hierarchy, or is this a life decision made once outside the app? **Recommendation: triage the list, don't build the feature.**
2. **Does the walk get special treatment?** It is the committed 30-day goal and it's currently one of twelve equal rows. A tracked-goal state would give it weight — at the cost of a special case in the design.
3. **How visible should misses be?** The hairline dot is the current answer. It may prove too quiet to matter, or too loud to face. Adjustable after two weeks of use.
4. **Canonical habit order** needs deciding once. Suggested grouping: body first, then business, then output.

---

## 11. Deliberately deferred

- **"Close the day"** — the eventual home for WHD and Finance. Not two more tabs: **one evening flow.** Personal note, work note, the day's expenses, done. One ritual, one screen sequence. This is the v2 headline.
- **Content planner** — pipeline and drafts. Laptop-layout-first when it comes.
- **Public build-in-public page** — live streaks and stats at a public URL. On-brand, genuinely interesting, and entirely a distraction until v1 has survived thirty days.

---

## 12. Verification

This is a design document, so verification is design validation, not tests.

1. **Stopwatch the flows.** Build clickable prototypes of Habits and Tasks. Time the five flows in §7 on a real phone, one-handed, standing up. Any flow over target gets redesigned before build.
2. **Contrast-check the full palette.** Every priority block and project tag, in both grounds, against the ratios in §5.3. Nine hues × two grounds = eighteen validations. Do this before any of it is drawn in Figma properly.
3. **Test in the real conditions.** The two grounds exist for two moments: 7am outdoors in Kerala sunlight, and 11pm in a dark room. View the prototype in both, physically. Screen brightness at those extremes will break choices that look fine at a desk.
4. **The thirty-day test.** After build: thirty consecutive days where the spreadsheet is never opened for habits or tasks. The failure mode to watch for is opening the sheet to do something the app made awkward — write down what it was, every time.
5. **The touch-target audit.** Measure every tick target in the prototype. 44px minimum, no exceptions. Both current mockups fail this; it will not fix itself.
