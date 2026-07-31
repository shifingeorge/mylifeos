"use client";

import { formatDue, overdueDays } from "@/lib/tasks";
import type { Task } from "@/lib/types";

/**
 * The shape rule, design doc §5.3 and non-negotiable: priority is a FILLED
 * solid block, project is an OUTLINED tag. Two shapes, not two hues — a
 * colour-only distinction disappears for half the people who look at it and
 * for all of us in sunlight.
 *
 * The whole row is the tick target, not the little box.
 */
export function TaskRow({
  task,
  projectName,
  today,
  onToggle,
}: {
  task: Task;
  projectName: string | null;
  today: string;
  onToggle: (id: string) => void;
}) {
  const late = overdueDays(task.due, today);

  return (
    <button
      type="button"
      aria-pressed={task.done}
      onClick={() => onToggle(task.id)}
      className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 py-2 text-left"
      style={{ borderBottom: "1px solid var(--rule)", minHeight: "72px" }}
    >
      <span
        aria-hidden="true"
        className="flex h-full items-center justify-center text-[13px]"
        style={{ color: task.done ? "var(--accent)" : "var(--type-muted)" }}
      >
        {task.done ? "■" : "[ ]"}
      </span>

      <span className="min-w-0">
        <span
          className="block truncate text-[12px] tracking-[0.04em]"
          style={{ color: task.done ? "var(--type-muted)" : "var(--type)" }}
        >
          {task.title}
        </span>

        <span className="flex items-center gap-2 pt-1">
          {/* Filled block — priority. */}
          <span
            className="px-1 text-[10px] tracking-[0.1em]"
            style={{ background: "var(--accent)", color: "var(--ground)" }}
          >
            {task.priority}
          </span>

          {/* Outlined tag — project. */}
          {projectName && (
            <span
              className="px-1 text-[10px] tracking-[0.1em]"
              style={{
                border: "1px solid var(--rule)",
                color: "var(--type-muted)",
              }}
            >
              {projectName}
            </span>
          )}
        </span>
      </span>

      <span className="pr-3 text-right text-[10px] tracking-[0.08em]">
        <span className="block" style={{ color: "var(--type-muted)" }}>
          {formatDue(task.due, today)}
        </span>
        {/* Overdue is urgency, so it earns --alert. The row itself does not
            recolour — a wall of red stops meaning anything. */}
        {late > 0 && (
          <span className="block" style={{ color: "var(--alert)" }}>
            +{late}d
          </span>
        )}
      </span>
    </button>
  );
}
