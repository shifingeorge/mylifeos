import { describe, it, expect } from "vitest";
import {
  recordFailure,
  isLockedOut,
  lockoutRemainingMs,
  type AttemptState,
} from "@/lib/auth/rate-limit";

const T0 = 1_000_000;

describe("rate limiting", () => {
  it("allows the first four failures without locking out", () => {
    let s: AttemptState | undefined;
    for (let i = 0; i < 4; i++) s = recordFailure(s, T0);
    expect(isLockedOut(s, T0)).toBe(false);
  });

  it("locks out for one minute on the fifth failure", () => {
    let s: AttemptState | undefined;
    for (let i = 0; i < 5; i++) s = recordFailure(s, T0);
    expect(isLockedOut(s, T0)).toBe(true);
    expect(lockoutRemainingMs(s, T0)).toBe(60_000);
  });

  it("doubles the lockout on each subsequent failure", () => {
    let s: AttemptState | undefined;
    for (let i = 0; i < 5; i++) s = recordFailure(s, T0);

    s = recordFailure(s, T0 + 60_000);
    expect(lockoutRemainingMs(s, T0 + 60_000)).toBe(120_000);

    s = recordFailure(s, T0 + 180_000);
    expect(lockoutRemainingMs(s, T0 + 180_000)).toBe(240_000);
  });

  it("caps the lockout at one hour", () => {
    let s: AttemptState | undefined;
    let now = T0;
    for (let i = 0; i < 20; i++) {
      s = recordFailure(s, now);
      now += 3_600_000;
    }
    expect(lockoutRemainingMs(s, now - 3_600_000)).toBe(3_600_000);
  });

  it("never exceeds the cap no matter how many failures", () => {
    let s: AttemptState | undefined;
    for (let i = 0; i < 100; i++) s = recordFailure(s, T0);
    expect(lockoutRemainingMs(s, T0)).toBeLessThanOrEqual(3_600_000);
  });

  it("is not locked out once the window has passed", () => {
    let s: AttemptState | undefined;
    for (let i = 0; i < 5; i++) s = recordFailure(s, T0);
    expect(isLockedOut(s, T0 + 60_001)).toBe(false);
  });

  it("is still locked out one millisecond before the window ends", () => {
    let s: AttemptState | undefined;
    for (let i = 0; i < 5; i++) s = recordFailure(s, T0);
    expect(isLockedOut(s, T0 + 59_999)).toBe(true);
  });

  it("treats an absent state as not locked out", () => {
    expect(isLockedOut(undefined, T0)).toBe(false);
    expect(lockoutRemainingMs(undefined, T0)).toBe(0);
  });

  it("keeps counting failures across a lockout so the delay keeps growing", () => {
    let s: AttemptState | undefined;
    for (let i = 0; i < 6; i++) s = recordFailure(s, T0);
    expect(s!.failures).toBe(6);
  });
});
