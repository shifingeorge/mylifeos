import { test, expect, type Page } from "@playwright/test";

/**
 * One test covering the spine of the app: unlock, tick, persist, work
 * offline, come back.
 *
 * The PIN never comes from the developer's `.env`: tests/e2e/global-setup.ts
 * mints a throwaway PIN and hash for each run and starts the dev server with
 * them, so E2E_PIN (default 123456) is the only PIN this suite ever knows.
 */
const PIN = process.env.E2E_PIN ?? "123456";

/** Unlock lands on Home; the grid is one tab away. */
const atHome = (url: URL) => url.pathname === "/";

/** The rolling window is anchored to today, so dates must be computed. */
function istDate(offsetDays = 0): string {
  const ms = Date.now() + 330 * 60_000 - offsetDays * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

const cell = (page: Page, habit: string, date: string) =>
  page.getByRole("button", { name: new RegExp(`^${habit} ${date} `) });

async function unlock(page: Page) {
  await page.goto("/unlock");
  for (const digit of PIN) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.waitForURL(atHome);
}

/** Unlock, then walk to the grid the way the tab bar does. */
async function unlockToGrid(page: Page) {
  await unlock(page);
  // exact: Home's HABITS card is also a link to /habits, and its accessible
  // name starts with HABITS too.
  await page.getByRole("link", { name: "HABITS", exact: true }).click();
  await page.waitForURL("**/habits");
}

test("guards the app behind the PIN", async ({ page }) => {
  await page.goto("/habits");
  await expect(page).toHaveURL(/\/unlock/);
});

test("rejects a wrong PIN without unlocking", async ({ page }) => {
  await page.goto("/unlock");
  for (const digit of "000000") {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await expect(page.getByRole("status")).toHaveText(/INVALID|LOCKED/);
  await expect(page).toHaveURL(/\/unlock/);
});

test("unlock, tick, persist, go offline, tick, come back online", async ({
  page,
  context,
}) => {
  const today = istDate(0);
  const yesterday = istDate(1);

  await unlockToGrid(page);

  // Tick today.
  const read = cell(page, "READ BOOK", today);
  await expect(read).toHaveText("[ ]");
  await read.click();
  await expect(read).toHaveText("■");

  // Backfill yesterday — the path a "slept at 11" entry actually takes.
  const sleep = cell(page, "SLEEP AT 11", yesterday);
  await sleep.click();
  await expect(sleep).toHaveText("■");

  // The score counts core only, and counts growing separately.
  await expect(page.getByText(/CORE \d+\/6 · \+\d+/)).toBeVisible();

  // Survives a reload: the write went to IndexedDB, not just React state.
  await page.reload();
  await expect(cell(page, "READ BOOK", today)).toHaveText("■");
  await expect(cell(page, "SLEEP AT 11", yesterday)).toHaveText("■");

  // Offline: a tick must never wait on the network.
  await context.setOffline(true);
  const meditate = cell(page, "MEDITATION", today);
  await meditate.click();
  await expect(meditate).toHaveText("■");

  // And the full cycle still works with no connection.
  await meditate.click();
  await expect(meditate).toHaveText("✕");
  await meditate.click();
  await expect(meditate).toHaveText("[ ]");

  await context.setOffline(false);
  await page.reload();
  await expect(cell(page, "READ BOOK", today)).toHaveText("■");
});

test("never renders a future column", async ({ page }) => {
  await unlockToGrid(page);
  const tomorrow = istDate(-1);
  await expect(page.getByRole("button", { name: new RegExp(tomorrow) }))
    .toHaveCount(0);
});
