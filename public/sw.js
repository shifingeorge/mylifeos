/*
 * Life OS service worker.
 *
 * Hand-written on purpose. The build-tool integrations (next-pwa, Serwist)
 * either are unmaintained or do not support Turbopack, which Next 16 uses by
 * default. This app's offline needs are small enough that a runtime-caching
 * worker with no precache manifest is both simpler and less coupled.
 *
 * Strategy:
 *   /_next/static, icons  cache-first   (content-hashed, immutable)
 *   navigations           network-first, cache fallback
 *   /api/*                network only  (sync must never be served stale)
 *
 * There is no skipWaiting. A new version installs immediately and takes over
 * on the NEXT launch. An app that reloads itself while you are mid-tick is
 * worse than one that is a day behind.
 */

// Bumped to v2 with the move of every entry point from /habits to Home:
// an already-installed client holds a `lifeos-shell-v1` whose only precached
// navigation is /habits, and the offline fallback below now looks for "/".
// Without a new cache name that client would keep answering a cold offline
// launch from the old shell — or from nothing at all — until it happened to
// visit Home while online. The bump drops both v1 caches on activate and
// re-warms the shell at the new URL.
const VERSION = "v2";
const SHELL = `lifeos-shell-${VERSION}`;
const ASSETS = `lifeos-assets-${VERSION}`;
const KEEP = new Set([SHELL, ASSETS]);

self.addEventListener("install", (event) => {
  // Warm the shell so a cold offline launch has something to render.
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(["/"])).catch(() => {
      // First install may be offline or "/" may redirect to /unlock.
      // Not fatal: the fetch handler fills the cache on the first real visit.
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname.endsWith(".woff2")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Sync and auth must always hit the network. A cached sync response would
  // silently report success while nothing left the device.
  if (url.pathname.startsWith("/api/")) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached =
            (await caches.match(request)) ?? (await caches.match("/"));
          if (cached) return cached;
          return new Response("Offline", {
            status: 503,
            headers: { "content-type": "text/plain" },
          });
        }),
    );
  }
});
