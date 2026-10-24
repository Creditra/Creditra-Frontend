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

export interface RepaymentAllocation {
  interestPaid: number;
  principalPaid: number;
  remainingInterest: number;
  remainingPrincipal: number;
  remainingTotal: number;
  isFullPayoff: boolean;
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
