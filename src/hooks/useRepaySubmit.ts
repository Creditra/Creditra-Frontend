import { useCallback, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { CreditLine } from '@/types/creditLine';
import { formatMoney } from '@/utils/amountValidation';
import { submitRepayment } from '@/services/repayService';
import { emit } from '@/lib/event-bus';
import {
  getRepayableBalance,
  moneyCoversAmount,
  moneyToNumber,
  SETTLEMENT_ASSET,
} from '@/lib/repayable-balance';

interface UseRepaySubmitOptions {
  selectedLine: CreditLine | null;
  step: 'input' | 'review';
  amount: number;
  walletBalance: number;
  hasRepayableBalance: boolean;
  isInvalid: boolean;
  isReviewConfirmDisabled: boolean;
  remainingDebt: number;
  isOnline: boolean;
  queueAction: (action: () => void, key?: string) => void;
  refreshBalance: () => Promise<import('@/context/WalletContext').BalanceInfo[] | null>;
  walletPublicKey: string | undefined;
  navigate: NavigateFunction;
  /** Clear the persisted draft immediately before submitting. */
  onBeforeSubmit: () => void;
  /** Move the wizard back to review after a failed balance check. */
  onRequireReview: () => void;
  /** Flag the offline queue in the UI. */
  onOfflineQueued: () => void;
  announce: (message: string) => void;
  setReviewBalance: (value: number | null) => void;
  setReviewBalanceError: (value: string) => void;
}

export interface RepaySubmit {
  handleConfirm: () => Promise<void>;
  isSubmittingRef: React.MutableRefObject<boolean>;
}

/**
 * Confirmation pipeline: guards against invalid/duplicate submits, queues the
 * action while offline, re-checks the wallet balance before submitting and
 * navigates to the success route with the transaction details.
 */
export function useRepaySubmit({
  selectedLine,
  step,
  amount,
  walletBalance,
  hasRepayableBalance,
  isInvalid,
  isReviewConfirmDisabled,
  remainingDebt,
  isOnline,
  queueAction,
  refreshBalance,
  walletPublicKey,
  navigate,
  onBeforeSubmit,
  onRequireReview,
  onOfflineQueued,
  announce,
  setReviewBalance,
  setReviewBalanceError,
}: UseRepaySubmitOptions): RepaySubmit {
  const isSubmittingRef = useRef(false);
  // Queued offline actions must call the latest closure.
  const handleConfirmRef = useRef<() => Promise<void>>(async () => {});

  const handleConfirm = useCallback(async () => {
    if (!selectedLine || isSubmittingRef.current) return;
    // Defense in depth (issue #1188): the review path re-checks amount
    // validity here as well as through the disabled state, so neither a
    // stale click nor the Enter shortcut can confirm an invalid amount.
    if (step === 'review' && (isReviewConfirmDisabled || isInvalid)) return;
    if (step === 'input' && (!hasRepayableBalance || isInvalid || amount > walletBalance)) return;

    if (!isOnline) {
      isSubmittingRef.current = false;
      queueAction(() => {
        void handleConfirmRef.current();
      }, 'repay-confirm');
      onOfflineQueued();
      return;
    }

    isSubmittingRef.current = true;

    if (step === 'input') {
      try {
        const refreshedBalances = await refreshBalance();
        const refreshed = getRepayableBalance(refreshedBalances, SETTLEMENT_ASSET);
        const refreshedAmount =
          refreshed.status === 'ok' ? moneyToNumber(refreshed.amount) : 0;
        if (refreshed.status !== 'ok' || !moneyCoversAmount(refreshed.amount, amount)) {
          isSubmittingRef.current = false;
          setReviewBalance(refreshed.status === 'ok' ? refreshedAmount : null);
          setReviewBalanceError(
            refreshed.status === 'ok'
              ? `Your ${SETTLEMENT_ASSET.code} balance dropped below the repayment amount. Reduce the amount to ${formatMoney(refreshedAmount)} or less.`
              : `Unable to verify your ${SETTLEMENT_ASSET.code} balance. Check your trustline and try again.`,
          );
          onRequireReview();
          announce(
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
        onRequireReview();
        announce(`Unable to verify your ${SETTLEMENT_ASSET.code} balance.`);
        return;
      }
    }

    onBeforeSubmit();
    const transactionId = `TXN-${Date.now()}`;
    const timestamp = new Date().toISOString();
    if (walletPublicKey) {
      await submitRepayment({
        transactionId,
        timestamp,
        walletPublicKey,
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
  }, [
    selectedLine,
    step,
    isReviewConfirmDisabled,
    isInvalid,
    hasRepayableBalance,
    amount,
    walletBalance,
    remainingDebt,
    isOnline,
    queueAction,
    refreshBalance,
    walletPublicKey,
    navigate,
    onBeforeSubmit,
    onRequireReview,
    onOfflineQueued,
    announce,
    setReviewBalance,
    setReviewBalanceError,
  ]);

  handleConfirmRef.current = handleConfirm;

  return { handleConfirm, isSubmittingRef };
}
