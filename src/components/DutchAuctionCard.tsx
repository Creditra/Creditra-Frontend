
import React, { useState, useEffect, useRef } from 'react';
import type { DutchAuction } from '../types/dutchAuction';
import { COLOR, fmt } from '../utils/tokens';
import { PendingButton } from './PendingButton';
import { useWallet } from '../context/WalletContext';
import { canPurchase } from '../lib/dutch-auction-purchase';
import { purchaseAuction } from '../services/dutchAuctions';
import { EXPECTED_NETWORK } from '../utils/wallet';
import { LiveRegion } from './LiveRegion';
import { clearAlert, listAlerts, setAlert } from '../state/auctionAlerts';
import { getEffectiveStatus, type EffectiveDutchAuctionStatus } from '../lib/dutch-auction-lifecycle';

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

const formatTimeUntilStart = (startTime: string): string => {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const diff = start - now;
  
  if (diff <= 0) return '00:00:00';
  
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
  const [timeUntilStart, setTimeUntilStart] = useState(formatTimeUntilStart(auction.startTime));
  const [effectiveStatus, setEffectiveStatus] = useState<EffectiveDutchAuctionStatus>(getEffectiveStatus(auction));
  const { wallet, status } = useWallet();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite');
  const [targetInput, setTargetInput] = useState('');
  const [alertError, setAlertError] = useState('');
  const [savedTarget, setSavedTarget] = useState<number | null>(() => listAlerts().find(item => item.auctionId === auction.id)?.targetStroops ?? null);
  const intervalRef = useRef<number | undefined>(undefined);

  // Update price, timer, and effective status
  useEffect(() => {
    const newStatus = getEffectiveStatus(auction);
    setEffectiveStatus(newStatus);

    // Only run interval for non-terminal states
    if (newStatus === 'Scheduled' || newStatus === 'Active') {
      intervalRef.current = window.setInterval(() => {
        const now = Date.now();
        const updatedStatus = getEffectiveStatus(auction, now);
        setEffectiveStatus(updatedStatus);
        setCurrentPrice(calculateCurrentPrice(auction));
        setTimeLeft(formatTimeLeft(auction.endTime));
        setTimeUntilStart(formatTimeUntilStart(auction.startTime));

        // Clear interval when reaching terminal state
        if (updatedStatus === 'Ended' || updatedStatus === 'Completed' || updatedStatus === 'Cancelled') {
          if (intervalRef.current !== undefined) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [auction]);

  const purchaseCheck = canPurchase(auction, wallet, status);
  const helperId = `purchase-helper-${auction.id}`;
  const alertId = `auction-alert-${auction.id}`;

  // Status badge configuration
  const getStatusConfig = (status: EffectiveDutchAuctionStatus) => {
    switch (status) {
      case 'Scheduled':
        return { label: 'Scheduled', bg: 'rgba(88,166,255,0.16)', color: '#58a6ff' };
      case 'Active':
        return { label: 'Active', bg: 'rgba(63,185,80,0.16)', color: '#8ee99d' };
      case 'Ended':
        return { label: 'Ended', bg: 'rgba(248,81,73,0.16)', color: '#ffb0aa' };
      case 'Completed':
        return { label: 'Completed', bg: 'rgba(88,166,255,0.16)', color: '#58a6ff' };
      case 'Cancelled':
        return { label: 'Cancelled', bg: 'rgba(248,81,73,0.16)', color: '#ffb0aa' };
    }
  };

  const statusConfig = getStatusConfig(effectiveStatus);

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
  const showPurchaseButton = effectiveStatus === 'Active';

  if (!wallet && showPurchaseButton) {
    buttonLabel = 'Connect wallet to buy';
    // assume onClick of wallet connection handled elsewhere; keep enabled
  } else if (showPurchaseButton && purchaseCheck.reason === 'wrong_network') {
    buttonDisabled = true;
    helperText = `Switch to ${EXPECTED_NETWORK} to buy`;
  } else if (showPurchaseButton && purchaseCheck.reason === 'own_auction') {
    buttonDisabled = true;
    helperText = 'You are the seller';
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
                background: statusConfig.bg,
                color: statusConfig.color,
              }}
            >
              {statusConfig.label}
            </div>
          </div>
          <p style={{ margin: '0.5rem 0', color: COLOR.text, fontSize: '0.9rem' }}>{auction.nft.description}</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>
                {effectiveStatus === 'Scheduled' ? 'Opening Price' : effectiveStatus === 'Ended' ? 'Final Asking Price' : 'Current Price'}
              </p>
              <p style={{ margin: 0, color: COLOR.accent, fontSize: '1.25rem', fontWeight: 600 }}>
                {effectiveStatus === 'Scheduled' 
                  ? fmt(auction.startPrice) 
                  : effectiveStatus === 'Ended'
                  ? fmt(auction.floorPrice)
                  : effectiveStatus === 'Active' 
                  ? fmt(currentPrice) 
                  : auction.finalPrice 
                  ? fmt(auction.finalPrice) 
                  : '-'}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Start / Floor</p>
              <p style={{ margin: 0, color: COLOR.text, fontSize: '0.9rem' }}>
                {fmt(auction.startPrice)} / {fmt(auction.floorPrice)}
              </p>
            </div>
            {effectiveStatus === 'Scheduled' && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Starts in</p>
                <p style={{ margin: 0, color: COLOR.warning, fontSize: '1rem', fontWeight: 600 }}>{timeUntilStart}</p>
              </div>
            )}
            {effectiveStatus === 'Active' && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Time Left</p>
                <p style={{ margin: 0, color: COLOR.warning, fontSize: '1rem', fontWeight: 600 }}>{timeLeft}</p>
              </div>
            )}
            {effectiveStatus === 'Ended' && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Status</p>
                <p style={{ margin: 0, color: COLOR.text, fontSize: '1rem', fontWeight: 600 }}>Auction ended</p>
              </div>
            )}
            {effectiveStatus === 'Completed' && auction.winner && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Winner</p>
                <p style={{ margin: 0, color: COLOR.text, fontSize: '0.9rem' }}>
                  {`${auction.winner.slice(0, 6)}...${auction.winner.slice(-4)}`}
                </p>
              </div>
            )}
          </div>
          {effectiveStatus === 'Active' && (
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
              {showPurchaseButton && (
                <>
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

