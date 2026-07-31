"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/db/local";
import { lastSyncAt } from "@/lib/sync/engine";
import { AppHeader } from "@/components/AppHeader";

const ENV_LABEL =
  process.env.NEXT_PUBLIC_ENV_LABEL === "dev" ? "LIFE_OS · DEV" : "LIFE_OS";

export default function SettingsPage() {
  const [counts, setCounts] = useState({ projects: 0, tasks: 0, entries: 0 });
  const [synced, setSynced] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      setCounts({
        projects: await db.projects.filter((p) => p.active).count(),
        tasks: await db.tasks.count(),
        entries: await db.habitEntries.count(),
      });
      setSynced(await lastSyncAt());
    })();
  }, []);

  /**
   * Locking only clears the auth cookie (see the DELETE handler in
   * src/app/api/auth/route.ts). It deliberately does not touch Dexie: the
   * ledger surviving a lock — and even surviving offline forever — is the
   * whole point of the app, so nothing here reaches into IndexedDB. The
   * next unlock reads the same local data back with no network involved.
   */
  const lock = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/unlock";
  };

  return (
    <main className="w-full pb-6">
      <AppHeader title="SETTINGS" />

      <Link
        href="/settings/projects"
        className="flex items-center justify-between px-3 py-4 text-[12px] tracking-[0.08em]"
        style={{ borderBottom: "1px solid var(--rule)" }}
      >
        <span>TASK PROJECTS</span>
        <span style={{ color: "var(--type-muted)" }}>{counts.projects} ›</span>
      </Link>

      <p
        className="px-3 pt-6 text-[10px] leading-relaxed tracking-[0.1em]"
        style={{ color: "var(--type-muted)" }}
      >
        {ENV_LABEL}
        <br />
        {counts.entries} TICKS · {counts.tasks} TASKS
        <br />
        SYNCED{" "}
        {synced
          ? new Date(synced).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            })
          : "NEVER"}
      </p>

      <button
        type="button"
        onClick={lock}
        className="mx-3 mt-6 h-11 w-[calc(100%-1.5rem)] text-[12px] tracking-[0.14em]"
        style={{ border: "1px solid var(--rule)", color: "var(--type)" }}
      >
        LOCK
      </button>
    </main>
  );
}
