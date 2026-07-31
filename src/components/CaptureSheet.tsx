"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, todayIST } from "@/lib/date";
import type { Priority, Project, Task } from "@/lib/types";
import { Sheet } from "./Sheet";

const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P4"];

type DueChoice = "today" | "tomorrow" | "none";

export function CaptureSheet({
  open,
  projects,
  defaultProjectId,
  onSave,
  onClose,
}: {
  open: boolean;
  projects: Project[];
  defaultProjectId: string | null;
  onSave: (task: Task) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("P2");
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [due, setDue] = useState<DueChoice>("today");
  const input = useRef<HTMLInputElement>(null);

  // Keyboard up the moment the sheet opens. Anything slower and the capture
  // costs a second tap.
  useEffect(() => {
    if (open) {
      setTitle("");
      setPriority("P2");
      setProjectId(defaultProjectId);
      setDue("today");
      input.current?.focus();
    }
  }, [open, defaultProjectId]);

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const today = todayIST();
    const now = new Date().toISOString();
    const dueDate =
      due === "none" ? null : due === "today" ? today : addDays(today, 1);

    onSave({
      id: crypto.randomUUID(),
      title: trimmed.toUpperCase(),
      priority,
      projectId,
      due: dueDate,
      done: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    onClose();
  };

  return (
    <Sheet open={open} title="NEW TASK" onClose={onClose}>
      <input
        ref={input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        aria-label="Task title"
        className="w-full bg-transparent px-2 py-3 text-[13px] outline-none"
        style={{ border: "1px solid var(--rule)", color: "var(--type)" }}
      />

      <Field label="PRIORITY">
        {PRIORITIES.map((p) => (
          <Block key={p} on={priority === p} onClick={() => setPriority(p)}>
            {p}
          </Block>
        ))}
      </Field>

      <Field label="PROJECT">
        {projects
          .filter((p) => p.active)
          .map((p) => (
            <Tag
              key={p.id}
              on={projectId === p.id}
              onClick={() => setProjectId(projectId === p.id ? null : p.id)}
            >
              {p.name}
            </Tag>
          ))}
      </Field>

      <Field label="DUE">
        <Tag on={due === "today"} onClick={() => setDue("today")}>TODAY</Tag>
        <Tag on={due === "tomorrow"} onClick={() => setDue("tomorrow")}>TOMORROW</Tag>
        <Tag on={due === "none"} onClick={() => setDue("none")}>NONE</Tag>
      </Field>

      <button
        type="button"
        onClick={save}
        disabled={!title.trim()}
        className="mt-4 h-11 w-full text-[12px] tracking-[0.14em] disabled:opacity-40"
        style={{ background: "var(--accent)", color: "var(--ground)" }}
      >
        SAVE
      </button>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pt-3">
      <span
        className="w-16 shrink-0 text-[10px] tracking-[0.14em]"
        style={{ color: "var(--type-muted)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** Filled block — a tier-like choice. Design doc §5.3. */
function Block({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="h-11 shrink-0 px-2 text-[11px] tracking-[0.1em]"
      style={{
        background: on ? "var(--accent)" : "transparent",
        color: on ? "var(--ground)" : "var(--type-muted)",
      }}
    >
      {children}
    </button>
  );
}

/** Outlined tag — a category-like choice. Design doc §5.3. */
function Tag({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="h-11 shrink-0 px-2 text-[11px] tracking-[0.1em]"
      style={{
        border: `1px solid ${on ? "var(--accent)" : "var(--rule)"}`,
        color: on ? "var(--accent)" : "var(--type-muted)",
      }}
    >
      {children}
    </button>
  );
}
