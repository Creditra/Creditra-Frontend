import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle, Info, ArrowLeft, RefreshCw, X } from 'lucide-react';
import { Skeleton } from '@/components/Skeleton';
import { PayoffProjection } from '@/components/PayoffProjection';
import { RepaymentVisualizer } from '@/components/RepaymentVisualizer';
import { InlineHelpOverlay } from '@/components/InlineHelpOverlay';
import { ProgressBar } from '@/components/ProgressBar';
import type { ProgressBarVariant } from '@/components/ProgressBar';
import { LiveRegion } from '@/components/LiveRegion';

import { EmptyState } from '@/components/EmptyState';
import { NoOutstandingDebt } from '@/components/illustrations';
import {
  formatMoney,
  getRepayAmountValidation,
  requiresRepayConfirmation,
} from '@/utils/amountValidation';
import { offlineMutation } from '@/utils/offline';
import { useOnline } from '@/hooks/useOnline';
import { suggestRepayAmount } from '@/utils/suggestRepay';
import { computeMonthlyAccruedInterest } from '@/utils/currency';
import {
  isTypedAmountMatch,
  TypedAmountConfirmField,
} from '@/components/TypedAmountConfirm';
import { KbdHint } from '@/components/KbdHint';
import { RepayPreviewModal } from '@/components/RepayPreviewModal';
import { CopyToClipboard } from '@/components/CopyToClipboard';
import { MOCK_CREDIT_LINES } from '@/data/mockData';
import { motionClasses, useReducedMotion } from '@/context/ReducedMotionContext';
import {
  saveRepayDraft,
  loadRepayDraft,
  clearRepayDraft,
  type RepayDraftState,
} from '@/state/repayDraft';
import './RepayPage.css';

type RepayStep = 'input' | 'review';

/**
 * SEVERITY_CONFIG — token-pinned colours for the inline feedback banner.
 *
 * Task tokens-v7: all border/bg/color values now reference CSS custom
 * properties defined in src/index.css so dark-mode and theming changes only
 * need to happen in one place.  The alpha-variant tokens (--accent-border,
 * --accent-tint, etc.) are already declared in :root.
 *
 * Task cb-v7: each severity also carries a `patternClass` that adds a CSS
 * pattern texture to the banner (see src/styles/patterns.css) so severity is
 * conveyed by shape AND colour, satisfying WCAG 1.4.1 (Use of Color).
 */
const SEVERITY_CONFIG = {
  info: {
    border: 'var(--accent-border)',
    bg: 'var(--accent-tint)',
    color: 'var(--accent)',
    patternClass: 'rp-severity--info',
    icon: <Info size={16} aria-hidden="true" />,
  },
  success: {
    border: 'var(--success-border)',
    bg: 'var(--success-tint)',
    color: 'var(--success)',
    patternClass: 'rp-severity--success',
    icon: <CheckCircle size={16} aria-hidden="true" />,
  },
  warning: {
    border: 'var(--warning-border)',
    bg: 'var(--warning-tint)',
    color: 'var(--warning)',
    patternClass: 'rp-severity--warning',
    icon: <AlertTriangle size={16} aria-hidden="true" />,
  },
  danger: {
    border: 'var(--error-border)',
    bg: 'var(--error-tint)',
    color: 'var(--error)',
    patternClass: 'rp-severity--danger',
    icon: <AlertCircle size={16} aria-hidden="true" />,
  },
} as const;

/**
 * RepayPage — reduced-motion strategy
 *
 * All CSS transitions are neutralised globally by the
 * `prefers-reduced-motion: reduce` reset in src/index.css (animation/transition
 * durations collapsed to 0.01 ms on `*`).  On top of that, transition utility
 * classes are only applied through `motionClasses(...)`, so they drop out of
 * the DOM entirely whenever reduced motion is active (OS-level or via the
 * in-app override).
 */
