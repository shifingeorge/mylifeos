"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A bottom sheet, built on `<dialog>` + `showModal()` the same way
 * MenuSheet is: the native top layer makes the content behind it inert for
 * free, and gives us Escape-to-close and background-scroll blocking as
 * platform behaviour instead of a hand-rolled fixed-div + button-backdrop,
 * which leaks background scroll and leaks focus into the content behind it.
 *
 * Unlike MenuSheet (full-height), this one is pinned to the bottom of the
 * viewport — the `<dialog>` is sized to content and anchored via `inset`,
 * while `showModal()` still puts it in the top layer with a real backdrop.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const overflowRef = useRef<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      // showModal() throws if the dialog is already open (e.g. re-render
      // after a state change that doesn't actually toggle open-ness).
      if (!dialog.open) dialog.showModal();
      // Top-layer scroll blocking isn't guaranteed on every engine, so
      // belt-and-braces it by freezing the root element directly.
      overflowRef.current = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
    } else {
      if (dialog.open) dialog.close();
      if (overflowRef.current !== null) {
        document.documentElement.style.overflow = overflowRef.current;
        overflowRef.current = null;
      }
    }

    // Runs on unmount too, so an unmount while open still restores scroll.
    return () => {
      if (overflowRef.current !== null) {
        document.documentElement.style.overflow = overflowRef.current;
        overflowRef.current = null;
      }
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      // Escape closes the dialog natively, bypassing onClose's caller —
      // without this, `open` state stays true while the dialog itself is
      // shut, and the trigger that opened it then looks dead.
      onClose={onClose}
      // The <dialog> element itself IS the exposed backdrop area (its box
      // fills the viewport; the visible sheet is a child div pinned to the
      // bottom). A click lands on the dialog only when it didn't land on
      // any child first — checking e.target against the dialog node is how
      // we tell "tapped the dim area" from "tapped the sheet content"
      // without stopPropagation on every interactive child.
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      style={{
        // Inline styles beat both Tailwind's utility classes and the UA
        // stylesheet's centred, fit-content `dialog[open]` box, so this is
        // the reliable way to pin the panel to the bottom of the viewport
        // instead of the browser's default centred dialog — and to keep it
        // fully offscreen (not just `display:none`'d by `open` alone)
        // before the mount effect ever calls `showModal()`.
        position: "fixed",
        inset: "auto 0 0 0",
        margin: 0,
        padding: 0,
        border: "none",
        width: "100%",
        maxWidth: "none",
        maxHeight: "85vh",
        background: "var(--ground)",
        borderTop: "1px solid var(--rule)",
        display: open ? "block" : "none",
      }}
    >
      <div
        className="px-3 pb-6 pt-3"
        style={{
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center justify-between pb-3">
          <h2
            className="text-[10px] tracking-[0.18em]"
            style={{ color: "var(--type-muted)" }}
          >
            {title}
          </h2>
          {/* A visible, always-working dismiss. The backdrop tap above is a
              gesture the user has to guess exists; this is the control that
              doesn't require guessing. */}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="h-11 w-11 text-[15px]"
            style={{ color: "var(--type-muted)" }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
