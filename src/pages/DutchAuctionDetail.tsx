import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useRouteHead } from '../components/RouteAnnouncer';
import { DutchAuctionPriceChart } from '../components/DutchAuctionPriceChart';
import { DutchAuctionPurchaseButton } from '../components/DutchAuctionPurchaseButton';
import { DutchAuctionStatusBadge } from '../components/DutchAuctionStatusBadge';
import { NoDataGraph } from '../components/illustrations';
import { getAuctionById } from '../data/mockDutchAuctions';
import { useDutchAuctionLivePrice } from '../hooks/useDutchAuctionLivePrice';
import type { DutchAuction } from '../types/dutchAuction';
import {
  AUCTION_ID_MAX_LENGTH,
  announceAuctionPurchase,
  getSettledPrice,
} from '../utils/dutchAuction';
import { shortenAddress } from '../utils/format-address';
import { COLOR, fmt, fmtDateTime } from '../utils/tokens';

const LIST_PATH = '/dutch-auctions';

/**
 * Resolve the "back to auctions" target.
 *
 * `from` is a query param on an untrusted URL, so only paths that point back
 * at the auctions list are accepted. Anything else (a protocol-relative URL,
 * an absolute URL, a path that escapes the list) falls back to the plain
 * list path.
 */
function resolveBackHref(from: string | null | undefined): string {
  if (!from) return LIST_PATH;
  if (from.startsWith('//')) return LIST_PATH;
  if (from !== LIST_PATH && !from.startsWith(`${LIST_PATH}?`)) return LIST_PATH;
  return from;
}

/**
 * Detail view of a single Dutch auction.
 *
 * Reachable at `/dutch-auctions/:auctionId`, so an auction can be linked to
 * and bookmarked. The route param is treated as untrusted input: it is
 * length-capped before the lookup and never interpolated into markup.
 */
export function DutchAuctionDetail() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [searchParams] = useSearchParams();
  const { setHead } = useRouteHead();

  const rawId = typeof auctionId === 'string' ? auctionId : '';

  const auction = useMemo<DutchAuction | undefined>(() => {
    // Cap the length before the lookup: an oversized id is never searched for.
    if (!rawId || rawId.length > AUCTION_ID_MAX_LENGTH) return undefined;
    return getAuctionById(rawId);
  }, [rawId]);

  useEffect(() => {
    if (!auction) return;

    setHead({
      title: `Creditra · ${auction.nft.name}`,
      description: `${auction.nft.name} — Dutch auction on ${auction.nft.collection}.`,
    });

    // Clear the override when leaving the page so other routes keep their own
    // title.
    return () => setHead(null);
  }, [auction, setHead]);

  const backHref = resolveBackHref(searchParams.get('from'));

  if (!auction) {
    return <AuctionNotFound backHref={backHref} />;
  }

  return <AuctionSummary auction={auction} backHref={backHref} />;
}

/**
 * Not-found state for an unknown auction id.
 *
 * Rendered inside the normal page layout (not the global 404) so a mistyped
 * link still offers a way back to the list.
 */
