/**
 * Shared Dutch auction route and countdown helpers.
 *
 * Pricing itself lives in `src/lib/dutch-auction-pricing` and is computed in
 * integer stroops. These helpers only deal with untrusted route input and
 * presentation timers; they must not reintroduce a floating-point price
 * engine.
 */
import type { DutchAuction } from '../types/dutchAuction';

/**
 * Maximum accepted length of an auction id taken from the URL.
 *
 * Route params are untrusted input: anything longer than this is rejected
 * before a lookup happens, so a hostile link can never make the app scan the
 * (arbitrarily long) id.
 */
export const AUCTION_ID_MAX_LENGTH = 64;

/**
 * Percent-decode a route param without throwing.
 *
 * `decodeURIComponent` raises `URIError` on malformed sequences such as a
 * lone `%`. A malformed id is simply "not found", never a crash.
 */
export function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Position of `now` inside the auction window, as a 0 → 1 fraction.
 *
 * 0 = the window has not opened yet, 1 = the window has closed.
 */
export function getAuctionProgress(auction: DutchAuction, now: number = Date.now()): number {
  const start = Date.parse(auction.startTime);
  const end = Date.parse(auction.endTime);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  if (now <= start) return 0;
  if (now >= end) return 1;

  return (now - start) / (end - start);
}

/**
 * Countdown to the end of the auction window, as `hh:mm:ss`.
 */
export function formatTimeLeft(endTime: string, now: number = Date.now()): string {
  const end = Date.parse(endTime);
  if (!Number.isFinite(end)) return 'Unavailable';

  const diff = end - now;
  if (diff <= 0) return 'Ended';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const h = hours;
  const m = minutes % 60;
  const s = seconds % 60;

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Countdown to the start of the auction window, as `hh:mm:ss`.
 */
export function formatTimeUntilStart(startTime: string, now: number = Date.now()): string {
  const start = Date.parse(startTime);
  if (!Number.isFinite(start)) return 'Unavailable';

  const diff = start - now;
  if (diff <= 0) return '00:00:00';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const h = hours;
  const m = minutes % 60;
  const s = seconds % 60;

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
