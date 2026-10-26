import { useEffect, useState } from 'react';
import type { DutchAuction } from '../types/dutchAuction';
import {
  getEffectiveStatus,
  type EffectiveDutchAuctionStatus,
} from '../lib/dutch-auction-lifecycle';
import { priceAt, validateSchedule } from '../lib/dutch-auction-pricing';
import { formatTimeLeft, formatTimeUntilStart } from '../utils/dutchAuction';

export interface DutchAuctionLivePrice {
  /** Price a buyer pays at `now`, in integer stroops (null for invalid schedules). */
  currentPriceStroops: bigint | null;
  /** `hh:mm:ss` countdown to the end of the window. */
  timeLeft: string;
  /** `hh:mm:ss` countdown to the start of the window. */
  timeUntilStart: string;
  /** Timestamp the current price was computed from. */
  now: number;
  /** Lifecycle state derived from the payload status and the clock. */
  effectiveStatus: EffectiveDutchAuctionStatus;
}

const calculateCurrentPriceStroops = (
  auction: DutchAuction,
  nowMs: number,
): bigint | null => {
  if (!validateSchedule(auction).ok) return null;

  try {
    return priceAt(auction, nowMs);
  } catch {
    return null;
  }
};

/**
 * Ticking price + countdown for a Dutch auction.
 *
 * Shared by the list card, the `/dutch-auctions/:auctionId` detail page and
 * its chart. Prices stay in integer stroops through the hook and are only
 * converted to display units by the consuming component.
 *
 * The ticker runs while the auction is `Scheduled` or `Active` and stops when
 * the effective status reaches a terminal state.
 */
export function useDutchAuctionLivePrice(auction: DutchAuction): DutchAuctionLivePrice {
  const [now, setNow] = useState(() => Date.now());
  const [currentPriceStroops, setCurrentPriceStroops] = useState<bigint | null>(() =>
    calculateCurrentPriceStroops(auction, Date.now()),
  );
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(auction.endTime));
  const [timeUntilStart, setTimeUntilStart] = useState(() =>
    formatTimeUntilStart(auction.startTime),
  );
  const [effectiveStatus, setEffectiveStatus] = useState<EffectiveDutchAuctionStatus>(() =>
    getEffectiveStatus(auction),
  );

  useEffect(() => {
    let interval: number | undefined;

    const update = (timestamp: number): EffectiveDutchAuctionStatus => {
      const nextStatus = getEffectiveStatus(auction, timestamp);
      setNow(timestamp);
      setEffectiveStatus(nextStatus);

      setCurrentPriceStroops(calculateCurrentPriceStroops(auction, timestamp));

      setTimeLeft(formatTimeLeft(auction.endTime, timestamp));
      setTimeUntilStart(formatTimeUntilStart(auction.startTime, timestamp));

      return nextStatus;
    };

    const initialStatus = update(Date.now());

    if (initialStatus === 'Scheduled' || initialStatus === 'Active') {
      interval = window.setInterval(() => {
        const nextStatus = update(Date.now());

        if (
          interval !== undefined &&
          (nextStatus === 'Ended' ||
            nextStatus === 'Completed' ||
            nextStatus === 'Cancelled')
        ) {
          clearInterval(interval);
          interval = undefined;
        }
      }, 1000);
    }

    return () => {
      if (interval !== undefined) {
        clearInterval(interval);
        interval = undefined;
      }
    };
  }, [auction]);

  return { currentPriceStroops, timeLeft, timeUntilStart, now, effectiveStatus };
}
