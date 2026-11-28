import { AlertCircle, Info } from 'lucide-react';
import { Amount } from '@/components/Amount';
import type {
  BatchAllocationStrategy,
  BatchRepaymentAllocation,
} from '@/lib/repay-allocation';
import { formatMoney } from '@/utils/amountValidation';

interface BatchAllocationFormProps {
  batchInputMode: 'total' | 'per-line';
  setBatchInputMode: (mode: 'total' | 'per-line') => void;
  hasRepayableBalance: boolean;
  walletBalance: number;
  batchStrategy: BatchAllocationStrategy;
  setBatchStrategy: (strategy: BatchAllocationStrategy) => void;
  batchTotalStr: string;
  setBatchTotalStr: (value: string) => void;
  batchTotalOwed: number;
  batchAllocation: BatchRepaymentAllocation;
  batchExceedsWallet: boolean;
}

/**
 * Batch amount entry: input mode, allocation strategy and total amount.
 */
export function BatchAllocationForm({
  batchInputMode,
  setBatchInputMode,
  hasRepayableBalance,
  walletBalance,
  batchStrategy,
  setBatchStrategy,
  batchTotalStr,
  setBatchTotalStr,
  batchTotalOwed,
  batchAllocation,
  batchExceedsWallet,
}: BatchAllocationFormProps) {
  return (
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
  );
}
