export interface SuggestRepayParams {
  totalDue: number;
  limit: number;
  walletBalance: number;
  apr: number;
  nextPaymentAmount?: number;
}

export interface RepaySuggestion {
  amount: number;
  reason:
    | 'target_utilization'
    | 'minimum_due'
    | 'interest_only'
    | 'capped_by_wallet'
    | 'insufficient_for_minimum'
    | 'nothing_due'
    | 'empty_wallet';
}

const toCents = (amount: number) =>
  Number.isFinite(amount)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(amount * 100)))
    : 0;

// A fractional cent in a balance cannot fund a whole cent of repayment.
const availableCents = (amount: number) => {
  const cents = toCents(amount);
  return cents / 100 > amount ? Math.max(0, cents - 1) : cents;
};

const TARGET_UTILIZATION = 0.5;

export function suggestRepayAmount({
  totalDue,
  limit,
  walletBalance,
  apr,
  nextPaymentAmount,
}: SuggestRepayParams): RepaySuggestion {
  const dueCents = availableCents(totalDue);
  const walletCents = availableCents(walletBalance);
  if (dueCents === 0) return { amount: 0, reason: 'nothing_due' };
  if (walletCents === 0) return { amount: 0, reason: 'empty_wallet' };

  const amountToTargetUtil = Math.max(0, dueCents - toCents(limit * TARGET_UTILIZATION));
  const monthlyInterest = toCents(totalDue * (apr / 100) / 12);
  const minimumDue = Math.min(
    dueCents,
    nextPaymentAmount === undefined ? Math.max(monthlyInterest, 100) : toCents(nextPaymentAmount),
  );

  // Do not present a partial payment as covering the minimum. The UI explains
  // the shortfall and leaves manual repayments available.
  if (walletCents < minimumDue) {
    return { amount: 0, reason: 'insufficient_for_minimum' };
  }

  const desired = Math.min(dueCents, Math.max(amountToTargetUtil, minimumDue));

  // Keep $100 or 10% (rounded to cents), but release as much of that reserve
  // as needed to cover the minimum. Cent rounding also keeps the suggestion
  // monotonic as the wallet balance increases.
  const walletReserve = Math.min(
    Math.max(10_000, Math.round(walletCents * 0.1)),
    walletCents - minimumDue,
  );
  const suggested = Math.min(desired, walletCents - walletReserve);

  let reason: RepaySuggestion['reason'];
  if (suggested === 0 && desired === 0) {
    reason = 'nothing_due';
  } else if (nextPaymentAmount !== undefined && minimumDue > 0 && suggested === minimumDue) {
    reason = 'minimum_due';
  } else if (suggested < desired) {
    reason = 'capped_by_wallet';
  } else {
    reason = amountToTargetUtil > minimumDue ? 'target_utilization' : 'interest_only';
  }

  return { amount: suggested / 100, reason };
}

export type RepaymentStrategy = 'avalanche' | 'snowball';

export interface OptimiseRepaymentLine {
  id: string;
  name: string;
  /** Outstanding balance to repay (principal + accrued interest, or utilized). */
  balance: number;
  /** Annual Percentage Rate (e.g., 18.5 for 18.5%). */
  apr: number;
  /** Optional minimum payment required for this line. */
  minimumPayment?: number;
  /** Optional status; 'Closed' and 'Frozen' lines are excluded from allocation. */
  status?: string;
}

export interface LineRepaymentAllocation {
  lineId: string;
  lineName: string;
  balance: number;
  apr: number;
  minimumApplied: number;
  extraApplied: number;
  amount: number;
  remainingBalance: number;
  isFullPayoff: boolean;
  priority: number;
  rationale: string;
}

export interface OptimisedRepaymentPlan {
  strategy: RepaymentStrategy;
  budget: number;
  totalDebt: number;
  totalAllocated: number;
  unallocatedBudget: number;
  allocations: LineRepaymentAllocation[];
  excludedLineIds: string[];
  projectedMonthlyInterestSaved: number;
  projectedAnnualInterestSaved: number;
  rationale: string;
}

const EXCLUDED_OPTIMISER_STATUSES = new Set(['closed', 'frozen']);

interface NormalizedLine {
  id: string;
  name: string;
  balanceCents: number;
  apr: number;
  minimumCents: number;
}

function compareByStrategy(
  a: NormalizedLine,
  b: NormalizedLine,
  strategy: RepaymentStrategy,
): number {
  if (strategy === 'avalanche') {
    if (b.apr !== a.apr) return b.apr - a.apr;
    if (a.balanceCents !== b.balanceCents) return a.balanceCents - b.balanceCents;
    return a.id.localeCompare(b.id);
  }
  // snowball: smallest balance first, tie-break by highest APR, then id
  if (a.balanceCents !== b.balanceCents) return a.balanceCents - b.balanceCents;
  if (b.apr !== a.apr) return b.apr - a.apr;
  return a.id.localeCompare(b.id);
}

