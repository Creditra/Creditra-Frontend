
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
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
import {
  validateSchedule,
  priceAt,
  fromStroops,
  toStroops,
} from '../lib/dutch-auction-pricing';
import { useDutchAuctionLivePrice } from '../hooks/useDutchAuctionLivePrice';
import { DutchAuctionStatusBadge } from './DutchAuctionStatusBadge';

export interface DutchAuctionCardProps {
  auction: DutchAuction;
  onPurchase?: (auctionId: string, priceStroops: bigint) => void | Promise<void>;
  /**
   * Query string of the auctions list this card is rendered in (e.g.
   * `?filter=active`). It is carried over to the detail page so the
   * "Back to auctions" link can restore the list exactly as it was.
   */
  listSearch?: string;
  /** Heading level for the NFT name. The detail page uses `h1`. */
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4';
  /** Set to false on the detail page so the title does not link to itself. */
  showDetailLink?: boolean;
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

export const DutchAuctionCard: React.FC<DutchAuctionCardProps> = ({
  auction,
  onPurchase,
  listSearch = '',
  headingLevel = 'h3',
  showDetailLink = true,
}) => {
  const validation = validateSchedule(auction);
  const { currentPriceStroops, timeLeft, timeUntilStart, effectiveStatus } =
    useDutchAuctionLivePrice(auction);
  const currentPrice = currentPriceStroops !== null ? fromStroops(currentPriceStroops) : 0;
  const [imageFailed, setImageFailed] = useState(false);
  const { wallet, status } = useWallet();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
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

  const purchaseCheck = canPurchase(auction, wallet, status);
  const helperId = `purchase-helper-${auction.id}`;
  const alertId = `auction-alert-${auction.id}`;
  const detailHref = buildAuctionDetailHref(auction.id, listSearch);
  const Heading = headingLevel;

  const handleSaveAlert = () => {
    const pricePattern = /^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/;
    const parsed = pricePattern.test(targetInput) ? Number(targetInput) : NaN;

    let targetStroops = 0;
    let floorStroops = 0;
    try {
      targetStroops = Number(toStroops(parsed));
      floorStroops = Number(toStroops(auction.floorPrice));
    } catch {
      targetStroops = 0;
      floorStroops = Number.POSITIVE_INFINITY;
    }

    const currentStroops = currentPriceStroops ?? 0n;
    if (
      !Number.isFinite(parsed) ||
      targetStroops < floorStroops ||
      BigInt(targetStroops) >= currentStroops
    ) {
      setAlertError(`Target must be between ${fmt(auction.floorPrice)} floor and ${fmt(currentPrice)} current price`);
      return;
    }
    setAlert(auction.id, targetStroops);
    setSavedTarget(targetStroops);
    setTargetInput('');
    setAlertError('');
  };

  const handlePurchase = async () => {
    if (pendingRef.current || !validation.ok) return; // guard concurrent calls & invalid schedules
    const check = canPurchase(auction, wallet, status);
    if (!check.ok) return; // should not happen as button disabled

    pendingRef.current = true;
    setPending(true);
    setFeedback('');
    try {
      // Price is computed in integer stroops at click time so the submitted
      // amount matches what the contract would settle.
      const priceStroops = priceAt(auction, Date.now());
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
  let buttonDisabled = false;
  let buttonLabel = `Purchase Now for ${fmt(currentPrice)}`;
  let helperText = '';
  const showPurchaseButton = effectiveStatus === 'Active' && validation.ok;

  if (!wallet && showPurchaseButton) {
    buttonLabel = 'Connect wallet to buy';
    // assume onClick of wallet connection handled elsewhere; keep enabled
  } else if (showPurchaseButton && !purchaseCheck.ok && purchaseCheck.reason === 'wrong_network') {
    buttonDisabled = true;
    helperText = `Switch to ${EXPECTED_NETWORK} to buy`;
  } else if (showPurchaseButton && !purchaseCheck.ok && purchaseCheck.reason === 'own_auction') {
    buttonDisabled = true;
    helperText = 'You are the seller';
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
              <Heading style={{ margin: 0, color: COLOR.text, fontSize: '1.1rem' }}>
                {showDetailLink ? (
                  <Link
                    to={detailHref}
                    style={{ color: COLOR.accent, textDecoration: 'none' }}
                  >
                    {auction.nft.name}
                  </Link>
                ) : (
                  auction.nft.name
                )}
              </Heading>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.85rem' }}>
                {auction.nft.collection} · Token #{auction.nft.tokenId}
              </p>
            </div>
            <DutchAuctionStatusBadge status={effectiveStatus} />
          </div>
          <p style={{ margin: '0.5rem 0', color: COLOR.text, fontSize: '0.9rem' }}>{auction.nft.description}</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>
                {effectiveStatus === 'Scheduled' ? 'Opening Price' : effectiveStatus === 'Ended' ? 'Final Asking Price' : 'Current Price'}
              </p>
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
                ) : effectiveStatus === 'Scheduled' 
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
                {Number.isFinite(auction.startPrice) ? fmt(auction.startPrice) : '-'} /{' '}
                {Number.isFinite(auction.floorPrice) ? fmt(auction.floorPrice) : '-'}
              </p>
            </div>
            {effectiveStatus === 'Scheduled' && (
              <div>
                <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.75rem' }}>Starts in</p>
                <p style={{ margin: 0, color: COLOR.warning, fontSize: '1rem', fontWeight: 600 }}>{timeUntilStart}</p>
              </div>
            )}
            {effectiveStatus === 'Active' && validation.ok && (
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
          {effectiveStatus === 'Active' && validation.ok && (
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
