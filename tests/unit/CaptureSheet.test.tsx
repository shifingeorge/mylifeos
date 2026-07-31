import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaptureSheet } from "@/components/CaptureSheet";
import { addDays, todayIST } from "@/lib/date";
import type { Project, Task } from "@/lib/types";

// jsdom doesn't implement HTMLDialogElement.showModal/close (they're no-ops
// that throw "Not implemented"), so Sheet's effect would blow up on mount.
// Stub the minimal behaviour Sheet actually relies on: flipping `.open` and
// not throwing. This is a test-environment gap, not a reason to weaken the
// component — real browsers implement both.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const projects: Project[] = [
  { id: "smashed", name: "SMASHED", sortOrder: 0, active: true, updatedAt: "2026-07-01" },
  { id: "archived", name: "OLD", sortOrder: 1, active: false, updatedAt: "2026-07-01" },
];

describe("CaptureSheet", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-07-31T06:00:00Z")); // 11:30 IST
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves the title trimmed and uppercased", async () => {
    const onSave = vi.fn();
    render(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId={null}
        onSave={onSave}
        onClose={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText("Task title"), "  fix the invoice  ");
    await userEvent.click(screen.getByRole("button", { name: "SAVE" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: "FIX THE INVOICE" });
  });

  it("defaults due to today", async () => {
    const onSave = vi.fn();
    render(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId={null}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText("Task title"), "TASK");
    await userEvent.click(screen.getByRole("button", { name: "SAVE" }));
    expect(onSave.mock.calls[0][0].due).toBe(todayIST());
  });

  it("sets due to tomorrow via addDays when TOMORROW is chosen", async () => {
    const onSave = vi.fn();
    render(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId={null}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText("Task title"), "TASK");
    await userEvent.click(screen.getByRole("button", { name: "TOMORROW" }));
    await userEvent.click(screen.getByRole("button", { name: "SAVE" }));
    expect(onSave.mock.calls[0][0].due).toBe(addDays(todayIST(), 1));
  });

  it("sets due to null when NONE is chosen", async () => {
    const onSave = vi.fn();
    render(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId={null}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText("Task title"), "TASK");
    await userEvent.click(screen.getByRole("button", { name: "NONE" }));
    await userEvent.click(screen.getByRole("button", { name: "SAVE" }));
    expect(onSave.mock.calls[0][0].due).toBeNull();
  });

  it("defaults priority to P2 and project to the supplied defaultProjectId", async () => {
    const onSave = vi.fn();
    render(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId="smashed"
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText("Task title"), "TASK");
    await userEvent.click(screen.getByRole("button", { name: "SAVE" }));
    const saved: Task = onSave.mock.calls[0][0];
    expect(saved.priority).toBe("P2");
    expect(saved.projectId).toBe("smashed");
  });

  it("disables SAVE while the title is empty or whitespace, enables it once there is text", async () => {
    render(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId={null}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    const save = screen.getByRole("button", { name: "SAVE" });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Task title"), "   ");
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Task title"), "x");
    expect(save).toBeEnabled();
  });

  it("resets its fields between opens", async () => {
    const { rerender } = render(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId={null}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText("Task title"), "LEFTOVER");
    expect(screen.getByLabelText("Task title")).toHaveValue("LEFTOVER");

    rerender(
      <CaptureSheet
        open={false}
        projects={projects}
        defaultProjectId={null}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    rerender(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId={null}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByLabelText("Task title")).toHaveValue("");
  });

  it("calls onClose when the sheet's close button is tapped", async () => {
    const onClose = vi.fn();
    render(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId={null}
        onSave={() => {}}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deselects a project when it is tapped again", async () => {
    const onSave = vi.fn();
    render(
      <CaptureSheet
        open
        projects={projects}
        defaultProjectId={null}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "SMASHED" }));
    await userEvent.click(screen.getByRole("button", { name: "SMASHED" }));
    await userEvent.type(screen.getByLabelText("Task title"), "TASK");
    await userEvent.click(screen.getByRole("button", { name: "SAVE" }));
    expect(onSave.mock.calls[0][0].projectId).toBeNull();
  });
});
