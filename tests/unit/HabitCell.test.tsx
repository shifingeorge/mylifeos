import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HabitCell } from "@/components/HabitCell";

const base = {
  habitId: "read",
  habitName: "READ BOOK",
  date: "2026-07-25",
  today: "2026-07-28",
  state: "none" as const,
};

describe("HabitCell", () => {
  it("renders the hairline dot for an untouched past cell", () => {
    render(<HabitCell {...base} onTick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("·");
  });

  it("renders the open invitation on today", () => {
    render(<HabitCell {...base} date="2026-07-28" onTick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("[ ]");
  });

  it("renders a filled block when done", () => {
    render(<HabitCell {...base} state="done" onTick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("■");
  });

  it("renders a cross when missed", () => {
    render(<HabitCell {...base} state="missed" onTick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("✕");
  });

  it("calls onTick with the next state when tapped", () => {
    const onTick = vi.fn();
    render(<HabitCell {...base} onTick={onTick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onTick).toHaveBeenCalledWith("read", "2026-07-25", "done");
  });

  it("cycles done to missed", () => {
    const onTick = vi.fn();
    render(<HabitCell {...base} state="done" onTick={onTick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onTick).toHaveBeenCalledWith("read", "2026-07-25", "missed");
  });

  it("cycles missed back to none", () => {
    const onTick = vi.fn();
    render(<HabitCell {...base} state="missed" onTick={onTick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onTick).toHaveBeenCalledWith("read", "2026-07-25", "none");
  });

  it("has an accessible label naming the habit, date, and state", () => {
    render(<HabitCell {...base} onTick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "READ BOOK 2026-07-25 not logged",
    );
  });

  it("describes a done cell in its accessible label", () => {
    render(<HabitCell {...base} state="done" onTick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "READ BOOK 2026-07-25 done",
    );
  });

  it("meets the 44px minimum tick target", () => {
    render(<HabitCell {...base} onTick={vi.fn()} />);
    const style = screen.getByRole("button").style;
    expect(style.minWidth).toBe("44px");
    expect(style.minHeight).toBe("44px");
  });

  it("does not throw when the Vibration API is unavailable", () => {
    render(<HabitCell {...base} onTick={vi.fn()} />);
    expect(() => fireEvent.click(screen.getByRole("button"))).not.toThrow();
  });
});
