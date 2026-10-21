/**
 * Shared Dutch auction maths.
 *
 * The price decay is linear, so the whole future price path of an auction is
 * known up front. Both the list card (`DutchAuctionCard`) and the detail
 * page (`/dutch-auctions/:auctionId`) price auctions with the helpers below
 * so the two surfaces can never drift apart.
 *
 * The price engine itself is tracked separately (see the price-engine issue);
 * keep every consumer on these helpers when it changes.
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
 * Price at a given point of the decay curve.
 *
 * The decay is linear from `startPrice` down to `floorPrice`. The result is
 * clamped to the `[floor, start]` band so the curve is guaranteed to be
 * monotonically non-increasing even if the feed ever reports an inverted
 * price pair.
 */
export function priceAtProgress(auction: DutchAuction, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const high = Math.max(auction.startPrice, auction.floorPrice);
  const low = Math.min(auction.startPrice, auction.floorPrice);
  const price = high - p * (high - low);

  return Math.round(price * 100) / 100;
}

/**
 * Price a buyer pays right now.
 */
export function calculateCurrentPrice(auction: DutchAuction, now: number = Date.now()): number {
  return priceAtProgress(auction, getAuctionProgress(auction, now));
}

/**
 * Countdown to the end of the auction window, as `hh:mm:ss`.
 */
export function formatTimeLeft(endTime: string, now: number = Date.now()): string {
  const end = Date.parse(endTime);
  if (!Number.isFinite(end)) return 'Ended';

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
 * Price of an auction once it is over: the recorded final price when the
 * feed has one, otherwise the floor the price decayed to.
 */
export function getSettledPrice(auction: DutchAuction): number {
  return auction.finalPrice ?? auction.floorPrice;
}

/**
 * Shared purchase side effect for the list card and the detail page.
 *
 * Kept in one place so both surfaces report the same thing when a buyer
 * takes an auction down.
 */
export function announceAuctionPurchase(auctionId: string, price: number): void {
  alert(`Purchased auction ${auctionId} for ${price} USD!`);
}
