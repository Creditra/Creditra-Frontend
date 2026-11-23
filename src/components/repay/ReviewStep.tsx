import { CopyToClipboard } from '@/components/CopyToClipboard';
import { DraftSavedIndicator } from '@/components/DraftSavedIndicator';
import { KbdHint } from '@/components/KbdHint';
import { PayoffProjection } from '@/components/PayoffProjection';
import { PendingButton } from '@/components/PendingButton';
import { Skeleton } from '@/components/Skeleton';
import { TypedAmountConfirmField } from '@/components/TypedAmountConfirm';
import { motionClasses } from '@/context/ReducedMotionContext';
import type { UseDraftSaveStatusResult } from '@/hooks/useDraftSaveStatus';
import type { RepaymentAllocation } from '@/lib/repay-allocation';
import { SETTLEMENT_ASSET } from '@/lib/repayable-balance';
import type { CreditLine } from '@/types/creditLine';
import {
  formatMoney,
  type RepayAmountValidationResult,
} from '@/utils/amountValidation';

interface ReviewStepProps {
  selectedLine: CreditLine;
  amount: number;
  remainingDebt: number;
  walletBalance: number;
  reviewBalance: number | null;
  isReviewBalanceLoading: boolean;
  reviewBalanceError: string;
  isOfflineBlocked: boolean;
  isInvalid: boolean;
  validation: RepayAmountValidationResult | null;
  isAutoSchedule: boolean;
  allocation: RepaymentAllocation;
  accruedInterest: number;
  accruedDays: number | null;
  needsConfirm: boolean;
  confirmAmountStr: string;
  setConfirmAmountStr: (value: string) => void;
  isReviewConfirmDisabled: boolean;
  isReducedMotionActive: boolean;
  handleBack: () => void;
  handleConfirm: () => void;
  draftSave: UseDraftSaveStatusResult;
}

/**
 * Review step: refreshed balance, repayment summary and allocation, typed
 * confirmation for large amounts, and the confirm/back actions.
 */
export function ReviewStep({
  selectedLine,
  amount,
  remainingDebt,
  walletBalance,
  reviewBalance,
  isReviewBalanceLoading,
  reviewBalanceError,
  isOfflineBlocked,
  isInvalid,
  validation,
  isAutoSchedule,
  allocation,
  accruedInterest,
  accruedDays,
  needsConfirm,
  confirmAmountStr,
  setConfirmAmountStr,
  isReviewConfirmDisabled,
  isReducedMotionActive,
  handleBack,
  handleConfirm,
  draftSave,
}: ReviewStepProps) {
  return (
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
  );
}
