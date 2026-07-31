"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Four tabs, because five 44px targets on a phone is a row of mistaps.
 * Journal and Settings live in the hamburger — neither is a daily
 * destination.
 */
const TABS = [
  { href: "/", label: "HOME" },
  { href: "/habits", label: "HABITS" },
  { href: "/tasks", label: "TASKS" },
  { href: "/money", label: "MONEY" },
];

/**
 * What anything fixed to the viewport bottom has to clear. Exported from
 * this file, not restated by each caller, because it is derived from the
 * `h-11` and the `borderTop` a few lines below and has to move with them.
 *
 * `h-11` is 2.75rem, and the 1px border adds to the rendered box, so the
 * bar is 1px taller than the tap target alone. On top of that comes the
 * safe-area inset: on a phone with a home indicator the bar is taller than
 * 2.75rem, which is why a bare `bottom-11`/`bottom-16` overlaps it and
 * swallows taps on the fourth tab.
 */
export const TAB_BAR_H = "calc(2.75rem + 1px)";
export const SAFE_BOTTOM = "env(safe-area-inset-bottom)";
/** Breathing room between the tab bar and a floating control above it. */
export const FAB_GAP = "0.5rem";

/** Sits flush on top of the tab bar — full-width bars, not floating ones. */
export const ABOVE_TAB_BAR = `calc(${TAB_BAR_H} + ${SAFE_BOTTOM})`;

/** Where a floating `+` button belongs on every screen that has one. */
export const FAB_BOTTOM = `calc(${TAB_BAR_H} + ${SAFE_BOTTOM} + ${FAB_GAP})`;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 grid grid-cols-4"
      style={{
        borderTop: "1px solid var(--rule)",
        background: "var(--ground)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="flex h-11 items-center justify-center text-[10px] tracking-[0.14em]"
            style={{ color: active ? "var(--accent)" : "var(--type-muted)" }}
          >
            {active ? `[${tab.label}]` : tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
