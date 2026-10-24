import { Link } from 'react-router-dom';
import type { DutchAuction } from '../types/dutchAuction';
import { COLOR, fmt } from '../utils/tokens';
import { shortenAddress } from '../utils/format-address';
import { DutchAuctionPurchaseButton } from './DutchAuctionPurchaseButton';
import { DutchAuctionStatusBadge } from './DutchAuctionStatusBadge';
import { useDutchAuctionLivePrice } from '../hooks/useDutchAuctionLivePrice';

interface DutchAuctionCardProps {
  auction: DutchAuction;
  onPurchase?: (auctionId: string, price: number) => void;
  /**
   * Query string of the auctions list this card is rendered in (e.g.
   * `?filter=active`). It is carried over to the detail page so the
   * "Back to auctions" link can restore the list exactly as it was.
   */
  listSearch?: string;
}

/**
 * Build the deep link to the detail page of an auction.
 *
 * The id is percent-encoded (it comes from the feed, but a link must never
 * carry a raw path segment), and the list query string is passed along as a
 * `from` parameter so the detail page can send the visitor back to the
 * list they came from.
 */
export const buildAuctionDetailHref = (auctionId: string, listSearch = ''): string => {
  const base = `/dutch-auctions/${encodeURIComponent(auctionId)}`;
  if (!listSearch) return base;

  return `${base}?from=${encodeURIComponent(`/dutch-auctions${listSearch}`)}`;
};

export function DutchAuctionCard({ auction, onPurchase, listSearch = '' }: DutchAuctionCardProps) {
  const { currentPrice, timeLeft } = useDutchAuctionLivePrice(auction);
  const detailHref = buildAuctionDetailHref(auction.id, listSearch);

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <img
          src={auction.nft.image}
          alt={auction.nft.name}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '8px',
            objectFit: 'cover',
            border: `1px solid ${COLOR.border}`,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: COLOR.text, fontSize: '1.1rem' }}>
                <Link
                  to={detailHref}
                  style={{ color: COLOR.accent, textDecoration: 'none' }}
                >
                  {auction.nft.name}
                </Link>
              </h3>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.85rem' }}>
                {auction.nft.collection} · Token #{auction.nft.tokenId}
              </p>
            </div>
            <DutchAuctionStatusBadge status={auction.status} />
          </div>

          <p style={{ margin: '0.5rem 0', color: COLOR.text, fontSize: '0.9rem' }}>
            {auction.nft.description}
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>
                Current Price
              </p>
              <p style={{ margin: 0, color: COLOR.accent, fontSize: '1.25rem', fontWeight: 600 }}>
                {auction.status === 'Active' ? fmt(currentPrice) : auction.finalPrice ? fmt(auction.finalPrice) : '-'}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>
                Start / Floor
              </p>
              <p style={{ margin: 0, color: COLOR.text, fontSize: '0.9rem' }}>
                {fmt(auction.startPrice)} / {fmt(auction.floorPrice)}
              </p>
            </div>
            {auction.status === 'Active' && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>
                  Time Left
                </p>
                <p style={{ margin: 0, color: COLOR.warning, fontSize: '1rem', fontWeight: 600 }}>
                  {timeLeft}
                </p>
              </div>
            )}
            {auction.status === 'Completed' && auction.winner && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>
                  Winner
                </p>
                <p style={{ margin: 0, color: COLOR.text, fontSize: '0.9rem' }}>
                  {shortenAddress(auction.winner)}
                </p>
              </div>
            )}
          </div>

          {auction.status === 'Active' && (
            <div style={{ marginTop: '1rem' }}>
              <DutchAuctionPurchaseButton
                auctionId={auction.id}
                price={currentPrice}
                onPurchase={onPurchase}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
