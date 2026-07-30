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
  // `/api/auth` is absent deliberately — it is the route that issues the
  // token. The narrow matcher also keeps the guard off _next/static and
  // public/, which would otherwise be redirected and break the app's own CSS.
  matcher: ["/habits/:path*", "/api/sync/:path*"],
};
