import { NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { COOKIE_NAME, signToken } from "@/lib/auth/pin";
import {
  recordFailure,
  isLockedOut,
  lockoutRemainingMs,
  type AttemptState,
} from "@/lib/auth/rate-limit";

// argon2 is a native module, so this route must not run on the Edge runtime.
export const runtime = "nodejs";

/**
 * In-memory, therefore per-instance: a serverless cold start resets it.
 * Accepted for a single-user app — an attacker still cannot exceed five
 * attempts against a warm instance, and the doubling lockout throttles any
 * sustained attempt. Moving this to a Neon table is a contained change if
 * it ever matters.
 */
const attempts = new Map<string, AttemptState>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const now = Date.now();

  if (isLockedOut(attempts.get(ip), now)) {
    return NextResponse.json(
      { error: "locked", retryInMs: lockoutRemainingMs(attempts.get(ip), now) },
      { status: 429 },
    );
  }

  const hash = process.env.PIN_HASH;
  if (!hash) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { pin?: unknown };
  const pin = body.pin;

  const ok =
    typeof pin === "string" &&
    pin.length > 0 &&
    (await verify(hash, pin).catch(() => false));

  if (!ok) {
    attempts.set(ip, recordFailure(attempts.get(ip), now));
    // Deliberately does not say whether the PIN was wrong or malformed.
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  attempts.delete(ip);

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(COOKIE_NAME, await signToken(), {
    httpOnly: true, // a script on the page cannot read it
    secure: process.env.NODE_ENV === "production", // never over plain HTTP
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

/**
 * Locking clears the token. Local data is deliberately left alone — the whole
 * point of the ledger is that it survives, and the next unlock needs no
 * network.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  // A cookie's identity is name + domain + path, so maxAge/path alone would
  // delete it regardless — but mirroring POST's full attribute set means
  // nobody has to re-derive that from the cookie spec to trust that this
  // actually clears the same cookie POST set, not a same-named lookalike.
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
