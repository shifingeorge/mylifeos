"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only. In development it would
 * serve stale bundles and make every change look like it did not apply.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing costs offline support, not the app. Stay quiet.
    });
  }, []);

  return null;
}
