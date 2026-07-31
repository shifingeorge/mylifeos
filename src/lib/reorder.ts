/** The minimal shape `swapOrder` needs — any row with an id and a sortOrder. */
export interface Orderable {
  id: string;
  sortOrder: number;
}

/**
 * Moves `id` one step within `items` (already filtered to the active/visible
 * set and in display order) by swapping its `sortOrder` with the neighbour in
 * `direction`. Returns the two changed rows — each with only `sortOrder`
 * replaced — or `null` if the move is out of bounds (first row moving up,
 * last row moving down, or `id` not found).
 *
 * This is a swap of two values that already belong to two distinct rows in
 * `items`, never a value computed from position or copied from a third row.
 * That's what makes it safe under gaps: whatever numbering adds/archives
 * have left behind, `items[i]` and `items[j]` still hold two distinct
 * sortOrder values, and the swap only exchanges those two — so two rows in
 * `items` can never end up sharing a sortOrder through this function, no
 * matter how sparse or how an archived row (excluded from `items`) sits
 * between them in storage order.
 */
export function swapOrder<T extends Orderable>(
  items: T[],
  id: string,
  direction: -1 | 1,
): [T, T] | null {
  const i = items.findIndex((item) => item.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= items.length) return null;

  const a = items[i];
  const b = items[j];
  return [
    { ...a, sortOrder: b.sortOrder },
    { ...b, sortOrder: a.sortOrder },
  ];
}
