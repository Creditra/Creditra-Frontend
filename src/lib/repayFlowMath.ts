import type { CreditLine } from '@/types/creditLine';
import type { RepaymentAllocation } from '@/lib/repay-allocation';
import { allocateRepayment } from '@/lib/repay-allocation';
import { getAccruedInterest, getAccruedInterestDays } from '@/lib/interest';
import { roundToCents } from '@/utils/currency';
import {
  formatMoney,
  getRepayAmountValidation,
  requiresRepayConfirmation,
  type RepayAmountValidationResult,
} from '@/utils/amountValidation';
import { isTypedAmountMatch } from '@/components/TypedAmountConfirm';
import { suggestRepayAmount, type RepaySuggestion } from '@/utils/suggestRepay';
import type { RepaySeverity } from '@/components/repay/repaySeverity';

export interface RepayDerived {
  accruedInterest: number;
  accruedDays: number | null;
  totalOwed: number;
  validation: RepayAmountValidationResult | null;
  suggestion: RepaySuggestion;
  suggestionMessage: string;
  suggestionTone: RepaySeverity;
  smartPayDisabled: boolean;
  amount: number;
  isInvalid: boolean;
  needsConfirm: boolean;
  isConfirmDisabled: boolean;
  allocation: RepaymentAllocation;
  remainingDebt: number;
}

interface ComputeRepayDerivedOptions {
  selectedLine: CreditLine | null;
  amountStr: string;
  confirmAmountStr: string;
  walletBalance: number;
  hasRepayableBalance: boolean;
}

const EMPTY_ALLOCATION: RepaymentAllocation = {
  interestPaid: 0,
  principalPaid: 0,
  remainingInterest: 0,
  remainingPrincipal: 0,
  remainingTotal: 0,
  isFullPayoff: false,
};

/**
 * Pure derivation of every value the repayment UI needs from the selected
 * line, the raw amount input and the wallet balance.
 */
export function computeRepayDerived({
  selectedLine,
  amountStr,
  confirmAmountStr,
  walletBalance,
  hasRepayableBalance,
}: ComputeRepayDerivedOptions): RepayDerived {
  const accruedInterest = selectedLine ? getAccruedInterest(selectedLine, new Date()) : 0;
  const accruedDays = selectedLine
    ? getAccruedInterestDays(selectedLine, new Date())
    : null;
  const totalOwed = selectedLine
    ? roundToCents(selectedLine.utilized + accruedInterest)
    : 0;

  const validation = selectedLine
    ? getRepayAmountValidation(amountStr, totalOwed, walletBalance)
    : null;

  const suggestion: RepaySuggestion = selectedLine
    ? suggestRepayAmount({
        totalDue: totalOwed,
        limit: selectedLine.limit,
        walletBalance,
        apr: selectedLine.apr,
        nextPaymentAmount: selectedLine.nextPaymentAmount,
      })
    : { amount: 0, reason: 'nothing_due' };

  const usesReserve =
    suggestion.amount > 0 &&
    walletBalance - suggestion.amount < (validation?.recommendedWalletReserve ?? 0);
  const minimumDue = Math.min(
    totalOwed,
    selectedLine?.nextPaymentAmount ??
      Math.max(((totalOwed * (selectedLine?.apr ?? 0)) / 100) / 12, 1),
  );
  const minimumShortfall = Math.max(0, minimumDue - walletBalance);
  const suggestionMessage =
    {
      target_utilization: 'Aims to bring your credit utilization to 50%.',
      minimum_due: 'Covers the minimum due.',
      interest_only: 'Covers estimated monthly interest, with a $1 minimum.',
      capped_by_wallet: 'Limited by your wallet balance after keeping a reserve.',
      insufficient_for_minimum: `Your wallet is ${formatMoney(minimumShortfall)} short of the minimum due. A partial payment will not cover it.`,
      nothing_due: 'No repayment is due for Smart Pay.',
      empty_wallet: 'Your wallet is empty. Add funds to use Smart Pay.',
    }[suggestion.reason] +
    (usesReserve ? ' Uses part of your reserve to cover the minimum due.' : '');
  const smartPayDisabled = !hasRepayableBalance || suggestion.amount === 0;
  const suggestionTone: RepaySeverity =
    usesReserve ||
    suggestion.reason === 'insufficient_for_minimum' ||
    suggestion.reason === 'capped_by_wallet' ||
    suggestion.reason === 'empty_wallet'
      ? 'warning'
      : 'info';

  const amount = validation?.amount ?? 0;
  const isInvalid = !validation?.isValid;
  const needsConfirm = requiresRepayConfirmation(amount);
  const isConfirmDisabled = needsConfirm && !isTypedAmountMatch(confirmAmountStr, amount);

  const allocation = selectedLine
    ? allocateRepayment(selectedLine, amount, accruedInterest)
    : EMPTY_ALLOCATION;

  return {
    accruedInterest,
    accruedDays,
    totalOwed,
    validation,
    suggestion,
    suggestionMessage,
    suggestionTone,
    smartPayDisabled,
    amount,
    isInvalid,
    needsConfirm,
    isConfirmDisabled,
    allocation,
    remainingDebt: allocation.remainingTotal,
  };
}
