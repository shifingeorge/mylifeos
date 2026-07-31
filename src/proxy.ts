import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth/pin";

/**
 * Next 16's rename of `middleware.ts`.
 *
 * Every guarded request is checked here, server-side. A check that only ran
 * in the browser would be bypassed by calling the API directly.
 */
export async function proxy(req: NextRequest) {
  if (await verifyToken(req.cookies.get(COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/unlock", req.url));
}

export const config = {
  /**
   * A denylist, not an allowlist: a route added tomorrow is guarded unless
   * somebody deliberately excludes it. Every exception below has a reason.
   *
   *   unlock, api/auth  — the pages that issue the token
   *   api/health        — must answer when auth is what is broken
   *   manifest, sw.js,  — static assets the service worker fetches without
   *   icons, _next,       cookies; guarding them breaks install and offline
   *   favicon
   */
  matcher: [
    "/((?!unlock|api/auth|api/health|manifest|sw\\.js|icons/|_next/|favicon\\.ico).*)",
  ],
};
