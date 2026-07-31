import { test, expect, type Page } from "@playwright/test";

/**
 * The task-side twin of spine.spec.ts: capture, complete, undo, and — the
 * whole point of an offline-first ledger — capture with no connection at
 * all and have it still be there after a reload.
 *
 * The PIN never comes from the developer's `.env`: tests/e2e/global-setup.ts
 * mints a throwaway PIN and hash for each run and starts the dev server with
 * them, so E2E_PIN (default 123456) is the only PIN this suite ever knows.
 */
const PIN = process.env.E2E_PIN ?? "123456";

async function unlock(page: Page) {
  await page.goto("/unlock");
  for (const digit of PIN) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  // Home. Unlock redirects to the same landing screen a plain visit gets
  // (src/app/unlock/page.tsx) — "**/" would also match /habits, so match the
  // path exactly.
  await page.waitForURL((url) => url.pathname === "/");
}

async function capture(page: Page, title: string) {
  await page.getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task title").fill(title);
  // Scoped to the dialog: SAVE also appears in the project-settings sheet,
  // so an unscoped locator is ambiguous the moment both dialogs exist in the DOM.
  await dialog.getByRole("button", { name: "SAVE" }).click();
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
  // Visible while STILL offline — if the save round-tripped through the
  // network first, this would never appear and the test would fail here,
  // not just later after reconnecting. A reload while still offline would
  // be an even stronger check, but the service worker that would let a
  // reload work offline is deliberately disabled in dev mode
  // (ServiceWorkerRegistrar.tsx only registers it in production, so dev
  // bundles never go stale mid-edit) — the mode this suite's webServer
  // runs. Without it, `page.reload()` while offline fails to load the
  // document at all, for a reason that has nothing to do with whether the
  // task write went to IndexedDB first.
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
