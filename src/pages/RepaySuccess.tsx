import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Home, RefreshCw } from 'lucide-react';
import { RepaySuccessShareCard } from '@/components/RepaySuccessShareCard';
import { PayoffProjection } from '@/components/PayoffProjection';
import { creditDataSource, type RepaymentTransaction } from '@/services/creditDataSource';
import { useWallet } from '@/context/WalletContext';
import { formatMoney } from '@/utils/amountValidation';

/**
 * Shape of the optional navigation state used for an immediate render while
 * the transaction id in the URL is checked against the data source.
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

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const daysInMonth = [
    31,
    Number(year) % 4 === 0 && (Number(year) % 100 !== 0 || Number(year) % 400 === 0) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1] &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
}

/**
 * Guard to validate that an unknown value satisfies the `RepaySuccessState`
 * interface at runtime.
 */
function isValidRepaySuccessState(v: unknown): v is RepaySuccessState {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  const isFiniteNonNegative = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;
  return (
    isFiniteNonNegative(s.amount) &&
    typeof s.creditLineName === 'string' &&
    s.creditLineName.trim().length > 0 &&
    typeof s.creditLineId === 'string' &&
    s.creditLineId.trim().length > 0 &&
    typeof s.transactionId === 'string' &&
    s.transactionId.trim().length > 0 &&
    isFiniteNonNegative(s.remainingDebt) &&
    isFiniteNonNegative(s.limit) &&
    s.remainingDebt <= s.limit &&
    isFiniteNonNegative(s.apr) &&
    (s.nextPaymentAmount === undefined || isFiniteNonNegative(s.nextPaymentAmount)) &&
    isIsoTimestamp(s.timestamp)
  );
}

function isValidTransaction(value: unknown): value is RepaymentTransaction {
  if (!value || typeof value !== 'object') return false;
  const transaction = value as Record<string, unknown>;
  return (
    typeof transaction.id === 'string' &&
    transaction.id.trim().length > 0 &&
    typeof transaction.owner === 'string' &&
    transaction.owner.trim().length > 0 &&
    ['Completed', 'Pending', 'Failed'].includes(String(transaction.status)) &&
    typeof transaction.creditLineId === 'string' &&
    transaction.creditLineId.trim().length > 0 &&
    typeof transaction.creditLineName === 'string' &&
    transaction.creditLineName.trim().length > 0 &&
    typeof transaction.amount === 'number' &&
    Number.isFinite(transaction.amount) &&
    transaction.amount >= 0 &&
    typeof transaction.remainingDebt === 'number' &&
    Number.isFinite(transaction.remainingDebt) &&
    transaction.remainingDebt >= 0 &&
    typeof transaction.limit === 'number' &&
    Number.isFinite(transaction.limit) &&
    transaction.limit >= transaction.remainingDebt &&
    typeof transaction.apr === 'number' &&
    Number.isFinite(transaction.apr) &&
    transaction.apr >= 0 &&
    (transaction.nextPaymentAmount === undefined ||
      (typeof transaction.nextPaymentAmount === 'number' &&
        Number.isFinite(transaction.nextPaymentAmount) &&
        transaction.nextPaymentAmount >= 0)) &&
    isIsoTimestamp(transaction.timestamp)
  );
}

