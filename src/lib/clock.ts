/**
 * Centralised injectable clock for the credit domain.
 *
 * In production, `now()` delegates directly to `new Date()`. In tests,
 * `setClockForTests(fn)` allows freezing or advancing time deterministically
 * across pages, fixtures, and date-dependent components without relying
 * on system clock state.
 */

type ClockFn = () => Date;

let customClock: ClockFn | null = null;

/**
 * Returns the current date according to the active clock.
 * Defaults to `new Date()`.
 */
export function now(): Date {
  return customClock ? customClock() : new Date();
}

/**
 * Returns the current epoch timestamp in milliseconds.
 * Matches `Date.now()` but respects the test clock override.
 */
export function nowMs(): number {
  return now().getTime();
}

/**
 * Overrides the clock function for testing purposes.
 * Pass a function returning a `Date` (or a fixed date generator).
 */
export function setClockForTests(fn: ClockFn): void {
  customClock = fn;
}

/**
 * Resets the clock to default production behavior (`new Date()`).
 */
export function resetClock(): void {
  customClock = null;
}
