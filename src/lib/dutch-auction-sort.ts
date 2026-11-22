import type { DutchAuction } from '../types/dutchAuction';
import { getEffectiveStatus } from './dutch-auction-lifecycle';
import { priceAt, toStroops, fromStroops } from './dutch-auction-pricing';

export type DutchAuctionSortOption = 'ending' | 'price' | 'discount';

export const DEFAULT_SORT_OPTION: DutchAuctionSortOption = 'ending';
export const VALID_SORT_OPTIONS: readonly DutchAuctionSortOption[] = ['ending', 'price', 'discount'];

export function isSortOption(value: string | null | undefined): value is DutchAuctionSortOption {
  return value === 'ending' || value === 'price' || value === 'discount';
}

/**
 * Get current price in integer stroops, handling edge cases gracefully.
 */
export function getAuctionPriceStroops(auction: DutchAuction, nowMs: number): bigint {
  try {
    return priceAt(auction, nowMs);
  } catch {
    return toStroops(auction.startPrice || 0);
  }
}

/**
 * Compute the discount fraction: (startPrice - currentPrice) / startPrice.
 * Returns 0 if startPrice is non-positive.
 */
export function getAuctionDiscount(auction: DutchAuction, nowMs: number): number {
  if (!auction.startPrice || auction.startPrice <= 0) return 0;
  const currentPrice = fromStroops(getAuctionPriceStroops(auction, nowMs));
  const discount = (auction.startPrice - currentPrice) / auction.startPrice;
  return Number.isFinite(discount) ? discount : 0;
}

/**
 * Comparator for 'ending':
 * - Active auctions come before non-active auctions.
 * - For active auctions: ordered by time remaining ascending (ending soonest first).
 * - For non-active auctions: ordered by time remaining ascending, then end time.
 * - Ties break by id ascending.
 */
export function compareEnding(a: DutchAuction, b: DutchAuction, nowMs: number): number {
  const aActive = getEffectiveStatus(a, nowMs) === 'Active';
  const bActive = getEffectiveStatus(b, nowMs) === 'Active';

  if (aActive !== bActive) {
    return aActive ? -1 : 1;
  }

  const aEnd = new Date(a.endTime).getTime();
  const bEnd = new Date(b.endTime).getTime();
  const aRemaining = Math.max(0, aEnd - nowMs);
  const bRemaining = Math.max(0, bEnd - nowMs);

  if (aRemaining !== bRemaining) {
    return aRemaining - bRemaining;
  }

  if (aEnd !== bEnd) {
    return aEnd - bEnd;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Comparator for 'price':
 * - Ordered by current decayed price ascending (lowest price first).
 * - Ties break by id ascending.
 */
export function comparePrice(a: DutchAuction, b: DutchAuction, nowMs: number): number {
  const priceA = getAuctionPriceStroops(a, nowMs);
  const priceB = getAuctionPriceStroops(b, nowMs);

  if (priceA !== priceB) {
    return priceA < priceB ? -1 : 1;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Comparator for 'discount':
 * - Ordered by discount = (start - current) / start descending (biggest discount first).
 * - Ties break by id ascending.
 */
export function compareDiscount(a: DutchAuction, b: DutchAuction, nowMs: number): number {
  const discountA = getAuctionDiscount(a, nowMs);
  const discountB = getAuctionDiscount(b, nowMs);

  if (discountA !== discountB) {
    return discountB - discountA;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Returns the comparator function for the given sort option and timestamp.
 */
export function getSortComparator(
  sortOption: DutchAuctionSortOption,
  nowMs: number
): (a: DutchAuction, b: DutchAuction) => number {
  switch (sortOption) {
    case 'price':
      return (a, b) => comparePrice(a, b, nowMs);
    case 'discount':
      return (a, b) => compareDiscount(a, b, nowMs);
    case 'ending':
    default:
      return (a, b) => compareEnding(a, b, nowMs);
  }
}

/**
 * Sort an array of auctions without mutating the input array.
 */
export function sortAuctions(
  auctions: readonly DutchAuction[],
  sortOption: DutchAuctionSortOption,
  nowMs: number
): DutchAuction[] {
  const comparator = getSortComparator(sortOption, nowMs);
  return [...auctions].sort(comparator);
}
