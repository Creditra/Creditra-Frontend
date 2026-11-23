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
import { ConnectWalletPrompt } from '@/components/ConnectWalletPrompt';

import { EmptyState } from '@/components/EmptyState';
import { NoOutstandingDebt } from '@/components/illustrations';
import {
  formatMoney,
  getRepayAmountValidation,
  requiresRepayConfirmation,
} from '@/utils/amountValidation';
import { useOnline } from '@/hooks/useOnline';
import {
  suggestRepayAmount,
  type OptimisedRepaymentPlan,
  type OptimiseRepaymentLine,
} from '@/utils/suggestRepay';
import { SmartPayCTA } from './SmartPayCTA';
import { roundToCents } from '@/utils/currency';
import {
  allocateBatchRepayment,
  allocateRepayment,
  type BatchAllocationStrategy,
  type BatchRepaymentAllocation,
  type RepaymentAllocation,
} from '@/lib/repay-allocation';
import { getAccruedInterest, getAccruedInterestDays } from '@/lib/interest';
import {
  isTypedAmountMatch,
  TypedAmountConfirmField,
} from '@/components/TypedAmountConfirm';
import { KbdHint } from '@/components/KbdHint';
import { RepayPreviewModal } from '@/components/RepayPreviewModal';
import { CopyToClipboard } from '@/components/CopyToClipboard';
import { Tooltip } from '@/components/Tooltip';
import { submitRepayment } from '@/services/repayService';
import { emit } from '@/lib/event-bus';
import { motionClasses, useReducedMotion } from '@/context/ReducedMotionContext';
import { useWallet, walletIdentityKey } from '@/context/WalletContext';
import { useCreditLine, useCreditLines } from '@/hooks/useCreditLines';
import {
  getRepayableBalance,
  moneyCoversAmount,
  moneyToNumber,
  SETTLEMENT_ASSET,
} from '@/lib/repayable-balance';
import {
  getRepayableLines,
  isRepayable,
  isDelinquentLine,
} from '@/lib/repay-eligibility';
import { StatusBadge } from '@/components/StatusBadge';
import {
  saveRepayDraft,
  loadRepayDraft,
  clearRepayDraft,
  type RepayDraftState,
} from '@/state/repayDraft';
import { useDraftSaveStatus } from '@/hooks/useDraftSaveStatus';
import { DraftSavedIndicator } from '@/components/DraftSavedIndicator';
import { PendingButton } from '@/components/PendingButton';

/**
 * Reason a saved draft was discarded instead of being offered for recovery.
 * Surfaced as a `role="status"` note so the discard is never silent
 * (issue #1188).
 */
type DraftDiscardReason = 'owner-mismatch' | 'line-unrepayable';

const DRAFT_DISCARD_MESSAGE: Record<DraftDiscardReason, string> = {
  'owner-mismatch':
    'Saved repayment draft discarded — it belongs to a different wallet.',
  'line-unrepayable':
    'Saved repayment draft discarded — that credit line can no longer be repaid.',
};
import './RepayPage.css';

type RepayStep = 'input' | 'review';

