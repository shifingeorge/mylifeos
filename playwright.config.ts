import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // The spine test walks one continuous session; parallel workers would
  // fight over the same PIN rate limiter.
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Pixel 7"],
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/unlock",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