/**
 * Allocates `totalCents` pro-rata by balance using the largest-remainder
 * (Hamilton) method so the integer cent shares sum exactly to `totalCents`.
 */
function allocateProRataCents(
  lines: NormalizedLine[],
  totalCents: number,
  totalDebtCents: number,
): number[] {
  if (totalCents <= 0 || totalDebtCents <= 0 || lines.length === 0) {
    return lines.map(() => 0);
  }

  const shares = lines.map((line, index) => {
    const exact = (totalCents * line.balanceCents) / totalDebtCents;
    const floored = Math.min(line.balanceCents, Math.floor(exact));
    return { index, floored, remainder: exact - floored, maxExtra: line.balanceCents - floored };
  });

  let remaining = totalCents - shares.reduce((sum, s) => sum + s.floored, 0);

  const byRemainder = [...shares].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.index - b.index;
  });

  const result = shares.map((s) => s.floored);
  for (const item of byRemainder) {
    if (remaining <= 0) break;
    if (item.maxExtra > 0) {
      result[item.index] += 1;
      remaining -= 1;
    }
  }

  // Fallback pass if any line hit its balance cap before remainder exhausted
  if (remaining > 0) {
    for (let i = 0; i < lines.length && remaining > 0; i += 1) {
      const room = lines[i].balanceCents - result[i];
      if (room > 0) {
        const add = Math.min(room, remaining);
        result[i] += add;
        remaining -= add;
      }
    }
  }

  return result;
}

const formatDollars = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/**
 * Optimises a repayment budget across multiple credit lines using either:
 * - `avalanche`: highest APR first (tie-break: smallest balance, then id)
 * - `snowball`: smallest balance first (tie-break: highest APR, then id)
 *
 * All allocation arithmetic is performed in integer cents so that the sum of
 * per-line allocations equals `min(budget, totalDebt)` exactly.
 *
 * Minimum payments are funded first (in strategy priority order), followed by
 * a waterfall of remaining budget in strategy order. Closed and Frozen lines
 * (as well as zero-balance lines) are excluded.
 */
