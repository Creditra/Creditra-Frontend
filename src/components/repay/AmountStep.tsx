import type { RefObject } from 'react';
import { AffordabilityCalc } from '@/components/AffordabilityCalc';
import { Amount } from '@/components/Amount';
import { CopyToClipboard } from '@/components/CopyToClipboard';
import { KbdHint } from '@/components/KbdHint';
import { PayoffProjection } from '@/components/PayoffProjection';
import { RepaymentVisualizer } from '@/components/RepaymentVisualizer';
import { Skeleton } from '@/components/Skeleton';
import { Tooltip } from '@/components/Tooltip';
import { motionClasses } from '@/context/ReducedMotionContext';
import type { UseDraftSaveStatusResult } from '@/hooks/useDraftSaveStatus';
import { SETTLEMENT_ASSET, type RepayableBalanceResult } from '@/lib/repayable-balance';
import type { CreditLine } from '@/types/creditLine';
import {
  formatMoney,
  type RepayAmountValidationResult,
} from '@/utils/amountValidation';
import type { RepaySuggestion } from '@/utils/suggestRepay';
import { RepayPreviewCard } from './RepayPreviewCard';
import type { SeverityStyle } from './repaySeverity';

interface AmountStepProps {
  selectedLine: CreditLine;
  amountStr: string;
  setAmountStr: (value: string) => void;
  validation: RepayAmountValidationResult | null;
  repayableBalance: RepayableBalanceResult;
  hasRepayableBalance: boolean;
  walletBalance: number;
  suggestion: RepaySuggestion;
  suggestionMessage: string;
  suggestionTone: SeverityStyle;
  activeTone: SeverityStyle;
  smartPayDisabled: boolean;
  isInvalid: boolean;
  amount: number;
  remainingDebt: number;
  oldPct: number;
  newPct: number;
  accruedInterest: number;
  accruedDays: number | null;
  isAutoSchedule: boolean;
  setIsAutoSchedule: (value: boolean) => void;
  isReducedMotionActive: boolean;
  handlePercent: (pct: number) => void;
  handleSmartPay: () => void;
  handleReview: () => void;
  setIsPreviewModalOpen: (open: boolean) => void;
  setIsHelpOpen: (open: boolean) => void;
  previewTriggerRef: RefObject<HTMLButtonElement>;
  helpTriggerRef: RefObject<HTMLButtonElement>;
  onCancel: () => void;
  draftSave: UseDraftSaveStatusResult;
}

/**
 * Amount entry step: current debt, repayment amount with presets/Smart Pay,
 * affordability calculator, live preview, auto-schedule and review actions.
 */
export function AmountStep({
  selectedLine,
  amountStr,
  setAmountStr,
  validation,
  repayableBalance,
  hasRepayableBalance,
  walletBalance,
  suggestion,
  suggestionMessage,
  suggestionTone,
  activeTone,
  smartPayDisabled,
  isInvalid,
  amount,
  remainingDebt,
  oldPct,
  newPct,
  accruedInterest,
  accruedDays,
  isAutoSchedule,
  setIsAutoSchedule,
  isReducedMotionActive,
  handlePercent,
  handleSmartPay,
  handleReview,
  setIsPreviewModalOpen,
  setIsHelpOpen,
  previewTriggerRef,
  helpTriggerRef,
  onCancel,
  draftSave,
}: AmountStepProps) {
  return (
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
                          {hasRepayableBalance ? <Amount value={walletBalance} format={formatMoney} maskedLabel="Wallet balance hidden for privacy" /> : 'Unavailable'}
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

                {/* AffordabilityCalc disclosure – collapsed by default so it
                    doesn't obscure the amount input, but keyboard-accessible
                    via the native <details>/<summary> element. onApply fills
                    amountStr (respecting existing amount validation). */}
                <details className="rounded-lg border border-border bg-surface">
                  <summary className="cursor-pointer select-none list-none px-4 py-3 text-xs font-semibold uppercase text-muted [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    <span className="flex items-center gap-2">
                      <span>Affordability Calculator</span>
                      <span className="text-muted font-normal normal-case">(optional)</span>
                    </span>
                  </summary>
                  <div className="border-t border-border">
                    <AffordabilityCalc
                      onApply={(suggested) => {
                        setAmountStr(suggested.toFixed(2));
                      }}
                    />
                  </div>
                </details>

                <RepayPreviewCard
                  amount={amount}
                  remainingDebt={remainingDebt}
                  oldPct={oldPct}
                  newPct={newPct}
                  isAutoSchedule={isAutoSchedule}
                  setIsAutoSchedule={setIsAutoSchedule}
                  isReducedMotionActive={isReducedMotionActive}
                  handleReview={handleReview}
                  hasRepayableBalance={hasRepayableBalance}
                  isInvalid={isInvalid}
                  setIsPreviewModalOpen={setIsPreviewModalOpen}
                  previewTriggerRef={previewTriggerRef}
                  draftSave={draftSave}
                />
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
                onClick={onCancel}
                className={`rp-cancel-btn rounded-md text-sm font-semibold text-foreground underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'hover:text-accent hover:underline')}`}
              >
                Cancel
              </button>
            </div>
          </>
  );
}
