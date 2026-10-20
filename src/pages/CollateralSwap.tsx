/**
 * CollateralSwap — page that lets users swap one collateral asset for another
 * within an existing credit line without closing and reopening the position.
 *
 * Loading state
 * ─────────────
 * While the credit-line and price data resolves, the page renders a skeleton
 * that mirrors the final card's height, padding, and border-radius exactly so
 * the layout does not jump when data arrives (Cumulative Layout Shift = 0).
 *
 * Shape parity (FWC26 — issue #834)
 * ──────────────────────────────────
 * Each skeleton element uses the same radius token as its counterpart in the
 * loaded state:
 *
 *   - Outer card    → shape="rectangular" (--skeleton-radius / --radius-md)
 *   - Asset rows    → shape="rectangular" (--radius-md, matching .collateral-swap__asset-row)
 *   - Asset icon    → shape="circular"    (50%, matching the circular asset icon)
 *   - Text lines    → shape="rounded"     (--radius-md for short text caps)
 *   - Direction dot → shape="circular"    (50%, matching the swap arrow circle)
 *   - Impact values → shape="rounded"
 *   - Confirm btn   → shape="rectangular" (--radius-md, matching the real button)
 *
 * Accessible markup
 * ─────────────────
 * The skeleton section is wrapped in a `<div role="status" aria-busy="true">`
 * so assistive technology announces a loading state without reading every
 * individual skeleton element. Each Skeleton primitive defaults to
 * `aria-hidden={true}` (decorative).
 *
 * GrantFox FWC26 — issue #834
 */

import React, { useState, useCallback } from 'react';
import { Skeleton } from '../components/Skeleton';
import './CollateralSwap.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type AssetId = string;

interface CollateralAsset {
  id: AssetId;
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
}

type SwapStatus = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

// ── Mock data (replaced by a real hook / API call in production) ──────────────

