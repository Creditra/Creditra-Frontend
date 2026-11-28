import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ConnectWalletPrompt } from '@/components/ConnectWalletPrompt';
import { InlineHelpOverlay } from '@/components/InlineHelpOverlay';
import { KbdHint } from '@/components/KbdHint';
import { LiveRegion } from '@/components/LiveRegion';
import { RepayPreviewModal } from '@/components/RepayPreviewModal';
import { AmountStep } from '@/components/repay/AmountStep';
import { DraftRecoveryPrompt } from '@/components/repay/DraftRecoveryPrompt';
import { PickLineStep } from '@/components/repay/PickLineStep';
import { RepayPageSkeleton } from '@/components/repay/RepayPageSkeleton';
import { ReviewStep } from '@/components/repay/ReviewStep';
import { SEVERITY_CONFIG } from '@/components/repay/repaySeverity';
import { motionClasses, useReducedMotion } from '@/context/ReducedMotionContext';
import { useCreditLines } from '@/hooks/useCreditLines';
import { useRepayFlow } from '@/hooks/useRepayFlow';
import { getAccruedInterest } from '@/lib/interest';
import { getRepayableLines } from '@/lib/repay-eligibility';
import { SETTLEMENT_ASSET } from '@/lib/repayable-balance';
import type { OptimiseRepaymentLine } from '@/utils/suggestRepay';
import { roundToCents } from '@/utils/currency';
import './RepayPage.css';

export { RepayPageSkeleton };

/**
 * RepayPage — composition root for the repayment wizard.
 *
 * Flow state (step, draft recovery, review balance, announcements) lives in
 * `useRepayFlow`; each step renders from `src/components/repay/`.
 *
 * Reduced-motion strategy: all CSS transitions are neutralised globally by the
 * `prefers-reduced-motion: reduce` reset in src/index.css. Transition utility
 * classes are only applied through `motionClasses(...)`, so they drop out of
 * the DOM entirely whenever reduced motion is active.
 */
