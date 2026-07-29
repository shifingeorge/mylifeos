export interface AttemptState {
  failures: number;
  lockedUntil: number;
}

const FREE_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 60_000;
const MAX_LOCKOUT_MS = 3_600_000;

/**
 * Six digits is a million combinations — a script clears that in minutes if
 * nothing throttles it. Five failures buy a one-minute lockout, and every
 * failure after that doubles it up to an hour.
 *
 * Pure so it can be tested exhaustively. The caller owns the storage.
 */
export function recordFailure(
  state: AttemptState | undefined,
  now: number,
): AttemptState {
  const failures = (state?.failures ?? 0) + 1;
  if (failures < FREE_ATTEMPTS) return { failures, lockedUntil: 0 };

  const step = failures - FREE_ATTEMPTS;
  const duration = Math.min(BASE_LOCKOUT_MS * 2 ** step, MAX_LOCKOUT_MS);
  return { failures, lockedUntil: now + duration };
}

export function isLockedOut(
  state: AttemptState | undefined,
  now: number,
): boolean {
  return (state?.lockedUntil ?? 0) > now;
}

export function lockoutRemainingMs(
  state: AttemptState | undefined,
  now: number,
): number {
  return Math.max(0, (state?.lockedUntil ?? 0) - now);
}
