import type { CreditLine } from '../types/creditLine';

export const LIMIT_INCREASE_MIN_LINE_AGE_DAYS = 90;
export const LIMIT_INCREASE_MIN_RISK_SCORE = 650;
export const LIMIT_INCREASE_MIN_ON_TIME_RATIO = 0.9;
export const LIMIT_INCREASE_COOLDOWN_DAYS = 30;
export const LIMIT_INCREASE_MAX_FRACTION = 0.5;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface LimitIncreaseEligibility {
  eligible: boolean;
  maxRequestable: number;
  reasons: string[];
}

function isLateRepayment(line: CreditLine, transaction: CreditLine['transactions'][number]): boolean {
  if (transaction.status === 'Failed') return true;

  const note = (transaction.note ?? '').toLowerCase();
  if (['late', 'overdue', 'past due'].some((term) => note.includes(term))) return true;

  const transactionTime = Date.parse(transaction.date);
  if (Number.isNaN(transactionTime)) return false;

  const latestStatus = [...(line.statusHistory ?? [])]
    .filter((entry) => Date.parse(entry.date) <= transactionTime)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0]?.status;

  const statusAtRepayment = latestStatus ?? line.status;
  return statusAtRepayment === 'Suspended' || statusAtRepayment === 'Defaulted';
}

/**
 * Evaluate a line's eligibility using its recorded repayment and lifecycle history.
 * The optional last-request date is used to enforce the per-line request cooldown.
 */
export function evaluateLimitIncreaseEligibility(
  line: CreditLine,
  now: Date = new Date(),
  lastRequestAt?: string,
): LimitIncreaseEligibility {
  const reasons: string[] = [];
  const maxRequestable =
    Number.isFinite(line.limit) && line.limit > 0
      ? Math.round(line.limit * LIMIT_INCREASE_MAX_FRACTION * 100) / 100
      : 0;

  if (line.status !== 'Active') {
    reasons.push('The credit line must be Active.');
  }

  const openedAt = Date.parse(line.openedAt);
  if (
    Number.isNaN(openedAt) ||
    Number.isNaN(now.getTime()) ||
    now.getTime() - openedAt < LIMIT_INCREASE_MIN_LINE_AGE_DAYS * DAY_IN_MS
  ) {
    reasons.push(`The credit line must be open for at least ${LIMIT_INCREASE_MIN_LINE_AGE_DAYS} days.`);
  }

  if (!Number.isFinite(line.riskScore) || line.riskScore < LIMIT_INCREASE_MIN_RISK_SCORE) {
    reasons.push(`Risk score must be at least ${LIMIT_INCREASE_MIN_RISK_SCORE}.`);
  }

  if ((line.statusHistory ?? []).some(
    (entry) => entry.status === 'Defaulted' || entry.status === 'Suspended',
  )) {
    reasons.push('Credit line history cannot include Defaulted or Suspended status.');
  }

  if (maxRequestable <= 0) {
    reasons.push('The current credit limit must be greater than zero.');
  }

  const repayments = (line.transactions ?? []).filter(
    (transaction) => transaction.type === 'Repay' && transaction.status !== 'Pending',
  );
  if (repayments.length === 0) {
    reasons.push('At least one completed repayment is required.');
  } else {
    const onTimeRatio =
      repayments.filter((transaction) => !isLateRepayment(line, transaction)).length /
      repayments.length;
    if (onTimeRatio < LIMIT_INCREASE_MIN_ON_TIME_RATIO) {
      reasons.push('At least 90% of repayments must be on time.');
    }
  }

  if (lastRequestAt !== undefined) {
    const lastRequestTime = Date.parse(lastRequestAt);
    if (
      Number.isNaN(lastRequestTime) ||
      Number.isNaN(now.getTime()) ||
      now.getTime() - lastRequestTime < LIMIT_INCREASE_COOLDOWN_DAYS * DAY_IN_MS
    ) {
      reasons.push(`Wait at least ${LIMIT_INCREASE_COOLDOWN_DAYS} days between requests.`);
    }
  }

  return { eligible: reasons.length === 0, maxRequestable, reasons };
}
