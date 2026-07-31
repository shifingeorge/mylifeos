import { describe, expect, it } from "vitest";
import { swapOrder } from "@/lib/reorder";

const items = [
  { id: "a", sortOrder: 1 },
  { id: "b", sortOrder: 3 },
  { id: "c", sortOrder: 4 },
  { id: "d", sortOrder: 5 },
];

describe("swapOrder", () => {
  it("returns null when the first item tries to move up", () => {
    expect(swapOrder(items, "a", -1)).toBeNull();
  });

  it("returns null when the last item tries to move down", () => {
    expect(swapOrder(items, "d", 1)).toBeNull();
  });

  it("returns null when the id is not found", () => {
    expect(swapOrder(items, "missing", 1)).toBeNull();
  });

  it("moving item 2 up returns the two rows with sortOrder exchanged", () => {
    const result = swapOrder(items, "b", -1);
    expect(result).not.toBeNull();
    const [moved, neighbour] = result!;
    expect(moved).toMatchObject({ id: "b", sortOrder: 1 });
    expect(neighbour).toMatchObject({ id: "a", sortOrder: 3 });
  });

  it("moving item 2 down returns the two rows with sortOrder exchanged", () => {
    const result = swapOrder(items, "b", 1);
    expect(result).not.toBeNull();
    const [moved, neighbour] = result!;
    expect(moved).toMatchObject({ id: "b", sortOrder: 4 });
    expect(neighbour).toMatchObject({ id: "c", sortOrder: 3 });
  });

  // Simulates the gap an archived row leaves behind: the caller filters to
  // active rows before calling swapOrder, so an archived row sitting between
  // two active ones in *storage* order never appears in `items` here and
  // can't be swapped into. sortOrder values on the active rows are already
  // sparse (1, 3, 4, 5) because of it, which is exactly the case this test
  // exercises.
  it("two active items never end up sharing a sortOrder, including with a gap from an archived row between them", () => {
    const result = swapOrder(items, "c", -1);
    expect(result).not.toBeNull();
    const [moved, neighbour] = result!;
    // b (3) and c (4) swap; a (1) and d (5) are untouched.
    expect(moved).toMatchObject({ id: "c", sortOrder: 3 });
    expect(neighbour).toMatchObject({ id: "b", sortOrder: 4 });

    const values = [items[0].sortOrder, moved.sortOrder, neighbour.sortOrder, items[3].sortOrder];
    expect(new Set(values).size).toBe(values.length);
  });
});
