import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Client = ReturnType<typeof drizzle<typeof schema>>;

let cached: Client | undefined;

/**
 * Resolved lazily rather than at module scope: a build without DATABASE_URL
 * set must still succeed, and only a request that actually needs the
 * database should fail without it.
 */
export function dbServer(): Client {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  cached = drizzle(neon(url), { schema });
  return cached;
}
