import type { CreditLine } from '@/types/creditLine';
import type { BatchRepaymentAllocation } from '@/lib/repay-allocation';
import { formatMoney } from '@/utils/amountValidation';

interface BatchAllocationPreviewProps {
  selectedBatchLines: CreditLine[];
  batchAllocation: BatchRepaymentAllocation;
}

/**
 * Per-line interest/principal allocation preview for a batch repayment.
 */
export function BatchAllocationPreview({
  selectedBatchLines,
  batchAllocation,
}: BatchAllocationPreviewProps) {
  return (
    <>
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
    </>
  );
}
