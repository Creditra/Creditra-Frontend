import type { DutchAuction } from '../types/dutchAuction';

/**
 * Multiplier for converting standard currency units to stroops (1 USDC = 10^7 stroops).
 */
export const STROOPS_PER_UNIT = 10_000_000n;

/**
 * Typed rejection reasons for invalid auction schedules.
 */
export type ScheduleRejectionReason =
  | 'invalid_time'
  | 'non_positive_duration'
  | 'floor_above_start'
  | 'negative_price';

/**
 * Typed schedule validation result.
 */
export type ScheduleValidationResult =
  | { ok: true }
  | { ok: false; reason: ScheduleRejectionReason };

/**
 * Minimal schedule subset required for pricing and validation.
 */
export type AuctionScheduleInput = Pick<
  DutchAuction,
  'startTime' | 'endTime' | 'startPrice' | 'floorPrice'
>;

/**
 * Convert a fractional currency amount (e.g. 0.3 USDC) into integer stroops (3,000,000 stroops).
 *
 * Rejects non-finite (NaN, Infinity) and negative amounts.
 */
export function toStroops(amount: number): bigint {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TypeError('Amount must be a finite, non-negative number');
  }
  return BigInt(Math.round(amount * 10_000_000));
}

/**
 * Convert integer stroops back to a floating-point unit amount.
 */
export function fromStroops(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}

/**
 * Validate a Dutch auction schedule.
 *
 * Rejects:
 * - Unparseable / NaN ISO dates ('invalid_time')
 * - Schedules where start >= end or duration is non-positive ('non_positive_duration')
 * - Negative or non-finite start/floor prices ('negative_price')
 * - Floor price strictly greater than start price ('floor_above_start')
 */
export function validateSchedule(auction: AuctionScheduleInput): ScheduleValidationResult {
  const startMs = new Date(auction.startTime).getTime();
  const endMs = new Date(auction.endTime).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { ok: false, reason: 'invalid_time' };
  }

  if (endMs <= startMs) {
    return { ok: false, reason: 'non_positive_duration' };
  }

  if (
    !Number.isFinite(auction.startPrice) ||
    !Number.isFinite(auction.floorPrice) ||
    auction.startPrice < 0 ||
    auction.floorPrice < 0
  ) {
    return { ok: false, reason: 'negative_price' };
  }

  if (auction.floorPrice > auction.startPrice) {
    return { ok: false, reason: 'floor_above_start' };
  }

  return { ok: true };
}

/**
 * Compute the decaying Dutch auction price in integer stroops at a given timestamp `nowMs`.
 *
 * ## Integer Arithmetic & Rounding Rule
 * The price decays linearly from `startPrice` to `floorPrice` over the interval `[startTime, endTime]`.
 * To avoid IEEE 754 floating-point drift and ensure exact agreement with on-chain settlement,
 * all calculations use integer `bigint` arithmetic:
 *
 * ```
 * total = endMs - startMs
 * elapsed = clamp(nowMs - startMs, 0, total)
 * decay = ((startStroops - floorStroops) * elapsed) / total
 * price = startStroops - decay
 * ```
 *
 * **Rounding UP:** Truncating integer division on the subtrahend (`decay`) rounds down the
 * amount decayed, which mathematically rounds the remaining `price` **UP** to the nearest stroop:
 * `start - floor(decay) = ceil(start - decay)`.
 *
 * This ensures the buyer is never undercharged and the displayed price never understates what
 * will be submitted on-chain.
 *
 * ## Constraints Guaranteed
 * - **Monotonic:** For any valid schedule, `priceAt(a, t1) >= priceAt(a, t2)` whenever `t1 <= t2`.
 * - **Bounded:** `floorPrice <= priceAt(a, t) <= startPrice` in stroops for all `t`.
 * - **Pure:** No `Date.now()` is called; timestamp is passed in as `nowMs`.
 */
export function priceAt(auction: AuctionScheduleInput, nowMs: number): bigint {
  const validation = validateSchedule(auction);
  if (!validation.ok) {
    throw new Error(`Cannot compute price for invalid auction schedule: ${validation.reason}`);
  }

  if (!Number.isFinite(nowMs)) {
    throw new TypeError('nowMs must be a finite number');
  }

  const startMs = BigInt(new Date(auction.startTime).getTime());
  const endMs = BigInt(new Date(auction.endTime).getTime());
  const totalMs = endMs - startMs;
  const currentMs = BigInt(nowMs);

  const startStroops = toStroops(auction.startPrice);
  const floorStroops = toStroops(auction.floorPrice);

  if (currentMs <= startMs) {
    return startStroops;
  }
  if (currentMs >= endMs) {
    return floorStroops;
  }

  const elapsedMs = currentMs - startMs;
  const priceRange = startStroops - floorStroops;
  const decay = (priceRange * elapsedMs) / totalMs;

  return startStroops - decay;
}