interface BatchRepayLineResult {
  lineId: string;
  lineName: string;
  amount: number;
  allocation: RepaymentAllocation;
  status: 'success' | 'error';
  transactionId?: string;
  error?: string;
}

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
  const { isOnline, queueAction } = useOnline();
  const {
    wallet,
    status: walletStatus,
    balances,
    refreshBalance,
  } = useWallet();
  const identityKey = walletIdentityKey(wallet ?? null);
  const preselectedId = searchParams.get('line');
  const {
    lines: mockLines,
    status: creditStatus,
    error: creditError,
    refetch: refetchCreditLines,
  } = useCreditLines();

  // ── Draft recovery state ──────────────────────────────────────────────
  const [recoveredDraft, setRecoveredDraft] = useState<RepayDraftState | null>(null);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [draftDiscardReason, setDraftDiscardReason] = useState<DraftDiscardReason | null>(null);
  const draftLoadedRef = useRef(false);
  // Prevent the persist effect from re-saving a draft after confirmation.
  const draftClearedRef = useRef(false);
  // Tracks the previous wallet identity so a mid-session account/network
  // switch can clear another wallet's draft (issue #1188).
  const prevIdentityKeyRef = useRef<string | null>(null);
  const draftSave = useDraftSaveStatus();
  const isSubmittingRef = useRef(false);

  const [step, setStep] = useState<RepayStep>('input');
  const [selectedId, setSelectedId] = useState<string>(preselectedId ?? '');
  const [amountStr, setAmountStr] = useState('');
  const [appliedPlan, setAppliedPlan] = useState<OptimisedRepaymentPlan | null>(null);
  const [confirmAmountStr, setConfirmAmountStr] = useState('');
  const [isAutoSchedule, setIsAutoSchedule] = useState(false);
  const [isMultiLineMode, setIsMultiLineMode] = useState(false);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(() =>
    preselectedId ? [preselectedId] : [],
  );
  const [batchStrategy, setBatchStrategy] =
    useState<BatchAllocationStrategy>('highest-apr');
  const [batchInputMode, setBatchInputMode] = useState<'total' | 'per-line'>(
    'total',
  );
  const [batchTotalStr, setBatchTotalStr] = useState('');
  const [perLineAmountStrs, setPerLineAmountStrs] = useState<
    Record<string, string>
  >({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [batchResults, setBatchResults] = useState<
    BatchRepayLineResult[] | null
  >(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isOfflineBlocked, setIsOfflineBlocked] = useState(false);
  // Task ariallive-v7: centralised SR announcement for step transitions and
  // validation feedback.  The LiveRegion component renders this via
  // aria-live="polite" so screen readers pick it up without focus moves.
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const { isReducedMotionActive } = useReducedMotion();

  // ── Repayable lines — single predicate used by picker and deep-link ──
  // Issue #1185: getRepayableLines (utilized > 0 && status !== Closed) replaces
  // the old Active-only filter so Suspended and Defaulted lines are visible.
  // The per-render `mockLines` capture lets the memo react when the line data
  // source is replaced (e.g. a provider refetch), so amounts re-validate
  // against current debt instead of stale closure data (issue #1188).
  const creditLines = useMemo(() => getRepayableLines(mockLines), [mockLines]);
  const { line: selectedCreditLine } = useCreditLine(selectedId);

  // When a ?line= deep-link names an unrepayable line we keep selectedLine null
  // so the picker renders with an explanatory status message instead of opening
  // the form for a line that has no outstanding balance (e.g. Closed).
  // Deps include creditLines so a provider refetch re-resolves the selected
  // line (issue #1188) — the review step then re-validates against current debt.
  const selectedLine = useMemo(() => {
    if (!selectedId) return null;
    const line = selectedCreditLine;
    if (!line || !isRepayable(line)) return null;
    return line;
  }, [selectedId, selectedCreditLine]);

  // True when the user arrived via ?line= but the named line is not repayable.
  const unrepayableDeepLink = useMemo(() => {
    if (!preselectedId) return false;
    const line = mockLines.find((cl) => cl.id === preselectedId) ?? null;
    return line !== null && !isRepayable(line);
  }, [mockLines, preselectedId]);

  const repayableBalance = getRepayableBalance(balances ?? null, SETTLEMENT_ASSET);
  const hasRepayableBalance =
    walletStatus === 'connected' &&
    wallet !== null &&
    repayableBalance.status === 'ok';
  const walletBalance =
    repayableBalance.status === 'ok' ? moneyToNumber(repayableBalance.amount) : 0;
  const [isReviewBalanceLoading, setIsReviewBalanceLoading] = useState(false);
  const [reviewBalance, setReviewBalance] = useState<number | null>(null);
  const [reviewBalanceError, setReviewBalanceError] = useState('');

  // Interest accrues by actual elapsed days since the last accrual
  // (ACT/365), falling back to a monthly estimate when no date is known.
  const accruedInterest = useMemo(
    () => (selectedLine ? getAccruedInterest(selectedLine, new Date()) : 0),
    [selectedLine],
  );
  const accruedDays = useMemo(
    () => (selectedLine ? getAccruedInterestDays(selectedLine, new Date()) : null),
    [selectedLine],
  );

  const totalOwed = useMemo(
    () => (selectedLine ? roundToCents(selectedLine.utilized + accruedInterest) : 0),
    [selectedLine, accruedInterest],
  );

  const validation = useMemo(
    () =>
      selectedLine
        ? getRepayAmountValidation(amountStr, totalOwed, walletBalance)
        : null,
    [amountStr, selectedLine, totalOwed, walletBalance],
  );

  const suggestion = useMemo(
    () =>
      selectedLine
        ? suggestRepayAmount({
            totalDue: totalOwed,
            limit: selectedLine.limit,
            walletBalance,
            apr: selectedLine.apr,
            nextPaymentAmount: selectedLine.nextPaymentAmount,
          })
        : { amount: 0, reason: 'nothing_due' as const },
    [selectedLine, totalOwed, walletBalance],
  );
  const usesReserve = suggestion.amount > 0 &&
    walletBalance - suggestion.amount < (validation?.recommendedWalletReserve ?? 0);
  const minimumDue = Math.min(
    totalOwed,
    selectedLine?.nextPaymentAmount ??
      Math.max(totalOwed * (selectedLine?.apr ?? 0) / 100 / 12, 1),
  );
  const minimumShortfall = Math.max(0, minimumDue - walletBalance);
  const suggestionMessage = {
    target_utilization: 'Aims to bring your credit utilization to 50%.',
    minimum_due: 'Covers the minimum due.',
    interest_only: 'Covers estimated monthly interest, with a $1 minimum.',
    capped_by_wallet: 'Limited by your wallet balance after keeping a reserve.',
    insufficient_for_minimum: `Your wallet is ${formatMoney(minimumShortfall)} short of the minimum due. A partial payment will not cover it.`,
    nothing_due: 'No repayment is due for Smart Pay.',
    empty_wallet: 'Your wallet is empty. Add funds to use Smart Pay.',
  }[suggestion.reason] + (usesReserve ? ' Uses part of your reserve to cover the minimum due.' : '');
  const smartPayDisabled = !hasRepayableBalance || suggestion.amount === 0;
  const suggestionTone = usesReserve || suggestion.reason === 'insufficient_for_minimum' ||
    suggestion.reason === 'capped_by_wallet' || suggestion.reason === 'empty_wallet'
    ? SEVERITY_CONFIG.warning
    : SEVERITY_CONFIG.info;

  const amount = validation?.amount ?? 0;
  const isInvalid = !validation?.isValid;
  const needsConfirm = requiresRepayConfirmation(amount);
  const isConfirmDisabled =
    needsConfirm && !isTypedAmountMatch(confirmAmountStr, amount);
  const isReviewConfirmDisabled =
    !hasRepayableBalance ||
    isInvalid ||
    amount <= 0 ||
    isConfirmDisabled ||
    isReviewBalanceLoading ||
    reviewBalance === null ||
    amount > reviewBalance;

  const activeTone = validation
    ? SEVERITY_CONFIG[validation.feedback.severity]
    : SEVERITY_CONFIG.info;

  const handlePercent = (pct: number) => {
    if (!validation || !hasRepayableBalance) return;
    let target = (validation.maxRepayAmount * pct) / 100;
    if (target > walletBalance) target = walletBalance;
    setAmountStr(target.toFixed(2));
  };

  const handleSmartPay = () => {
    if (!selectedLine || !hasRepayableBalance || suggestion.amount === 0) return;
    setAmountStr(suggestion.amount.toFixed(2));
    setSrAnnouncement(`Smart Pay amount set: ${formatMoney(suggestion.amount)}. ${suggestionMessage}`);
  };

  const optimiserLines = useMemo<OptimiseRepaymentLine[]>(() => {
    const now = new Date();
    return creditLines.map((cl) => ({
      id: cl.id,
      name: cl.name,
      balance: roundToCents(cl.utilized + getAccruedInterest(cl, now)),
      apr: cl.apr,
      minimumPayment: cl.nextPaymentAmount,
      status: cl.status,
    }));
  }, [creditLines]);

  const handleApplyOptimisedPlan = useCallback((plan: OptimisedRepaymentPlan) => {
    setAppliedPlan(plan);
    const first = plan.allocations.find((a) => a.amount > 0);
    if (!first) return;
    setSelectedId(first.lineId);
    setAmountStr(first.amount.toFixed(2));
    setSrAnnouncement(
      `Applied ${plan.strategy} plan. Prefilled ${formatMoney(first.amount)} for ${first.lineName}.`,
    );
  }, []);

  const handleReview = () => {
    if (hasRepayableBalance && !isInvalid && amount > 0) {
      setConfirmAmountStr('');
      setReviewBalance(null);
      setReviewBalanceError('');
      setStep('review');
      // Announce the transition so SR users know they've moved to the review step.
      setSrAnnouncement(`Review step: repaying ${formatMoney(amount)}. Confirm or go back.`);
    }
  };

  const handleConfirm = async () => {
    if (!selectedLine || isSubmittingRef.current) return;
    // Defense in depth (issue #1188): the review path re-checks amount
    // validity here as well as through the disabled state, so neither a
    // stale click nor the Enter shortcut can confirm an invalid amount.
    if (step === 'review' && (isReviewConfirmDisabled || isInvalid)) return;
    if (step === 'input' && (!hasRepayableBalance || isInvalid || amount > walletBalance)) return;

    if (!isOnline) {
      isSubmittingRef.current = false;
      queueAction(() => {
        void handleConfirm();
      }, 'repay-confirm');
      setIsOfflineBlocked(true);
      return;
    }

    isSubmittingRef.current = true;

    if (step === 'input') {
      try {
        const refreshedBalances = await refreshBalance();
        const refreshed = getRepayableBalance(
          refreshedBalances,
          SETTLEMENT_ASSET,
        );
        const refreshedAmount =
          refreshed.status === 'ok' ? moneyToNumber(refreshed.amount) : 0;
        if (
          refreshed.status !== 'ok' ||
          !moneyCoversAmount(refreshed.amount, amount)
        ) {
          isSubmittingRef.current = false;
          setReviewBalance(refreshed.status === 'ok' ? refreshedAmount : null);
          setReviewBalanceError(
            refreshed.status === 'ok'
              ? `Your ${SETTLEMENT_ASSET.code} balance dropped below the repayment amount. Reduce the amount to ${formatMoney(refreshedAmount)} or less.`
              : `Unable to verify your ${SETTLEMENT_ASSET.code} balance. Check your trustline and try again.`,
          );
          setStep('review');
          setSrAnnouncement(
            refreshed.status === 'ok'
              ? `Your ${SETTLEMENT_ASSET.code} balance dropped below the repayment amount.`
              : `Unable to verify your ${SETTLEMENT_ASSET.code} balance.`,
          );
          return;
        }
      } catch {
        isSubmittingRef.current = false;
        setReviewBalanceError(
          `Unable to verify your ${SETTLEMENT_ASSET.code} balance. Try again before confirming.`,
        );
        setStep('review');
        setSrAnnouncement(
          `Unable to verify your ${SETTLEMENT_ASSET.code} balance.`,
        );
        return;
      }
    }

    draftClearedRef.current = true;
    clearRepayDraft();
    draftSave.reset();
    const transactionId = `TXN-${Date.now()}`;
    const timestamp = new Date().toISOString();
    if (wallet?.publicKey) {
      await submitRepayment({
        transactionId,
        timestamp,
        walletPublicKey: wallet.publicKey,
        creditLineId: selectedLine.id,
        creditLineName: selectedLine.name,
        amount,
        remainingDebt,
        limit: selectedLine.limit,
        apr: selectedLine.apr,
        nextPaymentAmount: selectedLine.nextPaymentAmount,
      });
    }
    emit('repay:success', {
      transactionId,
      creditLineId: selectedLine.id,
      creditLineName: selectedLine.name,
      amount,
      remainingDebt,
      timestamp,
    });
    navigate(`/repay/success?tx=${encodeURIComponent(transactionId)}`, {
      state: {
        amount,
        creditLineName: selectedLine.name,
        creditLineId: selectedLine.id,
        transactionId,
        remainingDebt,
        limit: selectedLine.limit,
        apr: selectedLine.apr,
        nextPaymentAmount: selectedLine.nextPaymentAmount,
        timestamp,
      },
    });
  };

  const handleBack = useCallback(() => {
    isSubmittingRef.current = false;
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

    // Issue #1188: re-validate the draft against *current* data before
    // trusting its saved step. The stored amount may exceed the debt (or the
    // wallet) now, the line may have been closed, or the draft may belong to
    // a different wallet. Only a still-valid review draft returns to review;
    // anything else falls back to the input step so the user sees the live
    // validation instead of a Confirm button for an amount that no longer
    // checks out.
    const draftLine =
      mockLines.find((cl) => cl.id === recoveredDraft.creditLineId) ?? null;
    const ownerOk = identityKey !== null && recoveredDraft.owner === identityKey;
    const isAmountStillValid =
      draftLine !== null &&
      isRepayable(draftLine) &&
      getRepayAmountValidation(
        recoveredDraft.amountStr,
        roundToCents(
          draftLine.utilized + getAccruedInterest(draftLine, new Date()),
        ),
        walletBalance,
      ).isValid;
    const restoreToReview =
      recoveredDraft.step === 'review' && ownerOk && isAmountStillValid;

    setSelectedId(recoveredDraft.creditLineId);
    setAmountStr(recoveredDraft.amountStr);
    // Always clear the typed confirmation on restore: the amount must be
    // re-confirmed even when the review step itself is restored (issue #1188).
    setConfirmAmountStr('');
    setIsAutoSchedule(recoveredDraft.isAutoSchedule);
    setReviewBalance(null);
    setReviewBalanceError('');
    setStep(restoreToReview ? 'review' : 'input');
    setShowRecoveryPrompt(false);
    setRecoveredDraft(null);
    setDraftDiscardReason(null);
    setSrAnnouncement(
      restoreToReview
        ? `Restored repayment draft: ${formatMoney(parseFloat(recoveredDraft.amountStr) || 0)} on ${recoveredDraft.creditLineId}.`
        : `Restored repayment draft on ${recoveredDraft.creditLineId}. Review the amount before continuing.`,
    );
  }, [recoveredDraft, identityKey, walletBalance]);

  const handleDismissDraft = useCallback(() => {
    clearRepayDraft();
    draftSave.reset();
    setShowRecoveryPrompt(false);
    setRecoveredDraft(null);
    setSrAnnouncement('Previous repayment draft discarded.');
  }, [draftSave.reset]);

  // ── Initial draft recovery check ──────────────────────────────────────
  useEffect(() => {
    if (creditStatus !== 'success') return;
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;

    const draft = loadRepayDraft();
    if (!draft || preselectedId) {
      // Only offer recovery when the user hasn't navigated with a specific
      // credit line preselected (which implies a fresh intent).
      return;
    }

    // Issue #1188: discard drafts that can no longer be safely resumed
    // instead of offering to restore them.
    const draftLine =
      mockLines.find((cl) => cl.id === draft.creditLineId) ?? null;
    if (!draftLine || !isRepayable(draftLine)) {
      clearRepayDraft();
      setDraftDiscardReason('line-unrepayable');
      setSrAnnouncement(DRAFT_DISCARD_MESSAGE['line-unrepayable']);
      return;
    }
    // When the wallet identity is already known, a draft from another wallet
    // is discarded here. When it isn't (wallet still connecting), the owner
    // check in handleRestoreDraft still refuses to trust the stored step.
    if (identityKey !== null && draft.owner !== identityKey) {
      clearRepayDraft();
      setDraftDiscardReason('owner-mismatch');
      setSrAnnouncement(DRAFT_DISCARD_MESSAGE['owner-mismatch']);
      return;
    }

    setRecoveredDraft(draft);
    setShowRecoveryPrompt(true);
  }, [preselectedId, identityKey, creditStatus, mockLines]);

  // ── Clear the draft when the wallet identity changes ──────────────────
  // Issue #1188: a draft saved under one wallet must not survive an account
  // or network switch into another wallet's session.
  useEffect(() => {
    const prevIdentity = prevIdentityKeyRef.current;
    prevIdentityKeyRef.current = identityKey;
    if (identityKey === null || identityKey === prevIdentity) return;

    const draft = loadRepayDraft();
    if (draft && draft.owner !== identityKey) {
      clearRepayDraft();
      draftSave.reset();
      setShowRecoveryPrompt(false);
      setRecoveredDraft(null);
      setDraftDiscardReason('owner-mismatch');
      setSrAnnouncement(DRAFT_DISCARD_MESSAGE['owner-mismatch']);
    }
  }, [identityKey, draftSave.reset]);

  // ── Persist draft on state changes ────────────────────────────────────
  useEffect(() => {
    // Don't persist if the draft was just intentionally cleared on confirmation.
    if (draftClearedRef.current) return;

    // Don't save during loading or after cancel.
    if (creditStatus !== 'success' || !selectedId) return;
    // Don't save without a known wallet identity (the draft is owner-scoped).
    if (!identityKey) return;
    // Don't save empty amounts on the input step.
    if (step === 'input' && !amountStr) return;

    const ok = saveRepayDraft({
      step,
      creditLineId: selectedId,
      amountStr,
      confirmAmountStr,
      isAutoSchedule,
      owner: identityKey,
    });
    if (ok) {
      draftSave.markSaved();
    } else {
      draftSave.markError();
    }
  }, [
    step,
    selectedId,
    amountStr,
    confirmAmountStr,
    isAutoSchedule,
    creditStatus,
    identityKey,
    draftSave.markSaved,
    draftSave.markError,
  ]);

  useEffect(() => {
    if (walletStatus !== 'connected' || !wallet) {
      setSrAnnouncement(
        `Connect your wallet to check your ${SETTLEMENT_ASSET.code} balance.`,
      );
    } else if (repayableBalance.status === 'loading') {
      setSrAnnouncement(
        `Loading your ${SETTLEMENT_ASSET.code} wallet balance.`,
      );
    } else if (repayableBalance.status === 'no_trustline') {
      setSrAnnouncement(
        `Add a ${SETTLEMENT_ASSET.code} trustline to repay.`,
      );
    } else {
      setSrAnnouncement(
        `${SETTLEMENT_ASSET.code} wallet balance loaded.`,
      );
    }
  }, [walletStatus, wallet, repayableBalance.status]);

  useEffect(() => {
    if (step !== 'review') return;
    if (walletStatus !== 'connected' || !wallet) {
      setIsReviewBalanceLoading(false);
      setReviewBalance(null);
      setReviewBalanceError('Connect your wallet to confirm this repayment.');
      return;
    }

    let isCurrent = true;
    setIsReviewBalanceLoading(true);
    setReviewBalance(null);
    setReviewBalanceError('');
    setSrAnnouncement(
      `Refreshing your ${SETTLEMENT_ASSET.code} wallet balance.`,
    );

    refreshBalance()
      .then((freshBalances) => {
        if (!isCurrent) return;
        const fresh = getRepayableBalance(freshBalances, SETTLEMENT_ASSET);
        if (fresh.status !== 'ok') {
          setReviewBalanceError(
            `Unable to verify your ${SETTLEMENT_ASSET.code} balance. Check your trustline and try again.`,
          );
          setSrAnnouncement(
            `Unable to verify your ${SETTLEMENT_ASSET.code} balance.`,
          );
          return;
        }

        const freshAmount = moneyToNumber(fresh.amount);
        setReviewBalance(freshAmount);
        if (!moneyCoversAmount(fresh.amount, amount)) {
          setReviewBalanceError(
            `Your ${SETTLEMENT_ASSET.code} balance dropped below the repayment amount. Reduce the amount to ${formatMoney(freshAmount)} or less.`,
          );
          setSrAnnouncement(
            `Your ${SETTLEMENT_ASSET.code} balance dropped below the repayment amount.`,
          );
        }
      })
      .catch(() => {
        if (!isCurrent) return;
        setReviewBalanceError(
          `Unable to refresh your ${SETTLEMENT_ASSET.code} balance. Try again before confirming.`,
        );
        setSrAnnouncement(
          `Unable to refresh your ${SETTLEMENT_ASSET.code} balance.`,
        );
      })
      .finally(() => {
        if (isCurrent) setIsReviewBalanceLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [step, amount, refreshBalance, walletStatus, wallet]);

  useEffect(() => {
    if (walletStatus !== 'connected' || !wallet) {
      setSrAnnouncement(
        `Connect your wallet to check your ${SETTLEMENT_ASSET.code} balance.`,
      );
    } else if (repayableBalance.status === 'loading') {
      setSrAnnouncement(
        `Loading your ${SETTLEMENT_ASSET.code} wallet balance.`,
      );
    } else if (repayableBalance.status === 'no_trustline') {
      setSrAnnouncement(
        `Add a ${SETTLEMENT_ASSET.code} trustline to repay.`,
      );
    } else {
      setSrAnnouncement(
        `${SETTLEMENT_ASSET.code} wallet balance loaded.`,
      );
    }
  }, [walletStatus, wallet, repayableBalance.status]);

  useEffect(() => {
    if (step !== 'review') return;
    if (walletStatus !== 'connected' || !wallet) {
      setIsReviewBalanceLoading(false);
      setReviewBalance(null);
      setReviewBalanceError('Connect your wallet to confirm this repayment.');
      return;
    }

    let isCurrent = true;
    setIsReviewBalanceLoading(true);
    setReviewBalance(null);
    setReviewBalanceError('');
    setSrAnnouncement(
      `Refreshing your ${SETTLEMENT_ASSET.code} wallet balance.`,
    );

    refreshBalance()
      .then((freshBalances) => {
        if (!isCurrent) return;
        const fresh = getRepayableBalance(freshBalances, SETTLEMENT_ASSET);
        if (fresh.status !== 'ok') {
          setReviewBalanceError(
            `Unable to verify your ${SETTLEMENT_ASSET.code} balance. Check your trustline and try again.`,
          );
          setSrAnnouncement(
            `Unable to verify your ${SETTLEMENT_ASSET.code} balance.`,
          );
          return;
        }

        const freshAmount = moneyToNumber(fresh.amount);
        setReviewBalance(freshAmount);
        if (!moneyCoversAmount(fresh.amount, amount)) {
          setReviewBalanceError(
            `Your ${SETTLEMENT_ASSET.code} balance dropped below the repayment amount. Reduce the amount to ${formatMoney(freshAmount)} or less.`,
          );
          setSrAnnouncement(
            `Your ${SETTLEMENT_ASSET.code} balance dropped below the repayment amount.`,
          );
        }
      })
      .catch(() => {
        if (!isCurrent) return;
        setReviewBalanceError(
          `Unable to refresh your ${SETTLEMENT_ASSET.code} balance. Try again before confirming.`,
        );
        setSrAnnouncement(
          `Unable to refresh your ${SETTLEMENT_ASSET.code} balance.`,
        );
      })
      .finally(() => {
        if (isCurrent) setIsReviewBalanceLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [step, amount, refreshBalance, walletStatus, wallet]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('button, a, select, dialog, [role="dialog"]')) {
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
        } else if (step === 'review' && !isReviewConfirmDisabled) {
          handleConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, selectedLine, isInvalid, amount, isReviewConfirmDisabled, handleBack, suggestion, suggestionMessage, walletBalance]);

  // Task ariallive-v7: announce validation errors to screen readers
  useEffect(() => {
    if (validation?.feedback.severity === 'danger' && validation.feedback.message) {
      setSrAnnouncement(`Error: ${validation.feedback.message}`);
    }
  }, [validation?.feedback.message, validation?.feedback.severity]);

  // ── Multi-line batch repayment derived state ──────────────────────────
  const accruedByLineId = useMemo(() => {
    const now = new Date();
    const map: Record<string, number> = {};
    for (const cl of creditLines) {
      map[cl.id] = getAccruedInterest(cl, now);
    }
    return map;
  }, [creditLines]);

  const selectedBatchLines = useMemo(
    () => creditLines.filter((cl) => selectedLineIds.includes(cl.id)),
    [creditLines, selectedLineIds],
  );

  const batchTotalOwed = useMemo(
    () =>
      roundToCents(
        selectedBatchLines.reduce(
          (sum, cl) => sum + cl.utilized + (accruedByLineId[cl.id] ?? 0),
          0,
        ),
      ),
    [selectedBatchLines, accruedByLineId],
  );

  const batchAllocation: BatchRepaymentAllocation = useMemo(() => {
    if (batchInputMode === 'total') {
      const parsed = parseFloat(batchTotalStr);
      const totalAmt = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      return allocateBatchRepayment(
        selectedBatchLines,
        totalAmt,
        accruedByLineId,
        batchStrategy,
      );
    }

    const allocations: Record<string, RepaymentAllocation> = {};
    const items: BatchRepaymentAllocation['items'] = [];
    let totalAllocatedCents = 0;
    let totalInterestCents = 0;
    let totalPrincipalCents = 0;
    let totalRemainingCents = 0;
    let unallocatedCents = 0;

    for (const cl of selectedBatchLines) {
      const parsed = parseFloat(perLineAmountStrs[cl.id] ?? '');
      const lineAmt = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      const single = allocateBatchRepayment(
        [cl],
        lineAmt,
        accruedByLineId,
        'highest-apr',
      );
      const item = single.items[0];
      allocations[cl.id] = item.allocation;
      items.push(item);
      totalAllocatedCents += Math.round(item.allocatedAmount * 100);
      totalInterestCents += Math.round(item.allocation.interestPaid * 100);
      totalPrincipalCents += Math.round(item.allocation.principalPaid * 100);
      totalRemainingCents += Math.round(item.allocation.remainingTotal * 100);
      unallocatedCents += Math.round(single.unallocatedRemainder * 100);
    }

    return {
      allocations,
      items,
      totalAllocated: totalAllocatedCents / 100,
      totalInterestPaid: totalInterestCents / 100,
      totalPrincipalPaid: totalPrincipalCents / 100,
      totalRemaining: totalRemainingCents / 100,
      unallocatedRemainder: unallocatedCents / 100,
    };
  }, [
    batchInputMode,
    batchTotalStr,
    perLineAmountStrs,
    selectedBatchLines,
    accruedByLineId,
    batchStrategy,
  ]);

  const batchExceedsWallet =
    hasRepayableBalance && batchAllocation.totalAllocated > walletBalance;

  const isBatchSubmitDisabled =
    isBatchSubmitting ||
    !hasRepayableBalance ||
    selectedBatchLines.length === 0 ||
    batchAllocation.totalAllocated <= 0 ||
    batchExceedsWallet;

  useEffect(() => {
    if (!isMultiLineMode || batchResults !== null) return;
    if (selectedBatchLines.length === 0) {
      setSrAnnouncement('No credit lines selected for multi-line repayment.');
      return;
    }
    if (batchAllocation.totalAllocated > 0) {
      const countLabel = `${selectedBatchLines.length} ${selectedBatchLines.length === 1 ? 'line' : 'lines'}`;
      const remainderText =
        batchAllocation.unallocatedRemainder > 0
          ? ` Unallocated remainder: ${formatMoney(batchAllocation.unallocatedRemainder)}.`
          : '';
      setSrAnnouncement(
        `Allocation preview updated for ${countLabel}: paying ${formatMoney(batchAllocation.totalAllocated)} (${formatMoney(batchAllocation.totalInterestPaid)} interest, ${formatMoney(batchAllocation.totalPrincipalPaid)} principal).${remainderText}`,
      );
    } else {
      setSrAnnouncement(
        `${selectedBatchLines.length} ${selectedBatchLines.length === 1 ? 'line' : 'lines'} selected. Enter a repayment amount to preview allocation.`,
      );
    }
  }, [
    isMultiLineMode,
    batchResults,
    selectedBatchLines.length,
    batchAllocation.totalAllocated,
    batchAllocation.totalInterestPaid,
    batchAllocation.totalPrincipalPaid,
    batchAllocation.unallocatedRemainder,
  ]);

  const handleToggleBatchLine = (lineId: string) => {
    setSelectedLineIds((prev) =>
      prev.includes(lineId)
        ? prev.filter((id) => id !== lineId)
        : [...prev, lineId],
    );
  };

  const handleToggleMultiLineMode = () => {
    setIsMultiLineMode((prev) => {
      const next = !prev;
      setBatchResults(null);
      if (next) {
        setSrAnnouncement(
          'Multi-line repayment mode enabled. Select credit lines to repay.',
        );
      } else {
        setSrAnnouncement('Single-line repayment mode enabled.');
      }
      return next;
    });
  };

  const handleBatchSubmit = () => {
    if (isBatchSubmitDisabled || !wallet?.publicKey) return;

    setIsBatchSubmitting(true);
    const timestamp = new Date().toISOString();
    const results: BatchRepayLineResult[] = [];
    const linesById = new Map(selectedBatchLines.map((cl) => [cl.id, cl]));

    for (let idx = 0; idx < batchAllocation.items.length; idx += 1) {
      const item = batchAllocation.items[idx];
      if (item.allocatedAmount <= 0) continue;
      const cl = linesById.get(item.lineId);
      if (!cl) continue;

      const transactionId = `TXN-${Date.now()}-${idx + 1}`;
      try {
        saveMockRepaymentTransaction({
          id: transactionId,
          owner: wallet.publicKey,
          status: 'Completed',
          creditLineId: cl.id,
          creditLineName: cl.name,
          amount: item.allocatedAmount,
          remainingDebt: item.allocation.remainingTotal,
          limit: cl.limit,
          apr: cl.apr,
          nextPaymentAmount: cl.nextPaymentAmount,
          timestamp,
        });
        results.push({
          lineId: cl.id,
          lineName: cl.name,
          amount: item.allocatedAmount,
          allocation: item.allocation,
          status: 'success',
          transactionId,
        });
      } catch (err) {
        results.push({
          lineId: cl.id,
          lineName: cl.name,
          amount: item.allocatedAmount,
          allocation: item.allocation,
          status: 'error',
          error:
            err instanceof Error
              ? err.message
              : 'Repayment failed for this credit line.',
        });
      }
    }

    setBatchResults(results);
    setIsBatchSubmitting(false);

    const succeeded = results.filter((r) => r.status === 'success').length;
    const failed = results.length - succeeded;
    if (failed === 0) {
      setSrAnnouncement(
        `Batch repayment complete: ${succeeded} ${succeeded === 1 ? 'line' : 'lines'} repaid.`,
      );
    } else {
      setSrAnnouncement(
        `Batch repayment finished with partial results: ${succeeded} succeeded, ${failed} failed.`,
      );
    }
  };

  if (!selectedLine) {
    return (
    <div className="repay-page mx-auto max-w-2xl space-y-6 px-4 py-8">
        <LiveRegion id="repay-announcement" message={srAnnouncement} />
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

      {/* ── Draft discarded note (credit line picker view) ─────────── */}
      {draftDiscardReason && (
        <div
          role="status"
          aria-live="polite"
          className="mb-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
          data-testid="repay-draft-discarded-note"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{DRAFT_DISCARD_MESSAGE[draftDiscardReason]}</span>
        </div>
      )}

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

        {creditStatus === 'error' ? (
          <div role="alert" className="rounded-lg border border-error/40 bg-error/10 p-4 text-sm text-error">
            <p>{creditError?.message ?? 'Unable to load credit lines.'}</p>
            <button type="button" className="mt-3 underline" onClick={() => void refetchCreditLines().catch(() => undefined)}>
              Retry
            </button>
          </div>
        ) : creditStatus === 'loading' ? (
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
          <>
            {/* Issue #1185: unrepayable ?line= deep-link — status message + picker */}
            {unrepayableDeepLink && (
              <div
                role="status"
                aria-live="polite"
                className="mb-2 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
                data-testid="repay-unrepayable-notice"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>This line has no outstanding balance.</span>
              </div>
            )}
            {creditLines.length > 1 && hasRepayableBalance && (
              <div className="mt-4">
                <SmartPayCTA
                  title="Smart Pay Multi-Line Optimiser"
                  description="Compare avalanche (highest APR first) and snowball (smallest balance first) across your credit lines."
                  cta={null}
                  lines={optimiserLines}
                  budget={walletBalance}
                  onApplyPlan={handleApplyOptimisedPlan}
                />
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
              <div>
                <label
                  htmlFor="multi-line-repay-toggle"
                  className="text-sm font-semibold text-foreground cursor-pointer"
                  onClick={handleToggleMultiLineMode}
                >
                  Repay multiple lines
                </label>
                <p className="text-xs text-muted">
                  Select several credit lines and split one payment across them
                </p>
              <button
                id="multi-line-repay-toggle"
                type="button"
                role="switch"
                aria-checked={isMultiLineMode}
                onClick={handleToggleMultiLineMode}
                data-testid="multi-line-repay-toggle"
                className={`rp-toggle-switch relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  isMultiLineMode ? 'bg-accent' : 'bg-border'
                } ${motionClasses(isReducedMotionActive, 'transition-colors duration-200 ease-in-out')}`}
              >
                <span
                  aria-hidden="true"
                  className={`repay-page__toggle-thumb pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 ${
                    isMultiLineMode ? 'translate-x-5' : 'translate-x-0'
                  } ${motionClasses(isReducedMotionActive, 'transition duration-200 ease-in-out')}`}
                />
              </button>
                      const planned = appliedPlan?.allocations.find((a) => a.lineId === cl.id);
                      if (planned && planned.amount > 0) {
                        setAmountStr(planned.amount.toFixed(2));
                        setSrAnnouncement(
                          `Selected ${cl.name}. Prefilled ${formatMoney(planned.amount)} from your ${appliedPlan?.strategy} plan.`,
                        );
                      } else {
                        setSrAnnouncement(`Selected ${cl.name}. Choose a repayment amount.`);
                      }
            </div>

            {isMultiLineMode ? (
              walletStatus !== 'connected' || !wallet ? (
                <div className="mt-4">
                  <ConnectWalletPrompt assetCode={SETTLEMENT_ASSET.code} />
                </div>
              ) : batchResults !== null ? (
                <div
                  className="mt-4 space-y-4 rounded-lg border border-border bg-surface p-5"
                  data-testid="batch-repay-results"
                >
                  {(() => {
                    const succeeded = batchResults.filter(
                      (r) => r.status === 'success',
                    );
                    const failed = batchResults.filter(
                      (r) => r.status === 'error',
                    );
                    const totalPaid = roundToCents(
                      succeeded.reduce((sum, r) => sum + r.amount, 0),
                    );
                    const allSucceeded = failed.length === 0;
                    return (
                      <>
                        <div
                          role="status"
                          aria-live="polite"
                          className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
                            allSucceeded
                              ? 'border-success/40 bg-success/10 text-success'
                              : 'border-warning/40 bg-warning/10 text-warning'
                          }`}
                        >
                          {allSucceeded ? (
                            <CheckCircle
                              className="mt-0.5 h-5 w-5 shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <AlertTriangle
                              className="mt-0.5 h-5 w-5 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <div>
                            <p className="font-semibold">
                              {allSucceeded
                                ? `Batch repayment complete (${succeeded.length} ${succeeded.length === 1 ? 'line' : 'lines'})`
                                : `${succeeded.length} of ${batchResults.length} repayments completed`}
                            </p>
                            <p className="mt-0.5 text-xs opacity-90">
                              Total repaid:{' '}
                              <span className="font-semibold num-tabular">
                                {formatMoney(totalPaid)}
                              </span>
                              {failed.length > 0 &&
                                ` · ${failed.length} ${failed.length === 1 ? 'line' : 'lines'} failed`}
                            </p>
                          </div>
                        </div>

                        <div className="rp-batch-table-wrap overflow-x-auto">
                          <table className="rp-batch-table w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-border text-xs uppercase text-muted">
                                <th className="py-2 pr-3 font-semibold">Credit Line</th>
                                <th className="py-2 px-3 font-semibold">Status</th>
                                <th className="py-2 px-3 text-right font-semibold">Paid</th>
                                <th className="py-2 pl-3 text-right font-semibold">Remaining</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {batchResults.map((res) => (
                                <tr
                                  key={res.lineId}
                                  data-testid={`batch-result-row-${res.lineId}`}
                                >
                                  <td className="py-2.5 pr-3">
                                    <p className="font-medium text-foreground">
                                      {res.lineName}
                                    </p>
                                    <p className="text-xs text-muted">
                                      {res.transactionId ?? res.lineId}
                                    </p>
                                    {res.error && (
                                      <p
                                        role="alert"
                                        className="mt-0.5 text-xs text-error"
                                      >
                                        {res.error}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {res.status === 'success' ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                                        Completed
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-error/40 bg-error/10 px-2 py-0.5 text-xs font-semibold text-error">
                                        Failed
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-medium num-tabular text-foreground">
                                    {formatMoney(res.amount)}
                                  </td>
                                  <td className="py-2.5 pl-3 text-right font-medium num-tabular text-foreground">
                                    {formatMoney(res.allocation.remainingTotal)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setBatchResults(null);
                              setBatchTotalStr('');
                              setPerLineAmountStrs({});
                            }}
                            className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            Make another repayment
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            Back to dashboard
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="mt-4 space-y-4" data-testid="multi-line-repay-panel">
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold uppercase text-muted">
                      Select repayable credit lines ({selectedBatchLines.length} selected)
                    </legend>
                    <div className="mt-2 space-y-2">
                      {creditLines.map((cl) => {
                        const checked = selectedLineIds.includes(cl.id);
                        const accrued = accruedByLineId[cl.id] ?? 0;
                        const lineOwed = roundToCents(cl.utilized + accrued);
                        const delinquent = isDelinquentLine(cl);
                        return (
                          <div
                            key={cl.id}
                            className={`rp-batch-line-row rounded-lg border bg-surface p-3.5 ${
                              checked
                                ? 'border-accent bg-accent/5'
                                : delinquent
                                  ? 'border-warning/60'
                                  : 'border-border'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                id={`batch-line-${cl.id}`}
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleBatchLine(cl.id)}
                                className="mt-1 h-4 w-4 rounded border-border accent-accent"
                              />
                              <label
                                htmlFor={`batch-line-${cl.id}`}
                                className="flex flex-1 cursor-pointer flex-wrap items-start justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                    <StatusBadge status={cl.status} />
                                    <span className="text-xs text-muted num-tabular">
                                      {cl.apr}% APR
                                    </span>
                                  </div>
                                  <p className="font-semibold text-foreground">
                                    {cl.name}
                                  </p>
                                  <p className="text-xs text-muted">{cl.id}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-foreground num-tabular">
                                    {formatMoney(lineOwed)}
                                  </p>
                                  <p className="text-xs text-muted">
                                    Total owed
                                  </p>
                                </div>
                              </label>
                            </div>
                            {checked && batchInputMode === 'per-line' && (
                              <div className="mt-3 pl-7">
                                <label
                                  htmlFor={`batch-per-line-amount-${cl.id}`}
                                  className="block text-xs font-medium text-muted"
                                >
                                  Amount for {cl.name}
                                </label>
                                <input
                                  id={`batch-per-line-amount-${cl.id}`}
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  placeholder="0.00"
                                  value={perLineAmountStrs[cl.id] ?? ''}
                                  onChange={(e) =>
                                    setPerLineAmountStrs((prev) => ({
                                      ...prev,
                                      [cl.id]: e.target.value,
                                    }))
                                  }
                                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground num-tabular focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex gap-2" role="group" aria-label="Repayment amount mode">
                        <button
                          type="button"
                          onClick={() => setBatchInputMode('total')}
                          aria-pressed={batchInputMode === 'total'}
                          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                            batchInputMode === 'total'
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border text-muted hover:text-foreground'
                          }`}
                        >
                          Single total
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchInputMode('per-line')}
                          aria-pressed={batchInputMode === 'per-line'}
                          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                            batchInputMode === 'per-line'
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border text-muted hover:text-foreground'
                          }`}
                        >
                          Per-line amounts
                        </button>
                      </div>
                      <span className="text-xs text-muted">
                        Wallet:{' '}
                        <span className="num-tabular font-medium text-foreground">
                          {hasRepayableBalance
                            ? formatMoney(walletBalance)
                            : 'Unavailable'}
                        </span>
                      </span>
                    </div>

                    {batchInputMode === 'total' && (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label
                            htmlFor="batch-strategy"
                            className="text-xs font-semibold uppercase text-muted"
                          >
                            Allocation strategy
                          </label>
                          <select
                            id="batch-strategy"
                            value={batchStrategy}
                            onChange={(e) =>
                              setBatchStrategy(
                                e.target.value as BatchAllocationStrategy,
                              )
                            }
                            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            <option value="highest-apr">Highest APR first</option>
                            <option value="pro-rata">Pro-rata by balance</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor="batch-total-amount"
                              className="text-sm font-semibold text-foreground"
                            >
                              Total amount to repay
                            </label>
                            <button
                              type="button"
                              disabled={
                                !hasRepayableBalance ||
                                selectedBatchLines.length === 0
                              }
                              onClick={() => {
                                const cap = Math.min(batchTotalOwed, walletBalance);
                                setBatchTotalStr(cap.toFixed(2));
                              }}
                              className="rounded border border-accent/30 px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                            >
                              MAX ({formatMoney(Math.min(batchTotalOwed, walletBalance))})
                            </button>
                          </div>
                          <div className="relative mt-2">
                            <span
                              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted"
                              aria-hidden="true"
                            >
                              $
                            </span>
                            <input
                              id="batch-total-amount"
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="0.00"
                              value={batchTotalStr}
                              onChange={(e) => setBatchTotalStr(e.target.value)}
                              disabled={!hasRepayableBalance}
                              className="rp-amount-input num-tabular w-full rounded-lg border border-border bg-background px-3 py-3 pl-8 text-lg font-semibold text-foreground outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {batchAllocation.unallocatedRemainder > 0 && (
                      <div
                        role="status"
                        data-testid="batch-unallocated-remainder"
                        className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning"
                      >
                        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          Amount exceeds total owed across selected lines. Payment
                          is capped at{' '}
                          <strong className="num-tabular">
                            {formatMoney(batchAllocation.totalAllocated)}
                          </strong>
                          ; unallocated remainder:{' '}
                          <strong className="num-tabular">
                            {formatMoney(batchAllocation.unallocatedRemainder)}
                          </strong>
                          .
                        </span>
                      </div>
                    )}

                    {batchExceedsWallet && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/10 p-3 text-xs text-error"
                      >
                        <AlertCircle
                          className="mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Total repayment ({formatMoney(batchAllocation.totalAllocated)})
                          exceeds your wallet balance ({formatMoney(walletBalance)}).
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Per-line allocation preview table */}
                  <div
                    className="rounded-lg border border-border bg-surface p-4"
                    data-testid="batch-allocation-preview"
                  >
                    <p className="text-xs font-semibold uppercase text-muted">
                      Allocation Preview
                    </p>
                    {selectedBatchLines.length === 0 ? (
                      <p className="mt-2 text-sm text-muted">
                        Select at least one credit line to preview the allocation.
                      </p>
                    ) : (
                      <div className="rp-batch-table-wrap mt-3 overflow-x-auto">
                        <table className="rp-batch-table w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-border text-xs uppercase text-muted">
                              <th className="py-2 pr-3 font-semibold">Credit Line</th>
                              <th className="py-2 px-3 text-right font-semibold">
                                Interest Paid
                              </th>
                              <th className="py-2 px-3 text-right font-semibold">
                                Principal Paid
                              </th>
                              <th className="py-2 pl-3 text-right font-semibold">
                                Remaining
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {selectedBatchLines.map((cl) => {
                              const lineAlloc = batchAllocation.allocations[cl.id];
                              return (
                                <tr
                                  key={cl.id}
                                  data-testid={`batch-preview-row-${cl.id}`}
                                >
                                  <td className="py-2.5 pr-3">
                                    <p className="font-medium text-foreground">
                                      {cl.name}
                                    </p>
                                    <p className="text-xs text-muted num-tabular">
                                      {cl.apr}% APR
                                    </p>
                                  </td>
                                  <td className="py-2.5 px-3 text-right num-tabular text-foreground">
                                    {formatMoney(lineAlloc?.interestPaid ?? 0)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right num-tabular text-foreground">
                                    {formatMoney(lineAlloc?.principalPaid ?? 0)}
                                  </td>
                                  <td className="py-2.5 pl-3 text-right font-semibold num-tabular text-foreground">
                                    {formatMoney(lineAlloc?.remainingTotal ?? 0)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-border font-semibold text-foreground">
                              <td className="py-2.5 pr-3">Total</td>
                              <td className="py-2.5 px-3 text-right num-tabular">
                                {formatMoney(batchAllocation.totalInterestPaid)}
                              </td>
                              <td className="py-2.5 px-3 text-right num-tabular">
                                {formatMoney(batchAllocation.totalPrincipalPaid)}
                              </td>
                              <td className="py-2.5 pl-3 text-right num-tabular">
                                {formatMoney(batchAllocation.totalRemaining)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleBatchSubmit}
                    disabled={isBatchSubmitDisabled}
                    data-testid="batch-repay-submit"
                    className={`w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${motionClasses(isReducedMotionActive, 'transition-all hover:brightness-110')}`}
                  >
                    {isBatchSubmitting
                      ? 'Submitting batch repayment…'
                      : `Submit Batch Repayment (${formatMoney(batchAllocation.totalAllocated)})`}
                  </button>
                </div>
              )
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
                  const delinquent = isDelinquentLine(cl);
                  return (
                    <button
                      key={cl.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(cl.id);
                        setSrAnnouncement(`Selected ${cl.name}. Choose a repayment amount.`);
                      }}
                      className={`rp-cl-card w-full rounded-lg border bg-surface p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${delinquent ? 'border-warning/60' : 'border-border'} ${motionClasses(isReducedMotionActive, 'transition-all hover:border-accent hover:bg-accent/5')}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          {/* Issue #1185: status badge — text conveys state, not colour alone (WCAG 1.4.1) */}
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={cl.status} />
                            {delinquent && (
                              <span
                                className="rp-overdue-label inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning"
                                aria-label="Overdue — repayment needed"
                              >
                                Overdue
                              </span>
                            )}
                          </div>
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
          </>
        )}
      </div>
    );
  }

  if (walletStatus !== 'connected' || !wallet) {
    return (
      <div className="repay-page mx-auto max-w-2xl space-y-6 px-4 py-8">
        <ConnectWalletPrompt assetCode={SETTLEMENT_ASSET.code} />
        <LiveRegion message={srAnnouncement} />
      </div>
    );
  }

  const oldPct = Math.round((selectedLine.utilized / selectedLine.limit) * 100);
  const allocation = allocateRepayment(selectedLine, amount, accruedInterest);
  const remainingDebt = allocation.remainingTotal;
  const newPct = Math.round((remainingDebt / selectedLine.limit) * 100);

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

      {/* ── Draft discarded note (form view) ───────────────────────── */}
      {draftDiscardReason && (
        <div
          role="status"
          aria-live="polite"
          className="mb-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
          data-testid="repay-draft-discarded-note"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{DRAFT_DISCARD_MESSAGE[draftDiscardReason]}</span>
        </div>
      )}

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
                    {repayableBalance.status === 'loading' ? (
                      <span className="flex items-center gap-2 text-xs text-muted" aria-busy="true">
                        Wallet:
                        <Skeleton width={72} height={14} />
                      </span>
                    ) : (
                      <span className="text-xs text-muted">
                        Wallet:{' '}
                        <span className="num-tabular">
                          {hasRepayableBalance ? formatMoney(walletBalance) : 'Unavailable'}
                        </span>
                      </span>
                    )}
                  </div>

                  {repayableBalance.status === 'no_trustline' && (
                    <div
                      className="mt-3 rounded-lg border border-error bg-error/10 p-3 text-sm text-error"
                      role="alert"
                    >
                      <p className="font-semibold">
                        Add a {SETTLEMENT_ASSET.code} trustline to repay
                      </p>
                      <p className="mt-1 text-xs">
                        Add the settlement-asset trustline to your wallet, then refresh your balance.
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handlePercent(pct)}
                        disabled={!hasRepayableBalance}
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
                    <span className="flex-1 [&>.accessible-tooltip]:w-full">
                      <Tooltip label={suggestionMessage} disabled={!smartPayDisabled}>
                        <span
                          className="w-full rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
                          tabIndex={smartPayDisabled ? 0 : undefined}
                          aria-label={smartPayDisabled ? 'Smart Pay unavailable' : undefined}
                          aria-describedby="smart-pay-reason"
                        >
                          <button
                            type="button"
                            onClick={handleSmartPay}
                            disabled={smartPayDisabled}
                            className={`rp-smart-pay-btn w-full rounded-md border border-success/30 px-2 py-1.5 text-xs font-medium text-success disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success ${motionClasses(isReducedMotionActive, 'transition-colors enabled:hover:bg-success/10')}`}
                            aria-label={`Smart Pay suggested repayment of ${formatMoney(suggestion.amount)}`}
                            aria-describedby="smart-pay-reason"
                          >
                            <span className="flex items-center justify-center gap-1">
                              Smart Pay <KbdHint keys={['S']} />
                            </span>
                          </button>
                        </span>
                      </Tooltip>
                    </span>
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
                      disabled={!hasRepayableBalance}
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

                  <div
                    id="smart-pay-reason"
                    role="status"
                    aria-label="Smart Pay suggestion"
                    className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs ${suggestionTone.patternClass}`}
                    style={{
                      border: `1px solid ${suggestionTone.border}`,
                      background: suggestionTone.bg,
                      color: suggestionTone.color,
                    }}
                  >
                    <span className="shrink-0">{suggestionTone.icon}</span>
                    <p>Smart Pay: {suggestionMessage}</p>
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
                      disabled={!hasRepayableBalance || isInvalid || amount <= 0}
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
                      disabled={!hasRepayableBalance || isInvalid || amount <= 0}
                      className={`rp-preview-btn w-full rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs font-semibold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${motionClasses(isReducedMotionActive, 'transition-all hover:bg-accent/20')}`}
                    >
                      Preview Consequences Modal
                    </button>
                    <DraftSavedIndicator
                      status={draftSave.status}
                      savedAt={draftSave.savedAt}
                      className="text-center"
                    />
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
                  accruedInterest={accruedInterest}
                  accruedDays={accruedDays}
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
                  accruedInterest,
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
                onClick={() => {
                  draftClearedRef.current = true;
                  clearRepayDraft();
                  draftSave.reset();
                  navigate('/');
                }}
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
            {isReviewBalanceLoading && (
              <div
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 text-sm text-muted"
                aria-busy="true"
              >
                <span>Refreshing {SETTLEMENT_ASSET.code} wallet balance</span>
                <Skeleton width={72} height={16} />
              </div>
            )}
            {reviewBalanceError && (
              <div
                className="rounded-lg border border-error bg-error/10 p-4 text-sm text-error"
                role="alert"
              >
                {reviewBalanceError}
              </div>
            )}
            {/* Issue #1188: the amount no longer validates against current
                debt or wallet data while sitting on review (e.g. the debt was
                refetched lower). Confirm is disabled by isReviewConfirmDisabled;
                this alert explains why and offers the way back. */}
            {isInvalid && (
              <div
                className="rounded-lg border border-error bg-error/10 p-4 text-sm text-error"
                role="alert"
                data-testid="repay-review-invalid-alert"
              >
                <p className="font-semibold">
                  {validation?.feedback.title ?? 'Repayment amount is no longer valid'}
                </p>
                <p className="mt-0.5">
                  {validation?.feedback.message ??
                    'The amount does not match the current debt or wallet balance.'}
                </p>
                <button
                  type="button"
                  onClick={handleBack}
                  className="rp-review-edit-amount-btn mt-3 rounded-md border border-error/40 bg-error/5 px-3 py-1.5 text-xs font-semibold text-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  data-testid="repay-review-edit-amount"
                >
                  Edit amount
                </button>
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
                    {isReviewBalanceLoading
                      ? 'Refreshing…'
                      : formatMoney(reviewBalance ?? walletBalance)}
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
                <p className="font-semibold text-foreground" data-testid="repay-allocation-summary">
                  Interest{' '}
                  <span className="num-tabular">
                    {formatMoney(allocation.interestPaid)}
                  </span>
                  {' · '}
                  Principal{' '}
                  <span className="num-tabular">
                    {formatMoney(allocation.principalPaid)}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  Accrued interest ({accruedDays ?? 30} days)
                </p>
              </div>
            </div>

            <PayoffProjection
              currentDebt={selectedLine.utilized}
              apr={selectedLine.apr}
              repayAmount={amount}
              limit={selectedLine.limit}
              nextPaymentAmount={selectedLine.nextPaymentAmount}
              accruedInterest={accruedInterest}
              accruedDays={accruedDays}
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
              <div className="flex-[2] flex flex-col">
                <PendingButton
                  type="button"
                  onClick={handleConfirm}
                  pending={false}
                  pendingLabel="Confirming..."
                  disabled={isReviewConfirmDisabled}
                  aria-disabled={isReviewConfirmDisabled || undefined}
                  requiresOnline
                  offlineReason="You're offline — reconnect to repay"
                  className={`rp-confirm-btn w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${motionClasses(isReducedMotionActive, 'transition-all hover:brightness-110')}`}
                >
                  <span className="flex items-center justify-center gap-2">
                    Confirm Repayment <KbdHint keys={['Enter']} />
                  </span>
                </PendingButton>
              </div>
            </div>
            <DraftSavedIndicator
              status={draftSave.status}
              savedAt={draftSave.savedAt}
              className="text-right"
            />
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

      <LiveRegion id="repay-announcement" message={srAnnouncement} />
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