function AuctionNotFound({ backHref }: { backHref: string }) {
  return (
    <div className="dutch-auction-detail" style={{ padding: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '2.5rem 1rem',
          textAlign: 'center',
        }}
      >
        <NoDataGraph className="empty-state-illustration--muted" />
        <h1 style={{ margin: 0, color: COLOR.text, fontSize: '1.35rem' }}>Auction not found</h1>
        <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.9rem', maxWidth: '32rem' }}>
          We could not find a Dutch auction with that id. It may have been removed, or the link
          may be incomplete.
        </p>
        <Link
          to={backHref}
          style={{
            marginTop: '0.5rem',
            color: COLOR.accent,
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          Back to auctions
        </Link>
      </div>
    </div>
  );
}

/**
 * Full schedule, price curve and purchase action of one auction.
 */
function AuctionSummary({ auction, backHref }: { auction: DutchAuction; backHref: string }) {
  const { currentPrice, timeLeft, now } = useDutchAuctionLivePrice(auction);
  const isActive = auction.status === 'Active';
  const displayPrice = isActive ? currentPrice : getSettledPrice(auction);

  return (
    <div className="dutch-auction-detail" style={{ padding: '1rem' }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: '1rem' }}>
        <Link to={backHref} style={{ color: COLOR.accent, fontSize: '0.9rem' }}>
          Back to auctions
        </Link>
      </nav>

      <header
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
        }}
      >
        <img
          src={auction.nft.image}
          alt={auction.nft.name}
          style={{
            width: '160px',
            height: '160px',
            borderRadius: '8px',
            objectFit: 'cover',
            border: `1px solid ${COLOR.border}`,
          }}
        />
        <div style={{ flex: '1 1 15rem', minWidth: 0 }}>
          <h1 style={{ margin: 0, color: COLOR.text, fontSize: '1.5rem' }}>{auction.nft.name}</h1>
          <p style={{ margin: '0.35rem 0', color: COLOR.muted, fontSize: '0.9rem' }}>
            {auction.nft.collection} · Token #{auction.nft.tokenId}
          </p>
          <p style={{ margin: '0 0 0.5rem', color: COLOR.muted, fontSize: '0.9rem' }}>
            Seller: {shortenAddress(auction.seller)}
          </p>
          <DutchAuctionStatusBadge status={auction.status} />
        </div>
      </header>

      <section aria-labelledby="auction-schedule-title" style={{ marginBottom: '1.5rem' }}>
        <h2 id="auction-schedule-title" style={{ margin: '0 0 0.75rem', color: COLOR.text, fontSize: '1.1rem' }}>
          Schedule
        </h2>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
            gap: '1rem',
            margin: 0,
            padding: '1rem',
            border: `1px solid ${COLOR.border}`,
            borderRadius: '8px',
            background: COLOR.surface,
          }}
        >
          <div>
            <dt style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Start time</dt>
            <dd style={{ margin: '0.25rem 0 0', color: COLOR.text, fontSize: '0.95rem' }}>
              <time dateTime={auction.startTime}>{fmtDateTime(auction.startTime)}</time>
            </dd>
          </div>
          <div>
            <dt style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>End time</dt>
            <dd style={{ margin: '0.25rem 0 0', color: COLOR.text, fontSize: '0.95rem' }}>
              <time dateTime={auction.endTime}>{fmtDateTime(auction.endTime)}</time>
            </dd>
          </div>
          <div>
            <dt style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Start price</dt>
            <dd style={{ margin: '0.25rem 0 0', color: COLOR.text, fontSize: '0.95rem' }}>
              {fmt(auction.startPrice)}
            </dd>
          </div>
          <div>
            <dt style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Floor price</dt>
            <dd style={{ margin: '0.25rem 0 0', color: COLOR.text, fontSize: '0.95rem' }}>
              {fmt(auction.floorPrice)}
            </dd>
          </div>
          <div>
            <dt style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>
              {auction.status === 'Completed' ? 'Final price' : 'Current price'}
            </dt>
            <dd
              style={{
                margin: '0.25rem 0 0',
                color: isActive ? COLOR.accent : COLOR.text,
                fontSize: '1.15rem',
                fontWeight: 600,
              }}
            >
              {fmt(displayPrice)}
            </dd>
          </div>
          {isActive && (
            <div>
              <dt style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Time left</dt>
              <dd style={{ margin: '0.25rem 0 0', color: COLOR.warning, fontSize: '1rem', fontWeight: 600 }}>
                {timeLeft}
              </dd>
            </div>
          )}
          {auction.status === 'Completed' && auction.winner && (
            <div>
              <dt style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Winner</dt>
              <dd style={{ margin: '0.25rem 0 0', color: COLOR.text, fontSize: '0.95rem' }}>
                {shortenAddress(auction.winner)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="auction-chart-title" style={{ marginBottom: '1.5rem' }}>
        <h2 id="auction-chart-title" style={{ margin: '0 0 0.75rem', color: COLOR.text, fontSize: '1.1rem' }}>
          Price decay
        </h2>
        <div
          style={{
            padding: '1rem',
            border: `1px solid ${COLOR.border}`,
            borderRadius: '8px',
            background: COLOR.surface,
          }}
        >
          <DutchAuctionPriceChart auction={auction} now={now} />
        </div>
      </section>

      {isActive && (
        <section aria-labelledby="auction-purchase-title">
          <h2 id="auction-purchase-title" style={{ margin: '0 0 0.75rem', color: COLOR.text, fontSize: '1.1rem' }}>
            Purchase
          </h2>
          <DutchAuctionPurchaseButton
            auctionId={auction.id}
            price={currentPrice}
            onPurchase={announceAuctionPurchase}
          />
        </section>
      )}
    </div>
  );
}

export default DutchAuctionDetail;
