import { hashSync } from "@node-rs/argon2";

/**
 * The e2e suite must never depend on the developer's real PIN — a suite
 * that only runs for the one person who knows the production secret is a
 * suite nobody runs. So the credentials the test server verifies against
 * are minted here, at test-run time, instead of read from `.env`: nothing
 * in this file touches `.env`, and the user's actual PIN_HASH/AUTH_SECRET
 * on disk are never read or written.
 *
 * Hashed with the same call shape `scripts/hash-pin.mjs` uses — no
 * explicit options, so @node-rs/argon2's own defaults — so the test PIN is
 * hashed exactly the way a real one would be for local dev. `hashSync`
 * rather than the async `hash` because this needs to run to completion
 * before `playwright.config.ts` finishes building `webServer.env` (see
 * below); computed once, at module load, so both consumers of this module
 * see the identical hash rather than two different salted ones.
 *
 * The hash is never committed — it's generated fresh on every run, not
 * baked into the repo, even as a throwaway value.
 */
const pin = process.env.E2E_PIN ?? "123456";

export const testCredentials = {
  PIN_HASH: hashSync(pin),
  // Fixed and obviously-throwaway: only ever signs/verifies the session
  // cookie for the lifetime of one test run, never a real secret.
  AUTH_SECRET: "e2e-test-only-throwaway-auth-secret-not-real",
  // `.env`'s DATABASE_URL is a real, shared Neon instance — SyncRunner
  // fires a sync on every guarded page's first mount (see
  // `startSyncLoop`'s `void run()`), which POSTs straight to `/api/sync`
  // and, from there, to whatever DATABASE_URL the server has. Left
  // pointing at the real one, every captured test task gets pushed to
  // that shared database, and a later run's fresh browser pulls it back
  // down on its own first sync — which is exactly what produced a
  // duplicate "BUY FILTERS" row and a strict-mode locator failure while
  // building this fix. Pointed at a closed local port instead: the fetch
  // fails fast (connection refused, not a slow DNS timeout), `sync()`
  // throws, and `startSyncLoop`'s catch just backs off — already how the
  // app tolerates being offline, so this exercises a real, already-handled
  // path rather than a new failure mode. The task ledger itself never
  // notices, because captured tasks live in IndexedDB regardless of
  // whether sync succeeds — proving that is the whole point of this suite.
  DATABASE_URL: "postgres://e2e:e2e@127.0.0.1:1/e2e_do_not_use",
};

/**
 * `webServer.env` values pass through @next/env's `expand()` (see
 * node_modules/@next/env/dist/index.js) even when the key is already set in
 * process.env before the server starts — for every key that ALSO appears in
 * `.env`, `expand()` re-runs the *current* process.env value through its
 * `$VAR`-style interpolator before writing it back to process.env. An
 * argon2 hash is full of unescaped `$` (`$argon2id$v=19$...`), so without
 * this it gets silently mangled into garbage the moment `next dev` boots —
 * confirmed by hand: passing the raw hash through `webServer.env` made
 * `/api/health` report "PIN_HASH is not an argon2id hash", while the
 * backslash-escaped form below verifies correctly. This is exactly the trap
 * `.env.example` already documents for `PIN_HASH` — the fix is the same
 * `\$` escaping that file uses, applied here instead of by hand.
 */
function escapeForDotenv(value: string): string {
  return value.replace(/\$/g, "\\$");
}

export const webServerEnv = {
  PIN_HASH: escapeForDotenv(testCredentials.PIN_HASH),
  AUTH_SECRET: escapeForDotenv(testCredentials.AUTH_SECRET),
  DATABASE_URL: escapeForDotenv(testCredentials.DATABASE_URL),
};

/**
 * Playwright's `globalSetup` hook (wired in playwright.config.ts). Mutates
 * this process's own `process.env` so anything else in the test-runner
 * process that reads PIN_HASH/AUTH_SECRET directly sees the same throwaway
 * values as the dev server does.
 *
 * This is NOT how those values reach the dev server, though — the
 * webServer plugin's `setup()` (which spawns the `next dev` process) runs
 * *before* `globalSetup` tasks in Playwright's own task ordering
 * (verified against `node_modules/playwright/lib/runner/index.js`:
 * `createGlobalSetupTasks` runs `createPluginSetupTasks` — which starts
 * the webServer — ahead of `config.globalSetups` in the same task array).
 * By the time this function runs, the server has already been spawned
 * with whatever env `playwright.config.ts` gave it. So the config file
 * imports `testCredentials` directly and passes it through
 * `webServer.env`, synchronously, at config-load time — well before any
 * task, including this hook, runs.
 */
export default async function globalSetup() {
  process.env.PIN_HASH = testCredentials.PIN_HASH;
  process.env.AUTH_SECRET = testCredentials.AUTH_SECRET;
  process.env.DATABASE_URL = testCredentials.DATABASE_URL;
}
