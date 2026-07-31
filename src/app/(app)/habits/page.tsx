"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { rollingWindow, todayIST } from "@/lib/date";
import { dayScore } from "@/lib/score";
import {
  db,
  entriesForDates,
  putEntry,
  seedIfEmpty,
} from "@/lib/db/local";
import type { Category, CellState, Habit, HabitEntry } from "@/lib/types";
import { HabitGrid } from "@/components/HabitGrid";
import { AppHeader } from "@/components/AppHeader";
import { DayHeaderScore } from "@/components/DayHeader";
import { SyncFooter } from "@/components/SyncFooter";
import { lastSyncAt } from "@/lib/sync/engine";
import { useSynced } from "@/lib/use-synced";

export default function HabitsPage() {
  const [today] = useState(() => todayIST());
  const [categories, setCategories] = useState<Category[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [lastSync, setLastSync] = useState<string | undefined>();

  const dates = useMemo(() => rollingWindow(today), [today]);

  useEffect(() => {
    void (async () => {
      // Android can clear IndexedDB under storage pressure. Ask it not to.
      await navigator.storage?.persist?.();
      await seedIfEmpty();
      setCategories(await db.categories.toArray());
      setHabits(await db.habits.toArray());
      setEntries(await entriesForDates(dates));
      setLastSync(await lastSyncAt());
    })();
  }, [dates]);

  useSynced(() => {
    void (async () => {
      setEntries(await entriesForDates(dates));
      setLastSync(await lastSyncAt());
    })();
  });

  const handleTick = useCallback(
    async (habitId: string, date: string, next: CellState) => {
      const now = new Date().toISOString();
      const row: HabitEntry = {
        habitId,
        date,
        state: next,
        checkedAt: now,
        updatedAt: now,
      };

      // Optimistic: the UI changes before the write resolves, and the write
      // never touches the network. Design doc §8.1 and §8.2.
      setEntries((prev) => [
        ...prev.filter((e) => !(e.habitId === habitId && e.date === date)),
        row,
      ]);

      await putEntry(row);
    },
    [],
  );

  return (
    <main className="w-full pb-6">
      <AppHeader
        title="LIFE_OS"
        right={<DayHeaderScore today={today} score={dayScore(habits, entries, today)} />}
      />
      <HabitGrid
        categories={categories}
        habits={habits}
        entries={entries}
        dates={dates}
        today={today}
        onTick={handleTick}
      />
      <SyncFooter lastSync={lastSync} />
    </main>
  );
}
