import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { configReport } from "@/lib/config";
import { dbServer } from "@/lib/db/client";

export const runtime = "nodejs";
// Env vars are read per request so a Vercel redeploy is visible immediately.
export const dynamic = "force-dynamic";

/**
 * A database error's message can carry the connection string, the host, or
 * the password Neon was handed — and this endpoint is unauthenticated. So
 * nothing thrown is ever echoed: the failure is reduced to a Postgres error
 * code, itself scrubbed to alphanumerics and truncated, plus a fixed phrase.
 * The code is enough to tell "the migrations have not run" apart from "the
 * database is unreachable", which is the only distinction this has to make.
 */
function classify(err: unknown): string {
  const raw =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const code = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 16);

  // 42P01 undefined_table, 42703 undefined_column. Both mean the same thing
  // in practice here: the code deployed ahead of `drizzle-kit migrate`.
  if (code === "42P01" || code === "42703") {
    return "schema behind code — run drizzle-kit migrate";
  }
  return code ? `query failed (${code})` : "query failed";
}

/**
 * Touches the two things a half-applied migration breaks first: the `tasks`
 * table (added whole in the tasks migration) and `categories.updated_at`
 * (added to an existing table). Both are read-only and cost nothing.
 *
 * Without this the endpoint reported `ok: true` on an instance whose every
 * `/api/sync` was 500ing — `startSyncLoop` swallows that failure by design,
 * so a schema skew was invisible from both ends at once.
 */
async function schemaProbe(): Promise<string> {
  try {
    const db = dbServer();
    await db.execute(sql`select count(*) from tasks`);
    await db.execute(sql`select updated_at from categories limit 1`);
    return "ok";
  } catch (err) {
    return classify(err);
  }
}

/**
 * Unauthenticated on purpose: this has to answer when auth itself is
 * misconfigured. `configReport` guarantees no secret value is in the body —
 * only variable names, booleans, and the database host — and `classify`
 * guarantees the same for anything the schema probe throws.
 *
 * Not covered by the proxy matcher, so it stays reachable behind a redirect
 * loop or a bad AUTH_SECRET.
 */
export async function GET() {
  const report = configReport(process.env);
  // No point probing without a connection string; `missing` already says so.
  const schema = report.missing.includes("DATABASE_URL")
    ? "not checked"
    : await schemaProbe();

  // `ok` covers the whole check, not just the env vars — a body saying
  // `ok: true` next to a 503 is the kind of thing you read past at 1am.
  const ok = report.ok && schema === "ok";

  return NextResponse.json(
    { ...report, ok, schema },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
