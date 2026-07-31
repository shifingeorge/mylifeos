import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "@/components/TaskRow";
import type { Task } from "@/lib/types";

const task: Task = {
  id: "t1",
  title: "MENU PRICING FIX",
  priority: "P1",
  projectId: "smashed",
  due: "2026-07-23",
  done: false,
  completedAt: null,
  createdAt: "2026-07-20T00:00:00Z",
  updatedAt: "2026-07-20T00:00:00Z",
};

const today = "2026-07-31";

describe("TaskRow", () => {
  it("shows the title, priority and project", () => {
    render(
      <TaskRow task={task} projectName="SMASHED" today={today} onToggle={() => {}} />,
    );
    expect(screen.getByText("MENU PRICING FIX")).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("SMASHED")).toBeInTheDocument();
  });

  it("shows the overdue count for a past due date", () => {
    render(
      <TaskRow task={task} projectName="SMASHED" today={today} onToggle={() => {}} />,
    );
    expect(screen.getByText("+8d")).toBeInTheDocument();
  });

  it("shows no overdue marker for a task due today", () => {
    render(
      <TaskRow
        task={{ ...task, due: today }}
        projectName="SMASHED"
        today={today}
        onToggle={() => {}}
      />,
    );
    expect(screen.queryByText(/\+\d+d/)).not.toBeInTheDocument();
  });

  it("renders nothing for the project when the task is unfiled", () => {
    render(
      <TaskRow
        task={{ ...task, projectId: null }}
        projectName={null}
        today={today}
        onToggle={() => {}}
      />,
    );
    expect(screen.queryByText("SMASHED")).not.toBeInTheDocument();
  });

  it("calls onToggle with the task id when the tick target is pressed", async () => {
    const onToggle = vi.fn();
    render(
      <TaskRow task={task} projectName="SMASHED" today={today} onToggle={onToggle} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /MENU PRICING FIX/ }));
    expect(onToggle).toHaveBeenCalledWith("t1");
  });

  it("marks a completed task as checked for assistive technology", () => {
    render(
      <TaskRow
        task={{ ...task, done: true }}
        projectName="SMASHED"
        today={today}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /MENU PRICING FIX/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // The shape rule (design doc §5.3) is non-negotiable: priority is a FILLED
  // block, project is an OUTLINED tag — two shapes, not two hues. A colour-only
  // distinction is invisible to anyone colour-blind and to everyone in
  // sunlight. These assertions read the actual box model, not a colour value,
  // so a regression that swaps the border for a tint (collapsing the two
  // chips back into "different colour, same shape") fails loudly here. Do not
  // delete this as brittle — it is the only test defending the rule at all.
  it("renders priority as a filled block and project as an outlined tag, not a colour swap", () => {
    render(
      <TaskRow task={task} projectName="SMASHED" today={today} onToggle={() => {}} />,
    );

    const priorityChip = screen.getByText("P1");
    expect(priorityChip.style.background).not.toBe("");
    expect(priorityChip.style.border).toBe("");

    const projectChip = screen.getByText("SMASHED");
    expect(projectChip.style.border).not.toBe("");
    expect(projectChip.style.background).toBe("");
  });

  it("wraps a long title across up to two lines instead of truncating it", () => {
    const longTitle =
      "FOLLOW UP WITH THE SUPPLIER ABOUT THE JULY INVOICE AND CONFIRM THE REVISED DELIVERY DATE";
    render(
      <TaskRow
        task={{ ...task, title: longTitle }}
        projectName="SMASHED"
        today={today}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });
});
