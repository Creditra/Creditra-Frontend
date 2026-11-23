import type { DutchAuction, DutchAuctionStatus } from '../types/dutchAuction';

/**
 * Effective lifecycle state derived from schedule and clock.
 */
export type EffectiveDutchAuctionStatus =
  | 'Scheduled' // auction has not started yet
  | 'Active' // auction is running
  | 'Ended' // auction ended without a sale recorded
  | 'Completed' // auction completed with a sale
  | 'Cancelled'; // auction was cancelled

/**
 * Derive the effective auction state from the payload status and timestamps.
 *
 * Terminal states from the payload (Completed, Cancelled) always win.
 * Otherwise:
 *  - now < startTime → Scheduled
 *  - startTime <= now < endTime → Active
 *  - now >= endTime → Ended (closed without recorded sale)
 *
 * @param auction - The auction object
 * @param nowMs - Current time in milliseconds (default: Date.now())
 * @returns The effective status
 */
export function getEffectiveStatus(
  auction: DutchAuction,
  nowMs: number = Date.now()
): EffectiveDutchAuctionStatus {
  // Terminal states from payload always win
  if (auction.status === 'Completed') return 'Completed';
  if (auction.status === 'Cancelled') return 'Cancelled';

  // Derive from schedule
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();

  if (nowMs < start) return 'Scheduled';
  if (nowMs >= end) return 'Ended';
  return 'Active';
}
