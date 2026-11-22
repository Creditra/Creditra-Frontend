import { vi } from 'vitest';
import { setClockForTests, resetClock } from '../lib/clock';

/**
 * Canonical test anchor date for credit-lifecycle suites.
 * Placed in late February 2025 so fixture payment dates (2025-03-01 / 2025-03-05)
 * sit comfortably within the 7-day upcoming window.
 */
export const DEFAULT_FROZEN_TIME = '2025-02-25T12:00:00.000Z';

/**
 * Freezes both Vitest system timers and the credit-domain clock.
 *
 * @param date ISO string, timestamp, or Date to freeze at. Defaults to 2025-02-25T12:00:00.000Z.
 * @returns The Date object pinned to.
 */
export function freezeTime(date: string | number | Date = DEFAULT_FROZEN_TIME): Date {
  const target = new Date(date);
  vi.useFakeTimers();
  vi.setSystemTime(target);
  setClockForTests(() => new Date());
  return target;
}

/**
 * Unfreezes timers and restores real time.
 */
export function unfreezeTime(): void {
  resetClock();
  vi.useRealTimers();
}
