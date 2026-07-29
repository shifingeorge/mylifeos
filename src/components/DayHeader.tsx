import { formatHeader } from "@/lib/date";
import { formatDayScore, type DayScore } from "@/lib/score";

/**
 * The only display type on the screen (Syne), and the only number that
 * matters today. Design doc §5.2 — one display moment per screen.
 */
export function DayHeader({
  today,
  score,
}: {
  today: string;
  score: DayScore;
}) {
  return (
    <header
      className="flex items-baseline justify-between gap-4 px-3 py-3"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <span className="text-[13px] tracking-[0.12em]">LIFE_OS</span>

      <div className="text-right">
        <div
          className="text-[11px] tracking-[0.08em]"
          style={{ color: "var(--type-muted)" }}
        >
          {formatHeader(today)}
        </div>
        <div
          className="text-[17px] leading-tight"
          style={{
            fontFamily: "var(--font-syne), sans-serif",
            color: "var(--accent)",
          }}
        >
          {formatDayScore(score)}
        </div>
      </div>
    </header>
  );
}
