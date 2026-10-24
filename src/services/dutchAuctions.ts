import { delay } from '../utils/delay';

/**
 * Simulated purchase service for a Dutch auction.
 * Returns a promise that resolves after a short delay.
 * The delay can be overridden in tests via jest mock.
 *
 * @param auctionId - The auction identifier.
 * @param priceStroops - Price expressed in stroops (1e-7 of the quoted price).
 */
export async function purchaseAuction(auctionId: string, priceStroops: number): Promise<void> {
  // In production this would call a backend / Soroban contract.
  // Here we simulate a short async operation.
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
}
