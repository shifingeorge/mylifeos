import { describe, it, expect } from "vitest";
import { nextState, cycle, renderMark } from "@/lib/habit-state";

describe("nextState", () => {
  it("cycles none -> done -> missed -> none", () => {
    expect(nextState("none")).toBe("done");
    expect(nextState("done")).toBe("missed");
    expect(nextState("missed")).toBe("none");
  });

  it("returns to the start after three taps", () => {
    expect(nextState(nextState(nextState("none")))).toBe("none");
  });
});

describe("cycle", () => {
  const today = "2026-07-28";

  it("advances on today", () => {
    expect(cycle("none", today, today)).toBe("done");
  });

  it("advances identically on a past date — backfill needs no special mode", () => {
    expect(cycle("none", "2026-07-25", today)).toBe("done");
    expect(cycle("done", "2026-07-25", today)).toBe("missed");
    expect(cycle("missed", "2026-07-25", today)).toBe("none");
  });

  it("throws on a future date", () => {
    expect(() => cycle("none", "2026-07-29", today)).toThrow(
      "Cannot tick a future date",
    );
  });
});

describe("renderMark", () => {
  const today = "2026-07-28";

  it("renders done as a filled block on any date", () => {
    expect(renderMark("done", today, today)).toBe("■");
    expect(renderMark("done", "2026-07-25", today)).toBe("■");
  });

  it("renders missed as a cross", () => {
    expect(renderMark("missed", "2026-07-25", today)).toBe("✕");
  });

  it("renders a missed mark on today too — you can fail before the day ends", () => {
    expect(renderMark("missed", today, today)).toBe("✕");
  });

  it("renders none on a past date as a hairline dot", () => {
    expect(renderMark("none", "2026-07-25", today)).toBe("·");
  });

  it("renders none on today as the open invitation", () => {
    expect(renderMark("none", today, today)).toBe("[ ]");
  });

  it("never treats today-untouched as a miss", () => {
    expect(renderMark("none", today, today)).not.toBe("✕");
  });

  it("distinguishes never-logged from explicitly missed", () => {
    expect(renderMark("none", "2026-07-25", today)).not.toBe(
      renderMark("missed", "2026-07-25", today),
    );
  });
});
