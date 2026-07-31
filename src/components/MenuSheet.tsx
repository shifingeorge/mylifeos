"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * A full-height sheet rather than a slide-out drawer: one component, dismissed
 * by tapping away like everything else in the app, and no focus-trap library.
 */
export function MenuSheet() {
  const [open, setOpen] = useState(false);

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

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "var(--ground)" }}
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
        </div>
      )}
    </>
  );
}
