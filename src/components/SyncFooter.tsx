"use client";

const STALE_MS = 24 * 60 * 60 * 1000;

/**
 * The only visible sync signal. Silent failure over a week is how a month of
 * history disappears without anyone noticing, so a stale sync switches to the
 * alert tone — the same tone overdue tasks use, because both are urgency.
 */
export function SyncFooter({ lastSync }: { lastSync?: string }) {
  const stale =
    !lastSync || Date.now() - new Date(lastSync).getTime() > STALE_MS;

  const label = lastSync
    ? new Date(lastSync).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "NEVER";

  return (
    <footer
      className="mt-4 flex justify-end px-3 py-2 text-[10px] tracking-[0.1em]"
      style={{
        borderTop: "1px solid var(--rule)",
        color: stale ? "var(--alert)" : "var(--type-muted)",
      }}
    >
      LAST_SYNC: {label} IST
    </footer>
  );
}