const MOCK_ASSETS: CollateralAsset[] = [
  { id: 'xlm',  symbol: 'XLM',  name: 'Stellar Lumens', balance: 12_500,  usdValue: 1875.00  },
  { id: 'usdc', symbol: 'USDC', name: 'USD Coin',        balance: 5_000,   usdValue: 5_000.00 },
  { id: 'wbtc', symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: 0.125,   usdValue: 8_237.50 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtUsd = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const fmtBalance = (balance: number, symbol: string): string =>
  `${balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${symbol}`;

// ── Sub-components ────────────────────────────────────────────────────────────

interface AssetRowProps {
  label: string;
  asset: CollateralAsset;
}

const AssetRow: React.FC<AssetRowProps> = ({ label, asset }) => (
  <div className="collateral-swap__asset-block">
    <span className="collateral-swap__asset-label">{label}</span>
    <div
      className="collateral-swap__asset-row"
      role="group"
      aria-label={`${label}: ${asset.name}`}
    >
      <div
        className="collateral-swap__asset-icon"
        role="img"
        aria-label={`${asset.symbol} icon`}
      />
      <div className="collateral-swap__asset-meta">
        <span className="collateral-swap__asset-name">{asset.name}</span>
        <span className="collateral-swap__asset-balance">
          {fmtBalance(asset.balance, asset.symbol)}
        </span>
      </div>
      <span className="collateral-swap__asset-value">{fmtUsd(asset.usdValue)}</span>
    </div>
  </div>
);

// ── Skeleton layout ───────────────────────────────────────────────────────────

/**
 * CollateralSwapSkeleton — first-paint placeholder for the swap form.
 *
 * All sizes are derived from the rendered geometry of the real form so that
 * the swap card height, padding, and border-radius are identical before and
 * after the data fetch resolves.
 */
const CollateralSwapSkeleton: React.FC = () => (
  /*
   * role="status" + aria-busy="true" notifies assistive technology that
   * content is loading without enumerating every skeleton line.
   * aria-label provides a meaningful announcement.
   */
  <div role="status" aria-busy="true" aria-label="Loading collateral swap">
    {/* Card container — matches .collateral-swap__card border-radius (--radius-lg) */}
    <div className="collateral-swap__card">
      <div className="collateral-swap__skeleton-section">
        {/* From asset row — matches .collateral-swap__asset-row min-height 72px */}
        <div className="collateral-swap__skeleton-asset-row">
          {/* Icon — circular, 40x40, matches .collateral-swap__asset-icon */}
          <Skeleton width={40} height={40} shape="circular" />
          <div className="collateral-swap__skeleton-asset-meta">
            {/* Asset name — matches font-size var(--text-base) ~20px cap height */}
            <Skeleton width="55%" height={14} shape="rounded" />
            {/* Balance — matches font-size var(--text-sm) ~12px cap height */}
            <Skeleton width="70%" height={10} shape="rounded" variant="subtle" />
          </div>
          {/* USD value — right-aligned, matches .collateral-swap__asset-value */}
          <Skeleton width={64} height={18} shape="rounded" />
        </div>

        {/* Direction indicator — matches .collateral-swap__skeleton-direction 40px */}
        <div className="collateral-swap__skeleton-direction">
          <Skeleton width={28} height={28} shape="circular" variant="subtle" />
        </div>

        {/* To asset row — same geometry as the From row */}
        <div className="collateral-swap__skeleton-asset-row">
          <Skeleton width={40} height={40} shape="circular" />
          <div className="collateral-swap__skeleton-asset-meta">
            <Skeleton width="45%" height={14} shape="rounded" />
            <Skeleton width="60%" height={10} shape="rounded" variant="subtle" />
          </div>
          <Skeleton width={64} height={18} shape="rounded" />
        </div>

        {/* Impact summary — matches .collateral-swap__skeleton-impact min-height 68px */}
        <div className="collateral-swap__skeleton-impact">
          {(['35%', '50%', '40%'] as const).map((w, i) => (
            <div key={i} className="collateral-swap__skeleton-impact-col">
              {/* Label row */}
              <Skeleton width={w} height={10} shape="rounded" variant="subtle" />
              {/* Value row */}
              <Skeleton width="80%" height={16} shape="rounded" />
            </div>
          ))}
        </div>

        {/* Confirm button — matches .collateral-swap__confirm-btn min-height 48px,
            shape="rectangular" matches --radius-md used on the real button */}
        <Skeleton width="100%" height={48} shape="rectangular" />
      </div>
    </div>
  </div>
);

// ── Main page component ───────────────────────────────────────────────────────

const CollateralSwap: React.FC = () => {
  /*
   * In production this status would come from a data-fetching hook.
   * The simulated delay lets the skeleton be observed during development.
   */
  const [status, setStatus] = useState<SwapStatus>('loading');
  const [fromAsset, setFromAsset] = useState<CollateralAsset>(MOCK_ASSETS[0]);
  const [toAsset, setToAsset]     = useState<CollateralAsset>(MOCK_ASSETS[1]);

  // Simulated data-fetch that resolves after a short delay.
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus('ready'), 1400);
    return () => clearTimeout(timer);
  }, []);

  const handleSwap = useCallback(async () => {
    if (status !== 'ready') return;
    setStatus('submitting');
    // Real implementation would call a blockchain transaction here.
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
    setStatus('success');
  }, [status]);

  const healthImpact = {
    before: '1.68',
    after: '1.52',
    fee: fmtUsd(fromAsset.usdValue * 0.002),
  };

  if (status === 'loading') {
    return (
      <main className="collateral-swap">
        <header className="collateral-swap__header">
          {/* Header skeletons — title and subtitle lines */}
          <Skeleton
            width="55%"
            height={28}
            shape="rounded"
            style={{ marginBottom: 'var(--space-2)' }}
          />
          <Skeleton width="80%" height={14} shape="rounded" variant="subtle" />
        </header>
        <CollateralSwapSkeleton />
      </main>
    );
  }

  return (
    <main className="collateral-swap">
      <header className="collateral-swap__header">
        <h1 className="collateral-swap__title">Swap Collateral</h1>
        <p className="collateral-swap__subtitle">
          Exchange one collateral asset for another without closing your credit line.
        </p>
      </header>

      <div className="collateral-swap__card" aria-label="Collateral swap form">
        <AssetRow label="From" asset={fromAsset} />

        <div className="collateral-swap__direction" aria-hidden="true">
          <span title="Swap direction">&#8597;</span>
        </div>

        <AssetRow label="To" asset={toAsset} />

        <div className="collateral-swap__impact" aria-label="Swap impact summary">
          <div className="collateral-swap__impact-item">
            <span className="collateral-swap__impact-label">Health before</span>
            <span className="collateral-swap__impact-value">{healthImpact.before}</span>
          </div>
          <div className="collateral-swap__impact-item">
            <span className="collateral-swap__impact-label">Health after</span>
            <span className="collateral-swap__impact-value">{healthImpact.after}</span>
          </div>
          <div className="collateral-swap__impact-item">
            <span className="collateral-swap__impact-label">Swap fee</span>
            <span className="collateral-swap__impact-value">{healthImpact.fee}</span>
          </div>
        </div>

        <button
          type="button"
          className="collateral-swap__confirm-btn"
          onClick={handleSwap}
          disabled={status === 'submitting' || status === 'success'}
          aria-busy={status === 'submitting'}
        >
          {status === 'submitting' ? 'Swapping...' : status === 'success' ? 'Swapped' : 'Confirm Swap'}
        </button>
      </div>
    </main>
  );
};

export default CollateralSwap;
