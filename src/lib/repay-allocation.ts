/**
 * Cents-exact repayment allocation.
 *
 * Repayments pay accrued interest first, then reduce principal. Keeping this
 * math in one place prevents the page, preview modal, compact modal and
 * success state from disagreeing about the remaining balance.
 */
export interface RepayAllocationLine {
  /** Outstanding principal. The primary field used by credit-line models. */
  utilized?: number;
  /** Alias accepted for callers that model principal explicitly. */
  principal?: number;
}

export type BatchAllocationStrategy = 'highest-apr' | 'pro-rata';

export interface BatchRepayAllocationLine extends RepayAllocationLine {
  id: string;
  apr?: number;
}

export interface RepaymentAllocation {
  interestPaid: number;
  principalPaid: number;
  remainingInterest: number;
  remainingPrincipal: number;
  remainingTotal: number;
  isFullPayoff: boolean;
}

export interface BatchRepaymentLineAllocation {
  lineId: string;
  allocatedAmount: number;
  allocation: RepaymentAllocation;
}

export interface BatchRepaymentAllocation {
  allocations: Record<string, RepaymentAllocation>;
  items: BatchRepaymentLineAllocation[];
  totalAllocated: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  totalRemaining: number;
  unallocatedRemainder: number;
}

const toCents = (dollars: number): number =>
  Math.max(0, Math.round((Number.isFinite(dollars) ? dollars : 0) * 100));

const fromCents = (cents: number): number => cents / 100;

/**
 * Allocate `amount` against a line's outstanding principal and accrued
 * interest. All arithmetic is performed in integer cents; returned values are
 * dollars for display.
 *
 * Invariant: `interestPaid + principalPaid === amount` (when both sides are
 * compared in cents), even if the caller passes an overpayment.
 */
export function allocateRepayment(
  line: RepayAllocationLine,
  amount: number,
  accruedInterest: number,
): RepaymentAllocation {
  const principalCents = toCents(line.principal ?? line.utilized ?? 0);
  const interestCents = toCents(accruedInterest);
  const amountCents = toCents(amount);

  const interestPaidCents = Math.min(amountCents, interestCents);
  const principalPaidCents = amountCents - interestPaidCents;

  const remainingInterestCents = Math.max(0, interestCents - interestPaidCents);
  const remainingPrincipalCents = Math.max(
    0,
    principalCents - principalPaidCents,
  );
  const remainingTotalCents =
    remainingInterestCents + remainingPrincipalCents;

  return {
    interestPaid: fromCents(interestPaidCents),
    principalPaid: fromCents(principalPaidCents),
    remainingInterest: fromCents(remainingInterestCents),
    remainingPrincipal: fromCents(remainingPrincipalCents),
    remainingTotal: fromCents(remainingTotalCents),
    isFullPayoff: remainingTotalCents === 0,
  };
}

/**
 * Distribute `totalAmount` across multiple credit lines in integer cents using
 * the chosen strategy (`'highest-apr'` or `'pro-rata'`), reusing
 * `allocateRepayment` per line.
 *
 * Overpayment beyond the combined total owed is capped at total owed and
 * returned in `unallocatedRemainder`.
 */
export function allocateBatchRepayment(
  lines: readonly BatchRepayAllocationLine[],
  totalAmount: number,
  accruedByLineId: Readonly<Record<string, number>> = {},
  strategy: BatchAllocationStrategy = 'highest-apr',
): BatchRepaymentAllocation {
  const totalAmountCents = toCents(totalAmount);

  if (lines.length === 0) {
    return {
      allocations: {},
      items: [],
      totalAllocated: 0,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
      totalRemaining: 0,
      unallocatedRemainder: fromCents(totalAmountCents),
    };
  }

  const lineMeta = lines.map((line, index) => {
    const principalCents = toCents(line.principal ?? line.utilized ?? 0);
    const accrued = accruedByLineId[line.id] ?? 0;
    const interestCents = toCents(accrued);
    const owedCents = principalCents + interestCents;
    return {
      line,
      index,
      accrued,
      owedCents,
      apr: Number.isFinite(line.apr) ? (line.apr as number) : 0,
    };
  });

  const totalOwedCents = lineMeta.reduce((sum, item) => sum + item.owedCents, 0);
  const poolCents = Math.min(totalAmountCents, totalOwedCents);
  const allocatedCentsByIndex = new Array<number>(lines.length).fill(0);

  if (poolCents > 0) {
    if (strategy === 'highest-apr') {
      const ordered = [...lineMeta].sort((a, b) => {
        if (b.apr !== a.apr) return b.apr - a.apr;
        return a.index - b.index;
      });
      let remainingPool = poolCents;
      for (const entry of ordered) {
        if (remainingPool <= 0) break;
        const give = Math.min(remainingPool, entry.owedCents);
        allocatedCentsByIndex[entry.index] = give;
        remainingPool -= give;
      }
    } else {
      // Pro-rata in integer cents using the Largest Remainder (Hamilton) method.
      const shares = lineMeta.map((entry) => {
        if (entry.owedCents === 0 || totalOwedCents === 0) {
          return { index: entry.index, floor: 0, remainder: 0, owedCents: 0 };
        }
        const exact = (poolCents * entry.owedCents) / totalOwedCents;
        const floor = Math.min(entry.owedCents, Math.floor(exact));
        return {
          index: entry.index,
          floor,
          remainder: exact - floor,
          owedCents: entry.owedCents,
        };
      });

      let assigned = 0;
      for (const share of shares) {
        allocatedCentsByIndex[share.index] = share.floor;
        assigned += share.floor;
      }

      let leftover = poolCents - assigned;
      if (leftover > 0) {
        const eligible = shares
          .filter((s) => allocatedCentsByIndex[s.index] < s.owedCents)
          .sort((a, b) => {
            if (b.remainder !== a.remainder) return b.remainder - a.remainder;
            return a.index - b.index;
          });

        for (const share of eligible) {
          if (leftover <= 0) break;
          allocatedCentsByIndex[share.index] += 1;
          leftover -= 1;
        }
      }
    }
  }

  const allocations: Record<string, RepaymentAllocation> = {};
  const items: BatchRepaymentLineAllocation[] = [];
  let totalInterestPaidCents = 0;
  let totalPrincipalPaidCents = 0;
  let totalRemainingCents = 0;
  let totalAllocatedCents = 0;

  for (const entry of lineMeta) {
    const allocatedCents = allocatedCentsByIndex[entry.index];
    const allocatedAmount = fromCents(allocatedCents);
    const allocation = allocateRepayment(
      entry.line,
      allocatedAmount,
      entry.accrued,
    );

    allocations[entry.line.id] = allocation;
    items.push({
      lineId: entry.line.id,
      allocatedAmount,
      allocation,
    });

    totalAllocatedCents += allocatedCents;
    totalInterestPaidCents += toCents(allocation.interestPaid);
    totalPrincipalPaidCents += toCents(allocation.principalPaid);
    totalRemainingCents += toCents(allocation.remainingTotal);
  }

  const unallocatedRemainderCents = Math.max(
    0,
    totalAmountCents - totalAllocatedCents,
  );

  return {
    allocations,
    items,
    totalAllocated: fromCents(totalAllocatedCents),
    totalInterestPaid: fromCents(totalInterestPaidCents),
    totalPrincipalPaid: fromCents(totalPrincipalPaidCents),
    totalRemaining: fromCents(totalRemainingCents),
    unallocatedRemainder: fromCents(unallocatedRemainderCents),
  };
}
