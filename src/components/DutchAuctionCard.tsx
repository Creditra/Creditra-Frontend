
import { useState, useEffect, useRef, useCallback } from 'react';
import type { DutchAuction } from '../types/dutchAuction';
import { computeEffectiveStatus } from '../types/dutchAuction';
import { COLOR, fmt } from '../utils/tokens';
import { PendingButton } from './PendingButton';

interface DutchAuctionCardProps {
  auction: DutchAuction;
  onPurchase?: (auctionId: string, price: number) => void;
}

const calculateCurrentPrice = (auction: DutchAuction): number => {
  const now = Date.now();
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();
  
  if (now < start) return auction.startPrice;
  if (now > end) return auction.floorPrice;
  
  const elapsed = now - start;
  const total = end - start;
  const progress = elapsed / total;
  
  return auction.startPrice - progress * (auction.startPrice - auction.floorPrice);
};

const formatTimeLeft = (endTime: string): string => {
  const now = Date.now();
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
  const [currentPrice, setCurrentPrice] = useState(calculateCurrentPrice(auction));
  const [timeLeft, setTimeLeft] = useState(formatTimeLeft(auction.endTime));
  const [effectiveStatus, setEffectiveStatus] = useState(() =>
    computeEffectiveStatus(auction),
  );
  const [isPurchasing, setIsPurchasing] = useState(false);
  const purchaseAttemptRef = useRef(0);

  useEffect(() => {
    if (effectiveStatus !== 'Active') return;

    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentPrice(calculateCurrentPrice(auction));
      setTimeLeft(formatTimeLeft(auction.endTime));

      const status = computeEffectiveStatus(auction, now);
      setEffectiveStatus(status);

      if (status !== 'Active') {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [auction, effectiveStatus]);

  const handlePurchase = useCallback(async () => {
    if (effectiveStatus !== 'Active' || isPurchasing) return;

    const attemptId = ++purchaseAttemptRef.current;
    setIsPurchasing(true);

    try {
      await onPurchase?.(auction.id, currentPrice);
    } finally {
      if (purchaseAttemptRef.current === attemptId) {
        setIsPurchasing(false);
      }
    }
  }, [effectiveStatus, isPurchasing, onPurchase, auction.id, currentPrice]);

  const isEnded = effectiveStatus === 'Completed' || effectiveStatus === 'Cancelled';

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
                background: effectiveStatus === 'Active'
                  ? 'rgba(63,185,80,0.16)'
                  : effectiveStatus === 'Completed'
                  ? 'rgba(88,166,255,0.16)'
                  : 'rgba(248,81,73,0.16)',
                color: effectiveStatus === 'Active'
                  ? '#8ee99d'
                  : effectiveStatus === 'Completed'
                  ? '#58a6ff'
                  : '#ffb0aa',
              }}
            >
              {effectiveStatus}
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
                {effectiveStatus === 'Active' ? fmt(currentPrice) : auction.finalPrice ? fmt(auction.finalPrice) : '-'}
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
            {effectiveStatus === 'Active' && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>
                  Time Left
                </p>
                <p style={{ margin: 0, color: COLOR.warning, fontSize: '1rem', fontWeight: 600 }}>
                  {timeLeft}
                </p>
              </div>
            )}
            {effectiveStatus === 'Completed' && auction.winner && (
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

          {effectiveStatus === 'Active' && (
            <div style={{ marginTop: '1rem' }}>
              <PendingButton
                pending={isPurchasing}
                pendingLabel="Processing purchase…"
                onClick={handlePurchase}
                style={{ width: '100%' }}
              >
                Purchase Now for {fmt(currentPrice)}
              </PendingButton>
            </div>
          )}

          {isEnded && auction.status === 'Active' && (
            <div
              style={{ marginTop: '1rem' }}
              role="status"
              aria-live="polite"
            >
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.85rem' }}>
                This auction has ended.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
