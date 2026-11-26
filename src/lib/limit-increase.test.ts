import { describe, expect, it } from 'vitest';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import type { CreditLine, Transaction } from '../types/creditLine';
import {
  evaluateLimitIncreaseEligibility,
  LIMIT_INCREASE_COOLDOWN_DAYS,
  LIMIT_INCREASE_MIN_LINE_AGE_DAYS,
  LIMIT_INCREASE_MIN_ON_TIME_RATIO,
  LIMIT_INCREASE_MIN_RISK_SCORE,
} from './limit-increase';

const NOW = new Date('2025-03-01T00:00:00.000Z');
const dayMs = 24 * 60 * 60 * 1000;

function eligibleLine(overrides: Partial<CreditLine> = {}): CreditLine {
  return {
    ...MOCK_CREDIT_LINES[0],
    openedAt: new Date(NOW.getTime() - (LIMIT_INCREASE_MIN_LINE_AGE_DAYS + 10) * dayMs).toISOString(),
    riskScore: LIMIT_INCREASE_MIN_RISK_SCORE,
    status: 'Active',
    statusHistory: [{ status: 'Active', date: '2024-01-01T00:00:00.000Z' }],
    transactions: [
      {
        id: 'repay-on-time',
        type: 'Repay',
        amount: 100,
        date: '2025-02-01T00:00:00.000Z',
        status: 'Completed',
      },
    ],
    ...overrides,
  };
}

function repayment(id: string, late = false): Transaction {
  return {
    id,
    type: 'Repay',
    amount: 100,
    date: '2025-02-01T00:00:00.000Z',
    status: late ? 'Failed' : 'Completed',
  };
}

describe('evaluateLimitIncreaseEligibility', () => {
  it('accepts a line at the minimum score and line-age boundaries', () => {
    const line = eligibleLine({
      openedAt: new Date(NOW.getTime() - LIMIT_INCREASE_MIN_LINE_AGE_DAYS * dayMs).toISOString(),
      riskScore: LIMIT_INCREASE_MIN_RISK_SCORE,
    });

    expect(evaluateLimitIncreaseEligibility(line, NOW)).toMatchObject({
      eligible: true,
      maxRequestable: line.limit * 0.5,
      reasons: [],
    });
  });

  it('rejects a score below threshold and a line one millisecond short of minimum age', () => {
    const line = eligibleLine({
      openedAt: new Date(
        NOW.getTime() - LIMIT_INCREASE_MIN_LINE_AGE_DAYS * dayMs + 1,
      ).toISOString(),
      riskScore: LIMIT_INCREASE_MIN_RISK_SCORE - 1,
    });

    const result = evaluateLimitIncreaseEligibility(line, NOW);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(`Risk score must be at least ${LIMIT_INCREASE_MIN_RISK_SCORE}.`);
    expect(result.reasons).toContain(
      `The credit line must be open for at least ${LIMIT_INCREASE_MIN_LINE_AGE_DAYS} days.`,
    );
  });

  it('rejects Defaulted or Suspended line history even if the current status is Active', () => {
    const line = eligibleLine({
      statusHistory: [
        { status: 'Active', date: '2024-01-01T00:00:00.000Z' },
        { status: 'Suspended', date: '2024-02-01T00:00:00.000Z' },
        { status: 'Active', date: '2024-02-02T00:00:00.000Z' },
      ],
    });

    expect(evaluateLimitIncreaseEligibility(line, NOW).reasons).toContain(
      'Credit line history cannot include Defaulted or Suspended status.',
    );
  });

  it('accepts an on-time repayment ratio exactly at the required threshold', () => {
    const line = eligibleLine({
      transactions: [
        ...Array.from({ length: 9 }, (_, i) => repayment(`on-time-${i}`)),
        repayment('late', true),
      ],
    });

    expect(LIMIT_INCREASE_MIN_ON_TIME_RATIO).toBe(0.9);
    expect(evaluateLimitIncreaseEligibility(line, NOW).eligible).toBe(true);
  });

  it('rejects a repayment ratio below threshold and ignores pending repayments', () => {
    const line = eligibleLine({
      transactions: [
        repayment('on-time'),
        repayment('late', true),
        { ...repayment('pending'), status: 'Pending' },
      ],
    });

    expect(evaluateLimitIncreaseEligibility(line, NOW).reasons).toContain(
      'At least 90% of repayments must be on time.',
    );
  });

  it('enforces the cooldown at the exact day boundary', () => {
    const exactBoundary = new Date(
      NOW.getTime() - LIMIT_INCREASE_COOLDOWN_DAYS * dayMs,
    ).toISOString();
    const oneDayEarly = new Date(
      NOW.getTime() - (LIMIT_INCREASE_COOLDOWN_DAYS - 1) * dayMs,
    ).toISOString();

    expect(evaluateLimitIncreaseEligibility(eligibleLine(), NOW, exactBoundary).eligible).toBe(true);
    expect(
      evaluateLimitIncreaseEligibility(eligibleLine(), NOW, oneDayEarly).reasons,
    ).toContain(`Wait at least ${LIMIT_INCREASE_COOLDOWN_DAYS} days between requests.`);
  });
});
