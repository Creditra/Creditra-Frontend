import { useState, useMemo } from 'react';
import { Calendar, TrendingDown, Clock, DollarSign, Pencil } from 'lucide-react';
import {
  computePayoffProjection,
  computeDefaultMonthlyPayment,
  formatMonths,
  formatPayoffDate,
} from '@/utils/payoffProjection';
import { formatMoney } from '@/utils/amountValidation';
import { ProgressBar } from './ProgressBar';
import type { ProgressBarVariant } from './ProgressBar';


interface PayoffProjectionProps {
  currentDebt: number;
  apr: number;
  repayAmount: number;
  limit: number;
  nextPaymentAmount?: number;
}

export function PayoffProjection({
  currentDebt,
  apr,
  repayAmount,
  limit,
  nextPaymentAmount,
}: PayoffProjectionProps) {
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [customMonthlyPayment, setCustomMonthlyPayment] = useState<number | null>(null);

  const defaultMonthlyPayment = useMemo(
    () => computeDefaultMonthlyPayment(currentDebt, apr, nextPaymentAmount),
    [currentDebt, apr, nextPaymentAmount],
  );

  const monthlyPayment = customMonthlyPayment ?? defaultMonthlyPayment;

  const projection = useMemo(
    () => computePayoffProjection(currentDebt, apr, monthlyPayment, repayAmount, limit),
    [currentDebt, apr, monthlyPayment, repayAmount, limit],
  );

  const hasAmount = repayAmount > 0;

  const currentDate = formatPayoffDate(projection.currentMonths, false);
  const newDate = formatPayoffDate(projection.newMonths, projection.isFullPayoff);

  function utilizationVariant(pct: number): ProgressBarVariant {
    if (pct > 80) return 'danger';
    if (pct > 50) return 'warning';
    return 'success';
  }


  return (
    <section
      className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5"
      aria-label="Payoff projection"
      role="region"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Payoff Projection
        </h3>
        {hasAmount && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-success"
            style={{ background: 'rgba(63,185,80,0.12)' }}
            role="status"
            aria-live="polite"
            aria-label={
              projection.isFullPayoff
                ? 'Full payoff'
                : `${projection.monthsSaved} months sooner`
            }
          >
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
            {projection.isFullPayoff
              ? 'Full payoff'
              : projection.monthsSaved > 0
                ? `${projection.monthsSaved} mo sooner`
                : 'No change'}
          </span>
        )}
      </div>

      {!hasAmount ? (
        <p className="text-sm text-muted">
          Enter a repayment amount to see how it affects your payoff timeline.
        </p>
      ) : (
        <div className="space-y-4">
          <div
            className="grid gap-4 rounded-lg border border-border bg-background/60 p-4 sm:grid-cols-2"
            role="group"
            aria-label="Payoff timeline comparison"
          >
            <div>
              <p className="text-xs font-medium text-muted">Current payoff</p>
              <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-muted" aria-hidden="true" />
                {currentDate}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {formatMonths(projection.currentMonths)} of payments
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted">With this repayment</p>
              <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-accent" aria-hidden="true" />
                {newDate}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {formatMonths(projection.newMonths)} of payments
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
                <p className="text-xs font-medium text-muted">Months saved</p>
              </div>
              <p
                className="mt-1 text-2xl font-bold text-accent num-tabular"
                role="status"
                aria-live="polite"
              >
                {projection.monthsSaved > 0
                  ? projection.monthsSaved
                  : projection.isFullPayoff
                    ? '—'
                    : '0'}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-success" aria-hidden="true" />
                <p className="text-xs font-medium text-muted">Interest saved</p>
              </div>
              <p
                className="mt-1 text-2xl font-bold text-success num-tabular"
                role="status"
                aria-live="polite"
              >
                {projection.interestSaved > 0
                  ? formatMoney(projection.interestSaved)
                  : projection.isFullPayoff
                    ? '—'
                    : formatMoney(0)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">
                Utilization
              </p>
              <span className="text-xs text-muted num-tabular">
                {projection.currentUtilizationPct}% → {projection.newUtilizationPct}%
              </span>
            </div>
            <ProgressBar
              value={projection.currentUtilizationPct}
              variant={utilizationVariant(projection.currentUtilizationPct)}
              label="Current utilization"
              size="md"
            />
            <ProgressBar
              value={projection.newUtilizationPct}
              variant={utilizationVariant(projection.newUtilizationPct)}
              label="New utilization after repayment"
              size="md"
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background/40 p-3">
        {!isEditingPayment ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Monthly payment</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground num-tabular">
                {formatMoney(monthlyPayment)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingPayment(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-border hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Edit monthly payment amount"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted"
                aria-hidden="true"
              >
                $
              </span>
              <input
                id="edit-monthly-payment"
                type="number"
                value={customMonthlyPayment ?? monthlyPayment}
                onChange={(e) => {
                  const val = Number.parseFloat(e.target.value);
                  setCustomMonthlyPayment(Number.isFinite(val) && val > 0 ? val : null);
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 pl-6 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                aria-label="Assumed monthly payment"
                min={1}
                step={1}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditingPayment(false);
                if (customMonthlyPayment === null) {
                  setCustomMonthlyPayment(null);
                }
              }}
              className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Done
            </button>
            {customMonthlyPayment !== null && (
              <button
                type="button"
                onClick={() => {
                  setCustomMonthlyPayment(null);
                  setIsEditingPayment(false);
                }}
                className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-muted transition-colors hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
