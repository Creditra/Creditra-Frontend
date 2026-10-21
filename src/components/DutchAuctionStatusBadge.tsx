import type { DutchAuctionStatus } from '../types/dutchAuction';
import { COLOR } from '../utils/tokens';

/**
 * Status pill for a Dutch auction.
 *
 * Shared by the list card and the `/dutch-auctions/:auctionId` detail page
 * so an auction reads the same in both places.
 */
const STATUS_STYLES: Record<DutchAuctionStatus, { background: string; color: string }> = {
  Active: { background: 'rgba(63,185,80,0.16)', color: '#8ee99d' },
  Completed: { background: 'rgba(88,166,255,0.16)', color: '#58a6ff' },
  Cancelled: { background: 'rgba(248,81,73,0.16)', color: '#ffb0aa' },
};

export function DutchAuctionStatusBadge({ status }: { status: DutchAuctionStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.Cancelled;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500,
        background: style.background,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}
