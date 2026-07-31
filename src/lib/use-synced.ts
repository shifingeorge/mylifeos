import { useEffect, useRef } from "react";

/**
 * Subscribes to the app-wide `lifeos:synced` event fired by `SyncRunner`.
 * The callback lives in a ref so a screen passing a fresh inline arrow
 * function on every render doesn't tear down and re-add the listener each
 * time — only the one mount/unmount pair matters.
 */
export function useSynced(onSynced: () => void): void {
  const callback = useRef(onSynced);
  callback.current = onSynced;

  useEffect(() => {
    const handler = () => callback.current();
    window.addEventListener("lifeos:synced", handler);
    return () => window.removeEventListener("lifeos:synced", handler);
  }, []);
}
