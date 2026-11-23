import { Amount } from '@/components/Amount';
import { StatusBadge } from '@/components/StatusBadge';
import { isDelinquentLine } from '@/lib/repay-eligibility';
import type { CreditLine } from '@/types/creditLine';
import { formatMoney } from '@/utils/amountValidation';
import { roundToCents } from '@/utils/currency';

interface BatchLineSelectorProps {
  creditLines: CreditLine[];
  selectedLineIds: string[];
  accruedByLineId: Record<string, number>;
  batchInputMode: 'total' | 'per-line';
  perLineAmountStrs: Record<string, string>;
  onToggle: (lineId: string) => void;
  setPerLineAmount: (lineId: string, value: string) => void;
}

/**
 * Checkbox list of repayable lines for a batch repayment, with optional
 * per-line amount inputs.
 */
export function BatchLineSelector({
  creditLines,
  selectedLineIds,
  accruedByLineId,
  batchInputMode,
  perLineAmountStrs,
  onToggle,
  setPerLineAmount,
}: BatchLineSelectorProps) {
  return (
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
              onChange={() => onToggle(cl.id)}
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
                onChange={(e) => setPerLineAmount(cl.id, e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground num-tabular focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
          )}
        </div>
      );
    })}
  </div>
</fieldset>
  );
}
