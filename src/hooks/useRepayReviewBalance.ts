import { useCallback, useEffect, useState } from 'react';
import {
  getRepayableBalance,
  moneyCoversAmount,
  moneyToNumber,
  SETTLEMENT_ASSET,
} from '@/lib/repayable-balance';
import { formatMoney } from '@/utils/amountValidation';
import type { BalanceInfo } from '@/context/WalletContext';

interface UseRepayReviewBalanceOptions {
  /** Fetch only runs while the user is on the review step. */
  isReviewStep: boolean;
  amount: number;
  isWalletConnected: boolean;
  refreshBalance: () => Promise<BalanceInfo[] | null>;
  announce: (message: string) => void;
}

export interface RepayReviewBalance {
  isReviewBalanceLoading: boolean;
  reviewBalance: number | null;
  reviewBalanceError: string;
  /** Clear the fetched state, e.g. when a draft is restored. */
  reset: () => void;
  /** Allow the flow to record a balance drop found before confirmation. */
  setReviewBalance: (value: number | null) => void;
  setReviewBalanceError: (value: string) => void;
}

/**
 * Re-fetches the settlement-asset balance when the review step opens so the
 * user cannot confirm against a stale balance. Any drop below the repayment
 * amount blocks confirmation with an explanatory error.
 */
export function useRepayReviewBalance({
  isReviewStep,
  amount,
  isWalletConnected,
  refreshBalance,
  announce,
}: UseRepayReviewBalanceOptions): RepayReviewBalance {
  const [isReviewBalanceLoading, setIsReviewBalanceLoading] = useState(false);
  const [reviewBalance, setReviewBalance] = useState<number | null>(null);
  const [reviewBalanceError, setReviewBalanceError] = useState('');

  useEffect(() => {
    if (!isReviewStep) return;
    if (!isWalletConnected) {
      setIsReviewBalanceLoading(false);
      setReviewBalance(null);
      setReviewBalanceError('Connect your wallet to confirm this repayment.');
      return;
    }

    let isCurrent = true;
    setIsReviewBalanceLoading(true);
    setReviewBalance(null);
    setReviewBalanceError('');
    announce(`Refreshing your ${SETTLEMENT_ASSET.code} wallet balance.`);

    refreshBalance()
      .then((freshBalances) => {
        if (!isCurrent) return;
        const fresh = getRepayableBalance(freshBalances, SETTLEMENT_ASSET);
        if (fresh.status !== 'ok') {
          setReviewBalanceError(
            `Unable to verify your ${SETTLEMENT_ASSET.code} balance. Check your trustline and try again.`,
          );
          announce(`Unable to verify your ${SETTLEMENT_ASSET.code} balance.`);
          return;
        }

        const freshAmount = moneyToNumber(fresh.amount);
        setReviewBalance(freshAmount);
        if (!moneyCoversAmount(fresh.amount, amount)) {
          setReviewBalanceError(
            `Your ${SETTLEMENT_ASSET.code} balance dropped below the repayment amount. Reduce the amount to ${formatMoney(freshAmount)} or less.`,
          );
          announce(
            `Your ${SETTLEMENT_ASSET.code} balance dropped below the repayment amount.`,
          );
        }
      })
      .catch(() => {
        if (!isCurrent) return;
        setReviewBalanceError(
          `Unable to refresh your ${SETTLEMENT_ASSET.code} balance. Try again before confirming.`,
        );
        announce(`Unable to refresh your ${SETTLEMENT_ASSET.code} balance.`);
      })
      .finally(() => {
        if (isCurrent) setIsReviewBalanceLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isReviewStep, amount, refreshBalance, isWalletConnected, announce]);

  const reset = useCallback(() => {
    setIsReviewBalanceLoading(false);
    setReviewBalance(null);
    setReviewBalanceError('');
  }, []);

  return {
    isReviewBalanceLoading,
    reviewBalance,
    reviewBalanceError,
    reset,
    setReviewBalance,
    setReviewBalanceError,
  };
}