export default function RepayPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { queueAction } = useOnline();
  const preselectedId = searchParams.get('line');

  // ── Draft recovery state ──────────────────────────────────────────────
  const [recoveredDraft, setRecoveredDraft] = useState<RepayDraftState | null>(null);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const draftLoadedRef = useRef(false);
  // Guard: set to true inside handleConfirm/handleNewRepay to prevent the
  // persist useEffect from re-saving a draft after clearRepayDraft() runs.
  // React Router's navigate() can trigger a synchronous re-render via the
  // router context (outside React 18 batching), causing the persist effect
  // to fire with the old step before setStep('success') is applied.
  const draftClearedRef = useRef(false);

  const [step, setStep] = useState<RepayStep>('input');
  const [selectedId, setSelectedId] = useState<string>(preselectedId ?? '');
  const [amountStr, setAmountStr] = useState('');
  const [confirmAmountStr, setConfirmAmountStr] = useState('');
  const [isAutoSchedule, setIsAutoSchedule] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isOfflineBlocked, setIsOfflineBlocked] = useState(false);
  // Task ariallive-v7: centralised SR announcement for step transitions and
  // validation feedback.  The LiveRegion component renders this via
  // aria-live="polite" so screen readers pick it up without focus moves.
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const { isReducedMotionActive } = useReducedMotion();

  const creditLines = useMemo(
    () => MOCK_CREDIT_LINES.filter((cl) => cl.status === 'Active' && cl.utilized > 0),
    [],
  );

  const selectedLine = useMemo(
    () => MOCK_CREDIT_LINES.find((cl) => cl.id === selectedId) ?? null,
    [selectedId],
  );

  const walletBalance = 50000;

  const validation = useMemo(
    () =>
      selectedLine
        ? getRepayAmountValidation(amountStr, selectedLine.utilized, walletBalance)
        : null,
    [amountStr, selectedLine, walletBalance],
  );

  const suggestedAmount = useMemo(
    () =>
      selectedLine
        ? suggestRepayAmount(
            selectedLine.utilized,
            selectedLine.limit,
            walletBalance,
            selectedLine.apr,
            selectedLine.nextPaymentAmount,
          )
        : 0,
    [selectedLine, walletBalance],
  );

  const amount = validation?.amount ?? 0;
  const isInvalid = !validation?.isValid;
  const needsConfirm = requiresRepayConfirmation(amount);
  const isConfirmDisabled = needsConfirm && !isTypedAmountMatch(confirmAmountStr, amount);

  const activeTone = validation
    ? SEVERITY_CONFIG[validation.feedback.severity]
    : SEVERITY_CONFIG.info;

  const handlePercent = (pct: number) => {
    if (!validation) return;
    let target = (validation.maxRepayAmount * pct) / 100;
    if (target > walletBalance) target = walletBalance;
    setAmountStr(target.toFixed(2));
  };

  const handleSmartPay = () => {
    if (!selectedLine) return;
    setAmountStr(suggestedAmount.toFixed(2));
    setSrAnnouncement(`Smart Pay amount set: ${formatMoney(suggestedAmount)}`);
  };

  const handleReview = () => {
    if (!isInvalid && amount > 0) {
      setConfirmAmountStr('');
      setStep('review');
      // Announce the transition so SR users know they've moved to the review step.
      setSrAnnouncement(`Review step: repaying ${formatMoney(amount)}. Confirm or go back.`);
    }
  };

  const handleConfirm = () => {
    draftClearedRef.current = true;
    clearRepayDraft();
    navigate('/repay/success', {
      state: {
        amount,
        creditLineName: selectedLine.name,
        creditLineId: selectedLine.id,
        transactionId: `TXN-${Date.now()}`,
        remainingDebt,
        limit: selectedLine.limit,
        apr: selectedLine.apr,
        nextPaymentAmount: selectedLine.nextPaymentAmount,
        timestamp: new Date().toISOString(),
      },
      onOffline: () => {
        queueAction(() => {
          handleConfirm();
        }, 'repay-confirm');
        setIsOfflineBlocked(true);
      },
      offlineMessage:
        'You are offline, so this repayment cannot be processed yet. It has been queued and will be submitted when your connection is restored.',
    });
  };

  const handleNewRepay = () => {
    draftClearedRef.current = true;
    clearRepayDraft();
    setAmountStr('');
    setIsAutoSchedule(false);
    setStep('input');
    setSrAnnouncement('Starting a new repayment. Select an amount.');
  };

  const handleBack = useCallback(() => {
    if (step === 'review') {
      setStep('input');
      setSrAnnouncement('Back to input step. Edit your repayment amount.');
    } else if (!preselectedId) {
      setSelectedId('');
    } else {
      navigate(-1);
    }
  }, [step, preselectedId, navigate]);

  // ── Draft recovery handlers ──────────────────────────────────────────
  const handleRestoreDraft = useCallback(() => {
    if (!recoveredDraft) return;
    setSelectedId(recoveredDraft.creditLineId);
    setAmountStr(recoveredDraft.amountStr);
    setConfirmAmountStr(recoveredDraft.confirmAmountStr);
    setIsAutoSchedule(recoveredDraft.isAutoSchedule);
    setStep(recoveredDraft.step);
    setShowRecoveryPrompt(false);
    setRecoveredDraft(null);
    setSrAnnouncement(
      `Restored repayment draft: ${formatMoney(parseFloat(recoveredDraft.amountStr) || 0)} on ${recoveredDraft.creditLineId}.`,
    );
  }, [recoveredDraft]);

  const handleDismissDraft = useCallback(() => {
    clearRepayDraft();
    setShowRecoveryPrompt(false);
    setRecoveredDraft(null);
    setSrAnnouncement('Previous repayment draft discarded.');
  }, []);

  // ── Initial draft recovery check ──────────────────────────────────────
  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;

    const draft = loadRepayDraft();
    if (draft && !preselectedId) {
      // Only show recovery prompt when the user hasn't navigated with a
      // specific credit line preselected (which implies a fresh intent).
      setRecoveredDraft(draft);
      setShowRecoveryPrompt(true);
    }
  }, [preselectedId]);

  // ── Persist draft on state changes ────────────────────────────────────
  useEffect(() => {
    // When the user confirms or starts a new repayment, ensure the draft
    // is cleared.  This acts as a safety net: even if clearRepayDraft()
    // ran in the event handler, React Router's navigate() can trigger an
    // intermediate render that re-persists the draft before the step
    // state update is applied.
    if (step === 'success') {
      clearRepayDraft();
      return;
    }
    // Don't persist if the draft was just intentionally cleared
    // (handleConfirm / handleNewRepay).
    if (draftClearedRef.current) return;

    // Don't save during loading or after cancel.
    if (isLoading || !selectedId) return;
    // Don't save empty amounts on the input step.
    if (step === 'input' && !amountStr) return;

    saveRepayDraft({
      step,
      creditLineId: selectedId,
      amountStr,
      confirmAmountStr,
      isAutoSchedule,
    });
  }, [step, selectedId, amountStr, confirmAmountStr, isAutoSchedule, isLoading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        handleBack();
      } else if (e.key === 's' || e.key === 'S') {
        if (step === 'input' && selectedLine) {
          handleSmartPay();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        if (step === 'input' && selectedLine) {
          handlePercent(100);
        }
      } else if (e.key === 'Enter') {
        if (step === 'input' && selectedLine && !isInvalid && amount > 0) {
          handleReview();
        } else if (step === 'review' && !isConfirmDisabled) {
          handleConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, selectedLine, isInvalid, amount, isConfirmDisabled, handleBack, suggestedAmount, walletBalance]);

  // Task ariallive-v7: announce validation errors to screen readers
  useEffect(() => {
    if (validation?.feedback.severity === 'danger' && validation.feedback.message) {
      setSrAnnouncement(`Error: ${validation.feedback.message}`);
    }
  }, [validation?.feedback.message, validation?.feedback.severity]);

  if (!selectedLine) {
    return (
    <div className="repay-page mx-auto max-w-2xl space-y-6 px-4 py-8">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(-1)}
          className={`rp-back-btn inline-flex items-center gap-1.5 rounded-md text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-colors hover:text-foreground')}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
          <KbdHint keys={['Esc']} className="ml-1" />
        </button>

      {/* ── Recovery prompt banner (credit line picker view) ──────── */}
      {showRecoveryPrompt && recoveredDraft && (
        <div
          className="mb-4 flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/10 p-4"
          role="alert"
          aria-live="polite"
          data-testid="repay-recovery-prompt"
        >
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Recover interrupted repayment?
            </p>
            <p className="mt-1 text-xs text-muted">
              You have a saved repayment draft for credit line{' '}
              <span className="font-medium text-foreground">{recoveredDraft.creditLineId}</span>
              {' '}—{' '}
              <span className="font-medium text-foreground num-tabular">
                {formatMoney(parseFloat(recoveredDraft.amountStr) || 0)}
              </span>
              . Saved {new Date(recoveredDraft.savedAt).toLocaleTimeString()}.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-background transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                data-testid="repay-recovery-restore"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Resume
              </button>
              <button
                type="button"
                onClick={handleDismissDraft}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                data-testid="repay-recovery-dismiss"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}

        <header className="mt-4">
          <p className="text-xs font-semibold uppercase text-muted">Repay Credit</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            Select a credit line to repay
          </h1>
        </header>

        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-live="polite" data-testid="repay-loading-skeleton">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton width={120} height={20} className="mb-1" />
                    <Skeleton width={80} height={16} />
                  </div>
                  <div className="flex flex-col items-end">
                    <Skeleton width={90} height={20} className="mb-1" />
                    <Skeleton width={70} height={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <Skeleton width="100%" height={8} shape="rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : creditLines.length === 0 ? (
          <EmptyState
            data-testid="repay-empty-state"
            tone="success"
            eyebrow="All caught up"
            illustration={
              <NoOutstandingDebt className="empty-state-illustration--muted" />
            }
            title="Nothing to repay right now"
            description="You don\u2019t have any active credit lines with an outstanding balance. Make a new draw or come back later when a repayment is scheduled."
            primaryAction={{
              label: 'Request a credit line',
              to: '/open-credit',
            }}
            secondaryAction={{
              label: 'Back to dashboard',
              to: '/',
            }}
          />
        ) : (
          <div className="mt-4 space-y-3">
            {creditLines.map((cl) => {
              const utilization = Math.round((cl.utilized / cl.limit) * 100);
              // Task cb-v7: map utilization level to pattern class so the bar
              // conveys severity via texture, not colour alone (WCAG 1.4.1).
              const barClass =
                utilization > 80
                  ? 'rp-progress--high'
                  : utilization > 50
                    ? 'rp-progress--medium'
                    : 'rp-progress--low';
              return (
                <button
                  key={cl.id}
                  type="button"
                  onClick={() => setSelectedId(cl.id)}
                  className={`rp-cl-card w-full rounded-lg border border-border bg-surface p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-all hover:border-accent hover:bg-accent/5')}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{cl.name}</p>
                      <p className="mt-0.5 text-sm text-muted">{cl.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground num-tabular">
                        {formatMoney(cl.utilized)}
                      </p>
                      <p className="text-sm text-muted"><span className="num-tabular">{utilization}%</span> utilized</p>
                    </div>
                  </div>
                  {/* Task cb-v7: pattern fill on progress bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full transition-all ${barClass}`}
                      style={{ width: `${utilization}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const oldPct = Math.round((selectedLine.utilized / selectedLine.limit) * 100);
  const remainingDebt = validation?.remainingDebt ?? selectedLine.utilized;
  const newPct = Math.round((remainingDebt / selectedLine.limit) * 100);
  const accruedInterest = computeMonthlyAccruedInterest(
    selectedLine.utilized,
    selectedLine.apr,
  );
  const interestPortion = Math.min(amount, accruedInterest);
  const principalPortion = Math.max(0, amount - interestPortion);

  return (
    <div className="repay-page mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <button
        type="button"
        aria-label={step === 'input' ? 'Back to credit lines' : 'Back to input'}
        onClick={handleBack}
        className={`rp-back-btn mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-colors hover:text-foreground')}`}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="flex items-center gap-1.5">
          {step === 'input' ? 'Back to credit lines' : 'Back to input'}
          <KbdHint keys={['Esc']} />
        </span>
      </button>

      {/* ── Recovery prompt banner ────────────────────────────────────── */}
      {showRecoveryPrompt && recoveredDraft && (
        <div
          className="mb-4 flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/10 p-4"
          role="alert"
          aria-live="polite"
          data-testid="repay-recovery-prompt"
        >
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Recover interrupted repayment?
            </p>
            <p className="mt-1 text-xs text-muted">
              You have a saved repayment draft for credit line{' '}
              <span className="font-medium text-foreground">{recoveredDraft.creditLineId}</span>
              {' '}—{' '}
              <span className="font-medium text-foreground num-tabular">
                {formatMoney(parseFloat(recoveredDraft.amountStr) || 0)}
              </span>
              . Saved {new Date(recoveredDraft.savedAt).toLocaleTimeString()}.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-background transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                data-testid="repay-recovery-restore"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Resume
              </button>
              <button
                type="button"
                onClick={handleDismissDraft}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                data-testid="repay-recovery-dismiss"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted">
            Repay Credit
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {step === 'review'
              ? 'Review your repayment'
              : 'Make a repayment'}
          </h1>
          <p className="text-sm text-muted">
            {selectedLine.name} &middot; <span className="num-tabular">{selectedLine.apr}%</span> APR
          </p>
        </header>

        {step === 'input' && (
          <>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs font-semibold uppercase text-muted">
                Current debt
              </p>
              {/* num-tabular: prevents digit-width jitter as repayment amounts change (FWC26) */}
              <div className="mt-1 flex items-center gap-2">
                <p className="text-3xl font-bold text-foreground num-tabular">
                  {formatMoney(selectedLine.utilized)}
                </p>
                <CopyToClipboard
                  value={formatMoney(selectedLine.utilized)}
                  ariaLabel="Copy current debt amount"
                />
              </div>
              {/* Task cb-v7: pattern class on the bar in addition to colour */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full transition-all ${
                    oldPct > 80
                      ? 'rp-progress--high'
                      : oldPct > 50
                        ? 'rp-progress--medium'
                        : 'rp-progress--low'
                  }`}
                  style={{ width: `${oldPct}%` }}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                <span className="num-tabular">{oldPct}%</span> of <span className="num-tabular">{formatMoney(selectedLine.limit)}</span> limit
              </p>
            </div>

            {/* Task resp-v7: column layout triggers at md (768 px) instead of lg
                (1024 px) so the aside doesn't stack on tablet viewports where
                there's enough room for a two-column layout. */}
            <div className="grid gap-6 md:grid-cols-[1fr_320px] md:items-start lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="repay-amount"
                      className="text-sm font-semibold text-foreground"
                    >
                      Amount to repay
                    </label>
                    <span className="text-xs text-muted">
                      Wallet: <span className="num-tabular">{formatMoney(walletBalance)}</span>
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handlePercent(pct)}
                        className={`rp-preset-btn flex-1 rounded-md border border-accent/30 px-2 py-1.5 text-xs font-medium text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-colors hover:bg-accent/10')}`}
                        aria-label={`Set amount to ${pct === 100 ? 'maximum' : `${pct} percent`}`}
                      >
                        {pct === 100 ? (
                          <span className="flex items-center justify-center gap-1">
                            MAX <KbdHint keys={['M']} />
                          </span>
                        ) : (
                          `${pct}%`
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleSmartPay}
                      className={`rp-smart-pay-btn flex-1 rounded-md border border-success/30 px-2 py-1.5 text-xs font-medium text-success focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success ${motionClasses(isReducedMotionActive, 'transition-colors hover:bg-success/10')}`}
                      aria-label={`Smart Pay suggested repayment of ${formatMoney(suggestedAmount)}`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Smart Pay <KbdHint keys={['S']} />
                      </span>
                    </button>
                  </div>

                  <div className="relative mt-3">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted"
                      aria-hidden="true"
                    >
                      $
                    </span>
                    <input
                      id="repay-amount"
                      type="number"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      placeholder="0.00"
                      min={1}
                      step={0.01}
                      aria-invalid={validation?.feedback.severity === 'danger' || undefined}
                      className={`rp-amount-input num-tabular w-full rounded-lg border bg-background px-3 py-3 pl-8 text-lg font-semibold text-foreground outline-none focus:ring-2 focus:ring-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-colors')}`}
                      style={{
                        // Task tokens-v7: token-referenced colors only — no raw hex.
                        borderColor:
                          validation?.feedback.severity === 'danger'
                            ? 'var(--error)'
                            : validation?.feedback.severity === 'warning'
                              ? 'var(--warning)'
                              : amount > 0
                                ? 'var(--accent)'
                                : 'var(--border)',
                      }}
                    />
                  </div>

                  {/* Task cb-v7: patternClass adds a subtle background texture
                      so severity is distinguishable without colour alone.
                      Task tokens-v7: border/bg/color reference CSS tokens. */}
                  <div
                    className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${activeTone.patternClass}`}
                    style={{
                      border: `1px solid ${activeTone.border}`,
                      background: activeTone.bg,
                      color: activeTone.color,
                    }}
                    role={validation?.feedback.severity === 'danger' ? 'alert' : 'status'}
                    aria-live="polite"
                  >
                    <span className="mt-0.5 inline-flex shrink-0">
                      {activeTone.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {validation?.feedback.title ?? ''}
                      </p>
                      <p className="mt-0.5 text-xs opacity-80">
                        {validation?.feedback.message ?? ''}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-xs font-semibold uppercase text-muted">
                    Preview
                  </p>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Remaining debt</span>
                      <span
                        className={`font-semibold num-tabular ${
                          amount > 0 && remainingDebt === 0
                            ? 'text-success'
                            : 'text-foreground'
                        }`}
                      >
                        {formatMoney(remainingDebt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">New utilization</span>
                      <span className="font-semibold text-foreground">
                        <span className="num-tabular">{newPct}%</span>
                        <span className="ml-1.5 text-muted line-through num-tabular">
                          {oldPct}%
                        </span>
                    </span>
                  </div>

                  {/* cb-v7: pattern class on both bars so old and new utilization
                      are told apart without colour alone. */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full transition-all motion-reduce:transition-none rp-progress--ghost`}
                      style={{ width: `${oldPct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full transition-all ${newPct > 80 ? 'rp-progress--high' : newPct > 50 ? 'rp-progress--medium' : 'rp-progress--low'}`}
                      style={{ width: `${newPct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  </div>  {/* closes the space-y-3 wrapper */}

                  <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                    <div>
                      <label
                        htmlFor="auto-schedule-toggle"
                        className="text-sm font-medium text-foreground cursor-pointer"
                        onClick={() => setIsAutoSchedule(!isAutoSchedule)}
                      >
                        Auto-schedule
                      </label>
                      <p className="text-xs text-muted">Repeat this payment monthly</p>
                    </div>
                    <button
                      id="auto-schedule-toggle"
                      type="button"
                      role="switch"
                      aria-checked={isAutoSchedule}
                      onClick={() => setIsAutoSchedule(!isAutoSchedule)}
                      className={`rp-toggle-switch relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        isAutoSchedule ? 'bg-accent' : 'bg-border'
                      } ${motionClasses(isReducedMotionActive, 'transition-colors duration-200 ease-in-out')}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`repay-page__toggle-thumb pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 ${
                          isAutoSchedule ? 'translate-x-5' : 'translate-x-0'
                        } ${motionClasses(isReducedMotionActive, 'transition duration-200 ease-in-out')}`}
                      />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleReview}
                      disabled={isInvalid || amount <= 0}
                      className={`rp-review-btn w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${motionClasses(isReducedMotionActive, 'transition-all hover:brightness-110')}`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        Review Repayment <KbdHint keys={['Enter']} />
                      </span>
                    </button>
                    <button
                      ref={previewTriggerRef}
                      type="button"
                      onClick={() => setIsPreviewModalOpen(true)}
                      disabled={isInvalid || amount <= 0}
                      className={`rp-preview-btn w-full rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs font-semibold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${motionClasses(isReducedMotionActive, 'transition-all hover:bg-accent/20')}`}
                    >
                      Preview Consequences Modal
                    </button>
                  </div>
                </div>
              </div>

              {/* Task resp-v7: sticky top adjusted so the aside doesn't hide
                  behind the fixed header (60px) on tablet/desktop. */}
              <aside className="md:sticky md:top-[4.5rem]">
                <PayoffProjection
                  currentDebt={selectedLine.utilized}
                  apr={selectedLine.apr}
                  repayAmount={amount}
                  limit={selectedLine.limit}
                  nextPaymentAmount={selectedLine.nextPaymentAmount}
                />
              </aside>
            </div>

            <RepaymentVisualizer
              principal={selectedLine.utilized}
              apr={selectedLine.apr}
              monthlyPayment={
                selectedLine.nextPaymentAmount ??
                Math.max(
                  selectedLine.utilized * 0.025,
                  selectedLine.utilized * (selectedLine.apr / 100 / 12),
                )
              }
            />

            <div className="flex items-center justify-between">
              <button
                ref={helpTriggerRef}
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className={`rp-help-btn rounded-md text-sm font-semibold text-accent underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-colors hover:text-accent hover:underline')}`}
              >
                I need help
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`rp-cancel-btn rounded-md text-sm font-semibold text-foreground underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'hover:text-accent hover:underline')}`}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            {isOfflineBlocked && (
              <div
                className="rounded-lg border border-error bg-error/10 p-4 text-sm text-error"
                role="alert"
                aria-live="assertive"
              >
                <p className="font-semibold">You're offline</p>
                <p className="mt-0.5">
                  This repayment cannot be processed while offline. It has been
                  queued and will be submitted automatically when your
                  connection is restored.
                </p>
              </div>
            )}
            <div className="rounded-lg border border-border bg-surface p-6 text-center">
              <p className="text-sm text-muted">You are about to repay</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <p className="text-4xl font-bold text-foreground num-tabular">
                  {formatMoney(amount)}
                </p>
                <CopyToClipboard
                  value={formatMoney(amount)}
                  ariaLabel="Copy repayment amount"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Remaining debt after</span>
                  <span
                    className={`font-semibold num-tabular ${
                      remainingDebt === 0 ? 'text-success' : 'text-foreground'
                    }`}
                  >
                    {formatMoney(remainingDebt)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Wallet balance</span>
                  <span className="font-semibold text-success num-tabular">
                    {formatMoney(walletBalance)}
                  </span>
                </div>
                {isAutoSchedule && (
                  <div className="flex items-center justify-between text-sm border-t border-border pt-3">
                    <span className="text-muted">Auto-schedule</span>
                    <span className="font-semibold text-accent">Monthly</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Repayment Allocation</p>
                <span className="text-xs text-muted">{selectedLine.apr}% APR</span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted">Principal reduction</span>
                  <span className="font-semibold text-foreground num-tabular">
                    {formatMoney(principalPortion)}
                  </span>
                </div>
                {accruedInterest > 0 && (
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
                    <span className="text-muted">Accrued interest paid</span>
                    <span className="font-semibold text-foreground num-tabular">
                      {formatMoney(interestPortion)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <PayoffProjection
              currentDebt={selectedLine.utilized}
              apr={selectedLine.apr}
              repayAmount={amount}
              limit={selectedLine.limit}
              nextPaymentAmount={selectedLine.nextPaymentAmount}
            />

            {needsConfirm && (
              <TypedAmountConfirmField
                amount={amount}
                value={confirmAmountStr}
                onChange={setConfirmAmountStr}
                idPrefix="repay-page-confirm"
              />
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                className={`rp-back-input-btn flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-all hover:bg-border')}`}
              >
                <span className="flex items-center justify-center gap-2">
                  Back <KbdHint keys={['Esc']} />
                </span>
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                aria-disabled={isConfirmDisabled || undefined}
                className={`rp-confirm-btn flex-[2] rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${motionClasses(isReducedMotionActive, 'transition-all hover:brightness-110')}`}
              >
                <span className="flex items-center justify-center gap-2">
                  Confirm Repayment <KbdHint keys={['Enter']} />
                </span>
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
              <CheckCircle className="h-8 w-8 text-success" aria-hidden="true" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-foreground">
                You repaid <span className="num-tabular">{formatMoney(amount)}</span>!
              </h2>
              <p className="mt-1 text-muted">
                Your transaction was successful.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Remaining debt</span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-foreground num-tabular">
                    {formatMoney(remainingDebt)}
                  </span>
                  <CopyToClipboard
                    value={formatMoney(remainingDebt)}
                    ariaLabel="Copy remaining debt amount"
                  />
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted">Credit line utilization</span>
                <span className="font-semibold text-foreground">
                  Reduced to <span className="num-tabular">{newPct}%</span>
                </span>
              </div>
              {isAutoSchedule && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted">Auto-schedule</span>
                  <span className="font-semibold text-accent">Active</span>
                </div>
              )}
            </div>

            <PayoffProjection
              currentDebt={selectedLine.utilized}
              apr={selectedLine.apr}
              repayAmount={amount}
              limit={selectedLine.limit}
              nextPaymentAmount={selectedLine.nextPaymentAmount}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`rp-dashboard-btn flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-all hover:brightness-110')}`}
              >
                Back to Dashboard
              </button>
              <button
                type="button"
                onClick={handleNewRepay}
                className={`rp-new-repay-btn flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-all hover:bg-border')}`}
              >
                Make another repayment
              </button>
            </div>
          </div>
        )}
      </div>

      <InlineHelpOverlay
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        triggerRef={helpTriggerRef}
      />
      {selectedLine && (
        <RepayPreviewModal
          isOpen={isPreviewModalOpen}
          creditLine={selectedLine}
          walletBalance={walletBalance}
          repayAmount={amount}
          onClose={() => setIsPreviewModalOpen(false)}
          onConfirm={() => {
            setIsPreviewModalOpen(false);
            handleConfirm();
          }}
          triggerRef={previewTriggerRef}
        />
      )}

      <LiveRegion message={srAnnouncement} />
    </div>
  );
}

export function RepayPageSkeleton() {
  const [searchParams] = useSearchParams();
  const hasLine = !!searchParams.get('line');

  if (!hasLine) {
    return (
      <div
        className="repay-page mx-auto max-w-2xl space-y-6 px-4 py-8"
        aria-busy="true"
        aria-label="Loading repay page"
      >
        <div className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted" aria-hidden="true">
          <Skeleton width="60px" height="20px" />
        </div>

        <header className="space-y-2" aria-hidden="true">
          <Skeleton width="80px" height="16px" />
          <Skeleton width="320px" height="32px" />
        </header>

        <div className="space-y-3" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-full rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2">
                  <Skeleton width="150px" height="20px" />
                  <Skeleton width="80px" height="14px" />
                </div>
                <div className="text-right space-y-2">
                  <Skeleton width="100px" height="20px" />
                  <Skeleton width="80px" height="14px" />
                </div>
              </div>
              <Skeleton width="100%" height="8px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="repay-page mx-auto max-w-4xl px-4 py-6 sm:py-8"
      aria-busy="true"
      aria-label="Loading repay page"
    >
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted" aria-hidden="true">
        <Skeleton width="160px" height="20px" />
      </div>

      <div className="space-y-6" aria-hidden="true">
        <header className="space-y-2">
          <Skeleton width="80px" height="16px" />
          <Skeleton width="240px" height="32px" />
          <Skeleton width="180px" height="16px" />
        </header>

        <div className="rounded-lg border border-border bg-surface p-4">
          <Skeleton width="100px" height="16px" />
          <Skeleton width="200px" height="40px" className="mt-1" />
          <Skeleton width="100%" height="8px" className="mt-3" />
          <Skeleton width="180px" height="14px" className="mt-2" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <Skeleton width="120px" height="20px" />
                <Skeleton width="100px" height="14px" />
              </div>

              <div className="mt-3 flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="flex-1" height="32px" />
                ))}
              </div>

              <Skeleton height="56px" className="mt-3" />
              <Skeleton height="52px" className="mt-3" />
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <Skeleton width="80px" height="16px" />
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton width="120px" height="20px" />
                  <Skeleton width="80px" height="20px" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton width="120px" height="20px" />
                  <Skeleton width="80px" height="20px" />
                </div>
                <Skeleton width="100%" height="8px" />
                <Skeleton width="100%" height="8px" />
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <div className="space-y-1">
                  <Skeleton width="120px" height="18px" />
                  <Skeleton width="180px" height="14px" />
                </div>
                <Skeleton width="44px" height="24px" />
              </div>

              <Skeleton width="100%" height="44px" className="mt-4" />
            </div>
          </div>

          <aside className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <Skeleton width="120px" height="20px" />
            </div>
            <Skeleton width="100%" height="40px" />
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton width="100px" height="14px" />
                  <Skeleton width="80px" height="18px" />
                </div>
                <Skeleton width="32px" height="32px" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
