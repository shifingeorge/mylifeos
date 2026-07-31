import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One row of the Home summary. Every area renders exactly one, so the screen
 * grows by a card rather than by a rewrite.
 */
export function HomeCard({
  href,
  label,
  value,
  detail,
}: {
  href: string;
  label: string;
  value: string;
  detail?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block px-3 py-4"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span
          className="text-[10px] tracking-[0.18em]"
          style={{ color: "var(--type-muted)" }}
        >
          {label}
        </span>
        <span className="text-[13px]" style={{ color: "var(--accent)" }}>
          {value}
        </span>
      </div>
      {detail && (
        <div className="pt-1 text-[11px] tracking-[0.04em]">{detail}</div>
      )}
    </Link>
  );
}
