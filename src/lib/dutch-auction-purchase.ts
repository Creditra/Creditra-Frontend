import { DutchAuction } from '../types/dutchAuction';
import { EXPECTED_NETWORK } from '../utils/wallet';
import { generateIdempotencyKey } from '../utils/idempotency';
import type { WalletInfo } from '../types/wallet';

/** A confirmed purchase returned by the auction purchase service. */
export interface PurchaseReceipt {
  auctionId: string;
  priceStroops: bigint;
  txId: string;
  /** Unix timestamp (ms) at which the purchase settled. */
  purchasedAt: number;
  idempotencyKey: string;
}

/** Options accepted by `purchaseAuction`. */
export interface PurchaseOptions {
  /** Aborts an in-flight purchase. */
  signal?: AbortSignal;
  /**
   * Stable key for this purchase attempt. Repeating a call with the same key
   * returns the original receipt instead of buying twice.
   */
  idempotencyKey?: string;
}

/**
 * Build the idempotency key for one purchase attempt. Call once per attempt
 * and reuse it across retries of that same attempt.
 */
export function createPurchaseIdempotencyKey(
  auctionId: string,
  priceStroops: bigint,
  initiatedAtMs: number = Date.now(),
): string {
  return generateIdempotencyKey({
    creditLineId: `dutch-auction:${auctionId}`,
    incomingAssetId: `stroops:${priceStroops.toString()}`,
    initiatedAtMs,
  });
}

export type PurchaseCheckResult =
  | { ok: true }
  | { ok: false; reason: 'no_wallet' | 'wrong_network' | 'own_auction' | 'not_active' };

/**
 * Determines whether the current user can purchase the given auction.
 *
 * - `no_wallet`: No wallet connected.
 * - `wrong_network`: Connected wallet is not on the expected network.
 * - `own_auction`: The connected account is the seller.
 * - `not_active`: Auction is not currently active (status not 'Active' or outside time window).
 */
export const canPurchase = (
  auction: DutchAuction,
  wallet: WalletInfo | null,
  _status?: string,
  nowMs: number = Date.now()
): PurchaseCheckResult => {
  if (!wallet) {
    return { ok: false, reason: 'no_wallet' };
  }

  if (wallet.network !== EXPECTED_NETWORK) {
    return { ok: false, reason: 'wrong_network' };
  }

  if (wallet.publicKey === auction.seller) {
    return { ok: false, reason: 'own_auction' };
  }

  // Active check – use explicit status if present, otherwise fall back to time bounds.
  if (auction.status !== 'Active') {
    return { ok: false, reason: 'not_active' };
  }

  const now = nowMs;
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();
  if (now < start || now > end) {
    return { ok: false, reason: 'not_active' };
  }

  return { ok: true };
};
