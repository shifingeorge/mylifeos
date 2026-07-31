import { describe, it, expect } from "vitest";
import { config } from "@/proxy";

/**
 * The matcher is the whole guard. Reading it and believing it is how a route
 * ships unguarded, so every path is asserted.
 */
const matches = (path: string) =>
  new RegExp(`^${config.matcher[0]}$`).test(path);

describe("proxy matcher", () => {
  const guarded = [
    "/",
    "/habits",
    "/tasks",
    "/money",
    "/journal",
    "/settings",
    "/settings/projects",
    "/api/sync",
    "/api/journal",
    "/some/route/nobody/has/written/yet",
  ];

  for (const path of guarded) {
    it(`guards ${path}`, () => {
      expect(matches(path)).toBe(true);
    });
  }

  const publicPaths = [
    "/unlock",
    "/api/auth",
    "/api/health",
    "/manifest.webmanifest",
    "/sw.js",
    "/icons/icon-192.png",
    "/_next/static/chunk.js",
    "/favicon.ico",
  ];

  for (const path of publicPaths) {
    it(`leaves ${path} public`, () => {
      expect(matches(path)).toBe(false);
    });
  }
});
