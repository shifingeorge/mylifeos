# Seed data — extracted from `My Life OS.xlsx`

Extracted 2026-07-29. The spreadsheet itself is gitignored (never pushed). This file is
the durable record of everything the app needs from it. Once this exists, the `.xlsx`
has no further role in the repo.

Source workbook: 6 tabs — Habits, Task, Finance, WHD, Content to post, Settings.
Only **Habits** and **Task** are in v1 scope (design doc §3). The rest is recorded
below for v2 reference only.

---

## Habits

### July 2026 order — 13 habits

1. Wakeup at 6
2. Meditation
3. Excersice (walk)   ← sic, misspelled in sheet
4. Read Book
5. Bird Food
6. Post Content
7. Sales Tracker
8. Customer Checked
9. Payout
10. Inventory stock
11. Video
12. Finance Log
13. Sleep at 11

### August 2026 order — 11 habits

Meditation · Excersice (walk) · Wakeup at 6 · Read Book · Sleep at 11 · Post Content ·
Sales Tracker · Customer Checked · Inventory stock · Bird Food · Video

**Dropped in August:** Payout, Finance Log.

> This is exactly the problem design doc §6.2 names: two months, two orders, two
> counts, month-over-month comparison meaningless. The app fixes it with one
> canonical order. Open question §10.4 — order still undecided.

### Actual logged data (July, the only month with entries)

| Habit | Jul 27 | Jul 28 | Jul 29 | Jul 30 | Jul 31 |
|---|---|---|---|---|---|
| Wakeup at 6 | · | · | · | · | · |
| Meditation | ■ | ■ | · | · | · |
| Excersice (walk) | ■ | · | ■ | · | · |
| Read Book | ■ | ■ | ■ | · | · |
| Bird Food | · | ■ | · | · | · |
| Post Content | · | · | · | · | · |
| Sales Tracker | ■ | ■ | · | · | · |
| Customer Checked | ■ | ■ | · | · | · |
| Payout | (blank) | (blank) | · | · | · |
| Inventory stock | ■ | ■ | · | · | · |
| Video | · | · | · | · | · |
| Finance Log | ■ | · | · | · | · |
| Sleep at 11 | · | · | · | · | · |
| **Day score** | **7/13** | **6/13** | **2/13** | 0 | 0 |

All of August 2026 is `False` — untouched.

**Note:** design doc §1 says "7/12 then 3/12". Sheet shows 7/13 then 6/13. The shape of
the argument holds (capture decays fast); the exact figures in the doc are off.

---

## Tasks

Columns: `Task · Done · Priority · project · Due Date`. 20 rows, 11 done, **9 open**.

### Open (9)

| Task | Priority | Project | Due |
|---|---|---|---|
| Menu pricing fix | P1 | Smashed | 2026-07-28 |
| Zomato Sales Dipped reason | P1 | Smashed | 2026-07-20 |
| Content Gen Svg My Personal | P2 | Personal Brand | 2026-07-23 |
| customer complaint | P2 | Smashed | 2026-07-24 |
| Upstox Account Closure | P2 | Mine | 2026-07-28 |
| Call Ansab Ikka | P3 | Home | 2026-07-28 |
| Football day sales | P4 | Smashed | 2026-07-26 |
| Dress Arrange | P4 | Mine | 2026-07-27 |
| Sort Obsidian Vault | P4 | Mine | *(none)* |

**Note:** design doc §6.3 mockup shows `12 OPEN`. Sheet shows 9. Also: due date is
nullable (`Sort Obsidian Vault`) — the data model must allow a task with no due date,
which the doc's capture screen (§6.4, TODAY preselected) does not currently account for.

### Done (11)

Porter Account setup (P1/Smashed) · Restock Diet Pepsi (P1/Smashed) · Ammachi medicine
(P1/Home) · Search Black Pen (P2/Misc) · Collect 9k from shop (P2/Smashed) · Payout Data
to alfie chettan (P2/Smashed) · Pandhal Cake shop (P2/Smashed) · Attedance (P2/Smashed) ·
Ration Shop (P2/Home) · Spec Find (P3/Mine)

---

## Enumerations (from Settings tab)

**Priority** — `P1` `P2` `P3` `P4`

**Project** — `Home` `Smashed` `Personal Brand` `Misc` `Mine`
(Settings tab order. Design doc §5.3 lists the same five in a different order.)

**Bank** — `Primary Bank` `Secondary Bank`
**Finance type** — `Income` `Expense` `Transfer`
**Finance category** — `Work` `Petrol` `Subscription`
**Finance sub-category** — `Smashed` `Gbfc` `Bike` `Claude`

---

## Out of v1 scope — recorded for v2 only

**Finance** — pre-filled date rows Jul 1 → Aug 31, 3 entries total.
Columns: `Date · Type · Amount · Account (OUT) · Account (IN) · Category · Sub Category · Description`.

**WHD** — date rows Jul 27 → Aug 31. Columns: `Date · Personal · Work`. One entry (Jul 27).

**Content to post** — two stacked tables:
- Pipeline: `PN · Post Angle · The Work I did · IG · TH · LI · Posted Date` — 6 rows, 2 posted.
- Drafts: `PN · Title · Socials · Draft` — LI and TH variants per post, 3 posts drafted.
