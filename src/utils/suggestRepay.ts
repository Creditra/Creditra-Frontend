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
