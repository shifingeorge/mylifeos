import { describe, it, expect } from "vitest";
import {
  todayIST,
  rollingWindow,
  isFuture,
  formatColumn,
  formatHeader,
  daysElapsedInMonth,
  monthDates,
  addDays,
  daysBetween,
} from "@/lib/date";

describe("todayIST", () => {
  it("uses IST, not the machine timezone", () => {
    // 2026-07-28T20:00Z is 2026-07-29T01:30 IST — already the next day
    expect(todayIST(new Date("2026-07-28T20:00:00Z"))).toBe("2026-07-29");
  });

  it("is still the previous day just before IST midnight", () => {
    // 2026-07-28T18:29Z is 2026-07-28T23:59 IST
    expect(todayIST(new Date("2026-07-28T18:29:00Z"))).toBe("2026-07-28");
  });

  it("rolls over at exactly IST midnight", () => {
    // 2026-07-28T18:30Z is 2026-07-29T00:00 IST
    expect(todayIST(new Date("2026-07-28T18:30:00Z"))).toBe("2026-07-29");
  });

  it("handles a UTC date that is still the previous day in UTC", () => {
    // 2026-07-28T19:00Z — UTC says the 28th, IST says the 29th
    expect(todayIST(new Date("2026-07-28T19:00:00Z"))).toBe("2026-07-29");
  });
});

describe("rollingWindow", () => {
  it("returns five days ending with today, oldest first", () => {
    expect(rollingWindow("2026-07-28")).toEqual([
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
    ]);
  });

  it("never includes a future date", () => {
    const today = "2026-07-28";
    for (const d of rollingWindow(today)) {
      expect(isFuture(d, today)).toBe(false);
    }
  });

  it("crosses a month boundary correctly", () => {
    expect(rollingWindow("2026-08-02")).toEqual([
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("crosses a year boundary correctly", () => {
    expect(rollingWindow("2027-01-02")).toEqual([
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("crosses a leap day correctly", () => {
    expect(rollingWindow("2028-03-01")).toEqual([
      "2028-02-26",
      "2028-02-27",
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("honours a custom window size", () => {
    expect(rollingWindow("2026-07-28", 3)).toEqual([
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
    ]);
  });
});

describe("isFuture", () => {
  it("is false for today", () => {
    expect(isFuture("2026-07-28", "2026-07-28")).toBe(false);
  });

  it("is false for the past", () => {
    expect(isFuture("2026-07-27", "2026-07-28")).toBe(false);
  });

  it("is true for tomorrow", () => {
    expect(isFuture("2026-07-29", "2026-07-28")).toBe(true);
  });

  it("compares across a year boundary", () => {
    expect(isFuture("2027-01-01", "2026-12-31")).toBe(true);
    expect(isFuture("2026-12-31", "2027-01-01")).toBe(false);
  });
});

describe("formatColumn", () => {
  it("returns a three-letter uppercase weekday and a zero-padded day", () => {
    expect(formatColumn("2026-07-28")).toEqual({ dow: "TUE", dom: "28" });
  });

  it("zero-pads single-digit days", () => {
    expect(formatColumn("2026-07-05")).toEqual({ dow: "SUN", dom: "05" });
  });

  it("gets the weekday right across a month boundary", () => {
    expect(formatColumn("2026-08-01").dow).toBe("SAT");
  });
});

describe("formatHeader", () => {
  it("formats as DOW DD MON", () => {
    expect(formatHeader("2026-07-28")).toBe("TUE 28 JUL");
  });

  it("formats January correctly", () => {
    expect(formatHeader("2027-01-01")).toBe("FRI 01 JAN");
  });
});

describe("daysElapsedInMonth", () => {
  it("counts the current day", () => {
    expect(daysElapsedInMonth("2026-07-28")).toBe(28);
  });

  it("is 1 on the first", () => {
    expect(daysElapsedInMonth("2026-07-01")).toBe(1);
  });
});

describe("monthDates", () => {
  it("returns every day of the month containing the date", () => {
    const dates = monthDates("2026-07-28");
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe("2026-07-01");
    expect(dates[30]).toBe("2026-07-31");
  });

  it("handles a 30-day month", () => {
    expect(monthDates("2026-09-15")).toHaveLength(30);
  });

  it("handles February in a non-leap year", () => {
    expect(monthDates("2026-02-10")).toHaveLength(28);
  });

  it("handles February in a leap year", () => {
    expect(monthDates("2028-02-10")).toHaveLength(29);
  });
});

describe("addDays", () => {
  it("returns the same date for zero", () => {
    expect(addDays("2026-07-28", 0)).toBe("2026-07-28");
  });

  it("crosses a month boundary", () => {
    expect(addDays("2026-07-30", 3)).toBe("2026-08-02");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2025-12-30", 3)).toBe("2026-01-02");
  });

  it("goes backward for negative days", () => {
    expect(addDays("2026-08-02", -3)).toBe("2026-07-30");
  });
});

describe("daysBetween", () => {
  it("is zero for the same date", () => {
    expect(daysBetween("2026-07-28", "2026-07-28")).toBe(0);
  });

  it("counts across a month boundary", () => {
    expect(daysBetween("2026-07-30", "2026-08-02")).toBe(3);
  });

  it("counts across a year boundary", () => {
    expect(daysBetween("2025-12-30", "2026-01-02")).toBe(3);
  });

  it("is negative when to is earlier than from", () => {
    expect(daysBetween("2026-08-02", "2026-07-30")).toBe(-3);
  });
});
