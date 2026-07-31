import { NextResponse } from "next/server";
import { configReport } from "@/lib/config";

export const runtime = "nodejs";
// Env vars are read per request so a Vercel redeploy is visible immediately.
export const dynamic = "force-dynamic";

/**
 * Unauthenticated on purpose: this has to answer when auth itself is
 * misconfigured. `configReport` guarantees no secret value is in the body —
 * only variable names, booleans, and the database host.
 *
 * Not covered by the proxy matcher, so it stays reachable behind a redirect
 * loop or a bad AUTH_SECRET.
 */
export async function GET() {
  const report = configReport(process.env);
  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
