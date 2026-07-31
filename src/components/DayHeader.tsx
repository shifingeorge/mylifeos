import { formatHeader } from "@/lib/date";
import { formatDayScore, type DayScore } from "@/lib/score";

/**
 * The date and the one number that matters today. The only display type on
 * the screen (Syne) — design doc §5.2, one display moment per screen.
 *
 * The frame that used to live here belongs to AppHeader now.
 */
export function DayHeaderScore({
  today,
  score,
}: {
  today: string;
  score: DayScore;
}) {
  return (
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
  );
}
