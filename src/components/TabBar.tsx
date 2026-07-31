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
