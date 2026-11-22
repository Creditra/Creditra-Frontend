/**
 * CollateralSubstitutionModal
 *
 * Three-step flow that lets a borrower swap one pledged collateral asset
 * for another. Steps:
 *
 *   1. Select   — pick the incoming asset from the catalogue
 *   2. Review   — side-by-side LTV comparison + fee breakdown + slippage tolerance
 *   3. Confirm  — type the incoming asset name to unlock submission
 *
 * Production-ready failure handling:
 *   - Idempotency: Deterministic request IDs prevent duplicate intents from retries
 *   - Slippage: user selects a tolerance; re-fetched LTV is checked before submit
 *   - Stale quotes: if the review snapshot is older than STALE_QUOTE_THRESHOLD_MS,
 *     a banner warns the user and the submit is blocked until they acknowledge
 *   - Retries: failed submissions can be retried up to MAX_RETRY_ATTEMPTS times
 *   - Error classification: network / validation / permission / timeout / slippage / unknown
 *   - Concurrent guard: a ref prevents double-submission even on rapid clicks
 *
 * Accessibility: focus trap, body-scroll lock, inert backdrop, ARIA dialog.
 * WCAG 2.1 AA — LTV changes communicated by color + numeric value + text.
 *
 * @see src/types/collateral.ts   — domain types including idempotency types
 * @see src/utils/collateral.ts   — pure helpers (LTV math, fee calc, slippage)
 * @see src/utils/idempotency.ts  — idempotency key generation and state tracking
 */
import React, { useCallback, useReducer, useRef } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import { PendingButton } from './PendingButton';
import type {
  CollateralAsset,
  SlippageTolerance,
  SubstitutionError,
  SubstitutionStep,
  CollateralSubstitutionIntent,
} from '../types/collateral';
import {
  AVAILABLE_COLLATERAL_ASSETS,
  categoryIcon,
  classifySubstitutionError,
  computeLtvSnapshot,
  computeSlippage,
  computeSubstitutionFee,
  fmtLtv,
  fmtLtvDelta,
  isStaleQuote,
  MAX_RETRY_ATTEMPTS,
  SLIPPAGE_PRESETS,
  STALE_QUOTE_THRESHOLD_MS,
} from '../utils/collateral';
import {
  createSubmissionAttempt,
  recordSubmissionAttempt,
  recordServerResponse,
  hasSucceeded,
  extractDiagnostics,
  type SubmissionAttempt,
} from '../utils/idempotency';
import { fmt } from '../utils/tokens';
import {
  canRetry as canRetryState,
  createInitialState,
  isSubmitting as isSubmittingState,
  reducer as collateralSubstitutionReducer,
} from '../state/collateralSubstitution';
import './CollateralSubstitutionModal.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SubmitCollateralSwapPayload {
  idempotencyKey: string;
  creditLineName: string;
  outgoingAssetId?: string;
  incomingAssetId: string;
  loanBalance: number;
}

