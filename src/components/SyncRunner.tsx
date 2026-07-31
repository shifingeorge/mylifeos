"use client";

import { useEffect } from "react";
import { startSyncLoop } from "@/lib/sync/engine";

/**
 * Runs the sync loop once for the whole app, from the guarded layout rather
 * than any one screen. Home is the landing screen but isn't the only one, and
 * screens mount and unmount as the user taps around the tab bar — if each
 * screen started its own loop, a user who never opens `/habits` would never
 * sync, and two screens mounted together would fire duplicate requests
 * against the same dirty rows. One loop here, screens just listen.
 */
export function SyncRunner() {
  useEffect(() => {
    return startSyncLoop(() => {
      window.dispatchEvent(new CustomEvent("lifeos:synced"));
    });
  }, []);

  return null;
}
