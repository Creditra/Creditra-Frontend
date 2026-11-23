import type { NavigateFunction } from 'react-router-dom';
import type { CreditLine } from '@/types/creditLine';
import type { RepayAmountValidationResult } from '@/utils/amountValidation';
import type { OptimisedRepaymentPlan, RepaySuggestion } from '@/utils/suggestRepay';
import type { RepaymentAllocation } from '@/lib/repay-allocation';
import type { RepayableBalanceResult } from '@/lib/repayable-balance';
import type { RepayDraftState } from '@/state/repayDraft';
import type { DraftDiscardReason } from '@/components/repay/DraftRecoveryPrompt';
import type { RepaySeverity } from '@/components/repay/repaySeverity';
import type { useWallet } from '@/context/WalletContext';
import type { useRepayDraft } from '@/hooks/useRepayDraft';

export type RepayStep = 'input' | 'review';

export interface UseRepayFlowOptions {
  /** `?line=` query value, used for deep links and draft selection. */
  preselectedId: string | null;
  /** Lines eligible for repayment (see `getRepayableLines`). */
  creditLines: CreditLine[];
  /** Every credit line, including unrepayable ones, for draft validation. */
  allLines: CreditLine[];
  creditStatus: 'idle' | 'loading' | 'success' | 'error';
  navigate: NavigateFunction;
}

export interface UseRepayFlowResult {
  step: RepayStep;
  selectedId: string;
  selectedLine: CreditLine | null;
  unrepayableDeepLink: boolean;

  amountStr: string;
  setAmountStr: (value: string) => void;
  confirmAmountStr: string;
  setConfirmAmountStr: (value: string) => void;
  isAutoSchedule: boolean;
  setIsAutoSchedule: (value: boolean) => void;

  amount: number;
  isInvalid: boolean;
  needsConfirm: boolean;
  isConfirmDisabled: boolean;
  isReviewConfirmDisabled: boolean;
  validation: RepayAmountValidationResult | null;
  suggestion: RepaySuggestion;
  suggestionMessage: string;
  suggestionTone: RepaySeverity;
  smartPayDisabled: boolean;

  accruedInterest: number;
  accruedDays: number | null;
  totalOwed: number;
  allocation: RepaymentAllocation;
  remainingDebt: number;

  wallet: ReturnType<typeof useWallet>['wallet'];
  walletStatus: ReturnType<typeof useWallet>['status'];
  repayableBalance: RepayableBalanceResult;
  hasRepayableBalance: boolean;
  walletBalance: number;

  draftSave: ReturnType<typeof useRepayDraft>['draftSave'];
  recoveredDraft: RepayDraftState | null;
  showRecoveryPrompt: boolean;
  draftDiscardReason: DraftDiscardReason | null;

  srAnnouncement: string;
  announce: (message: string) => void;
  isOfflineBlocked: boolean;

  isReviewBalanceLoading: boolean;
  reviewBalance: number | null;
  reviewBalanceError: string;

  selectLine: (lineId: string) => void;
  applyOptimisedPlan: (plan: OptimisedRepaymentPlan) => void;
  handlePercent: (pct: number) => void;
  handleSmartPay: () => void;
  handleReview: () => void;
  handleConfirm: () => Promise<void>;
  handleBack: () => void;
  restoreDraft: () => void;
  dismissDraft: () => void;
  cancel: () => void;
}
