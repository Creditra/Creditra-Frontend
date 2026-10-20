import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Home } from 'lucide-react';
import { RepaySuccessShareCard } from '@/components/RepaySuccessShareCard';
import { PayoffProjection } from '@/components/PayoffProjection';
import { formatMoney } from '@/utils/amountValidation';

/**
 * Shape of the navigation state expected when arriving at this page.
 * `RepayPage` passes this via `navigate('/repay/success', { state })`.
 */
interface RepaySuccessState {
  amount: number;
  creditLineName: string;
  creditLineId: string;
  transactionId: string;
  /** Remaining debt *after* the repayment. */
  remainingDebt: number;
  /** Credit line total limit. */
  limit: number;
  /** Annual percentage rate on the line. */
  apr: number;
  /** Optional next payment amount for the PayoffProjection. */
  nextPaymentAmount?: number;
  /** ISO string of when the repayment was processed. */
  timestamp: string;
}

/**
 * Guard to validate that an unknown value satisfies the `RepaySuccessState`
 * interface at runtime — no extra keys, all required fields present and
 * coercible to the expected types.
 */
function isValidRepaySuccessState(v: unknown): v is RepaySuccessState {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.amount === 'number' &&
    typeof s.creditLineName === 'string' &&
    typeof s.creditLineId === 'string' &&
    typeof s.transactionId === 'string' &&
    typeof s.remainingDebt === 'number' &&
    typeof s.limit === 'number' &&
    typeof s.apr === 'number' &&
    typeof s.timestamp === 'string'
  );
}

/**
 * Landing page shown after a successful repayment.
 *
 * Displays a shareable success card and a repayment summary, with options to
 * return to the dashboard or start another repayment.
 *
 * **Navigation contract**
 *
 * `RepayPage` sends the user here via:
 * ```
 * navigate('/repay/success', {
 *   state: { amount, creditLineName, creditLineId, transactionId,
 *            remainingDebt, limit, apr, nextPaymentAmount, timestamp }
 * })
 * ```
 *
 * When the page is accessed directly without state (e.g. a bookmark), a
 * fallback message invites the user to navigate to the dashboard.
 *
 * **Accessibility notes**
 *
 * - Inner container uses `role="status"` so screen readers announce the success
 *   without preempting user keystrokes, while `<main>` retains its landmark role.
 * - All action buttons meet the 44×44 px touch-target minimum.
 * - The share card uses its own ARIA attributes.
 *
 * @see RepayPage – the upstream page that navigates here on confirm.
 * @see RepaySuccessShareCard – the embedded shareable card.
 */
export default function RepaySuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as RepaySuccessState | null;

  const validState = isValidRepaySuccessState(state) ? state : null;

  const handleDashboard = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleNewRepay = useCallback(() => {
    navigate('/repay');
  }, [navigate]);

  const newUtilizationPct = validState
    ? validState.limit > 0
      ? Math.round((validState.remainingDebt / validState.limit) * 100)
      : 0
    : 0;

  // ── Fallback: no state provided ──────────────────────────────────────────
  if (!validState) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <div className="rounded-lg border border-border bg-surface p-8">
          <CheckCircle className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Repayment successful
          </h1>
          <p className="mt-2 text-muted">
            Your repayment was processed, but the full details are not available
            on this screen. Visit the dashboard to see your updated credit lines.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleDashboard}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-background transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={handleNewRepay}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-all hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Make another repayment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div role="status" aria-live="polite">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => navigate('/repay')}
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
            You repaid {formatMoney(validState.amount)}!
          </h1>
          <p className="text-sm text-muted">
            {validState.creditLineName} &middot; Your transaction was successful.
          </p>
        </header>

        {/* ── Shareable success card ───────────────────────────────────────── */}
        <RepaySuccessShareCard
          amount={validState.amount}
          creditLineName={validState.creditLineName}
          transactionId={validState.transactionId}
          timestamp={new Date(validState.timestamp)}
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
                {formatMoney(validState.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Remaining debt</span>
              <span
                className={`font-semibold ${
                  validState.remainingDebt === 0
                    ? 'text-success'
                    : 'text-foreground'
                }`}
              >
                {formatMoney(validState.remainingDebt)}
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
                      validState.remainingDebt === 0
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
                    width: `${Math.max(newUtilizationPct, validState.remainingDebt > 0 ? 2 : 0)}%`,
                    background:
                      validState.remainingDebt === 0
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
          currentDebt={validState.remainingDebt}
          apr={validState.apr}
          repayAmount={0}
          limit={validState.limit}
          nextPaymentAmount={validState.nextPaymentAmount}
        />

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleDashboard}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to Dashboard
          </button>
          <button
            type="button"
            onClick={handleNewRepay}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Make another repayment
          </button>
        </div>
      </div>
    </main>
  );
}
