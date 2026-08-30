import React from 'react';
import type { DutchAuction } from '../types/dutchAuction';
import { COLOR, fmt } from '../utils/tokens';
import { PendingButton } from './PendingButton';
import { useLedgerTime } from '../hooks/useLedgerTime';

interface DutchAuctionCardProps {
  auction: DutchAuction;
  onPurchase?: (auctionId: string, price: number) => void;
}

const calculateCurrentPrice = (auction: DutchAuction, now: number): number => {
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();

  if (now < start) return auction.startPrice;
  if (now > end) return auction.floorPrice;

  const elapsed = now - start;
  const total = end - start;
  const progress = elapsed / total;

  return auction.startPrice - progress * (auction.startPrice - auction.floorPrice);
};

const formatTimeLeft = (endTime: string, now: number): string => {
  const end = new Date(endTime).getTime();
  const diff = end - now;

  if (diff <= 0) return 'Ended';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const h = hours;
  const m = minutes % 60;
  const s = seconds % 60;

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const DutchAuctionCard: React.FC<DutchAuctionCardProps> = ({ auction, onPurchase }) => {
  const { now, isSynced } = useLedgerTime();

  const currentPrice = calculateCurrentPrice(auction, now);
  const timeLeft = formatTimeLeft(auction.endTime, now);

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
            opacity: isSynced ? 1 : 0.7,
            transition: 'opacity 0.3s ease'
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: COLOR.text, fontSize: '1.1rem' }}>
                {auction.nft.name}
              </h3>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.85rem' }}>
                {auction.nft.collection} · Token #{auction.nft.tokenId}
              </p>
            </div>
            <div
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 500,
                background: auction.status === 'Active'
                  ? 'rgba(63,185,80,0.16)'
                  : auction.status === 'Completed'
                  ? 'rgba(88,166,255,0.16)'
                  : 'rgba(248,81,73,0.16)',
                color: auction.status === 'Active'
                  ? '#8ee99d'
                  : auction.status === 'Completed'
                  ? '#58a6ff'
                  : '#ffb0aa',
              }}
            >
              {auction.status}
            </div>
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
                  {isSynced ? 'Time Left' : 'Time Left (Syncing...)'}
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
                  {`${auction.winner.slice(0, 6)}...${auction.winner.slice(-4)}`}
                </p>
              </div>
            )}
          </div>

          {auction.status === 'Active' && (
            <div style={{ marginTop: '1rem' }}>
              <PendingButton
                onClick={() => onPurchase?.(auction.id, currentPrice)}
                style={{ width: '100%' }}
              >
                Purchase Now for {fmt(currentPrice)}
              </PendingButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