export function optimiseRepayment(
  lines: readonly OptimiseRepaymentLine[],
  budget: number,
  strategy: RepaymentStrategy,
): OptimisedRepaymentPlan {
  const budgetCents = availableCents(budget);
  const excludedLineIds: string[] = [];
  const eligible: NormalizedLine[] = [];

  for (const line of lines) {
    const normalizedStatus = line.status?.trim().toLowerCase();
    const balanceCents = toCents(line.balance);
    if (
      (normalizedStatus && EXCLUDED_OPTIMISER_STATUSES.has(normalizedStatus)) ||
      balanceCents <= 0
    ) {
      excludedLineIds.push(line.id);
      continue;
    }
    const apr = Number.isFinite(line.apr) ? Math.max(0, line.apr) : 0;
    const rawMin = line.minimumPayment !== undefined ? toCents(line.minimumPayment) : 0;
    eligible.push({
      id: line.id,
      name: line.name,
      balanceCents,
      apr,
      minimumCents: Math.min(balanceCents, rawMin),
    });
  }

  const ordered = [...eligible].sort((a, b) => compareByStrategy(a, b, strategy));
  const totalDebtCents = ordered.reduce((sum, l) => sum + l.balanceCents, 0);
  const targetAllocatedCents = Math.min(budgetCents, totalDebtCents);

  if (ordered.length === 0 || targetAllocatedCents === 0) {
    const emptyAllocations: LineRepaymentAllocation[] = ordered.map((line, idx) => ({
      lineId: line.id,
      lineName: line.name,
      balance: line.balanceCents / 100,
      apr: line.apr,
      minimumApplied: 0,
      extraApplied: 0,
      amount: 0,
      remainingBalance: line.balanceCents / 100,
      isFullPayoff: false,
      priority: idx + 1,
      rationale: 'No budget available to allocate.',
    }));

    const rationale =
      ordered.length === 0
        ? 'No eligible credit lines with an outstanding balance to repay.'
        : 'Enter a positive budget to generate a repayment plan.';

    return {
      strategy,
      budget: budgetCents / 100,
      totalDebt: totalDebtCents / 100,
      totalAllocated: 0,
      unallocatedBudget: budgetCents / 100,
      allocations: emptyAllocations,
      excludedLineIds,
      projectedMonthlyInterestSaved: 0,
      projectedAnnualInterestSaved: 0,
      rationale,
    };
  }

  let remainingBudgetCents = targetAllocatedCents;
  const minApplied = ordered.map(() => 0);
  const extraApplied = ordered.map(() => 0);

  // Pass 1: fund minimum payments in strategy priority order.
  for (let i = 0; i < ordered.length && remainingBudgetCents > 0; i += 1) {
    const needed = ordered[i].minimumCents;
    if (needed > 0) {
      const applied = Math.min(needed, remainingBudgetCents);
      minApplied[i] = applied;
      remainingBudgetCents -= applied;
    }
  }

  // Pass 2: waterfall remaining budget in strategy priority order.
  for (let i = 0; i < ordered.length && remainingBudgetCents > 0; i += 1) {
    const room = ordered[i].balanceCents - minApplied[i];
    if (room > 0) {
      const applied = Math.min(room, remainingBudgetCents);
      extraApplied[i] = applied;
      remainingBudgetCents -= applied;
    }
  }

  // Compare projected interest against a pro-rata allocation of the same budget.
  const proRataCents = allocateProRataCents(ordered, targetAllocatedCents, totalDebtCents);

  let strategyAnnualInterestCents = 0;
  let proRataAnnualInterestCents = 0;

  const allocations: LineRepaymentAllocation[] = ordered.map((line, i) => {
    const totalLineCents = minApplied[i] + extraApplied[i];
    const remainingCents = line.balanceCents - totalLineCents;
    const proRataRemainingCents = line.balanceCents - proRataCents[i];

    strategyAnnualInterestCents += remainingCents * (line.apr / 100);
    proRataAnnualInterestCents += proRataRemainingCents * (line.apr / 100);

    const isFullPayoff = remainingCents === 0;
    let lineRationale: string;
    if (totalLineCents === 0) {
      lineRationale = 'No funds left after higher-priority lines.';
    } else if (isFullPayoff) {
      lineRationale =
        strategy === 'avalanche'
          ? `Paid in full first (${line.apr}% APR).`
          : `Paid in full first (${formatDollars(line.balanceCents)} balance).`;
    } else if (extraApplied[i] > 0 && minApplied[i] > 0) {
      lineRationale = `Covers ${formatDollars(minApplied[i])} minimum plus ${formatDollars(extraApplied[i])} extra.`;
    } else if (extraApplied[i] > 0) {
      lineRationale =
        strategy === 'avalanche'
          ? `Prioritised for ${line.apr}% APR.`
          : `Prioritised for ${formatDollars(line.balanceCents)} balance.`;
    } else {
      lineRationale = `Covers ${formatDollars(minApplied[i])} minimum payment.`;
    }

    return {
      lineId: line.id,
      lineName: line.name,
      balance: line.balanceCents / 100,
      apr: line.apr,
      minimumApplied: minApplied[i] / 100,
      extraApplied: extraApplied[i] / 100,
      amount: totalLineCents / 100,
      remainingBalance: remainingCents / 100,
      isFullPayoff,
      priority: i + 1,
      rationale: lineRationale,
    };
  });

  const annualDiffCents = Math.round(proRataAnnualInterestCents - strategyAnnualInterestCents);
  const monthlyDiffCents = Math.round(
    (proRataAnnualInterestCents - strategyAnnualInterestCents) / 12,
  );
  const unallocatedCents = budgetCents - targetAllocatedCents;

  const strategyDesc =
    strategy === 'avalanche'
      ? 'Avalanche orders lines by highest APR first to minimise interest cost.'
      : 'Snowball orders lines by smallest balance first to pay off lines faster.';

  const interestNote =
    annualDiffCents > 0
      ? ` Saves an estimated ${formatDollars(annualDiffCents)}/yr (${formatDollars(monthlyDiffCents)}/mo) in interest vs pro-rata.`
      : annualDiffCents < 0
        ? ` Costs an estimated ${formatDollars(Math.abs(annualDiffCents))}/yr more in interest vs pro-rata in exchange for faster payoffs.`
        : ' Matches pro-rata interest cost.';

  const surplusNote =
    unallocatedCents > 0
      ? ` Covers all ${formatDollars(totalDebtCents)} of debt with ${formatDollars(unallocatedCents)} remaining.`
      : '';

  return {
    strategy,
    budget: budgetCents / 100,
    totalDebt: totalDebtCents / 100,
    totalAllocated: targetAllocatedCents / 100,
    unallocatedBudget: unallocatedCents / 100,
    allocations,
    excludedLineIds,
    projectedMonthlyInterestSaved: monthlyDiffCents / 100,
    projectedAnnualInterestSaved: annualDiffCents / 100,
    rationale: `${strategyDesc}${interestNote}${surplusNote}`,
  };
}