type LookupStatus = 'loading' | 'completed' | 'pending' | 'failed' | 'not-found' | 'error';

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
 * navigate('/repay/success?tx=' + transactionId, {
 *   state: { amount, creditLineName, creditLineId, transactionId,
 *            remainingDebt, limit, apr, nextPaymentAmount, timestamp }
 * })
 * ```
 *
 * The transaction URL is verified for the connected wallet before a
 * completed repayment is shown.
 *
 * **Accessibility notes**
 *
 * - Status changes use live regions; failed states use `role="alert"`.
 * - All action buttons meet the 44×44 px touch-target minimum.
 * - The share card uses its own ARIA attributes.
 *
 * @see RepayPage – the upstream page that navigates here on confirm.
 * @see RepaySuccessShareCard – the embedded shareable card.
 */
export default function RepaySuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { wallet } = useWallet();
  const transactionId = searchParams.get('tx')?.trim() ?? '';
  const validState = isValidRepaySuccessState(location.state) ? location.state : null;
  const [status, setStatus] = useState<LookupStatus>('loading');
  const [transaction, setTransaction] = useState<RepaymentTransaction | null>(null);
  const requestId = useRef(0);
  const initialLookupCompleteFor = useRef('');

  const refreshTransaction = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!transactionId || !wallet?.publicKey) {
      initialLookupCompleteFor.current = transactionId;
      setTransaction(null);
      setStatus('not-found');
      return;
    }

    setStatus('loading');
    try {
      const result = await creditDataSource.getTransaction(wallet.publicKey, transactionId);
      if (currentRequestId !== requestId.current) return;
      initialLookupCompleteFor.current = transactionId;
      if (
        !isValidTransaction(result) ||
        result.id !== transactionId ||
        result.owner !== wallet.publicKey
      ) {
        setTransaction(null);
        setStatus('not-found');
        return;
      }
      setTransaction(result);
      setStatus(
        result.status === 'Completed'
          ? 'completed'
          : result.status === 'Pending'
            ? 'pending'
            : 'failed',
      );
    } catch {
      if (currentRequestId !== requestId.current) return;
      initialLookupCompleteFor.current = transactionId;
      setTransaction(null);
      setStatus('error');
    }
  }, [transactionId, wallet?.publicKey]);

  useEffect(() => {
    void refreshTransaction();
    return () => {
      requestId.current += 1;
    };
  }, [refreshTransaction]);

  const handleDashboard = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleNewRepay = useCallback(() => {
    navigate('/repay');
  }, [navigate]);

  const freshNavigationState =
    status === 'loading' &&
    initialLookupCompleteFor.current !== transactionId &&
    transactionId.length > 0 &&
    Boolean(wallet?.publicKey) &&
    validState?.transactionId === transactionId
      ? validState
      : null;
  const ownedTransaction =
    transaction &&
    transaction.owner === wallet?.publicKey &&
    transaction.id === transactionId
      ? transaction
      : null;
  const displayState = useMemo<RepaySuccessState | null>(() => {
    if (status === 'completed' && ownedTransaction) {
      return {
        amount: ownedTransaction.amount,
        creditLineName: ownedTransaction.creditLineName,
        creditLineId: ownedTransaction.creditLineId,
        transactionId: ownedTransaction.id,
        remainingDebt: ownedTransaction.remainingDebt,
        limit: ownedTransaction.limit,
        apr: ownedTransaction.apr,
        nextPaymentAmount: ownedTransaction.nextPaymentAmount,
        timestamp: ownedTransaction.timestamp,
      };
    }
    return freshNavigationState;
  }, [freshNavigationState, ownedTransaction, status]);

  const newUtilizationPct = displayState
    ? displayState.limit > 0
      ? Math.round((displayState.remainingDebt / displayState.limit) * 100)
      : 0
    : 0;

  if (status === 'pending' && ownedTransaction) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 text-center" role="status" aria-live="polite">
        <div className="rounded-lg border border-border bg-surface p-8">
          <h1 className="text-2xl font-bold text-foreground">Repayment submitted, awaiting confirmation</h1>
          <p className="mt-2 text-muted">We are waiting for the repayment to be confirmed.</p>
          <button
            type="button"
            onClick={() => void refreshTransaction()}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </main>
    );
  }

  if (status === 'failed' && ownedTransaction) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 text-center" role="alert">
        <div className="rounded-lg border border-border bg-surface p-8">
          <h1 className="text-2xl font-bold text-foreground">Repayment failed</h1>
          <p className="mt-2 text-muted">This repayment could not be completed.</p>
          <Link
            to={`/repay?line=${encodeURIComponent(ownedTransaction.creditLineId)}`}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground"
          >
            Return to repayment
          </Link>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 text-center" role="alert">
        <div className="rounded-lg border border-border bg-surface p-8">
          <h1 className="text-2xl font-bold text-foreground">We couldn't verify this repayment</h1>
          <p className="mt-2 text-muted">Please try again to check its status.</p>
          <button
            type="button"
            onClick={() => void refreshTransaction()}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </main>
    );
  }

  // No transaction id, or no transaction owned by this wallet.
  if (!displayState) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 text-center" role="status" aria-live="polite">
        <div className="rounded-lg border border-border bg-surface p-8">
          <h1 className="text-2xl font-bold text-foreground">
            {status === 'loading' ? 'Checking repayment status' : "We couldn't find this repayment"}
          </h1>
          <p className="mt-2 text-muted">
            {status === 'loading'
              ? 'Please wait while we check this transaction.'
              : 'Check the transaction link or review your activity.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-background">Dashboard</Link>
            <Link to="/transactions" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground">Transactions</Link>
          </div>
        </div>
      </main>
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
            You repaid {formatMoney(displayState.amount)}!
          </h1>
          <p className="text-sm text-muted">
            {displayState.creditLineName} &middot; Your transaction was successful.
          </p>
        </header>

        {/* ── Shareable success card ───────────────────────────────────────── */}
        <RepaySuccessShareCard
          amount={displayState.amount}
          creditLineName={displayState.creditLineName}
          transactionId={displayState.transactionId}
          timestamp={new Date(displayState.timestamp)}
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
                {formatMoney(displayState.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Remaining debt</span>
              <span
                className={`font-semibold ${
                  displayState.remainingDebt === 0
                    ? 'text-success'
                    : 'text-foreground'
                }`}
              >
                {formatMoney(displayState.remainingDebt)}
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
                      displayState.remainingDebt === 0
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
                    width: `${Math.max(newUtilizationPct, displayState.remainingDebt > 0 ? 2 : 0)}%`,
                    background:
                      displayState.remainingDebt === 0
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
          currentDebt={displayState.remainingDebt}
          apr={displayState.apr}
          repayAmount={0}
          limit={displayState.limit}
          nextPaymentAmount={displayState.nextPaymentAmount}
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
