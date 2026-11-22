import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { useCreditLines } from '../hooks/useCreditLines';
import { getBorrowerRiskScore, summarizeCreditLines } from '../lib/credit-summary';
import { getDaysPastDue } from '../lib/delinquency';
import type { CreditLine, Transaction } from '../types/creditLine';
import { formatCurrency } from '../utils/currency';
import { formatAbsolute } from '../utils/dates';
import { shortenAddress } from '../utils/format-address';
import '../styles/print.css';

interface RepaymentEntry {
  id: string;
  lineId: string;
  lineName: string;
  date: string;
  amount: number;
  status: Transaction['status'];
  timing: 'On-time' | 'Late';
  note?: string;
}

interface RepaymentRecord {
  totalRepayments: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number | null;
  entries: RepaymentEntry[];
}

function getRiskTier(score: number): string {
  if (score >= 740) return 'Excellent';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'High Risk';
}

function isDelinquentAtDate(line: CreditLine, txDateMs: number): boolean {
  if (!line.statusHistory || line.statusHistory.length === 0) {
    return line.status === 'Suspended' || line.status === 'Defaulted';
  }

  const sorted = [...line.statusHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  let activeStatus = sorted[0].status;
  for (const entry of sorted) {
    const entryMs = new Date(entry.date).getTime();
    if (!Number.isNaN(entryMs) && entryMs <= txDateMs) {
      activeStatus = entry.status;
    }
  }

  return activeStatus === 'Suspended' || activeStatus === 'Defaulted';
}

function buildRepaymentRecord(lines: CreditLine[]): RepaymentRecord {
  const entries: RepaymentEntry[] = [];

  for (const line of lines) {
    for (const tx of line.transactions ?? []) {
      if (tx.type !== 'Repay') continue;
      const txMs = new Date(tx.date).getTime();
      const noteLower = (tx.note ?? '').toLowerCase();
      const isLate =
        tx.status === 'Failed' ||
        noteLower.includes('late') ||
        noteLower.includes('overdue') ||
        noteLower.includes('past due') ||
        (!Number.isNaN(txMs) && isDelinquentAtDate(line, txMs));

      entries.push({
        id: tx.id,
        lineId: line.id,
        lineName: line.name,
        date: tx.date,
        amount: tx.amount,
        status: tx.status,
        timing: isLate ? 'Late' : 'On-time',
        note: tx.note,
      });
    }
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const onTimeCount = entries.filter((e) => e.timing === 'On-time').length;
  const lateCount = entries.filter((e) => e.timing === 'Late').length;
  const totalRepayments = entries.length;
  const onTimeRate =
    totalRepayments > 0 ? Math.round((onTimeCount / totalRepayments) * 100) : null;

  return {
    totalRepayments,
    onTimeCount,
    lateCount,
    onTimeRate,
    entries,
  };
}

export function CreditReport() {
  const { status, lines, error, owner, wallet } = useCreditLines();
  const generatedAt = useMemo(() => new Date(), []);

  const summary = useMemo(() => summarizeCreditLines(lines), [lines]);
  const riskScore = useMemo(() => getBorrowerRiskScore(lines), [lines]);
  const repaymentRecord = useMemo(() => buildRepaymentRecord(lines), [lines]);

  const utilizationPct =
    summary.drawableLimit > 0
      ? Math.round((summary.totalOutstanding / summary.drawableLimit) * 100)
      : 0;

  const walletAddress = wallet?.publicKey ?? owner ?? '';
  const shortWallet = walletAddress ? shortenAddress(walletAddress) : 'Not connected';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="credit-report mx-auto max-w-5xl px-4 py-6">
      <div className="credit-report__header mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credit Report</h1>
          <p className="mt-1 text-sm text-muted">
            Borrower summary of credit limits, utilisation, risk score, and repayment record.
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-muted">Generated:</dt>
              <dd className="text-foreground">
                <time dateTime={generatedAt.toISOString()}>
                  {formatAbsolute(generatedAt)}
                </time>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-muted">Wallet:</dt>
              <dd className="font-mono text-foreground" data-testid="credit-report-wallet">
                {shortWallet}
              </dd>
            </div>
          </dl>
        </div>

        <div className="credit-report__actions no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="credit-report__print-btn inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-accent"
          >
            <Printer size={16} aria-hidden="true" />
            Print Report
          </button>
        </div>
      </div>

      {status === 'loading' && (
        <section className="credit-report__section rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted">Loading credit report...</p>
        </section>
      )}

      {status === 'error' && (
        <section
          className="credit-report__section rounded-lg border border-error bg-surface p-6 text-center"
          role="alert"
        >
          <h2 className="text-lg font-semibold text-foreground">Unable to load credit report</h2>
          <p className="mt-1 text-sm text-muted">
            {error?.message ?? 'An unexpected error occurred while fetching credit lines.'}
          </p>
        </section>
      )}

      {status !== 'loading' && status !== 'error' && lines.length === 0 && (
        <section
          className="credit-report__section rounded-lg border border-border bg-surface p-8 text-center"
          data-testid="credit-report-empty"
        >
          <h2 className="text-lg font-semibold text-foreground">No credit lines found</h2>
          <p className="mt-2 text-sm text-muted">
            There are no credit lines associated with this wallet yet. Open a credit line to
            generate a full credit report.
          </p>
        </section>
      )}

      {status !== 'loading' && status !== 'error' && lines.length > 0 && (
        <div className="space-y-6">
          {/* 1. Summary Section */}
          <section
            className="credit-report__section rounded-lg border border-border bg-surface p-5"
            aria-labelledby="credit-report-summary-heading"
          >
            <h2
              id="credit-report-summary-heading"
              className="mb-4 text-lg font-semibold text-foreground"
            >
              Portfolio Summary
            </h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Drawable Limit</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">
                  {formatCurrency(summary.drawableLimit)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Available to Draw</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">
                  {formatCurrency(summary.availableToDraw)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Total Outstanding</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">
                  {formatCurrency(summary.totalOutstanding)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Utilisation</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">
                  {utilizationPct}%
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Delinquent Balance</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">
                  {formatCurrency(summary.delinquentOutstanding)}
                </dd>
              </div>
            </dl>
          </section>

          {/* 2. Per-Line Table */}
          <section
            className="credit-report__section rounded-lg border border-border bg-surface p-5"
            aria-labelledby="credit-report-lines-heading"
          >
            <h2
              id="credit-report-lines-heading"
              className="mb-4 text-lg font-semibold text-foreground"
            >
              Credit Lines Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="credit-report__table w-full border-collapse text-left text-sm">
                <caption className="mb-2 text-left text-xs text-muted">
                  Per-line limits, balances, utilisation, APR, risk score, and delinquency status
                </caption>
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted">
                    <th scope="col" className="py-2 pr-4 font-semibold">Line</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Limit</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Utilised</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Utilisation</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">APR</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Risk Score</th>
                    <th scope="col" className="py-2 font-semibold">Days Past Due</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const lineUtil =
                      line.limit > 0 ? Math.round((line.utilized / line.limit) * 100) : 0;
                    const daysPastDue = getDaysPastDue(line, generatedAt);
                    return (
                      <tr key={line.id} className="border-b border-border">
                        <th scope="row" className="py-2 pr-4 font-medium text-foreground">
                          {line.name}
                        </th>
                        <td className="py-2 pr-4 text-foreground">{line.status}</td>
                        <td className="py-2 pr-4 text-foreground">
                          {formatCurrency(line.limit)}
                        </td>
                        <td className="py-2 pr-4 text-foreground">
                          {formatCurrency(line.utilized)}
                        </td>
                        <td className="py-2 pr-4 text-foreground">{lineUtil}%</td>
                        <td className="py-2 pr-4 text-foreground">{line.apr.toFixed(2)}%</td>
                        <td className="py-2 pr-4 text-foreground">{line.riskScore}</td>
                        <td className="py-2 text-foreground">
                          {daysPastDue !== null ? `${daysPastDue}d` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. Risk Score Section */}
          <section
            className="credit-report__section rounded-lg border border-border bg-surface p-5"
            aria-labelledby="credit-report-risk-heading"
          >
            <h2
              id="credit-report-risk-heading"
              className="mb-4 text-lg font-semibold text-foreground"
            >
              Risk Score &amp; Status History
            </h2>
            <div className="mb-4 flex flex-wrap items-baseline gap-6">
              <div>
                <span className="text-xs uppercase tracking-wide text-muted">
                  Borrower Risk Score
                </span>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {riskScore.score !== null ? riskScore.score : 'N/A'}
                  {riskScore.score !== null && (
                    <span className="ml-2 text-sm font-medium text-muted">
                      ({getRiskTier(riskScore.score)})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-muted">
                  Calculation Basis
                </span>
                <p className="mt-1 text-sm text-foreground">
                  {riskScore.basis === 'borrower'
                    ? 'Uniform borrower score'
                    : riskScore.basis === 'limit_weighted'
                      ? 'Limit-weighted average across open lines'
                      : 'No open lines'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="credit-report__table w-full border-collapse text-left text-sm">
                <caption className="mb-2 text-left text-xs text-muted">
                  Status history and risk score observations by credit line
                </caption>
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted">
                    <th scope="col" className="py-2 pr-4 font-semibold">Line</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Score</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Opened</th>
                    <th scope="col" className="py-2 font-semibold">Status History</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-b border-border">
                      <th scope="row" className="py-2 pr-4 font-medium text-foreground">
                        {line.name}
                      </th>
                      <td className="py-2 pr-4 text-foreground">{line.riskScore}</td>
                      <td className="py-2 pr-4 text-foreground">
                        {formatAbsolute(line.openedAt)}
                      </td>
                      <td className="py-2 text-foreground">
                        {line.statusHistory.length > 0
                          ? line.statusHistory
                              .map((entry) => `${entry.status} (${entry.date.slice(0, 10)})`)
                              .join(' → ')
                          : line.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Repayment Record Section */}
          <section
            className="credit-report__section rounded-lg border border-border bg-surface p-5"
            aria-labelledby="credit-report-repayment-heading"
          >
            <h2
              id="credit-report-repayment-heading"
              className="mb-4 text-lg font-semibold text-foreground"
            >
              Repayment Record
            </h2>

            <dl className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Total Repayments</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">
                  {repaymentRecord.totalRepayments}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">On-Time Payments</dt>
                <dd
                  className="mt-1 text-lg font-semibold text-foreground"
                  data-testid="repayment-on-time-count"
                >
                  {repaymentRecord.onTimeCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Late Payments</dt>
                <dd
                  className="mt-1 text-lg font-semibold text-foreground"
                  data-testid="repayment-late-count"
                >
                  {repaymentRecord.lateCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">On-Time Rate</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">
                  {repaymentRecord.onTimeRate !== null
                    ? `${repaymentRecord.onTimeRate}%`
                    : '—'}
                </dd>
              </div>
            </dl>

            {repaymentRecord.entries.length === 0 ? (
              <p className="text-sm text-muted">No repayment transactions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="credit-report__table w-full border-collapse text-left text-sm">
                  <caption className="mb-2 text-left text-xs text-muted">
                    Recorded repayment transactions with on-time and late classification
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted">
                      <th scope="col" className="py-2 pr-4 font-semibold">Date</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Line</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Amount</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                      <th scope="col" className="py-2 font-semibold">Timing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repaymentRecord.entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border">
                        <th scope="row" className="py-2 pr-4 font-medium text-foreground">
                          {formatAbsolute(entry.date)}
                        </th>
                        <td className="py-2 pr-4 text-foreground">{entry.lineName}</td>
                        <td className="py-2 pr-4 text-foreground">
                          {formatCurrency(entry.amount)}
                        </td>
                        <td className="py-2 pr-4 text-foreground">{entry.status}</td>
                        <td className="py-2 text-foreground">{entry.timing}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default CreditReport;
