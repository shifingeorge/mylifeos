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
   * somebody deliberately excludes it. Every exception below is anchored —
   * an unanchored prefix would make /unlockable and /api/authenticate public.
   *
   *   unlock, api/auth  — the pages that issue the token
   *   api/health        — must answer when auth is what is broken
   *   manifests, sw.js, — fetched by the service worker without cookies;
   *   icon-*.png,         guarding them breaks PWA install and offline
   *   _next, favicon
   */
  matcher: [
    "/((?!unlock$|api/auth$|api/health$|manifest\\.json$|manifest\\.dev\\.json$|sw\\.js$|icon-.*\\.png$|_next/|favicon\\.ico$).*)",
  ],
};
