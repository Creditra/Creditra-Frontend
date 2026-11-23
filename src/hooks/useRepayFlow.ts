import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCreditLine } from '@/hooks/useCreditLines';
import { useOnline } from '@/hooks/useOnline';
import { useRepayDraft, type RestoredDraft } from '@/hooks/useRepayDraft';
import { useRepayReviewBalance } from '@/hooks/useRepayReviewBalance';
import { useRepayShortcuts } from '@/hooks/useRepayShortcuts';
import { useRepaySubmit } from '@/hooks/useRepaySubmit';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useWallet, walletIdentityKey } from '@/context/WalletContext';
import { isRepayable } from '@/lib/repay-eligibility';
import { computeRepayDerived } from '@/lib/repayFlowMath';
import {
  getRepayableBalance,
  moneyToNumber,
  SETTLEMENT_ASSET,
} from '@/lib/repayable-balance';
import { formatMoney } from '@/utils/amountValidation';
import type { OptimisedRepaymentPlan } from '@/utils/suggestRepay';
import type { RepayStep, UseRepayFlowOptions, UseRepayFlowResult } from '@/types/repayFlow';

export type { RepayStep, UseRepayFlowOptions, UseRepayFlowResult };

/**
 * Owns the repayment wizard's flow state: step transitions, amount validation,
 * the pre-confirmation balance refresh, the offline guard, keyboard shortcuts
 * and screen-reader announcements. Draft persistence lives in `useRepayDraft`,
 * submission in `useRepaySubmit`, and pure derivations in `repayFlowMath`.
 */
