import { defineConfig, devices } from "@playwright/test";
import { webServerEnv } from "./tests/e2e/global-setup";

// A dedicated port, distinct from the developer's own `npm run dev` on
// 3000. `reuseExistingServer: false` below already refuses to attach to
// someone else's server, but a same-port collision is the one way that
// refusal could still be bypassed — nothing stops a developer from running
// `npm run dev` on 3000 in another terminal, and if the test server shared
// that port it would either fail to bind or, worse, silently reuse the
// already-running server that loaded the real `.env`. A different port
// makes that scenario impossible rather than merely unlikely.
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  // The spine test walks one continuous session; parallel workers would
  // fight over the same PIN rate limiter.
  workers: 1,
  // Mints throwaway PIN/auth credentials into process.env for anything in
  // the test-runner process that reads them directly. Getting them to the
  // dev server itself is `webServer.env` below, not this hook — see the
  // comment on `testCredentials` in global-setup.ts for why.
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
  },
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}/unlock`,
    // Must be false: `true` would happily attach to a server someone
    // already has running on this port — including, if the port ever
    // collided with the developer's own dev server, one that loaded the
    // real `.env` and never saw these throwaway credentials at all. A
    // fresh server every run is the only way to be sure the dev server
    // actually verifies against `testCredentials`, not `.env`.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      // Next.js's env-file loader only fills in variables that aren't
      // already in process.env (checked directly against
      // node_modules/next/dist/docs/01-app/02-guides/environment-variables.md's
      // "Environment Variable Load Order": process.env is checked first,
      // before any .env* file, and the lookup stops at the first place a
      // variable is found) — so setting these here means the dev server
      // this suite drives verifies against the throwaway PIN, and never
      // reads the real PIN_HASH/AUTH_SECRET out of `.env` at all.
      //
      // `webServerEnv`, not `testCredentials`, on purpose — see
      // `escapeForDotenv` in global-setup.ts for why the raw hash can't be
      // passed through here directly.
      ...webServerEnv,
    },
  },
});
