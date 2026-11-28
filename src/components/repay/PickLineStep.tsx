import { AlertTriangle, ArrowLeft } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import { ConnectWalletPrompt } from '@/components/ConnectWalletPrompt';
import { EmptyState } from '@/components/EmptyState';
import { KbdHint } from '@/components/KbdHint';
import { LiveRegion } from '@/components/LiveRegion';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { NoOutstandingDebt } from '@/components/illustrations';
import { motionClasses } from '@/context/ReducedMotionContext';
import type { CreditLine } from '@/types/creditLine';
import type { WalletInfo } from '@/types/wallet';
import type {
  OptimiseRepaymentLine,
  OptimisedRepaymentPlan,
} from '@/utils/suggestRepay';
import { formatMoney } from '@/utils/amountValidation';
import { isDelinquentLine } from '@/lib/repay-eligibility';
import { SETTLEMENT_ASSET } from '@/lib/repayable-balance';
import type { RepayDraftState } from '@/state/repayDraft';
import { SmartPayCTA } from '@/pages/SmartPayCTA';
import { DraftRecoveryPrompt, type DraftDiscardReason } from './DraftRecoveryPrompt';
import { MultiLineRepayPanel } from './MultiLineRepayPanel';

interface PickLineStepProps {
  creditStatus: 'idle' | 'loading' | 'success' | 'error';
  creditError: Error | null;
  refetchCreditLines: () => Promise<unknown>;
  creditLines: CreditLine[];
  unrepayableDeepLink: boolean;
  optimiserLines: OptimiseRepaymentLine[];
  walletBalance: number;
  onApplyPlan: (plan: OptimisedRepaymentPlan) => void;
  isMultiLineMode: boolean;
  onToggleMultiLineMode: () => void;
  walletStatus: string;
  wallet: WalletInfo | null;
  hasRepayableBalance: boolean;
  isReducedMotionActive: boolean;
  discardReason: DraftDiscardReason | null;
  recoveredDraft: RepayDraftState | null;
  showRecoveryPrompt: boolean;
  onRestoreDraft: () => void;
  onDismissDraft: () => void;
  srAnnouncement: string;
  onBack: () => void;
  onSelectLine: (lineId: string) => void;
  preselectedId: string | null;
  announce: (message: string) => void;
  navigate: NavigateFunction;
}

/**
 * Credit-line picker: eligibility states, Smart Pay optimiser, single/multi-line
 * mode switch and the line cards. Also hosts draft recovery.
 */
export function PickLineStep({
  creditStatus,
  creditError,
  refetchCreditLines,
  creditLines,
  unrepayableDeepLink,
  optimiserLines,
  walletBalance,
  onApplyPlan,
  isMultiLineMode,
  onToggleMultiLineMode,
  walletStatus,
  wallet,
  hasRepayableBalance,
  isReducedMotionActive,
  discardReason,
  recoveredDraft,
  showRecoveryPrompt,
  onRestoreDraft,
  onDismissDraft,
  srAnnouncement,
  onBack,
  onSelectLine,
  preselectedId,
  announce,
  navigate,
}: PickLineStepProps) {
  return (
    <div className="repay-page mx-auto max-w-2xl space-y-6 px-4 py-8">
        <LiveRegion id="repay-announcement" message={srAnnouncement} />
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className={`rp-back-btn inline-flex items-center gap-1.5 rounded-md text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-colors hover:text-foreground')}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
          <KbdHint keys={['Esc']} className="ml-1" />
        </button>

      {/* ── Draft discarded note (credit line picker view) ─────────── */}
      <DraftRecoveryPrompt
        discardReason={discardReason}
        draft={recoveredDraft}
        isOpen={showRecoveryPrompt}
        onRestore={onRestoreDraft}
        onDismiss={onDismissDraft}
      />

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
                  onApplyPlan={onApplyPlan}
                />
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
              <div>
                <label
                  htmlFor="multi-line-repay-toggle"
                  className="text-sm font-semibold text-foreground cursor-pointer"
                  onClick={onToggleMultiLineMode}
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
                onClick={onToggleMultiLineMode}
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
            </div>
        {isMultiLineMode ? (
          walletStatus !== 'connected' || !wallet ? (
            <div className="mt-4">
              <ConnectWalletPrompt assetCode={SETTLEMENT_ASSET.code} />
            </div>
          ) : (
            <MultiLineRepayPanel
              creditLines={creditLines}
              wallet={wallet}
              hasRepayableBalance={hasRepayableBalance}
              walletBalance={walletBalance}
              initialSelectedLineIds={preselectedId ? [preselectedId] : []}
              announce={announce}
              navigate={navigate}
              isReducedMotionActive={isReducedMotionActive}
            />
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
                      onClick={() => onSelectLine(cl.id)}
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
      </div>
      </>
    )}
  </div>
  );
}
