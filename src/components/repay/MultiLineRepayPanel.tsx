import { useEffect, useMemo, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { motionClasses } from '@/context/ReducedMotionContext';
import { getAccruedInterest } from '@/lib/interest';
import {
  allocateBatchRepayment,
  type BatchAllocationStrategy,
  type BatchRepaymentAllocation,
  type RepaymentAllocation,
} from '@/lib/repay-allocation';
import { saveMockRepaymentTransaction } from '@/services/creditDataSource';
import type { CreditLine } from '@/types/creditLine';
import type { WalletInfo } from '@/types/wallet';
import { formatMoney } from '@/utils/amountValidation';
import { roundToCents } from '@/utils/currency';
import { BatchAllocationForm } from './BatchAllocationForm';
import { BatchAllocationPreview } from './BatchAllocationPreview';
import { BatchLineSelector } from './BatchLineSelector';
import { BatchRepayResults, type BatchRepayLineResult } from './BatchRepayResults';

interface MultiLineRepayPanelProps {
  creditLines: CreditLine[];
  wallet: WalletInfo;
  hasRepayableBalance: boolean;
  walletBalance: number;
  initialSelectedLineIds: string[];
  announce: (message: string) => void;
  navigate: NavigateFunction;
  isReducedMotionActive: boolean;
}

/**
 * Multi-line (batch) repayment: line selection, allocation strategy/preview
 * and submission of one split payment across several credit lines.
 */
export function MultiLineRepayPanel({
  creditLines,
  wallet,
  hasRepayableBalance,
  walletBalance,
  initialSelectedLineIds,
  announce,
  navigate,
  isReducedMotionActive,
}: MultiLineRepayPanelProps) {
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(
    () => initialSelectedLineIds,
  );
  const [batchStrategy, setBatchStrategy] =
    useState<BatchAllocationStrategy>('highest-apr');
  const [batchInputMode, setBatchInputMode] = useState<'total' | 'per-line'>('total');
  const [batchTotalStr, setBatchTotalStr] = useState('');
  const [perLineAmountStrs, setPerLineAmountStrs] = useState<Record<string, string>>({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchRepayLineResult[] | null>(null);

  const accruedByLineId = useMemo(() => {
    const now = new Date();
    const map: Record<string, number> = {};
    for (const cl of creditLines) {
      map[cl.id] = getAccruedInterest(cl, now);
    }
    return map;
  }, [creditLines]);

  const selectedBatchLines = useMemo(
    () => creditLines.filter((cl) => selectedLineIds.includes(cl.id)),
    [creditLines, selectedLineIds],
  );

  const batchTotalOwed = useMemo(
    () =>
      roundToCents(
        selectedBatchLines.reduce(
          (sum, cl) => sum + cl.utilized + (accruedByLineId[cl.id] ?? 0),
          0,
        ),
      ),
    [selectedBatchLines, accruedByLineId],
  );

  const batchAllocation: BatchRepaymentAllocation = useMemo(() => {
    if (batchInputMode === 'total') {
      const parsed = parseFloat(batchTotalStr);
      const totalAmt = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      return allocateBatchRepayment(
        selectedBatchLines,
        totalAmt,
        accruedByLineId,
        batchStrategy,
      );
    }

    const allocations: Record<string, RepaymentAllocation> = {};
    const items: BatchRepaymentAllocation['items'] = [];
    let totalAllocatedCents = 0;
    let totalInterestCents = 0;
    let totalPrincipalCents = 0;
    let totalRemainingCents = 0;
    let unallocatedCents = 0;

    for (const cl of selectedBatchLines) {
      const parsed = parseFloat(perLineAmountStrs[cl.id] ?? '');
      const lineAmt = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      const single = allocateBatchRepayment(
        [cl],
        lineAmt,
        accruedByLineId,
        'highest-apr',
      );
      const item = single.items[0];
      allocations[cl.id] = item.allocation;
      items.push(item);
      totalAllocatedCents += Math.round(item.allocatedAmount * 100);
      totalInterestCents += Math.round(item.allocation.interestPaid * 100);
      totalPrincipalCents += Math.round(item.allocation.principalPaid * 100);
      totalRemainingCents += Math.round(item.allocation.remainingTotal * 100);
      unallocatedCents += Math.round(single.unallocatedRemainder * 100);
    }

    return {
      allocations,
      items,
      totalAllocated: totalAllocatedCents / 100,
      totalInterestPaid: totalInterestCents / 100,
      totalPrincipalPaid: totalPrincipalCents / 100,
      totalRemaining: totalRemainingCents / 100,
      unallocatedRemainder: unallocatedCents / 100,
    };
  }, [
    batchInputMode,
    batchTotalStr,
    perLineAmountStrs,
    selectedBatchLines,
    accruedByLineId,
    batchStrategy,
  ]);

  const batchExceedsWallet =
    hasRepayableBalance && batchAllocation.totalAllocated > walletBalance;

  const isBatchSubmitDisabled =
    isBatchSubmitting ||
    !hasRepayableBalance ||
    selectedBatchLines.length === 0 ||
    batchAllocation.totalAllocated <= 0 ||
    batchExceedsWallet;

  useEffect(() => {
    if (batchResults !== null) return;
    if (selectedBatchLines.length === 0) {
      announce('No credit lines selected for multi-line repayment.');
      return;
    }
    if (batchAllocation.totalAllocated > 0) {
      const countLabel = `${selectedBatchLines.length} ${selectedBatchLines.length === 1 ? 'line' : 'lines'}`;
      const remainderText =
        batchAllocation.unallocatedRemainder > 0
          ? ` Unallocated remainder: ${formatMoney(batchAllocation.unallocatedRemainder)}.`
          : '';
      announce(
        `Allocation preview updated for ${countLabel}: paying ${formatMoney(batchAllocation.totalAllocated)} (${formatMoney(batchAllocation.totalInterestPaid)} interest, ${formatMoney(batchAllocation.totalPrincipalPaid)} principal).${remainderText}`,
      );
    } else {
      announce(
        `${selectedBatchLines.length} ${selectedBatchLines.length === 1 ? 'line' : 'lines'} selected. Enter a repayment amount to preview allocation.`,
      );
    }
  }, [
    batchResults,
    selectedBatchLines.length,
    batchAllocation.totalAllocated,
    batchAllocation.totalInterestPaid,
    batchAllocation.totalPrincipalPaid,
    batchAllocation.unallocatedRemainder,
  ]);

  const handleToggleBatchLine = (lineId: string) => {
    setSelectedLineIds((prev) =>
      prev.includes(lineId)
        ? prev.filter((id) => id !== lineId)
        : [...prev, lineId],
    );
  };

  const handleToggleMultiLineMode = () => {
    setIsMultiLineMode((prev) => {
      const next = !prev;
      setBatchResults(null);
      if (next) {
        announce(
          'Multi-line repayment mode enabled. Select credit lines to repay.',
        );
      } else {
        announce('Single-line repayment mode enabled.');
      }
      return next;
    });
  };

  const handleBatchSubmit = () => {
    if (isBatchSubmitDisabled || !wallet.publicKey) return;

    setIsBatchSubmitting(true);
    const timestamp = new Date().toISOString();
    const results: BatchRepayLineResult[] = [];
    const linesById = new Map(selectedBatchLines.map((cl) => [cl.id, cl]));

    for (let idx = 0; idx < batchAllocation.items.length; idx += 1) {
      const item = batchAllocation.items[idx];
      if (item.allocatedAmount <= 0) continue;
      const cl = linesById.get(item.lineId);
      if (!cl) continue;

      const transactionId = `TXN-${Date.now()}-${idx + 1}`;
      try {
        saveMockRepaymentTransaction({
          id: transactionId,
          owner: wallet.publicKey,
          status: 'Completed',
          creditLineId: cl.id,
          creditLineName: cl.name,
          amount: item.allocatedAmount,
          remainingDebt: item.allocation.remainingTotal,
          limit: cl.limit,
          apr: cl.apr,
          nextPaymentAmount: cl.nextPaymentAmount,
          timestamp,
        });
        results.push({
          lineId: cl.id,
          lineName: cl.name,
          amount: item.allocatedAmount,
          allocation: item.allocation,
          status: 'success',
          transactionId,
        });
      } catch (err) {
        results.push({
          lineId: cl.id,
          lineName: cl.name,
          amount: item.allocatedAmount,
          allocation: item.allocation,
          status: 'error',
          error:
            err instanceof Error
              ? err.message
              : 'Repayment failed for this credit line.',
        });
      }
    }

    setBatchResults(results);
    setIsBatchSubmitting(false);

    const succeeded = results.filter((r) => r.status === 'success').length;
    const failed = results.length - succeeded;
    if (failed === 0) {
      announce(
        `Batch repayment complete: ${succeeded} ${succeeded === 1 ? 'line' : 'lines'} repaid.`,
      );
    } else {
      announce(
        `Batch repayment finished with partial results: ${succeeded} succeeded, ${failed} failed.`,
      );
    }
  };

  if (batchResults !== null) {
    return (
      <BatchRepayResults
        batchResults={batchResults}
        onReset={() => {
          setBatchResults(null);
          setBatchTotalStr('');
          setPerLineAmountStrs({});
        }}
        navigate={navigate}
      />
    );
  }

  return (
    <div className="mt-4 space-y-4" data-testid="multi-line-repay-panel">
      <BatchLineSelector
        creditLines={creditLines}
        selectedLineIds={selectedLineIds}
        accruedByLineId={accruedByLineId}
        batchInputMode={batchInputMode}
        perLineAmountStrs={perLineAmountStrs}
        onToggle={handleToggleBatchLine}
        setPerLineAmount={(lineId, value) =>
          setPerLineAmountStrs((prev) => ({ ...prev, [lineId]: value }))
        }
      />

      <BatchAllocationForm
        batchInputMode={batchInputMode}
        setBatchInputMode={setBatchInputMode}
        hasRepayableBalance={hasRepayableBalance}
        walletBalance={walletBalance}
        batchStrategy={batchStrategy}
        setBatchStrategy={setBatchStrategy}
        batchTotalStr={batchTotalStr}
        setBatchTotalStr={setBatchTotalStr}
        batchTotalOwed={batchTotalOwed}
        batchAllocation={batchAllocation}
        batchExceedsWallet={batchExceedsWallet}
      />

      <BatchAllocationPreview
        selectedBatchLines={selectedBatchLines}
        batchAllocation={batchAllocation}
      />

      <button
        type="button"
        onClick={handleBatchSubmit}
        disabled={isBatchSubmitDisabled}
        data-testid="batch-repay-submit"
        className={`w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${motionClasses(isReducedMotionActive, 'transition-all hover:brightness-110')}`}
      >
        {isBatchSubmitting
          ? 'Submitting batch repayment…'
          : `Submit Batch Repayment (${formatMoney(batchAllocation.totalAllocated)})`}
      </button>
    </div>
  );
}
