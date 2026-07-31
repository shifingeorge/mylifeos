"use client";

import { useCallback, useEffect, useState } from "react";
import { db, putProject, seedIfEmpty } from "@/lib/db/local";
import type { Project, Task } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { ListEditor, type ListItem } from "@/components/ListEditor";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const reload = useCallback(async () => {
    setProjects((await db.projects.toArray()).sort((a, b) => a.sortOrder - b.sortOrder));
    setTasks(await db.tasks.toArray());
  }, []);

  useEffect(() => {
    void (async () => {
      await seedIfEmpty();
      await reload();
    })();
  }, [reload]);

  const stamp = () => new Date().toISOString();

  const items: ListItem[] = projects
    .filter((p) => p.active)
    .map((p) => {
      const count = tasks.filter((t) => t.projectId === p.id).length;
      // Archiving is always allowed — a project with tasks keeps its tag,
      // nothing is orphaned — so this is purely informational, not a
      // reason to disable anything. It has to say "archiving", not just
      // state the count, or a reader could mistake it for a warning that
      // the tap is unsafe.
      return {
        id: p.id,
        name: p.name,
        blocked:
          count > 0
            ? `ARCHIVING KEEPS THE TAG ON ${count} EXISTING TASK${count === 1 ? "" : "S"}`
            : null,
      };
    });

  const onRename = async (id: string, name: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    await putProject({ ...p, name, updatedAt: stamp() });
    await reload();
  };

  const onAdd = async (name: string) => {
    const max = projects.reduce((m, p) => Math.max(m, p.sortOrder), 0);
    await putProject({
      id: crypto.randomUUID(),
      name,
      sortOrder: max + 1,
      active: true,
      updatedAt: stamp(),
    });
    await reload();
  };

  const onArchive = async (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    await putProject({ ...p, active: false, updatedAt: stamp() });
    await reload();
  };

  /**
   * Swaps sortOrder with the neighbour in the *active* list. This is safe
   * even after adds/archives punch gaps in the numbering: `active[i]` and
   * `active[j]` are always two distinct rows with two distinct existing
   * sortOrder values, and the swap only ever exchanges those two real
   * values between each other — it never copies a value from a third row
   * or computes one from a position index. So two active projects can
   * never end up sharing a sortOrder through this path, regardless of how
   * sparse the numbering has become. Archived rows keep their old
   * sortOrder untouched, which is fine because they're filtered out of
   * `active` and never re-enter the comparison.
   */
  const onReorder = async (id: string, direction: -1 | 1) => {
    const active = projects.filter((p) => p.active);
    const i = active.findIndex((p) => p.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= active.length) return;

    const a = active[i];
    const b = active[j];
    const now = stamp();
    await putProject({ ...a, sortOrder: b.sortOrder, updatedAt: now });
    await putProject({ ...b, sortOrder: a.sortOrder, updatedAt: now });
    await reload();
  };

  return (
    <main className="w-full pb-24">
      <AppHeader title="PROJECTS" />
      <ListEditor
        items={items}
        onRename={onRename}
        onReorder={onReorder}
        onAdd={onAdd}
        onArchive={onArchive}
      />
    </main>
  );
}
