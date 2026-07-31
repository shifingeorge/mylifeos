"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * `<dialog>` + `showModal()` rather than a fixed-position div: the native
 * top layer makes everything behind the sheet inert for free (no `inert`
 * plumbing on TabBar/HabitGrid, no focus-trap library) and gives us
 * Escape-to-close and background-scroll blocking as platform behaviour
 * instead of things we'd otherwise have to hand-roll and get wrong.
 */
export function MenuSheet() {
  const [open, setOpen] = useState(false);
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
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="h-11 w-11 text-[15px]"
      >
        ≡
      </button>

      <dialog
        ref={dialogRef}
        // Escape closes the dialog natively, bypassing our close button's
        // onClick — without this, `open` state stays true while the
        // dialog itself is shut, and the hamburger then looks dead.
        onClose={() => setOpen(false)}
        style={{
          // Inline styles beat both Tailwind's utility classes and the UA
          // stylesheet's `dialog[open]` rule, so this is the reliable way
          // to turn the browser's auto-centred, fit-content dialog box
          // into a full-screen panel — and to keep it fully offscreen
          // (not just `display:none`'d by the `open` attribute alone)
          // before the mount effect ever calls `showModal()`.
          position: "fixed",
          inset: 0,
          margin: 0,
          padding: 0,
          border: "none",
          width: "100%",
          height: "100%",
          maxWidth: "none",
          maxHeight: "none",
          background: "var(--ground)",
          display: open ? "flex" : "none",
          flexDirection: "column",
        }}
      >
        <div
          className="flex items-center justify-between px-3"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <span className="text-[13px] tracking-[0.12em]">LIFE_OS</span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="h-11 w-11 text-[15px]"
          >
            ✕
          </button>
        </div>

        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          className="flex h-14 items-center px-3 text-[12px] tracking-[0.12em]"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          SETTINGS
        </Link>
      </dialog>
    </>
  );
}
