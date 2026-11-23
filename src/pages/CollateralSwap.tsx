/**
 * CollateralSwap — page that lets users swap one collateral asset for another
 * within an existing credit line without closing and reopening the position.
 *
 * Connected to real credit lines via `useCreditLines`, the collateral quote/LTV
 * engine in `src/utils/collateral.ts`, and confirmation handoff to
 * `CollateralSubstitutionModal`.
 *
 * Loading state (shape parity — issue #834)
 * ─────────────────────────────────────────
 * While credit-line data resolves, the page renders a skeleton that mirrors
 * the final card's height, padding, and border-radius so the layout does not
 * jump when data arrives (Cumulative Layout Shift = 0).
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { NoLines } from '../components/illustrations';
import { CollateralSubstitutionModal } from '../components/CollateralSubstitutionModal';
import { useCreditLines } from '../hooks/useCreditLines';
import type { CollateralAsset, SlippageTolerance } from '../types/collateral';
import {
  AVAILABLE_COLLATERAL_ASSETS,
  categoryIcon,
  computeLtvSnapshot,
  computeSubstitutionFee,
  DEFAULT_SLIPPAGE,
  findAssetByName,
  fmtLtv,
  fmtLtvDelta,
  isStaleQuote,
  SLIPPAGE_PRESETS,
  STALE_QUOTE_THRESHOLD_MS,
} from '../utils/collateral';
import './CollateralSwap.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtUsd = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

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
        aria-label={`${asset.ticker ?? asset.name} icon`}
      >
        <span aria-hidden="true">{categoryIcon(asset.category)}</span>
      </div>
      <div className="collateral-swap__asset-meta">
        <span className="collateral-swap__asset-name">{asset.name}</span>
        <span className="collateral-swap__asset-balance">
          Max LTV {fmtLtv(asset.maxLtvRatio)}
          {asset.ticker ? ` · ${asset.ticker}` : ''}
        </span>
      </div>
      <span className="collateral-swap__asset-value">{fmtUsd(asset.value)}</span>
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
  <div role="status" aria-busy="true" aria-label="Loading collateral swap">
    <div className="collateral-swap__card">
      <div className="collateral-swap__skeleton-section">
        <div className="collateral-swap__skeleton-asset-row">
          <Skeleton width={40} height={40} shape="circular" />
          <div className="collateral-swap__skeleton-asset-meta">
            <Skeleton width="55%" height={14} shape="rounded" />
            <Skeleton width="70%" height={10} shape="rounded" variant="subtle" />
          </div>
          <Skeleton width={64} height={18} shape="rounded" />
        </div>

        <div className="collateral-swap__skeleton-direction">
          <Skeleton width={28} height={28} shape="circular" variant="subtle" />
        </div>

        <div className="collateral-swap__skeleton-asset-row">
          <Skeleton width={40} height={40} shape="circular" />
          <div className="collateral-swap__skeleton-asset-meta">
            <Skeleton width="45%" height={14} shape="rounded" />
            <Skeleton width="60%" height={10} shape="rounded" variant="subtle" />
          </div>
          <Skeleton width={64} height={18} shape="rounded" />
        </div>

        <div className="collateral-swap__skeleton-impact">
          {(['35%', '50%', '40%'] as const).map((w, i) => (
            <div key={i} className="collateral-swap__skeleton-impact-col">
              <Skeleton width={w} height={10} shape="rounded" variant="subtle" />
              <Skeleton width="80%" height={16} shape="rounded" />
            </div>
          ))}
        </div>

        <Skeleton width="100%" height={48} shape="rectangular" />
      </div>
    </div>
  </div>
);

// ── Main page component ───────────────────────────────────────────────────────

const CollateralSwap: React.FC = () => {
  const { lines, status: creditStatus, error: creditError, refetch, setLines } = useCreditLines();

  const collateralizedLines = useMemo(
    () => lines.filter((line) => Boolean(line.collateral && line.collateral.trim().length > 0)),
    [lines],
  );

  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [selectedToAssetId, setSelectedToAssetId] = useState<string>('');
  const [swapAmountInput, setSwapAmountInput] = useState<string>('');
  const [slippage, setSlippage] = useState<SlippageTolerance>(DEFAULT_SLIPPAGE);
  const [quoteTimestampMs, setQuoteTimestampMs] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastSwappedAsset, setLastSwappedAsset] = useState<CollateralAsset | null>(null);

  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Active credit line (defaults to the first collateralized line).
  const selectedLine = useMemo(() => {
    if (collateralizedLines.length === 0) return null;
    return (
      collateralizedLines.find((line) => line.id === selectedLineId) ??
      collateralizedLines[0]
    );
  }, [collateralizedLines, selectedLineId]);

  // Sync swap amount input whenever the selected credit line changes.
  useEffect(() => {
    if (selectedLine) {
      setSwapAmountInput(String(selectedLine.utilized));
      setQuoteTimestampMs(Date.now());
      setNowMs(Date.now());
      setLastSwappedAsset(null);
    }
  }, [selectedLine?.id, selectedLine?.utilized]);

  // Derive the "from" asset from the selected line's collateral string.
  const fromAsset: CollateralAsset | null = useMemo(() => {
    if (!selectedLine) return null;
    const matched = findAssetByName(selectedLine.collateral);
    if (matched) return matched;
    return {
      id: `custom-${selectedLine.id}`,
      name: selectedLine.collateral ?? 'Current Collateral',
      value: Math.max(selectedLine.limit, selectedLine.utilized, 1),
      maxLtvRatio: 0.75,
      category: 'other',
    };
  }, [selectedLine]);

  // Candidate incoming assets exclude the currently pledged asset.
  const candidateAssets = useMemo(
    () => AVAILABLE_COLLATERAL_ASSETS.filter((asset) => asset.id !== fromAsset?.id),
    [fromAsset?.id],
  );

  const toAsset: CollateralAsset | null = useMemo(() => {
    if (candidateAssets.length === 0) return null;
    return (
      candidateAssets.find((asset) => asset.id === selectedToAssetId) ??
      candidateAssets[0]
    );
  }, [candidateAssets, selectedToAssetId]);

  // Parsed swap/loan amount (falls back to selectedLine.utilized when empty/invalid).
  const effectiveAmount = useMemo(() => {
    const parsed = Number(swapAmountInput);
    if (Number.isFinite(parsed) && parsed >= 0 && swapAmountInput.trim() !== '') {
      return parsed;
    }
    return selectedLine?.utilized ?? 0;
  }, [swapAmountInput, selectedLine?.utilized]);

  // Schedule a timer to mark the quote stale once STALE_QUOTE_THRESHOLD_MS elapses.
  useEffect(() => {
    const timer = setTimeout(() => {
      setNowMs(Date.now());
    }, STALE_QUOTE_THRESHOLD_MS + 50);
    return () => clearTimeout(timer);
  }, [quoteTimestampMs]);

  const quoteIsStale = isStaleQuote(quoteTimestampMs, nowMs);

  const handleLineChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLineId(e.target.value);
    const ts = Date.now();
    setQuoteTimestampMs(ts);
    setNowMs(ts);
    setLastSwappedAsset(null);
  }, []);

  const handleToAssetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedToAssetId(e.target.value);
    const ts = Date.now();
    setQuoteTimestampMs(ts);
    setNowMs(ts);
    setLastSwappedAsset(null);
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSwapAmountInput(e.target.value);
    const ts = Date.now();
    setQuoteTimestampMs(ts);
    setNowMs(ts);
    setLastSwappedAsset(null);
  }, []);

  const handleRefreshQuote = useCallback(() => {
    const ts = Date.now();
    setQuoteTimestampMs(ts);
    setNowMs(ts);
  }, []);

  // Compute LTV snapshots and fee via the collateral quote engine.
  const beforeSnapshot = useMemo(
    () => (fromAsset ? computeLtvSnapshot(fromAsset, effectiveAmount) : null),
    [fromAsset, effectiveAmount],
  );

  const afterSnapshot = useMemo(
    () => (toAsset ? computeLtvSnapshot(toAsset, effectiveAmount) : null),
    [toAsset, effectiveAmount],
  );

  const ltvDelta = useMemo(
    () =>
      beforeSnapshot && afterSnapshot
        ? fmtLtvDelta(beforeSnapshot, afterSnapshot)
        : null,
    [beforeSnapshot, afterSnapshot],
  );

  const fee = useMemo(
    () => (toAsset ? computeSubstitutionFee(effectiveAmount, toAsset) : null),
    [effectiveAmount, toAsset],
  );

  const isOverLtv = afterSnapshot?.isOverLtv ?? false;
  const isConfirmDisabled = !selectedLine || !fromAsset || !toAsset || isOverLtv || quoteIsStale;

  const handleOpenConfirmModal = useCallback(() => {
    if (isConfirmDisabled) return;
    const now = Date.now();
    if (isStaleQuote(quoteTimestampMs, now)) {
      setNowMs(now);
      return;
    }
    setIsModalOpen(true);
  }, [isConfirmDisabled, quoteTimestampMs]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleModalSuccess = useCallback(
    (incomingAsset: CollateralAsset) => {
      if (selectedLine) {
        setLines(
          lines.map((line) =>
            line.id === selectedLine.id
              ? { ...line, collateral: incomingAsset.name }
              : line,
          ),
        );
      }
      setLastSwappedAsset(incomingAsset);
      setIsModalOpen(false);
      const ts = Date.now();
      setQuoteTimestampMs(ts);
      setNowMs(ts);
    },
    [lines, selectedLine, setLines],
  );

  // ── Loading state ───────────────────────────────────────────────────────────

  if (creditStatus === 'loading' || creditStatus === 'idle') {
    return (
      <main className="collateral-swap">
        <header className="collateral-swap__header">
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

  // ── Error state ─────────────────────────────────────────────────────────────

  if (creditStatus === 'error') {
    return (
      <main className="collateral-swap">
        <header className="collateral-swap__header">
          <h1 className="collateral-swap__title">Swap Collateral</h1>
          <p className="collateral-swap__subtitle">
            Exchange one collateral asset for another without closing your credit line.
          </p>
        </header>
        <div className="collateral-swap__card collateral-swap__error" role="alert">
          <p className="collateral-swap__error-message">
            {creditError?.message ?? 'Unable to load your credit lines. Please try again.'}
          </p>
          <button
            type="button"
            className="collateral-swap__confirm-btn"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // ── Empty state (no credit line has collateral) ─────────────────────────────

  if (!selectedLine || !fromAsset || !toAsset || !beforeSnapshot || !afterSnapshot || !fee) {
    return (
      <main className="collateral-swap">
        <header className="collateral-swap__header">
          <h1 className="collateral-swap__title">Swap Collateral</h1>
          <p className="collateral-swap__subtitle">
            Exchange one collateral asset for another without closing your credit line.
          </p>
        </header>
        <EmptyState
          data-testid="collateral-swap-empty-state"
          illustration={<NoLines className="empty-state-illustration--muted" />}
          title="No collateralized credit lines"
          description="None of your credit lines currently have pledged collateral available to swap."
          primaryAction={{
            label: 'Refresh Credit Lines',
            onClick: () => void refetch(),
          }}
        />
      </main>
    );
  }

  // ── Ready state ─────────────────────────────────────────────────────────────

  return (
    <main className="collateral-swap">
      <header className="collateral-swap__header">
        <h1 className="collateral-swap__title">Swap Collateral</h1>
        <p className="collateral-swap__subtitle">
          Exchange one collateral asset for another without closing your credit line.
        </p>
      </header>

      <div className="collateral-swap__card" aria-label="Collateral swap form">
        {/* Credit line & amount controls */}
        <div className="collateral-swap__controls">
          <div className="collateral-swap__field">
            <label htmlFor="collateral-swap-line" className="collateral-swap__asset-label">
              Credit line
            </label>
            <select
              id="collateral-swap-line"
              className="collateral-swap__select"
              value={selectedLine.id}
              onChange={handleLineChange}
            >
              {collateralizedLines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name} ({line.collateral})
                </option>
              ))}
            </select>
          </div>

          <div className="collateral-swap__field">
            <label htmlFor="collateral-swap-amount" className="collateral-swap__asset-label">
              Loan balance (USD)
            </label>
            <input
              id="collateral-swap-amount"
              type="number"
              min={0}
              step="1000"
              className="collateral-swap__input"
              value={swapAmountInput}
              onChange={handleAmountChange}
            />
          </div>
        </div>

        <AssetRow label="From" asset={fromAsset} />

        <div className="collateral-swap__direction" aria-hidden="true">
          <span title="Swap direction">&#8597;</span>
        </div>

        {/* Target asset selector + summary */}
        <div className="collateral-swap__field">
          <label htmlFor="collateral-swap-to-asset" className="collateral-swap__asset-label">
            Target collateral asset
          </label>
          <select
            id="collateral-swap-to-asset"
            className="collateral-swap__select"
            value={toAsset.id}
            onChange={handleToAssetChange}
          >
            {candidateAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({fmtUsd(asset.value)} · Max LTV {fmtLtv(asset.maxLtvRatio)})
              </option>
            ))}
          </select>
        </div>

        <AssetRow label="To" asset={toAsset} />

        {/* Slippage tolerance presets */}
        <div className="collateral-swap__slippage">
          <span className="collateral-swap__asset-label" id="collateral-swap-slippage-label">
            Slippage tolerance
          </span>
          <div
            className="collateral-swap__slippage-chips"
            role="radiogroup"
            aria-labelledby="collateral-swap-slippage-label"
          >
            {SLIPPAGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={slippage === preset}
                className={`collateral-swap__slippage-chip${
                  slippage === preset ? ' collateral-swap__slippage-chip--active' : ''
                }`}
                onClick={() => setSlippage(preset)}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        {/* LTV & fee impact summary */}
        <div className="collateral-swap__impact" aria-label="Swap impact summary">
          <div className="collateral-swap__impact-item">
            <span className="collateral-swap__impact-label">Health before</span>
            <span className="collateral-swap__impact-value" data-testid="ltv-before">
              {fmtLtv(beforeSnapshot.ltvRatio)}
            </span>
          </div>
          <div className="collateral-swap__impact-item">
            <span className="collateral-swap__impact-label">Health after</span>
            <span
              className={`collateral-swap__impact-value${
                isOverLtv ? ' collateral-swap__impact-value--danger' : ''
              }`}
              data-testid="ltv-after"
            >
              {fmtLtv(afterSnapshot.ltvRatio)}
              {ltvDelta ? ` (${ltvDelta.text})` : ''}
            </span>
          </div>
          <div className="collateral-swap__impact-item">
            <span className="collateral-swap__impact-label">Swap fee</span>
            <span className="collateral-swap__impact-value" data-testid="swap-fee">
              {fmtUsd(fee.total)}
            </span>
          </div>
        </div>

        {/* Over-LTV blocking alert */}
        {isOverLtv && (
          <div
            className="collateral-swap__alert collateral-swap__alert--danger"
            role="alert"
            data-testid="over-ltv-alert"
          >
            Swap blocked: post-swap LTV ({fmtLtv(afterSnapshot.ltvRatio)}) exceeds the{' '}
            {fmtLtv(toAsset.maxLtvRatio)} liquidation threshold for {toAsset.name}. Choose a
            higher-value asset or reduce the loan balance.
          </div>
        )}

        {/* Stale quote alert */}
        {quoteIsStale && (
          <div
            className="collateral-swap__alert collateral-swap__alert--warning"
            role="alert"
            data-testid="stale-quote-alert"
          >
            <span>Quote expired. Refresh the quote before confirming your swap.</span>
            <button
              type="button"
              className="collateral-swap__refresh-btn"
              onClick={handleRefreshQuote}
            >
              Refresh quote
            </button>
          </div>
        )}

        {/* Success banner after modal completion */}
        {lastSwappedAsset && (
          <div
            className="collateral-swap__alert collateral-swap__alert--success"
            role="status"
            data-testid="swap-success-banner"
          >
            Collateral updated to {lastSwappedAsset.name} for {selectedLine.name}.
          </div>
        )}

        <button
          ref={confirmBtnRef}
          type="button"
          className="collateral-swap__confirm-btn"
          onClick={handleOpenConfirmModal}
          disabled={isConfirmDisabled}
          aria-disabled={isConfirmDisabled}
        >
          {isOverLtv
            ? 'Swap Blocked (Over LTV)'
            : quoteIsStale
              ? 'Quote Expired'
              : 'Confirm Swap'}
        </button>
      </div>

      {isModalOpen && (
        <CollateralSubstitutionModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          creditLineName={selectedLine.name}
          loanBalance={effectiveAmount}
          currentAsset={fromAsset}
          initialIncomingAsset={toAsset}
          initialSlippage={slippage}
          initialStep="confirm"
          triggerRef={confirmBtnRef}
        />
      )}
    </main>
  );
};

export default CollateralSwap;
