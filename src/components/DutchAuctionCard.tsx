
import React, { useState, useEffect } from 'react';
import type { DutchAuction } from '../types/dutchAuction';
import { COLOR, fmt } from '../utils/tokens';
import { PendingButton } from './PendingButton';
import { useWallet } from '../context/WalletContext';
import { canPurchase } from '../lib/dutch-auction-purchase';
import { purchaseAuction } from '../services/dutchAuctions';
import { EXPECTED_NETWORK } from '../utils/wallet';
import { resolveNftImage } from '../utils/nft-image';
import { LiveRegion } from './LiveRegion';
import { clearAlert, listAlerts, setAlert } from '../state/auctionAlerts';
import { Image as ImageIcon } from 'lucide-react';

interface DutchAuctionCardProps {
  auction: DutchAuction;
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

export const DutchAuctionCard: React.FC<DutchAuctionCardProps> = ({ auction }) => {
  const [currentPrice, setCurrentPrice] = useState(calculateCurrentPrice(auction));
  const [timeLeft, setTimeLeft] = useState(formatTimeLeft(auction.endTime));
  const [imageFailed, setImageFailed] = useState(false);
  const { wallet, status } = useWallet();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite');
  const [targetInput, setTargetInput] = useState('');
  const [alertError, setAlertError] = useState('');
  const [savedTarget, setSavedTarget] = useState<number | null>(() => listAlerts().find(item => item.auctionId === auction.id)?.targetStroops ?? null);
  const image = resolveNftImage(auction.nft.image);
  const imageSrc = 'src' in image ? image.src : undefined;
  const imageLabel = `${auction.nft.name} from ${auction.nft.collection}`;
  const collectionInitials = auction.nft.collection
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('') || 'NFT';

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  // Update price and timer
  useEffect(() => {
    if (auction.status !== 'Active') return;
    const interval = setInterval(() => {
      setCurrentPrice(calculateCurrentPrice(auction));
      setTimeLeft(formatTimeLeft(auction.endTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  const purchaseCheck = canPurchase(auction, wallet, status);
  const helperId = `purchase-helper-${auction.id}`;
  const alertId = `auction-alert-${auction.id}`;

  const handleSaveAlert = () => {
    const pricePattern = /^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/;
    const parsed = pricePattern.test(targetInput) ? Number(targetInput) : NaN;
    const targetStroops = Math.round(parsed * 1e7);
    const floorStroops = Math.round(auction.floorPrice * 1e7);
    const currentStroops = Math.round(currentPrice * 1e7);
    if (!Number.isFinite(parsed) || targetStroops < floorStroops || targetStroops >= currentStroops) {
      setAlertError(`Target must be between ${fmt(auction.floorPrice)} floor and ${fmt(currentPrice)} current price`);
      return;
    }
    setAlert(auction.id, targetStroops);
    setSavedTarget(targetStroops);
    setTargetInput('');
    setAlertError('');
  };

  const handlePurchase = async () => {
    if (pending) return; // guard concurrent calls
    const check = canPurchase(auction, wallet, status);
    if (!check.ok) return; // should not happen as button disabled
    setPending(true);
    setFeedback('');
    try {
      await purchaseAuction(auction.id, Math.round(currentPrice * 1e7)); // price in stroops approximation
      setFeedback(`Purchased auction ${auction.id} for ${fmt(currentPrice)} USD!`);
      setPoliteness('assertive');
    } catch (e) {
      setFeedback('Purchase failed. Please try again.');
      setPoliteness('assertive');
    } finally {
      setPending(false);
    }
  };

  // Determine button state and helper text
  let buttonDisabled = false;
  let buttonLabel = `Purchase Now for ${fmt(currentPrice)}`;
  let helperText = '';
  if (!wallet) {
    buttonLabel = 'Connect wallet to buy';
    // assume onClick of wallet connection handled elsewhere; keep enabled
  } else if (purchaseCheck.reason === 'wrong_network') {
    buttonDisabled = true;
    helperText = `Switch to ${EXPECTED_NETWORK} to buy`;
  } else if (purchaseCheck.reason === 'own_auction') {
    buttonDisabled = true;
    helperText = 'You are the seller';
  } else if (purchaseCheck.reason === 'not_active') {
    // Do not render purchase button at all for inactive auctions
    return (
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        {/* existing UI above omitted for brevity */}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {imageSrc && !imageFailed ? (
          <img
            width={120}
            height={120}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            src={imageSrc}
            alt={imageLabel}
            onError={() => setImageFailed(true)}
            style={{
              width: '120px',
              height: '120px',
              boxSizing: 'border-box',
              borderRadius: '8px',
              objectFit: 'cover',
              flexShrink: 0,
              background: COLOR.surface,
              border: `1px solid ${COLOR.border}`,
            }}
          />
        ) : (
          <div
            role="img"
            aria-label={imageLabel}
            style={{
              width: '120px',
              height: '120px',
              boxSizing: 'border-box',
              borderRadius: '8px',
              flexShrink: 0,
              background: COLOR.surface,
              border: `1px solid ${COLOR.border}`,
              color: COLOR.accent,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <ImageIcon size={32} aria-hidden="true" />
            <span aria-hidden="true" style={{ color: COLOR.muted, fontSize: '0.8rem', fontWeight: 600 }}>
              {collectionInitials}
            </span>
          </div>
        )}
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
                background: auction.status === 'Active' ? 'rgba(63,185,80,0.16)' : auction.status === 'Completed' ? 'rgba(88,166,255,0.16)' : 'rgba(248,81,73,0.16)',
                color: auction.status === 'Active' ? '#8ee99d' : auction.status === 'Completed' ? '#58a6ff' : '#ffb0aa',
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
                {auction.status === 'Active' ? fmt(currentPrice) : auction.finalPrice ? fmt(auction.finalPrice) : '-'}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Start / Floor</p>
              <p style={{ margin: 0, color: COLOR.text, fontSize: '0.9rem' }}>
                {fmt(auction.startPrice)} / {fmt(auction.floorPrice)}
              </p>
            </div>
            {auction.status === 'Active' && (
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
          {auction.status === 'Active' && (
            <div style={{ marginTop: '1rem' }}>
              {savedTarget !== null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span>Alert at {fmt(savedTarget / 1e7)}</span>
                  <button type="button" onClick={() => { clearAlert(auction.id); setSavedTarget(null); }}>Remove</button>
                </div>
              ) : (
                <form aria-describedby={alertError ? `${alertId}-error` : undefined} onSubmit={event => { event.preventDefault(); handleSaveAlert(); }} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <label htmlFor={alertId}>Notify me at…</label>
                  <input id={alertId} type="text" inputMode="decimal" value={targetInput} onChange={event => { setTargetInput(event.target.value); setAlertError(''); }} />
                  <button type="submit">Save</button>
                  {alertError && <p id={`${alertId}-error`} role="alert" style={{ flexBasis: '100%', margin: 0, color: COLOR.danger }}>{alertError}</p>}
                </form>
              )}
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