export function useRepayFlow({
  preselectedId,
  allLines,
  creditStatus,
  navigate,
}: UseRepayFlowOptions): UseRepayFlowResult {
  const { isOnline, queueAction } = useOnline();
  const { wallet, status: walletStatus, balances, refreshBalance } = useWallet();
  const identityKey = walletIdentityKey(wallet ?? null);

  const [step, setStep] = useState<RepayStep>('input');
  const [selectedId, setSelectedId] = useState<string>(preselectedId ?? '');
  const [amountStr, setAmountStr] = useState('');
  const [confirmAmountStr, setConfirmAmountStr] = useState('');
  const [isAutoSchedule, setIsAutoSchedule] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const [isOfflineBlocked, setIsOfflineBlocked] = useState(false);

  const { line: selectedCreditLine } = useCreditLine(selectedId);

  // When a ?line= deep-link names an unrepayable line we keep selectedLine null
  // so the picker renders with an explanatory status message instead of opening
  // the form for a line that has no outstanding balance (e.g. Closed).
  const selectedLine = useMemo(() => {
    if (!selectedId) return null;
    const line = selectedCreditLine;
    if (!line || !isRepayable(line)) return null;
    return line;
  }, [selectedId, selectedCreditLine]);

  const unrepayableDeepLink = useMemo(() => {
    if (!preselectedId) return false;
    const line = allLines.find((cl) => cl.id === preselectedId) ?? null;
    return line !== null && !isRepayable(line);
  }, [allLines, preselectedId]);

  const repayableBalance = getRepayableBalance(balances ?? null, SETTLEMENT_ASSET);
  const hasRepayableBalance =
    walletStatus === 'connected' && wallet !== null && repayableBalance.status === 'ok';
  const walletBalance =
    repayableBalance.status === 'ok' ? moneyToNumber(repayableBalance.amount) : 0;

  const derived = useMemo(
    () =>
      computeRepayDerived({
        selectedLine,
        amountStr,
        confirmAmountStr,
        walletBalance,
        hasRepayableBalance,
      }),
    [selectedLine, amountStr, confirmAmountStr, walletBalance, hasRepayableBalance],
  );
  const { amount, isInvalid, isConfirmDisabled } = derived;

  const announce = useCallback((message: string) => {
    setSrAnnouncement(message);
  }, []);

  const {
    isReviewBalanceLoading,
    reviewBalance,
    reviewBalanceError,
    reset: resetReviewBalance,
    setReviewBalance,
    setReviewBalanceError,
  } = useRepayReviewBalance({
    isReviewStep: step === 'review',
    amount,
    isWalletConnected: walletStatus === 'connected' && wallet !== null,
    refreshBalance,
    announce,
  });

  const isReviewConfirmDisabled =
    !hasRepayableBalance ||
    isInvalid ||
    amount <= 0 ||
    isConfirmDisabled ||
    isReviewBalanceLoading ||
    reviewBalance === null ||
    amount > reviewBalance;

  const applyRestoredDraft = useCallback(
    (draft: RestoredDraft) => {
      setSelectedId(draft.creditLineId);
      setAmountStr(draft.amountStr);
      // Always clear the typed confirmation on restore: the amount must be
      // re-confirmed even when the review step itself is restored (issue #1188).
      setConfirmAmountStr('');
      setIsAutoSchedule(draft.isAutoSchedule);
      resetReviewBalance();
      setStep(draft.toReview ? 'review' : 'input');
    },
    [resetReviewBalance],
  );

  const draftControls = useRepayDraft({
    preselectedId,
    allLines,
    creditStatus,
    identityKey,
    walletBalance,
    step,
    selectedId,
    amountStr,
    confirmAmountStr,
    isAutoSchedule,
    announce,
    applyRestoredDraft,
  });

  const { handleConfirm, isSubmittingRef } = useRepaySubmit({
    selectedLine,
    step,
    amount,
    walletBalance,
    hasRepayableBalance,
    isInvalid,
    isReviewConfirmDisabled,
    remainingDebt: derived.remainingDebt,
    isOnline,
    queueAction,
    refreshBalance,
    walletPublicKey: wallet?.publicKey,
    navigate,
    onBeforeSubmit: draftControls.discardPersistedDraft,
    onRequireReview: () => setStep('review'),
    onOfflineQueued: () => setIsOfflineBlocked(true),
    announce,
    setReviewBalance,
    setReviewBalanceError,
  });

  const selectLine = useCallback(
    (lineId: string) => {
      setSelectedId(lineId);
      const line = allLines.find((cl) => cl.id === lineId);
      setSrAnnouncement(
        line ? `Selected ${line.name}. Choose a repayment amount.` : 'Credit line selected.',
      );
    },
    [allLines],
  );

  // Warn on unload while the form holds an unsaved amount. The page navigates
  // away on success, so checking amountStr alone is sufficient.
  useUnsavedChangesGuard(amountStr !== '' && !isSubmittingRef.current);

  const handlePercent = useCallback(
    (pct: number) => {
      if (!derived.validation || !hasRepayableBalance) return;
      let target = (derived.validation.maxRepayAmount * pct) / 100;
      if (target > walletBalance) target = walletBalance;
      setAmountStr(target.toFixed(2));
    },
    [derived.validation, hasRepayableBalance, walletBalance],
  );

  const handleSmartPay = useCallback(() => {
    if (!selectedLine || !hasRepayableBalance || derived.suggestion.amount === 0) return;
    setAmountStr(derived.suggestion.amount.toFixed(2));
    setSrAnnouncement(
      `Smart Pay amount set: ${formatMoney(derived.suggestion.amount)}. ${derived.suggestionMessage}`,
    );
  }, [selectedLine, hasRepayableBalance, derived.suggestion, derived.suggestionMessage]);

  const applyOptimisedPlan = useCallback((plan: OptimisedRepaymentPlan) => {
    const first = plan.allocations.find((a) => a.amount > 0);
    if (!first) return;
    setSelectedId(first.lineId);
    setAmountStr(first.amount.toFixed(2));
    setSrAnnouncement(
      `Applied ${plan.strategy} plan. Prefilled ${formatMoney(first.amount)} for ${first.lineName}.`,
    );
  }, []);

  const handleReview = useCallback(() => {
    if (hasRepayableBalance && !isInvalid && amount > 0) {
      setConfirmAmountStr('');
      resetReviewBalance();
      setStep('review');
      setSrAnnouncement(`Review step: repaying ${formatMoney(amount)}. Confirm or go back.`);
    }
  }, [hasRepayableBalance, isInvalid, amount, resetReviewBalance]);

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
  }, [step, preselectedId, navigate, isSubmittingRef]);

  const cancel = useCallback(() => {
    draftControls.discardPersistedDraft();
    navigate('/');
  }, [draftControls.discardPersistedDraft, navigate]);

  useRepayShortcuts({
    step,
    hasSelectedLine: selectedLine !== null,
    isInvalid,
    amount,
    isReviewConfirmDisabled,
    onBack: handleBack,
    onSmartPay: handleSmartPay,
    onMax: () => handlePercent(100),
    onReview: handleReview,
    onConfirm: () => void handleConfirm(),
  });

  useEffect(() => {
    if (walletStatus !== 'connected' || !wallet) {
      setSrAnnouncement(
        `Connect your wallet to check your ${SETTLEMENT_ASSET.code} balance.`,
      );
    } else if (repayableBalance.status === 'loading') {
      setSrAnnouncement(`Loading your ${SETTLEMENT_ASSET.code} wallet balance.`);
    } else if (repayableBalance.status === 'no_trustline') {
      setSrAnnouncement(`Add a ${SETTLEMENT_ASSET.code} trustline to repay.`);
    } else {
      setSrAnnouncement(`${SETTLEMENT_ASSET.code} wallet balance loaded.`);
    }
  }, [walletStatus, wallet, repayableBalance.status]);

  // Task ariallive-v7: announce validation errors to screen readers
  useEffect(() => {
    if (derived.validation?.feedback.severity === 'danger' && derived.validation.feedback.message) {
      setSrAnnouncement(`Error: ${derived.validation.feedback.message}`);
    }
  }, [derived.validation?.feedback.message, derived.validation?.feedback.severity]);

  return {
    step,
    selectedId,
    selectedLine,
    unrepayableDeepLink,
    amountStr,
    setAmountStr,
    confirmAmountStr,
    setConfirmAmountStr,
    isAutoSchedule,
    setIsAutoSchedule,
    amount,
    isInvalid,
    needsConfirm: derived.needsConfirm,
    isConfirmDisabled,
    isReviewConfirmDisabled,
    validation: derived.validation,
    suggestion: derived.suggestion,
    suggestionMessage: derived.suggestionMessage,
    suggestionTone: derived.suggestionTone,
    smartPayDisabled: derived.smartPayDisabled,
    accruedInterest: derived.accruedInterest,
    accruedDays: derived.accruedDays,
    totalOwed: derived.totalOwed,
    allocation: derived.allocation,
    remainingDebt: derived.remainingDebt,
    wallet,
    walletStatus,
    repayableBalance,
    hasRepayableBalance,
    walletBalance,
    draftSave: draftControls.draftSave,
    recoveredDraft: draftControls.recoveredDraft,
    showRecoveryPrompt: draftControls.showRecoveryPrompt,
    draftDiscardReason: draftControls.discardReason,
    srAnnouncement,
    announce,
    isOfflineBlocked,
    isReviewBalanceLoading,
    reviewBalance,
    reviewBalanceError,
    selectLine,
    applyOptimisedPlan,
    handlePercent,
    handleSmartPay,
    handleReview,
    handleConfirm,
    handleBack,
    restoreDraft: draftControls.restoreDraft,
    dismissDraft: draftControls.dismissDraft,
    cancel,
  };
}
