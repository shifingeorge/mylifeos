"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { FAB_BOTTOM } from "./TabBar";

export interface ListItem {
  id: string;
  name: string;
  /**
   * Informational only here, not a lock: every archive is safe (see
   * ARCHIVE below), so this never disables the button. It exists so the
   * sheet can say what archiving will do before the tap, instead of after.
   * A future list with a real delete path (habits, Phase 4) can repurpose
   * this to also disable the destructive control when set.
   */
  blocked?: string | null;
}

/**
 * Every Settings list is this component. Reorder is `↑ ↓`, not drag and drop —
 * dragging is miserable on a phone and needs a library.
 *
 * The destructive button reads DELETE or ARCHIVE depending on whether anything
 * references the row, decided before the sheet opens. A button that says what
 * it will do removes the need for a confirmation dialog.
 */
export function ListEditor({
  items,
  onRename,
  onReorder,
  onAdd,
  onArchive,
}: {
  items: ListItem[];
  onRename: (id: string, name: string) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
  onAdd: (name: string) => void;
  onArchive: (id: string) => void;
}) {
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const openEditor = (item: ListItem) => {
    setDraft(item.name);
    setEditing(item);
  };

  return (
    <>
      {items.map((item, i) => (
        <div
          key={item.id}
          className="flex items-center gap-1 px-3"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          {/* min-w-0 + truncate lets the name give way first: the three
              buttons below are pinned at a full 44x44 tap target each (the
              global minimum, enforced elsewhere as 44 square — see
              HabitCell/TaskRow), never shrunk to fit a narrow phone. */}
          <span className="min-w-0 flex-1 truncate text-[12px] tracking-[0.04em]">
            {item.name}
          </span>
          <button
            type="button"
            aria-label={`Move ${item.name} up`}
            disabled={i === 0}
            onClick={() => onReorder(item.id, -1)}
            className="h-11 w-11 shrink-0 text-[12px] disabled:opacity-25"
            style={{ color: "var(--type-muted)" }}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move ${item.name} down`}
            disabled={i === items.length - 1}
            onClick={() => onReorder(item.id, 1)}
            className="h-11 w-11 shrink-0 text-[12px] disabled:opacity-25"
            style={{ color: "var(--type-muted)" }}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={`Edit ${item.name}`}
            onClick={() => openEditor(item)}
            className="h-11 w-11 shrink-0 text-[12px]"
            style={{ color: "var(--type-muted)" }}
          >
            ›
          </button>
        </div>
      ))}

      <button
        type="button"
        aria-label="Add"
        onClick={() => {
          setDraft("");
          setAdding(true);
        }}
        className="fixed right-4 z-30 h-14 w-14 rounded-full text-[20px]"
        style={{
          // Not `bottom-16`: 4rem is shorter than the tab bar on a phone
          // with a home indicator, so this button used to sit on top of the
          // fourth tab and eat its taps. Same offset the tasks FAB uses.
          bottom: FAB_BOTTOM,
          background: "var(--accent)",
          color: "var(--ground)",
        }}
      >
        +
      </button>

      <Sheet
        open={adding || editing !== null}
        title={adding ? "NEW" : "EDIT"}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Name"
          className="w-full bg-transparent px-2 py-3 text-[13px] outline-none"
          style={{ border: "1px solid var(--rule)", color: "var(--type)" }}
        />

        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => {
            const name = draft.trim().toUpperCase();
            if (adding) onAdd(name);
            else if (editing) onRename(editing.id, name);
            setAdding(false);
            setEditing(null);
          }}
          className="mt-4 h-11 w-full text-[12px] tracking-[0.14em] disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--ground)" }}
        >
          SAVE
        </button>

        {editing && (
          <>
            {/* Always enabled: archiving a project is safe whether or not it
                has tasks (see ListItem.blocked above), so there is nothing to
                refuse here — only something to explain before the tap. */}
            <button
              type="button"
              onClick={() => {
                onArchive(editing.id);
                setEditing(null);
              }}
              className="mt-2 h-11 w-full text-[12px] tracking-[0.14em]"
              style={{
                border: "1px solid var(--alert)",
                color: "var(--alert)",
              }}
            >
              ARCHIVE
            </button>
            {editing.blocked && (
              <p
                className="pt-2 text-center text-[10px] tracking-[0.1em]"
                style={{ color: "var(--type-muted)" }}
              >
                {editing.blocked}
              </p>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
