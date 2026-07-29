import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "lifeos_token";

/** Read lazily so a build without AUTH_SECRET set still succeeds. */
function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signToken(): Promise<string> {
  return new SignJWT({ sub: "shifin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret());
}

/**
 * Verified with `jose` rather than a native library so this also runs in the
 * Edge runtime, where `proxy.ts` guards every request.
 */
export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