interface CollateralSubstitutionModalProps {
  /** Whether the modal is rendered and visible. */
  isOpen: boolean;
  /** Invoked when the user dismisses the modal without completing the flow. */
  onClose: () => void;
  /**
   * Invoked after a successful substitution submission.
   * The parent is responsible for refetching or updating its local state.
   *
   * @param incomingAsset  The asset that was pledged.
   */
  onSuccess: (incomingAsset: CollateralAsset) => void;
  /**
   * Invoked when a submission fails after all retries are exhausted.
   * The parent can use this for logging, analytics, or banner notifications.
   *
   * @param error  Classified error with reason, message, and retryability.
   */
  onError?: (error: SubstitutionError) => void;
  /** Human-readable credit-line name, shown in the header subtitle. */
  creditLineName: string;
  /** The credit line's outstanding loan balance in USD. */
  loanBalance: number;
  /**
   * The asset currently pledged against this credit line.
   * When `undefined` the modal still works; the left card shows "None".
   */
  currentAsset?: CollateralAsset;
  /** Ref to the trigger button so focus returns correctly on close. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /**
   * Optional submission handler for performing the collateral swap.
   * Receives the substitution payload including the deterministic `idempotencyKey`.
   * Defaults to resolving after `_delayMs` ms (never fails by default).
   * Pass a custom implementation in production to call the backend API, or in
   * tests to deterministically simulate failures and verify retry behavior.
   */
  submitCollateralSwap?: (payload: SubmitCollateralSwapPayload) => Promise<void>;
  /**
   * Simulated network delay in ms for the default submission Promise.
   * Defaults to 1800. Override in tests to keep them fast.
   * @internal
   */
  _delayMs?: number;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: { id: SubstitutionStep; label: string; n: number }[] = [
  { id: 'select',  label: 'Select',  n: 1 },
  { id: 'review',  label: 'Review',  n: 2 },
  { id: 'confirm', label: 'Confirm', n: 3 },
];

function Stepper({ current }: { current: SubstitutionStep }) {
  return (
    <div className="csm-stepper" aria-label="Progress">
      {STEPS.map((step, i) => {
        const stepIndex = STEPS.findIndex(s => s.id === current);
        const isDone   = i < stepIndex;
        const isActive = step.id === current;
        return (
          <React.Fragment key={step.id}>
            {i > 0 && <div className="csm-step-divider" aria-hidden="true" />}
            <div
              className={`csm-step ${isActive ? 'csm-step--active' : ''} ${isDone ? 'csm-step--done' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="csm-step-dot" aria-hidden="true">
                {isDone ? '✓' : step.n}
              </span>
              <span>{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── LTV progress bar helper ──────────────────────────────────────────────────

function LtvBar({
  ltvRatio,
  maxLtvRatio,
}: {
  ltvRatio: number;
  maxLtvRatio: number;
}) {
  const fillPct  = Math.min(ltvRatio * 100, 100);
  const isOver   = ltvRatio > maxLtvRatio;
  const fillColor = isOver ? 'var(--error)' : ltvRatio > maxLtvRatio * 0.85
    ? 'var(--warning)' : 'var(--success)';

  return (
    <div
      className="csm-ltv-bar"
      role="progressbar"
      aria-valuenow={Math.round(ltvRatio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`LTV: ${fmtLtv(ltvRatio)} of ${fmtLtv(maxLtvRatio)} max`}
    >
      <div
        className="csm-ltv-fill"
        style={{ width: `${fillPct}%`, background: fillColor }}
      />
    </div>
  );
}

// ─── Asset card (comparison side) ────────────────────────────────────────────

function AssetCard({
  asset,
  loanBalance,
  variant,
}: {
  asset: CollateralAsset | undefined;
  loanBalance: number;
  variant: 'current' | 'incoming';
}) {
  const snap = asset ? computeLtvSnapshot(asset, loanBalance) : null;

  return (
    <div className={`csm-asset-card csm-asset-card--${variant}`}>
      <span className={`csm-asset-card-badge csm-asset-card-badge--${variant}`}>
        {variant === 'current' ? 'Current' : 'Incoming'}
      </span>

      <div>
        <p className="csm-asset-card-name">
          {asset ? asset.name : 'None'}
        </p>
        {asset?.ticker && (
          <span className="csm-asset-card-ticker">{asset.ticker}</span>
        )}
      </div>

      <hr className="csm-asset-card-divider" />

      <div className="csm-asset-card-rows">
        <div className="csm-asset-card-row">
          <span className="csm-asset-card-row-label">Value</span>
          <span className="csm-asset-card-row-value">
            {asset ? fmt(asset.value) : '—'}
          </span>
        </div>
        <div className="csm-asset-card-row">
          <span className="csm-asset-card-row-label">LTV</span>
          <span
            className={`csm-asset-card-row-value ${snap?.isOverLtv ? 'csm-asset-card-row-value--over-ltv' : ''}`}
          >
            {snap ? fmtLtv(snap.ltvRatio) : '—'}
          </span>
        </div>
        <div className="csm-asset-card-row">
          <span className="csm-asset-card-row-label">Max LTV</span>
          <span className="csm-asset-card-row-value">
            {asset ? fmtLtv(asset.maxLtvRatio) : '—'}
          </span>
        </div>
        <div className="csm-asset-card-row">
          <span className="csm-asset-card-row-label">Headroom</span>
          <span className="csm-asset-card-row-value">
            {snap ? fmt(Math.max(snap.availableHeadroom, 0)) : '—'}
          </span>
        </div>
      </div>

      {snap && (
        <LtvBar ltvRatio={snap.ltvRatio} maxLtvRatio={asset!.maxLtvRatio} />
      )}
    </div>
  );
}

// ─── Slippage tolerance selector ──────────────────────────────────────────────

function SlippageSelector({
  value,
  onChange,
  disabled,
}: {
  value: SlippageTolerance;
  onChange: (tolerance: SlippageTolerance) => void;
  disabled?: boolean;
}) {
  return (
    <div className="csm-slippage-section">
      <p className="csm-slippage-label" id="csm-slippage-label">
        Slippage tolerance
      </p>
      <p className="csm-slippage-hint">
        If the collateral LTV drifts beyond this tolerance before submission,
        the transaction will be blocked to protect you from adverse price moves.
      </p>
      <div
        className="csm-slippage-chips"
        role="radiogroup"
        aria-labelledby="csm-slippage-label"
      >
        {SLIPPAGE_PRESETS.map(preset => (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={value === preset}
            disabled={disabled}
            className={`csm-slippage-chip ${value === preset ? 'csm-slippage-chip--active' : ''}`}
            onClick={() => onChange(preset)}
          >
            {preset}%
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Select ───────────────────────────────────────────────────────────

function SelectStep({
  current,
  selected,
  onSelect,
  loanBalance,
}: {
  current: CollateralAsset | undefined;
  selected: CollateralAsset | null;
  onSelect: (asset: CollateralAsset) => void;
  loanBalance: number;
}) {
  const candidates = AVAILABLE_COLLATERAL_ASSETS.filter(
    a => a.id !== current?.id,
  );

  return (
    <div className="csm-body">
      <p className="csm-select-heading">
        Choose the asset you want to pledge as collateral
      </p>
      <ul className="csm-asset-list" role="listbox" aria-label="Available collateral assets">
        {candidates.map(asset => {
          const snap     = computeLtvSnapshot(asset, loanBalance);
          const isChosen = selected?.id === asset.id;
          return (
            <li key={asset.id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={isChosen}
                className={`csm-asset-option ${isChosen ? 'csm-asset-option--selected' : ''}`}
                onClick={() => onSelect(asset)}
              >
                <span className="csm-asset-option-icon" aria-hidden="true">
                  {categoryIcon(asset.category)}
                </span>
                <span className="csm-asset-option-info">
                  <span className="csm-asset-option-name">{asset.name}</span>
                  <span className="csm-asset-option-meta">
                    {asset.ticker && <span>{asset.ticker}</span>}
                    <span>Value: {fmt(asset.value)}</span>
                  </span>
                </span>
                <span className="csm-asset-option-value">
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                    {fmtLtv(snap.ltvRatio)}
                  </span>
                  <span className="csm-asset-option-ltv">
                    Max {fmtLtv(asset.maxLtvRatio)}
                  </span>
                </span>
                {isChosen && (
                  <span className="csm-asset-check" aria-hidden="true">✓</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Step 2: Review ───────────────────────────────────────────────────────────

function ReviewStep({
  current,
  incoming,
  loanBalance,
  slippageTolerance,
  onSlippageChange,
  disabled,
}: {
  current: CollateralAsset | undefined;
  incoming: CollateralAsset;
  loanBalance: number;
  slippageTolerance: SlippageTolerance;
  onSlippageChange: (tolerance: SlippageTolerance) => void;
  disabled?: boolean;
}) {
  const outSnap = current ? computeLtvSnapshot(current, loanBalance) : null;
  const inSnap  = computeLtvSnapshot(incoming, loanBalance);
  const fee     = computeSubstitutionFee(loanBalance, incoming);
  const delta   = outSnap ? fmtLtvDelta(outSnap, inSnap) : null;

  return (
    <div className="csm-body">
      {/* Side-by-side comparison */}
      <section aria-labelledby="csm-compare-heading">
        <h3 id="csm-compare-heading" className="csm-select-heading">
          Collateral comparison
        </h3>
        <div className="csm-compare">
          <AssetCard asset={current} loanBalance={loanBalance} variant="current" />

          {/* Arrow + delta */}
          <div className="csm-arrow-col" aria-hidden="true">
            <ArrowRight className="csm-arrow-icon" size={22} />
            {delta && (
              <span
                className={`csm-delta-pill csm-delta-pill--${
                  delta.isImprovement ? 'improvement' : 'degradation'
                }`}
              >
                {delta.text}
              </span>
            )}
          </div>

          <AssetCard asset={incoming} loanBalance={loanBalance} variant="incoming" />
        </div>

        {/* Screen-reader summary of the delta */}
        {delta && (
          <p className="sr-only" aria-live="polite">
            LTV change: {delta.text}.{' '}
            {delta.isImprovement ? 'This is an improvement.' : 'This increases your LTV.'}
          </p>
        )}
      </section>

      {/* Over-LTV warning */}
      {inSnap.isOverLtv && (
        <div className="csm-warning" role="alert">
          <AlertTriangle className="csm-warning-icon" size={18} aria-hidden="true" />
          <div>
            <p className="csm-warning-title">LTV exceeds the maximum for this asset</p>
            <p className="csm-warning-body">
              Your outstanding balance of {fmt(loanBalance)} exceeds the maximum
              LTV for {incoming.name} ({fmtLtv(incoming.maxLtvRatio)}).
              You may need to repay a portion of your balance before proceeding.
            </p>
          </div>
        </div>
      )}

      {/* Slippage tolerance selector */}
      <SlippageSelector
        value={slippageTolerance}
        onChange={onSlippageChange}
        disabled={disabled}
      />

      {/* Fee breakdown */}
      <section aria-labelledby="csm-fee-heading">
        <div className="csm-fee-box">
          <p className="csm-fee-heading" id="csm-fee-heading">Substitution fees</p>
          <div className="csm-fee-row">
            <span className="csm-fee-row-label">Processing fee (0.5% of balance)</span>
            <span className="csm-fee-row-value">{fmt(fee.processingFee)}</span>
          </div>
          {fee.appraisalFee !== undefined && (
            <div className="csm-fee-row">
              <span className="csm-fee-row-label">Appraisal fee</span>
              <span className="csm-fee-row-value">{fmt(fee.appraisalFee)}</span>
            </div>
          )}
          <div className="csm-fee-divider" />
          <div className="csm-fee-total-row">
            <span className="csm-fee-total-label">Total due at submission</span>
            <span className="csm-fee-total-value">{fmt(fee.total)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Step 3: Confirm ──────────────────────────────────────────────────────────

function ConfirmStep({
  current,
  incoming,
  loanBalance,
  confirmText,
  onConfirmTextChange,
  classifiedError,
  isStale,
  onRefreshStale,
  retryCount,
  canRetry,
}: {
  current: CollateralAsset | undefined;
  incoming: CollateralAsset;
  loanBalance: number;
  confirmText: string;
  onConfirmTextChange: (v: string) => void;
  classifiedError: SubstitutionError | null;
  isStale: boolean;
  onRefreshStale: () => void;
  retryCount: number;
  canRetry: boolean;
}) {
  const fee        = computeSubstitutionFee(loanBalance, incoming);
  const targetText = incoming.name;
  const isMatch    = confirmText.trim().toLowerCase() === targetText.toLowerCase();
  const inputId    = 'csm-confirm-name-input';
  const hintId     = 'csm-confirm-hint';
  const maxRetries = MAX_RETRY_ATTEMPTS;

  return (
    <div className="csm-body">
      {/* Summary recap */}
      <section aria-labelledby="csm-confirm-summary-heading">
        <h3 id="csm-confirm-summary-heading" className="csm-select-heading">
          Review before confirming
        </h3>
        <dl className="csm-confirm-summary">
          <div className="csm-confirm-row">
            <dt className="csm-confirm-row-label">Replacing</dt>
            <dd className="csm-confirm-row-value">{current?.name ?? 'None'}</dd>
          </div>
          <div className="csm-confirm-row">
            <dt className="csm-confirm-row-label">New collateral</dt>
            <dd className="csm-confirm-row-value" style={{ color: 'var(--accent)' }}>
              {incoming.name}
            </dd>
          </div>
          <div className="csm-confirm-row">
            <dt className="csm-confirm-row-label">New LTV</dt>
            <dd className="csm-confirm-row-value">
              {fmtLtv(computeLtvSnapshot(incoming, loanBalance).ltvRatio)}
            </dd>
          </div>
          <div className="csm-confirm-row">
            <dt className="csm-confirm-row-label">Total fee</dt>
            <dd className="csm-confirm-row-value" style={{ color: 'var(--accent)' }}>
              {fmt(fee.total)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Stale quote warning */}
      {isStale && (
        <div className="csm-warning" role="alert">
          <AlertTriangle className="csm-warning-icon" size={18} aria-hidden="true" />
          <div>
            <p className="csm-warning-title">Quote may be stale</p>
            <p className="csm-warning-body">
              This quote is over {Math.round(STALE_QUOTE_THRESHOLD_MS / 1000)} seconds old.
              Collateral prices may have changed since you reviewed the comparison.
            </p>
            <button
              type="button"
              className="csm-btn csm-btn--ghost csm-btn--inline"
              onClick={onRefreshStale}
              style={{ marginTop: '0.5rem' }}
            >
              <RefreshCw size={14} aria-hidden="true" style={{ marginRight: '0.375rem' }} />
              Refresh quote
            </button>
          </div>
        </div>
      )}

      {/* Confirmation input */}
      <div className="csm-confirm-input-wrap">
        <label htmlFor={inputId} className="csm-confirm-label">
          Type <strong>{targetText}</strong> to confirm
        </label>
        <p id={hintId} className="csm-confirm-hint">
          This action is irreversible. Typing the asset name acknowledges that
          the substitution will be processed and the fee will be charged.
        </p>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          value={confirmText}
          onChange={e => onConfirmTextChange(e.target.value)}
          placeholder={targetText}
          aria-describedby={hintId}
          aria-invalid={confirmText.length > 0 && !isMatch}
          className={`csm-confirm-input ${isMatch && confirmText.length > 0 ? 'csm-confirm-input--valid' : ''}`}
        />
      </div>

      {/* Classified submission error */}
      {classifiedError && (
        <div
          className={`csm-error-alert csm-error-alert--${classifiedError.reason}`}
          role="alert"
        >
          <XCircle className="csm-error-icon" size={18} aria-hidden="true" />
          <div>
            <p className="csm-error-title">
              Submission failed
              {retryCount > 0 && (
                <span className="csm-error-retry-count">
                  {' '}(attempt {retryCount} of {maxRetries})
                </span>
              )}
            </p>
            <p className="csm-error-body">{classifiedError.message}</p>
            {canRetry && (
              <p className="csm-error-hint">
                You can retry up to {maxRetries - retryCount} more time{maxRetries - retryCount !== 1 ? 's' : ''}.
              </p>
            )}
            {!classifiedError.retryable && (
              <p className="csm-error-hint">
                This error is not retryable. Please adjust your selection or contact support.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessView({
  incoming,
  onClose,
}: {
  incoming: CollateralAsset;
  onClose: () => void;
}) {
  return (
    <div className="csm-success">
      <div className="csm-success-icon" aria-hidden="true">
        <CheckCircle color="var(--bg)" size={32} strokeWidth={2.5} />
      </div>
      <p className="csm-success-title">Collateral substituted</p>
      <p className="csm-success-body">
        <strong>{incoming.name}</strong> is now pledged as collateral.
        Your credit line has been updated and the fee has been queued for processing.
      </p>
      <button type="button" className="csm-btn csm-btn--primary" onClick={onClose}>
        Done
      </button>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

/**
 * CollateralSubstitutionModal
 *
 * Orchestrates the three-step substitution flow with production-ready
 * failure handling: slippage tolerance, stale-quote detection, retry
 * logic, error classification, and concurrent submission protection.
 *
 * All async state is managed here; child steps are stateless.
 */
export function CollateralSubstitutionModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  creditLineName,
  loanBalance,
  currentAsset,
  triggerRef,
  submitCollateralSwap,
  _delayMs = 1800,
}: CollateralSubstitutionModalProps) {
  const modalId = 'collateral-substitution-modal';

  // The reducer owns the complete modal lifecycle. Each phase carries only
  // the data valid for that phase, so submitting cannot coexist with a stale quote.
  const [state, dispatch] = useReducer(collateralSubstitutionReducer, undefined, createInitialState);
  const selected = state.selectedAsset;
  const confirmText = state.confirmText;
  const slippageTolerance = state.slippageTolerance;
  const step: SubstitutionStep =
    state.phase === 'selecting' || state.phase === 'quoting'
      ? 'select'
      : state.phase === 'reviewing'
        ? state.step
        : 'confirm';
  const reviewLtvRatio = 'quote' in state ? state.quote.ltvRatio : null;
  const reviewTimestampMs = 'quote' in state ? state.quote.timestampMs : null;
  const staleQuoteDetected = state.phase === 'reviewing' && state.staleQuote;
  const classifiedError = state.phase === 'error' ? state.error : null;
  const retryCount = 'retryCount' in state ? state.retryCount : 0;
  const canRetry = canRetryState(state);
  const isPending = isSubmittingState(state);
  const isSuccess = state.phase === 'success';

  // Idempotency metadata remains a ref because it is not rendered UI state.
  const submissionAttemptRef = useRef<SubmissionAttempt | null>(null);
  const submittingRef = useRef(false);

  const handleClose = useCallback(() => {
    dispatch({ type: 'RESET' });
    submittingRef.current = false;
    submissionAttemptRef.current = null;
    onClose();
  }, [onClose]);

  // Accessibility hooks
  const containerRef = useFocusTrap({
    isActive: isOpen,
    triggerRef,
    onEscape: isPending ? undefined : handleClose,
  });
  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId });

  // Derived UI values
  const canProceedFromSelect = selected !== null;
  const isConfirmMatch =
    selected !== null &&
    confirmText.trim().toLowerCase() === selected.name.toLowerCase();
  const incomingSnap = selected ? computeLtvSnapshot(selected, loanBalance) : null;

  const handleSelectAsset = (asset: CollateralAsset) => {
    dispatch({ type: 'SELECT_ASSET', asset });
  };

  const handleNextFromSelect = () => {
    if (!selected || state.phase !== 'selecting') return;
    const snap = computeLtvSnapshot(selected, loanBalance);
    const nowMs = Date.now();
    dispatch({
      type: 'START_QUOTE',
      quote: { ltvRatio: snap.ltvRatio, timestampMs: nowMs },
    });
    dispatch({ type: 'QUOTE_RESOLVED', nowMs });
  };

  const handleNextFromReview = () => {
    dispatch({ type: 'CONTINUE_TO_CONFIRM', nowMs: Date.now() });
  };

  const handleBack = () => dispatch({ type: 'BACK' });

  const handleRefreshStale = () => {
    if (!selected || state.phase !== 'reviewing' || state.step !== 'confirm') return;
    const freshSnap = computeLtvSnapshot(selected, loanBalance);
    dispatch({
      type: 'REFRESH_QUOTE',
      quote: { ltvRatio: freshSnap.ltvRatio, timestampMs: Date.now() },
    });
  };

  const handleSubmit = async () => {
    if (!selected || !isConfirmMatch || state.phase !== 'reviewing' || state.step !== 'confirm') return;
    if (submittingRef.current) return;

    const nowMs = Date.now();
    // The reducer also enforces this invariant. The local guard avoids starting
    // an async request when the reducer rejects the transition as stale.
    if (state.staleQuote || (reviewTimestampMs !== null && isStaleQuote(reviewTimestampMs, nowMs))) {
      dispatch({ type: 'SUBMIT_STARTED', nowMs });
      return;
    }

    submittingRef.current = true;
    dispatch({ type: 'SUBMIT_STARTED', nowMs });

    // ── Idempotency key generation ─────────────────────────────────────────
    // On first submission, create a new intent. Retries reuse the same key.
    if (!submissionAttemptRef.current) {
      const intent: CollateralSubstitutionIntent = {
        creditLineId: currentAsset?.id ?? 'unknown',
        outgoingAssetId: currentAsset?.id,
        incomingAssetId: selected.id,
        initiatedAtMs: Date.now(),
      };
      submissionAttemptRef.current = createSubmissionAttempt({
        creditLineId: intent.creditLineId,
        outgoingAssetId: intent.outgoingAssetId,
        incomingAssetId: intent.incomingAssetId,
        initiatedAtMs: intent.initiatedAtMs,
      });
      console.debug(
        '[CollateralSubstitution] Generated idempotency key:',
        extractDiagnostics(submissionAttemptRef.current)
      );
    }

    if (submissionAttemptRef.current && hasSucceeded(submissionAttemptRef.current)) {
      console.debug(
        '[CollateralSubstitution] Duplicate submission detected (already succeeded):',
        extractDiagnostics(submissionAttemptRef.current)
      );
      dispatch({ type: 'SUBMIT_SUCCEEDED' });
      submittingRef.current = false;
      onSuccess(selected);
      return;
    }

    if (reviewLtvRatio !== null) {
      const freshSnap = computeLtvSnapshot(selected, loanBalance);
      const slippage = computeSlippage(reviewLtvRatio, freshSnap.ltvRatio, slippageTolerance);

      if (slippage.isExceeded) {
        const slippageError: SubstitutionError = {
          reason: 'slippage',
          message: `LTV moved by ${slippage.slippagePp.toFixed(1)} pp (tolerance: ${slippage.tolerancePp} pp). Re-review the comparison before submitting.`,
          retryable: false,
          idempotencyKey: submissionAttemptRef.current?.idempotencyKey,
        };
        dispatch({ type: 'SLIPPAGE_BLOCKED', error: slippageError });
        submittingRef.current = false;
        onError?.(slippageError);
        return;
      }
    }

    try {
      if (submissionAttemptRef.current) {
        submissionAttemptRef.current = recordSubmissionAttempt(submissionAttemptRef.current);
        console.debug(
          '[CollateralSubstitution] Submitting attempt:',
          extractDiagnostics(submissionAttemptRef.current)
        );
      }

      // Pass the idempotency key to the server to enable duplicate detection.
      const idempotencyKey = submissionAttemptRef.current?.idempotencyKey ?? 'unknown';
      const payload: SubmitCollateralSwapPayload = {
        idempotencyKey,
        creditLineName,
        outgoingAssetId: currentAsset?.id,
        incomingAssetId: selected.id,
        loanBalance,
      };
      if (submitCollateralSwap) {
        await submitCollateralSwap(payload);
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, _delayMs));
      }

      if (submissionAttemptRef.current) {
        submissionAttemptRef.current = recordServerResponse(
          submissionAttemptRef.current,
          'success',
          'Collateral substituted successfully'
        );
        console.debug(
          '[CollateralSubstitution] Submission succeeded:',
          extractDiagnostics(submissionAttemptRef.current)
        );
      }

      dispatch({ type: 'SUBMIT_SUCCEEDED' });
      submittingRef.current = false;
      onSuccess(selected);
    } catch (err) {
      const classified = classifySubstitutionError(err);
      classified.idempotencyKey = submissionAttemptRef.current?.idempotencyKey;

      if (submissionAttemptRef.current) {
        submissionAttemptRef.current = recordServerResponse(
          submissionAttemptRef.current,
          classified.reason,
          classified.message
        );
        console.debug(
          '[CollateralSubstitution] Submission failed:',
          extractDiagnostics(submissionAttemptRef.current)
        );
      }

      dispatch({ type: 'SUBMIT_FAILED', error: classified });
      submittingRef.current = false;

      if (retryCount + 1 >= MAX_RETRY_ATTEMPTS) {
        console.warn(
          '[CollateralSubstitution] Max retries exhausted:',
          extractDiagnostics(submissionAttemptRef.current!)
        );
        onError?.(classified);
      }
    }
  };

  const handleRetry = () => {
    dispatch({ type: 'RETRY', nowMs: Date.now() });
  };

  if (!isOpen) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  const stepTitles: Record<SubstitutionStep, string> = {
    select:  'Choose new collateral',
    review:  'Compare collateral',
    confirm: 'Confirm substitution',
  };

  return (
    <div id={modalId} className="csm-portal">
      {/* Backdrop */}
      <div
        className="csm-backdrop"
        aria-hidden="true"
        onClick={isPending ? undefined : handleClose}
      />

      {/* Dialog */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csm-title"
        aria-describedby="csm-subtitle"
        className="csm-dialog"
        onKeyDown={e => {
          if (e.key === 'Escape' && !isPending) handleClose();
        }}
      >
        {/* Header */}
        <div className="csm-header">
          <div className="csm-header-text">
            <p className="csm-kicker">GrantFox · Collateral</p>
            <h2 id="csm-title" className="csm-title">
              {isSuccess
                ? 'Substitution complete'
                : stepTitles[step]}
            </h2>
            <p id="csm-subtitle" className="csm-subtitle">
              {creditLineName}
            </p>
          </div>
          {!isPending && (
            <button
              type="button"
              className="csm-close"
              aria-label="Close collateral substitution dialog"
              onClick={handleClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Stepper (not shown on success) */}
        {!isSuccess && <Stepper current={step} />}

        {/* Body */}
        {isSuccess && selected ? (
          <SuccessView incoming={selected} onClose={handleClose} />
        ) : step === 'select' ? (
          <SelectStep
            current={currentAsset}
            selected={selected}
            onSelect={handleSelectAsset}
            loanBalance={loanBalance}
          />
        ) : step === 'review' && selected ? (
          <ReviewStep
            current={currentAsset}
            incoming={selected}
            loanBalance={loanBalance}
            slippageTolerance={slippageTolerance}
            onSlippageChange={tolerance => dispatch({ type: 'SET_SLIPPAGE', tolerance })}
            disabled={isPending}
          />
        ) : step === 'confirm' && selected ? (
          <ConfirmStep
            current={currentAsset}
            incoming={selected}
            loanBalance={loanBalance}
            confirmText={confirmText}
            onConfirmTextChange={value => dispatch({ type: 'SET_CONFIRM_TEXT', value })}
            classifiedError={state.phase === 'error' ? classifiedError : null}
            isStale={staleQuoteDetected}
            onRefreshStale={handleRefreshStale}
            retryCount={retryCount}
            canRetry={canRetry}
          />
        ) : null}

        {/* Footer action bar
            Button order rule (docs/BUTTON_ORDER.md):
            Cancel (exit flow) — Back (previous step) — Primary (forward/confirm)
            This puts the safe escape on the left and the primary action on the right,
            matching WCAG 3.2.4 consistent navigation and thumb-reach conventions. */}
        {!isSuccess && (
          <div className="csm-footer">
            {/* Cancel always comes first (leftmost) — exits the flow entirely */}
            <button
              type="button"
              className="csm-btn csm-btn--ghost"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </button>

            {/* Back comes after Cancel — returns to previous step, not an exit */}
            {step !== 'select' && (
              <button
                type="button"
                className="csm-btn csm-btn--ghost"
                onClick={handleBack}
                disabled={isPending}
              >
                Back
              </button>
            )}

            {/* Primary action always comes last (rightmost) */}
            {step === 'select' && (
              <button
                type="button"
                className="csm-btn csm-btn--primary"
                onClick={handleNextFromSelect}
                disabled={!canProceedFromSelect}
                aria-describedby={!canProceedFromSelect ? 'csm-select-hint' : undefined}
              >
                Review
              </button>
            )}

            {step === 'review' && (
              <button
                type="button"
                className="csm-btn csm-btn--primary"
                onClick={handleNextFromReview}
                disabled={incomingSnap?.isOverLtv}
                title={incomingSnap?.isOverLtv ? 'Resolve LTV before proceeding' : undefined}
              >
                Continue
              </button>
            )}

            {step === 'confirm' && state.phase !== 'error' && (
              <PendingButton
                pending={isPending}
                pendingLabel="Submitting…"
                onClick={handleSubmit}
                disabled={!isConfirmMatch || isPending || staleQuoteDetected}
                className="csm-btn csm-btn--primary"
                aria-describedby={!isConfirmMatch ? 'csm-confirm-name-input' : undefined}
              >
                Confirm substitution
              </PendingButton>
            )}

            {step === 'confirm' && canRetry && (
              <button
                type="button"
                className="csm-btn csm-btn--primary"
                onClick={handleRetry}
              >
                <RefreshCw size={16} aria-hidden="true" style={{ marginRight: '0.375rem' }} />
                Retry
              </button>
            )}
          </div>
        )}

        {/* Hidden helper for the disabled "Review" button */}
        {step === 'select' && !canProceedFromSelect && (
          <p id="csm-select-hint" className="sr-only">
            Select a collateral asset to proceed.
          </p>
        )}
      </div>
    </div>
  );
}
