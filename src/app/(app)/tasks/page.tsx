"use client";

import { useCallback, useEffect, useState } from "react";
import { todayIST } from "@/lib/date";
import { doneOnDate, sortTasks } from "@/lib/tasks";
import {
  db,
  getMeta,
  openDB,
  putTask,
  seedIfEmpty,
  setMeta,
} from "@/lib/db/local";
import type { Project, Task } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { CaptureSheet } from "@/components/CaptureSheet";
import { DBUnavailable } from "@/components/DBUnavailable";
import { SyncFooter } from "@/components/SyncFooter";
import { ABOVE_TAB_BAR, FAB_BOTTOM } from "@/components/TabBar";
import { TaskRow } from "@/components/TaskRow";
import { lastSyncAt } from "@/lib/sync/engine";
import { useSynced } from "@/lib/use-synced";

const LAST_PROJECT = "lastProjectId";
const UNDO_MS = 5000;

// The undo bar's own rendered height: the h-11 (2.75rem) button plus its
// py-3 (1.5rem total) padding. Needed so the FAB can be pushed above it —
// otherwise the FAB overlaps the undo bar's top half whenever both are
// visible at once. The tab-bar offsets it stacks on come from TabBar
// itself, so they cannot drift from the bar they are measuring.
const UNDO_BAR_H = "4.25rem";

export default function TasksPage() {
  const [today] = useState(() => todayIST());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastProject, setLastProject] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [undo, setUndo] = useState<Task | null>(null);
  const [lastSync, setLastSync] = useState<string | undefined>();
  const [dbFailed, setDbFailed] = useState(false);

  const reload = useCallback(async () => {
    setTasks(await db.tasks.toArray());
    setProjects(await db.projects.toArray());
    setLastSync(await lastSyncAt());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await openDB();
        await seedIfEmpty();
        setLastProject((await getMeta(LAST_PROJECT)) ?? null);
        await reload();
      } catch {
        // NOTHING OPEN on a broken database reads as "my ledger is empty".
        setDbFailed(true);
      }
    })();
  }, [reload]);

  // The sync loop itself lives once, in SyncRunner (see app layout) — this
  // screen only listens for the "a sync just finished" event and refreshes
  // its own state from Dexie.
  useSynced(() => void reload().catch(() => setDbFailed(true)));

  // The undo window closes on its own. Nothing is deleted either way — the
  // row is only marked done — so a missed undo costs one tap to reverse.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const handleSave = async (task: Task) => {
    setTasks((prev) => [...prev, task]);
    await putTask(task);
    if (task.projectId) {
      setLastProject(task.projectId);
      await setMeta(LAST_PROJECT, task.projectId);
    }
  };

  // Reads `tasks` from the render closure rather than a ref. That is safe
  // here even under a rapid double-tap or a sync landing mid-interaction:
  // each click is a separate browser event, and React commits the
  // optimistic `setTasks` from the first tap (called synchronously, before
  // the `await putTask` below) before the second click event can fire. So
  // the second tap's closure — from the re-render that followed the first
  // click — already sees the toggled row and flips it back, not a stale
  // one. A sync's `reload()` lands the same way: it calls `setTasks` from
  // `useSynced`, which commits before any subsequent click. There is no
  // window where a click reads a `tasks` array older than the last commit.
  const handleToggle = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const now = new Date().toISOString();
    const next: Task = {
      ...task,
      done: !task.done,
      completedAt: task.done ? null : now,
      updatedAt: now,
    };

    setTasks((prev) => prev.map((t) => (t.id === id ? next : t)));
    await putTask(next);
    setUndo(next.done ? task : null);
  };

  const handleUndo = async () => {
    if (!undo) return;
    const restored: Task = { ...undo, updatedAt: new Date().toISOString() };
    setTasks((prev) => prev.map((t) => (t.id === restored.id ? restored : t)));
    await putTask(restored);
    setUndo(null);
  };

  const open = sortTasks(tasks.filter((t) => !t.done));
  const doneToday = doneOnDate(tasks, today);

  const projectName = (id: string | null) =>
    projects.find((p) => p.id === id)?.name ?? null;

  if (dbFailed) {
    return (
      <main className="w-full pb-6">
        <AppHeader title="TASK_LEDGER" />
        <DBUnavailable />
      </main>
    );
  }

  return (
    <main className="w-full pb-6">
      <AppHeader
        title="TASK_LEDGER"
        right={
          <span className="text-[11px]" style={{ color: "var(--accent)" }}>
            {open.length} OPEN
          </span>
        }
      />

      {open.length === 0 ? (
        <p
          className="px-3 py-8 text-center text-[11px] tracking-[0.1em]"
          style={{ color: "var(--type-muted)" }}
        >
          NOTHING OPEN
        </p>
      ) : (
        open.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            projectName={projectName(task.projectId)}
            today={today}
            onToggle={handleToggle}
          />
        ))
      )}

      {doneToday > 0 && (
        <p
          className="px-3 py-3 text-[10px] tracking-[0.14em]"
          style={{ color: "var(--type-muted)" }}
        >
          DONE TODAY {doneToday}
        </p>
      )}

      <SyncFooter lastSync={lastSync} />

      {undo && (
        <div
          role="status"
          className="fixed inset-x-0 z-40 mx-auto flex max-w-2xl items-center justify-between px-3 py-3"
          style={{
            bottom: ABOVE_TAB_BAR,
            background: "var(--type)",
            color: "var(--ground)",
          }}
        >
          <span className="truncate text-[11px]">{undo.title} DONE</span>
          <button
            type="button"
            onClick={handleUndo}
            className="h-11 px-2 text-[11px] tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            UNDO
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label="New task"
        onClick={() => setCapturing(true)}
        className="fixed right-4 z-30 h-14 w-14 rounded-full text-[20px]"
        style={{
          // Clears the tab bar always, and rises above the undo bar too
          // while it's showing, so the two fixed elements never overlap.
          bottom: undo ? `calc(${FAB_BOTTOM} + ${UNDO_BAR_H})` : FAB_BOTTOM,
          background: "var(--accent)",
          color: "var(--ground)",
        }}
      >
        +
      </button>

      <CaptureSheet
        open={capturing}
        projects={projects}
        defaultProjectId={lastProject}
        onSave={handleSave}
        onClose={() => setCapturing(false)}
      />
    </main>
  );
}
