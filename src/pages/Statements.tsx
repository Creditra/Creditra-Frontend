/**
 * Monthly credit-line statements page.
 *
 * Shows a reconciled statement (opening balance, draws, repayments, interest,
 * fees, closing balance) for a chosen credit line and month, with CSV download
 * and print output.
 */

import { useState, useMemo } from 'react';
import { FileText, Download, Printer, AlertCircle } from 'lucide-react';
import { useCreditLines } from '@/hooks/useCreditLines';
import {
  buildMonthlyStatement,
  buildStatementCsv,
  getAvailableMonths,
} from '@/lib/statement';
import { downloadCsv } from '@/utils/csv';
import { formatMoney } from '@/utils/amountValidation';
import './Statements.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(dollars: number): string {
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Statements() {
  const { lines, status, error } = useCreditLines();

  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const selectedLine = useMemo(
    () => lines.find((l) => l.id === selectedLineId) ?? null,
    [lines, selectedLineId],
  );

  const availableMonths = useMemo(
    () => (selectedLine ? getAvailableMonths(selectedLine) : []),
    [selectedLine],
  );

  const statement = useMemo(() => {
    if (!selectedLine) return null;
    try {
      return buildMonthlyStatement(selectedLine, selectedYear, selectedMonth);
    } catch {
      return null;
    }
  }, [selectedLine, selectedYear, selectedMonth]);

  function handleDownloadCsv() {
    if (!statement) return;
    const csv = buildStatementCsv(statement);
    const monthStr = String(statement.month).padStart(2, '0');
    downloadCsv(
      `creditra-statement-${statement.lineId}-${statement.year}-${monthStr}.csv`,
      csv,
    );
  }

  function handlePrint() {
    window.print();
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <main className="statements-page mx-auto max-w-4xl px-4 py-8" aria-busy="true">
        <h1 className="text-2xl font-bold text-foreground">Monthly Statements</h1>
        <p className="mt-4 text-muted" aria-live="polite">Loading credit lines…</p>
      </main>
    );
  }

  if (status === 'error' || error) {
    return (
      <main className="statements-page mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Monthly Statements</h1>
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 p-4 text-error"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Failed to load credit lines. Please try again.</span>
        </div>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="statements-page mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Monthly Statements</h1>
        <p className="mt-4 text-muted">No credit lines found.</p>
      </main>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <main className="statements-page mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-accent" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground">Monthly Statements</h1>
      </div>

      {/* Controls */}
      <section
        aria-label="Statement filters"
        className="statements-controls rounded-lg border border-border bg-surface p-4 space-y-4 sm:flex sm:items-end sm:gap-4 sm:space-y-0"
      >
        {/* Credit line selector */}
        <div className="flex-1">
          <label
            htmlFor="stmt-line-select"
            className="mb-1 block text-xs font-medium text-muted"
          >
            Credit line
          </label>
          <select
            id="stmt-line-select"
            value={selectedLineId}
            onChange={(e) => {
              setSelectedLineId(e.target.value);
              // Reset month to current when line changes
              setSelectedYear(new Date().getFullYear());
              setSelectedMonth(new Date().getMonth() + 1);
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">— Select a credit line —</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.id})
              </option>
            ))}
          </select>
        </div>

        {/* Month picker */}
        <div className="flex-1">
          <label
            htmlFor="stmt-month-select"
            className="mb-1 block text-xs font-medium text-muted"
          >
            Statement month
          </label>
          <select
            id="stmt-month-select"
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number);
              setSelectedYear(y);
              setSelectedMonth(m);
            }}
            disabled={!selectedLine}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          >
            {availableMonths.map(({ year, month, label }) => (
              <option key={`${year}-${month}`} value={`${year}-${month}`}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Actions */}
      {statement && (
        <div className="statements-actions flex gap-3">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={`Download CSV statement for ${monthLabel(statement.year, statement.month)}`}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={`Print statement for ${monthLabel(statement.year, statement.month)}`}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print
          </button>
        </div>
      )}

      {/* Empty state: no line selected */}
      {!selectedLine && (
        <p className="text-sm text-muted">
          Select a credit line above to view its monthly statement.
        </p>
      )}

      {/* Statement summary */}
      {statement && (
        <>
          <section
            aria-label="Statement summary"
            className="statements-summary rounded-lg border border-border bg-surface"
          >
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {statement.lineName} — {monthLabel(statement.year, statement.month)}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {statement.periodStart} to {statement.periodEnd}
              </p>
            </div>

            <table className="w-full text-sm" aria-label="Statement summary totals">
              <caption className="sr-only">
                Monthly statement summary for {statement.lineName},{' '}
                {monthLabel(statement.year, statement.month)}
              </caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-4 py-2 text-muted">Opening balance</td>
                  <td className="px-4 py-2 text-right font-mono text-foreground">
                    {fmt(statement.openingBalance)}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-2 text-muted">Draws</td>
                  <td className="px-4 py-2 text-right font-mono text-foreground">
                    + {fmt(statement.draws)}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-2 text-muted">Interest</td>
                  <td className="px-4 py-2 text-right font-mono text-foreground">
                    + {fmt(statement.interest)}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-2 text-muted">Fees</td>
                  <td className="px-4 py-2 text-right font-mono text-foreground">
                    + {fmt(statement.fees)}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-2 text-muted">Repayments</td>
                  <td className="px-4 py-2 text-right font-mono text-success">
                    − {fmt(statement.repayments)}
                  </td>
                </tr>
                <tr className="bg-accent/5">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    Closing balance
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                    {fmt(statement.closingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Entries list */}
          <section
            aria-label="Statement entries"
            className="statements-entries rounded-lg border border-border bg-surface"
          >
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Transactions</h2>
            </div>

            {statement.entries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">
                No transactions in this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Statement transaction entries">
                  <caption className="sr-only">
                    Transactions for {monthLabel(statement.year, statement.month)}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted">
                      <th scope="col" className="px-4 py-2 text-left font-medium">
                        Date
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-medium">
                        Type
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-medium">
                        Note
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-mono text-xs text-muted">
                          {new Date(entry.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-2 text-foreground">{entry.type}</td>
                        <td className="px-4 py-2 text-muted text-xs">
                          {entry.note ?? '—'}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${
                            entry.type === 'Repay'
                              ? 'text-success'
                              : 'text-foreground'
                          }`}
                        >
                          {entry.type === 'Repay' ? '−' : '+'} {fmt(entry.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default Statements;
