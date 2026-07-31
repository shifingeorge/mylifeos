import type { ReactNode } from "react";
import { MenuSheet } from "./MenuSheet";

export function AppHeader({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  return (
    <header
      className="flex items-center justify-between gap-4 pr-3"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <div className="flex items-center gap-1">
        <MenuSheet />
        <span className="text-[13px] tracking-[0.12em]">{title}</span>
      </div>
      {right}
    </header>
  );
}
