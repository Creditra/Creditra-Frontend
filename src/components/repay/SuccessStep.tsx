import { ArrowLeft, Home } from 'lucide-react';
import { PayoffProjection } from '@/components/PayoffProjection';
import { RepaySuccessShareCard } from '@/components/RepaySuccessShareCard';
import { formatMoney } from '@/utils/amountValidation';

interface SuccessStepProps {
  amount: number;
  creditLineName: string;
  transactionId: string;
  /** ISO timestamp of the repayment. */
  timestamp: string;
  remainingDebt: number;
  limit: number;
  apr: number;
  nextPaymentAmount?: number;
  onBack: () => void;
  onDashboard: () => void;
  onNewRepay: () => void;
}

/**
 * Confirmed-repayment success view: share card, summary with before/after
 * utilization, payoff projection and follow-up actions.
 */
export function SuccessStep({
  amount,
  creditLineName,
  transactionId,
  timestamp,
  remainingDebt,
  limit,
  apr,
  nextPaymentAmount,
  onBack,
  onDashboard,
  onNewRepay,
}: SuccessStepProps) {
  const newUtilizationPct =
    limit > 0 ? Math.round((remainingDebt / limit) * 100) : 0;

  return (
      <div role="status" aria-live="polite">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to repayment
        </button>

        <header className="mb-8 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase text-muted">
            Repayment Complete
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            You repaid {formatMoney(amount)}!
          </h1>
          <p className="text-sm text-muted">
            {creditLineName} &middot; Your transaction was successful.
          </p>
        </header>

        {/* ── Shareable success card ───────────────────────────────────────── */}
        <RepaySuccessShareCard
          amount={amount}
          creditLineName={creditLineName}
          transactionId={transactionId}
          timestamp={new Date(timestamp)}
          onClose={undefined}
        />

        {/* ── Repayment summary ────────────────────────────────────────────── */}
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Repayment Summary
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Amount repaid</span>
              <span className="font-semibold text-foreground">
                {formatMoney(amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Remaining debt</span>
              <span
                className={`font-semibold ${
                  remainingDebt === 0
                    ? 'text-success'
                    : 'text-foreground'
                }`}
              >
                {formatMoney(remainingDebt)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Credit line utilization</span>
              <span className="font-semibold text-foreground">
                Reduced to {newUtilizationPct}%
              </span>
            </div>

            {/* Utilization bars — before/after */}
            <div className="pt-2">
              <p className="mb-1 text-xs text-muted">Before repayment</p>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuenow={100}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Utilization before repayment at 100%"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: '100%',
                    background:
                      remainingDebt === 0
                        ? 'var(--success, #3fb950)'
                        : 'var(--warning, #d29922)',
                  }}
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">After repayment</p>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuenow={newUtilizationPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Utilization after repayment at ${newUtilizationPct}%`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(newUtilizationPct, remainingDebt > 0 ? 2 : 0)}%`,
                    background:
                      remainingDebt === 0
                        ? 'var(--success, #3fb950)'
                        : 'var(--accent, #58a6ff)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Payoff projection ────────────────────────────────────────────── */}
        <PayoffProjection
          currentDebt={remainingDebt}
          apr={apr}
          repayAmount={0}
          limit={limit}
          nextPaymentAmount={nextPaymentAmount}
        />

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onDashboard}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to Dashboard
          </button>
          <button
            type="button"
            onClick={onNewRepay}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Make another repayment
          </button>
        </div>
      </div>
  );
}
