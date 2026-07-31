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
});