export default function RepayPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('line');
  const {
    lines: mockLines,
    status: creditStatus,
    error: creditError,
    refetch: refetchCreditLines,
  } = useCreditLines();
  const { isReducedMotionActive } = useReducedMotion();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isMultiLineMode, setIsMultiLineMode] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);

  // Issue #1185: getRepayableLines (utilized > 0 && status !== Closed) replaces
  // the old Active-only filter so Suspended and Defaulted lines are visible.
  const creditLines = useMemo(() => getRepayableLines(mockLines), [mockLines]);

  const flow = useRepayFlow({
    preselectedId,
    creditLines,
    allLines: mockLines,
    creditStatus,
    navigate,
  });

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

  const handleToggleMultiLineMode = () => {
    setIsMultiLineMode((prev) => {
      const next = !prev;
      flow.announce(
        next
          ? 'Multi-line repayment mode enabled. Select credit lines to repay.'
          : 'Single-line repayment mode enabled.',
      );
      return next;
    });
  };

  if (!flow.selectedLine) {
    return (
      <PickLineStep
        creditStatus={creditStatus}
        creditError={creditError}
        refetchCreditLines={refetchCreditLines}
        creditLines={creditLines}
        unrepayableDeepLink={flow.unrepayableDeepLink}
        optimiserLines={optimiserLines}
        walletBalance={flow.walletBalance}
        onApplyPlan={flow.applyOptimisedPlan}
        isMultiLineMode={isMultiLineMode}
        onToggleMultiLineMode={handleToggleMultiLineMode}
        walletStatus={flow.walletStatus}
        wallet={flow.wallet}
        hasRepayableBalance={flow.hasRepayableBalance}
        isReducedMotionActive={isReducedMotionActive}
        discardReason={flow.draftDiscardReason}
        recoveredDraft={flow.recoveredDraft}
        showRecoveryPrompt={flow.showRecoveryPrompt}
        onRestoreDraft={flow.restoreDraft}
        onDismissDraft={flow.dismissDraft}
        srAnnouncement={flow.srAnnouncement}
        onBack={() => navigate(-1)}
        onSelectLine={flow.selectLine}
        preselectedId={preselectedId}
        announce={flow.announce}
        navigate={navigate}
      />
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
                <Amount value={parseFloat(recoveredDraft.amountStr) || 0} format={formatMoney} maskedLabel="Repayment amount hidden for privacy" />
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
              </div>
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
                                <Amount value={totalPaid} format={formatMoney} maskedLabel="Total repaid hidden for privacy" />
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
                                    <Amount value={res.amount} format={formatMoney} maskedLabel="Repayment amount hidden for privacy" />
                                  </td>
                                  <td className="py-2.5 pl-3 text-right font-medium num-tabular text-foreground">
                                    <Amount value={res.allocation.remainingTotal} format={formatMoney} maskedLabel="Remaining balance hidden for privacy" />
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
                                    <Amount value={lineOwed} format={formatMoney} maskedLabel="Total owed hidden for privacy" />
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
                            ? <Amount value={walletBalance} format={formatMoney} maskedLabel="Wallet balance hidden for privacy" />
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
                              MAX (<Amount value={Math.min(batchTotalOwed, walletBalance)} format={formatMoney} maskedLabel="Maximum repayment hidden for privacy" />)
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

  if (flow.walletStatus !== 'connected' || !flow.wallet) {
    return (
      <div className="repay-page mx-auto max-w-2xl space-y-6 px-4 py-8">
        <ConnectWalletPrompt assetCode={SETTLEMENT_ASSET.code} />
        <LiveRegion message={flow.srAnnouncement} />
      </div>
    );
  }

  const selectedLine = flow.selectedLine;
  const oldPct = Math.round((selectedLine.utilized / selectedLine.limit) * 100);
  const newPct = Math.round((flow.remainingDebt / selectedLine.limit) * 100);
  const activeTone = SEVERITY_CONFIG[flow.validation?.feedback.severity ?? 'info'];

  return (
    <div className="repay-page mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <button
        type="button"
        aria-label={flow.step === 'input' ? 'Back to credit lines' : 'Back to input'}
        onClick={flow.handleBack}
        className={`rp-back-btn mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-colors hover:text-foreground')}`}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="flex items-center gap-1.5">
          {flow.step === 'input' ? 'Back to credit lines' : 'Back to input'}
          <KbdHint keys={['Esc']} />
        </span>
      </button>

      <DraftRecoveryPrompt
        discardReason={flow.draftDiscardReason}
        draft={flow.recoveredDraft}
        isOpen={flow.showRecoveryPrompt}
        onRestore={flow.restoreDraft}
        onDismiss={flow.dismissDraft}
      />

      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted">
            Repay Credit
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {flow.step === 'review'
              ? 'Review your repayment'
              : 'Make a repayment'}
          </h1>
          <p className="text-sm text-muted">
            {selectedLine.name} &middot; <span className="num-tabular">{selectedLine.apr}%</span> APR
          </p>
        </header>

        {flow.step === 'input' && (
          <AmountStep
            selectedLine={selectedLine}
            amountStr={flow.amountStr}
            setAmountStr={flow.setAmountStr}
            validation={flow.validation}
            repayableBalance={flow.repayableBalance}
            hasRepayableBalance={flow.hasRepayableBalance}
            walletBalance={flow.walletBalance}
            suggestion={flow.suggestion}
            suggestionMessage={flow.suggestionMessage}
            suggestionTone={SEVERITY_CONFIG[flow.suggestionTone]}
            activeTone={activeTone}
            smartPayDisabled={flow.smartPayDisabled}
            isInvalid={flow.isInvalid}
            amount={flow.amount}
            remainingDebt={flow.remainingDebt}
            oldPct={oldPct}
            newPct={newPct}
            accruedInterest={flow.accruedInterest}
            accruedDays={flow.accruedDays}
            isAutoSchedule={flow.isAutoSchedule}
            setIsAutoSchedule={flow.setIsAutoSchedule}
            isReducedMotionActive={isReducedMotionActive}
            handlePercent={flow.handlePercent}
            handleSmartPay={flow.handleSmartPay}
            handleReview={flow.handleReview}
            setIsPreviewModalOpen={setIsPreviewModalOpen}
            setIsHelpOpen={setIsHelpOpen}
            previewTriggerRef={previewTriggerRef}
            helpTriggerRef={helpTriggerRef}
            onCancel={flow.cancel}
            draftSave={flow.draftSave}
          />
        )}

        {flow.step === 'review' && (
          <ReviewStep
            selectedLine={selectedLine}
            amount={flow.amount}
            remainingDebt={flow.remainingDebt}
            walletBalance={flow.walletBalance}
            reviewBalance={flow.reviewBalance}
            isReviewBalanceLoading={flow.isReviewBalanceLoading}
            reviewBalanceError={flow.reviewBalanceError}
            isOfflineBlocked={flow.isOfflineBlocked}
            isInvalid={flow.isInvalid}
            validation={flow.validation}
            isAutoSchedule={flow.isAutoSchedule}
            allocation={flow.allocation}
            accruedInterest={flow.accruedInterest}
            accruedDays={flow.accruedDays}
            needsConfirm={flow.needsConfirm}
            confirmAmountStr={flow.confirmAmountStr}
            setConfirmAmountStr={flow.setConfirmAmountStr}
            isReviewConfirmDisabled={flow.isReviewConfirmDisabled}
            isReducedMotionActive={isReducedMotionActive}
            handleBack={flow.handleBack}
            handleConfirm={flow.handleConfirm}
            draftSave={flow.draftSave}
          />
        )}
      </div>

      <InlineHelpOverlay
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        triggerRef={helpTriggerRef}
      />
      <RepayPreviewModal
        isOpen={isPreviewModalOpen}
        creditLine={selectedLine}
        walletBalance={flow.walletBalance}
        repayAmount={flow.amount}
        onClose={() => setIsPreviewModalOpen(false)}
        onConfirm={() => {
          setIsPreviewModalOpen(false);
          void flow.handleConfirm();
        }}
        triggerRef={previewTriggerRef}
      />

      <LiveRegion id="repay-announcement" message={flow.srAnnouncement} />
    </div>
  );
}
