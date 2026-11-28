import type { NavigateFunction } from 'react-router-dom';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Amount } from '@/components/Amount';
import type { RepaymentAllocation } from '@/lib/repay-allocation';
import { formatMoney } from '@/utils/amountValidation';
import { roundToCents } from '@/utils/currency';

export interface BatchRepayLineResult {
  lineId: string;
  lineName: string;
  amount: number;
  allocation: RepaymentAllocation;
  status: 'success' | 'error';
  transactionId?: string;
  error?: string;
}

interface BatchRepayResultsProps {
  batchResults: BatchRepayLineResult[];
  onReset: () => void;
  navigate: NavigateFunction;
}

/**
 * Per-line outcome table for a submitted multi-line repayment.
 */
export function BatchRepayResults({
  batchResults,
  onReset,
  navigate,
}: BatchRepayResultsProps) {
  return (
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
              onClick={onReset}
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
  );
}
