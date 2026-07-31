"use client";

import { useEffect, useMemo, useState } from "react";
import { formatHeader, rollingWindow, todayIST } from "@/lib/date";
import { dayScore, formatDayScore } from "@/lib/score";
import { db, entriesForDates, seedIfEmpty } from "@/lib/db/local";
import type { Habit, HabitEntry } from "@/lib/types";
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

  const dates = useMemo(() => rollingWindow(today, 1), [today]);

  useEffect(() => {
    void (async () => {
      await navigator.storage?.persist?.();
      await seedIfEmpty();
      setHabits(await db.habits.toArray());
      setEntries(await entriesForDates(dates));
    })();
  }, [dates]);

  // A sync elsewhere in the app (or the loop's own timer) can bring in
  // habits or entries this card summarises — re-read so the number on
  // screen isn't stale the whole time the user has Home open.
  useSynced(() => {
    void (async () => {
      setHabits(await db.habits.toArray());
      setEntries(await entriesForDates(dates));
    })();
  });

  const score = dayScore(habits, entries, today);

  return (
    <main className="w-full pb-6">
      <AppHeader title={formatHeader(today)} />
      <HomeCard
        href="/habits"
        label="HABITS"
        value={`${score.coreDone} / ${score.coreTotal}`}
        detail={formatDayScore(score)}
      />
    </main>
  );
}
