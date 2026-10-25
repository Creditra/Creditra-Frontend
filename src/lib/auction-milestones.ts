export interface AuctionMilestone {
  /** Threshold in milliseconds remaining. */
  remainingMs: number;
  /** Label used in announcements or descriptors. */
  label: string;
}

export const DEFAULT_AUCTION_MILESTONES: readonly AuctionMilestone[] = [
  { remainingMs: 15 * 60 * 1000, label: '15 minutes left' },
  { remainingMs: 5 * 60 * 1000, label: '5 minutes left' },
  { remainingMs: 1 * 60 * 1000, label: '1 minute left' },
  { remainingMs: 0, label: 'ended' },
] as const;

/**
 * Returns the latest milestone crossed between prevRemainingMs and nextRemainingMs.
 *
 * A milestone at T is crossed when:
 * prevRemainingMs > T and nextRemainingMs <= T.
 *
 * If multiple milestones are crossed in a single tick (e.g. throttled tab),
 * only the lowest remainingMs milestone (the latest / most urgent one) is returned.
 *
 * If no milestone is crossed, returns null.
 */
export function crossedMilestone(
  prevRemainingMs: number,
  nextRemainingMs: number,
  milestones: readonly AuctionMilestone[] = DEFAULT_AUCTION_MILESTONES
): AuctionMilestone | null {
  // Sort descending by remainingMs
  const sorted = [...milestones].sort((a, b) => b.remainingMs - a.remainingMs);

  let latestCrossed: AuctionMilestone | null = null;

  for (const m of sorted) {
    if (prevRemainingMs > m.remainingMs && nextRemainingMs <= m.remainingMs) {
      // Since sorted descending, subsequent crossed milestones have smaller remainingMs (more recent / closer to 0)
      latestCrossed = m;
    }
  }

  return latestCrossed;
}

/**
 * Format milestone message for screen reader announcements.
 */
export function formatMilestoneAnnouncement(
  nftName: string,
  milestone: AuctionMilestone,
  currentPriceFormatted: string
): string {
  if (milestone.remainingMs === 0) {
    return `${nftName} auction ended`;
  }
  return `${nftName}: ${milestone.label}, current price ${currentPriceFormatted}`;
}
