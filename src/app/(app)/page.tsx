"use client";

import { useEffect, useMemo, useState } from "react";
import { formatHeader, rollingWindow, todayIST } from "@/lib/date";
import { dayScore, formatDayScore } from "@/lib/score";
import { db, entriesForDates, seedIfEmpty } from "@/lib/db/local";
import { sortTasks } from "@/lib/tasks";
import type { Habit, HabitEntry, Project, Task } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { HomeCard } from "@/components/HomeCard";
import { useSynced } from "@/lib/use-synced";

/**
 * Where do I stand today, in one screen. The habits-only redirect this
 * replaced was right when habits were the only thing to come to.
 */
export default function HomePage() {
  const [today] = useState(() => todayIST());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const dates = useMemo(() => rollingWindow(today, 1), [today]);

  useEffect(() => {
    void (async () => {
      await navigator.storage?.persist?.();
      await seedIfEmpty();
      setHabits(await db.habits.toArray());
      setEntries(await entriesForDates(dates));
      setTasks(await db.tasks.toArray());
      setProjects(await db.projects.toArray());
    })();
  }, [dates]);

  // A sync elsewhere in the app (or the loop's own timer) can bring in
  // habits, entries, tasks, or projects this card summarises — re-read so
  // the numbers on screen aren't stale the whole time the user has Home open.
  useSynced(() => {
    void (async () => {
      setHabits(await db.habits.toArray());
      setEntries(await entriesForDates(dates));
      setTasks(await db.tasks.toArray());
      setProjects(await db.projects.toArray());
    })();
  });

  const score = dayScore(habits, entries, today);
  const open = sortTasks(tasks.filter((t) => !t.done));
  const next = open[0];
  const nextProject =
    projects.find((p) => p.id === next?.projectId)?.name ?? null;

  return (
    <main className="w-full pb-6">
      <AppHeader title={formatHeader(today)} />
      <HomeCard
        href="/habits"
        label="HABITS"
        value={`${score.coreDone} / ${score.coreTotal}`}
        detail={formatDayScore(score)}
      />
      <HomeCard
        href="/tasks"
        label="TASKS"
        value={`${open.length} OPEN`}
        detail={
          next ? (
            // min-w-0 on the flex row is what lets the title's `truncate`
            // actually clip instead of pushing the project tag off-card —
            // without it a flex item's min-width defaults to its content
            // size, and the card is too narrow for a long title otherwise.
            <span className="flex min-w-0 items-center gap-2">
              {/* Filled block — priority. Same shape rule as TaskRow. */}
              <span
                className="shrink-0 px-1 text-[10px] tracking-[0.1em]"
                style={{ background: "var(--accent)", color: "var(--ground)" }}
              >
                {next.priority}
              </span>
              <span className="min-w-0 truncate">{next.title}</span>
              {/* Outlined tag — project. Same shape rule as TaskRow. */}
              {nextProject && (
                <span
                  className="shrink-0 px-1 text-[10px] tracking-[0.1em]"
                  style={{
                    border: "1px solid var(--rule)",
                    color: "var(--type-muted)",
                  }}
                >
                  {nextProject}
                </span>
              )}
            </span>
          ) : (
            "NOTHING OPEN"
          )
        }
      />
    </main>
  );
}
