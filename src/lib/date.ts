/**
 * All dates in Life OS are `YYYY-MM-DD` strings in IST.
 *
 * The IST shift happens in exactly one place — `todayIST`. Everything after
 * that is calendar arithmetic on dates that already represent IST days.
 * Shifting twice is the classic off-by-one in this kind of code.
 */
export type ISODate = string;

const IST_OFFSET_MINUTES = 330; // +05:30, and India has no DST
const DAY_MS = 86_400_000;

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** Parse `YYYY-MM-DD` into a UTC-midnight Date, for calendar maths only. */
function parse(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** The current day in IST. The only place the timezone offset is applied. */
export function todayIST(now: Date = new Date()): ISODate {
  return toISO(new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000));
}

/**
 * The rolling window shown on the habits grid: `days` dates ending with
 * today, oldest first. Today is always the rightmost column, and no future
 * date can ever be produced — which is why the grid has no future state.
 */
export function rollingWindow(today: ISODate, days = 5): ISODate[] {
  const end = parse(today).getTime();
  const out: ISODate[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(toISO(new Date(end - i * DAY_MS)));
  }
  return out;
}

/** Lexicographic comparison is correct and total for ISO dates. */
export function isFuture(date: ISODate, today: ISODate): boolean {
  return date > today;
}

/** Column head: `{ dow: 'TUE', dom: '28' }`. */
export function formatColumn(date: ISODate): { dow: string; dom: string } {
  return { dow: DOW[parse(date).getUTCDay()], dom: date.slice(8, 10) };
}

/** Screen header: `'TUE 28 JUL'`. */
export function formatHeader(date: ISODate): string {
  const d = parse(date);
  return `${DOW[d.getUTCDay()]} ${date.slice(8, 10)} ${MON[d.getUTCMonth()]}`;
}

/**
 * Days elapsed in the month so far, counting today. This is the denominator
 * for month-view category scores, so the ratio stays honest on the 2nd
 * rather than reading as failure.
 */
export function daysElapsedInMonth(today: ISODate): number {
  return Number(today.slice(8, 10));
}

/** Every date in the month containing `today`, oldest first. */
export function monthDates(today: ISODate): ISODate[] {
  const d = parse(today);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) =>
    toISO(new Date(Date.UTC(year, month, i + 1))),
  );
}
