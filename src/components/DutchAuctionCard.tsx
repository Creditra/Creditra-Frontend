import React, { useState, useEffect } from 'react';
import type { DutchAuction } from '../types/dutchAuction';
import { COLOR, fmt } from '../utils/tokens';
import { PendingButton } from './PendingButton';
import { useWallet } from '../context/WalletContext';
import { canPurchase } from '../lib/dutch-auction-purchase';
import { purchaseAuction } from '../services/dutchAuctions';
import { EXPECTED_NETWORK } from '../utils/wallet';
import { LiveRegion } from './LiveRegion';
import { validateSchedule, priceAt, fromStroops } from '../lib/dutch-auction-pricing';

export interface DutchAuctionCardProps {
  auction: DutchAuction;
  onPurchase?: (auctionId: string, priceStroops: bigint) => void | Promise<void>;
}

const formatTimeLeft = (endTime: string): string => {
  const now = Date.now();
  const end = new Date(endTime).getTime();
  if (Number.isNaN(end)) return 'Unavailable';
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
  const validation = validateSchedule(auction);

  const [currentPriceStroops, setCurrentPriceStroops] = useState<bigint | null>(() => {
    if (!validation.ok) return null;
    try {
      return priceAt(auction, Date.now());
    } catch {
      return null;
    }
  });

  const [timeLeft, setTimeLeft] = useState<string>(() => formatTimeLeft(auction.endTime));

  let wallet: any = null;
  let status = 'disconnected';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const walletContext = useWallet();
    wallet = walletContext.wallet;
    status = walletContext.status;
  } catch {
    // Fallback when rendered outside WalletProvider (e.g. isolated component/page tests)
  }

  const [pending, setPending] = useState(false);
  const pendingRef = React.useRef(false);
  const [feedback, setFeedback] = useState('');
  const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite');

  // Update price and timer
  useEffect(() => {
    if (auction.status !== 'Active' || !validation.ok) return;

    const tick = () => {
      try {
        setCurrentPriceStroops(priceAt(auction, Date.now()));
      } catch {
        // preserve existing price if an unexpected tick error occurs
      }
      setTimeLeft(formatTimeLeft(auction.endTime));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [auction, validation.ok]);

  const purchaseCheck = canPurchase(auction, wallet, status);
  const helperId = `purchase-helper-${auction.id}`;

  const handlePurchase = async () => {
    if (pendingRef.current || !validation.ok) return; // guard concurrent calls & invalid schedules
    const check = canPurchase(auction, wallet, status);
    if (!check.ok) return; // should not happen as button disabled

    pendingRef.current = true;
    setPending(true);
    setFeedback('');
    try {
      const now = Date.now();
      const priceStroops = priceAt(auction, now);
      if (onPurchase) {
        await onPurchase(auction.id, priceStroops);
      } else {
        await purchaseAuction(auction.id, priceStroops);
      }
      setFeedback(`Purchased auction ${auction.id} for ${fmt(fromStroops(priceStroops))} USD!`);
      setPoliteness('assertive');
    } catch (e) {
      setFeedback('Purchase failed. Please try again.');
      setPoliteness('assertive');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  // Determine button state and helper text
  const currentPriceNum = currentPriceStroops !== null ? fromStroops(currentPriceStroops) : 0;
  let buttonDisabled = false;
  let buttonLabel = `Purchase Now for ${fmt(currentPriceNum)}`;
  let helperText = '';

  if (!wallet) {
    buttonLabel = 'Connect wallet to buy';
    // assume onClick of wallet connection handled elsewhere; keep enabled
  } else if (!purchaseCheck.ok) {
    if (purchaseCheck.reason === 'wrong_network') {
      buttonDisabled = true;
      helperText = `Switch to ${EXPECTED_NETWORK} to buy`;
    } else if (purchaseCheck.reason === 'own_auction') {
      buttonDisabled = true;
      helperText = 'You are the seller';
    } else if (purchaseCheck.reason === 'not_active') {
      buttonDisabled = true;
    }
  }

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <img
          width={120}
          height={120}
          loading="lazy"
          src={auction.nft.image}
          alt={auction.nft.name}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '8px',
            objectFit: 'cover',
            flexShrink: 0,
            background: COLOR.surface,
            border: `1px solid ${COLOR.border}`,
          }}
        />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: COLOR.text, fontSize: '1.1rem' }}>{auction.nft.name}</h3>
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
                background:
                  auction.status === 'Active'
                    ? 'rgba(63,185,80,0.16)'
                    : auction.status === 'Completed'
                    ? 'rgba(88,166,255,0.16)'
                    : 'rgba(248,81,73,0.16)',
                color:
                  auction.status === 'Active'
                    ? '#8ee99d'
                    : auction.status === 'Completed'
                    ? '#58a6ff'
                    : '#ffb0aa',
              }}
            >
              {auction.status}
            </div>
          </div>
          <p style={{ margin: '0.5rem 0', color: COLOR.text, fontSize: '0.9rem' }}>{auction.nft.description}</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Current Price</p>
              <p style={{ margin: 0, color: COLOR.accent, fontSize: '1.25rem', fontWeight: 600 }}>
                {!validation.ok ? (
                  <span>
                    Pricing unavailable
                    <span
                      className="visually-hidden"
                      style={{
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        padding: 0,
                        margin: '-1px',
                        overflow: 'hidden',
                        clip: 'rect(0, 0, 0, 0)',
                        whiteSpace: 'nowrap',
                        border: 0,
                      }}
                    >
                      {` (${validation.reason})`}
                    </span>
                  </span>
                ) : auction.status === 'Active' && currentPriceStroops !== null ? (
                  fmt(fromStroops(currentPriceStroops))
                ) : auction.finalPrice ? (
                  fmt(auction.finalPrice)
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Start / Floor</p>
              <p style={{ margin: 0, color: COLOR.text, fontSize: '0.9rem' }}>
                {Number.isFinite(auction.startPrice) ? fmt(auction.startPrice) : '-'} /{' '}
                {Number.isFinite(auction.floorPrice) ? fmt(auction.floorPrice) : '-'}
              </p>
            </div>
            {auction.status === 'Active' && validation.ok && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Time Left</p>
                <p style={{ margin: 0, color: COLOR.warning, fontSize: '1rem', fontWeight: 600 }}>{timeLeft}</p>
              </div>
            )}
            {auction.status === 'Completed' && auction.winner && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Winner</p>
                <p style={{ margin: 0, color: COLOR.text, fontSize: '0.9rem' }}>
                  {`${auction.winner.slice(0, 6)}...${auction.winner.slice(-4)}`}
                </p>
              </div>
            )}
          </div>
          {auction.status === 'Active' && validation.ok && (
            <div style={{ marginTop: '1rem' }}>
              <PendingButton
                onClick={handlePurchase}
                pending={pending}
                pendingLabel="Purchasing…"
                disabled={buttonDisabled}
                aria-describedby={helperText ? helperId : undefined}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0.625rem 1rem',
                  borderRadius: '8px',
                  border: `1px solid ${COLOR.accent}`,
                  background: COLOR.accent,
                  color: COLOR.bg,
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: buttonDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {buttonLabel}
              </PendingButton>
              {helperText && (
                <p id={helperId} style={{ marginTop: '0.25rem', color: COLOR.muted, fontSize: '0.75rem' }}>
                  {helperText}
                </p>
              )}
              {feedback && <LiveRegion message={feedback} politeness={politeness} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
