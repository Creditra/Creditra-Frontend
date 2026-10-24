const roundToCents = (amount: number) => Math.round(amount * 100) / 100;

export type DayCountConvention = 'ACT/365' | 'ACT/360';

export interface InterestBearingLine {
  utilized: number;
  apr: number;
  nextInterestAccrualDate?: string;
  transactions?: Array<{ type: string; date: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Returns the number of whole elapsed UTC days since the last known accrual. */
export function getAccruedInterestDays(line: InterestBearingLine, now: Date): number | null {
  const latestInterest = (line.transactions ?? [])
    .filter((transaction) => transaction.type === 'Interest')
    .map((transaction) => Date.parse(transaction.date))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  let lastAccrualMs = latestInterest;
  if (lastAccrualMs === undefined && line.nextInterestAccrualDate) {
    const nextAccrual = new Date(line.nextInterestAccrualDate);
    if (Number.isFinite(nextAccrual.getTime())) {
      // Interest is scheduled monthly; the prior scheduled date begins this period.
      nextAccrual.setUTCMonth(nextAccrual.getUTCMonth() - 1);
      lastAccrualMs = nextAccrual.getTime();
    }
  }
  if (lastAccrualMs === undefined) return null;

  const elapsed = Math.floor((now.getTime() - lastAccrualMs) / DAY_MS);
  return Math.max(0, elapsed);
}

/**
 * Simple interest on current principal, using actual elapsed days.
 * ACT/365 is the default convention; ACT/360 is available for contracts
 * that specify a 360-day annual basis. Rounding is applied once, at the end.
 */
export function getAccruedInterest(
  line: InterestBearingLine,
  now: Date,
  opts: { dayCount?: DayCountConvention } = {},
): number {
  if (line.utilized <= 0 || line.apr <= 0) return 0;
  const days = getAccruedInterestDays(line, now);
  if (days === null) {
    console.warn(`Missing accrual date for credit line; using monthly interest fallback.`);
    return roundToCents((line.utilized * (line.apr / 100)) / 12);
  }
  const denominator = opts.dayCount === 'ACT/360' ? 360 : 365;
  return roundToCents(line.utilized * (line.apr / 100) * days / denominator);
}
