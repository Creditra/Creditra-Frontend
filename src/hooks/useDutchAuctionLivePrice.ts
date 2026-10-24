import { useEffect, useState } from 'react';
import type { DutchAuction } from '../types/dutchAuction';
import { calculateCurrentPrice, formatTimeLeft } from '../utils/dutchAuction';

export interface DutchAuctionLivePrice {
  /** Price a buyer pays at `now`. */
  currentPrice: number;
  /** `hh:mm:ss` countdown to the end of the window. */
  timeLeft: string;
  /** Timestamp the current price was computed from. */
  now: number;
}

/**
 * Ticking price + countdown for an active Dutch auction.
 *
 * Shared by the list card and the `/dutch-auctions/:auctionId` detail page so
 * both surfaces quote the same price at the same moment. The ticker only
 * runs while the auction is `Active`; settled auctions keep their recorded
 * values.
 */
export function useDutchAuctionLivePrice(auction: DutchAuction): DutchAuctionLivePrice {
  const [now, setNow] = useState(() => Date.now());
  const [currentPrice, setCurrentPrice] = useState(() => calculateCurrentPrice(auction));
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(auction.endTime));

  useEffect(() => {
    if (auction.status !== 'Active') return;

    const tick = () => {
      const timestamp = Date.now();
      setNow(timestamp);
      setCurrentPrice(calculateCurrentPrice(auction, timestamp));
      setTimeLeft(formatTimeLeft(auction.endTime, timestamp));
    };

    // Refresh immediately so a newly rendered auction does not show the
    // values of the previously rendered one for a full second.
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  return { currentPrice, timeLeft, now };
}
