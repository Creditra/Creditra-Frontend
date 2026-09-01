
/**
 * Status of a Dutch auction.
 */
export type DutchAuctionStatus = 'Active' | 'Completed' | 'Cancelled';

/**
 * Represents an NFT for sale in a Dutch auction.
 */
export interface DutchAuctionNFT {
  id: string;
  name: string;
  description: string;
  image: string;
  collection: string;
  tokenId: string;
}

/**
 * Canonical Dutch auction shape.
 */
export interface DutchAuction {
  id: string;
  nft: DutchAuctionNFT;
  seller: string;
  startPrice: number;
  floorPrice: number;
  startTime: string;
  endTime: string;
  duration: number; // in seconds
  status: DutchAuctionStatus;
  winner?: string;
  finalPrice?: number;
}

/**
 * Compute the effective status of an auction at a given point in time,
 * accounting for clock-based close races.
 *
 * If the recorded status is already terminal (Completed / Cancelled), it is
 * returned as-is. Otherwise the current wall-clock is compared against
 * `endTime`: once the deadline passes the auction is treated as Completed
 * even if the stored status still reads Active.
 *
 * This prevents stale "Active" states and action buttons from lingering
 * after the auction has logically closed.
 */
export function computeEffectiveStatus(
  auction: DutchAuction,
  nowMs: number = Date.now(),
): DutchAuctionStatus {
  if (auction.status === 'Completed' || auction.status === 'Cancelled') {
    return auction.status;
  }

  const endTimeMs = new Date(auction.endTime).getTime();
  if (nowMs >= endTimeMs) {
    return 'Completed';
  }

  return 'Active';
}

