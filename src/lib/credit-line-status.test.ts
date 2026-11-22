import { describe, expect, it } from 'vitest';
import type { CreditLine, CreditLineStatus } from '../types/creditLine';
import {
  applyTransition,
  canDraw,
  canRepay,
  canTransition,
  CreditLineTransitionError,
  isDelinquentStatus,
  getUnfrozenStatus,
} from './credit-line-status';

const STATUSES: CreditLineStatus[] = [
  'Active',
  'Suspended',
  'Defaulted',
  'Closed',
  'Frozen',
];

const ALLOWED: Record<CreditLineStatus, CreditLineStatus[]> = {
  Active: ['Suspended', 'Defaulted', 'Closed', 'Frozen'],
  Suspended: ['Active', 'Defaulted', 'Closed', 'Frozen'],
  Defaulted: ['Active', 'Closed'],
  Closed: [],
  Frozen: ['Active', 'Suspended', 'Defaulted'],
};

function line(
  status: CreditLineStatus,
  statusHistory: CreditLine['statusHistory'] = [],
): CreditLine {
  return {
    id: 'cl-status-test',
    name: 'Test line',
    status,
    limit: 1_000,
    utilized: 0,
    apr: 0,
    riskScore: 0,
    openedAt: '2025-01-01',
    updatedAt: '2025-01-01',
    transactions: [],
    statusHistory,
  };
}

describe('credit line status transitions', () => {
  it('matches the exhaustive allowed-transition matrix', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        const history =
          from === 'Frozen'
            ? [
                { status: 'Active' as const, date: '2025-01-01' },
                { status: 'Frozen' as const, date: '2025-01-02' },
              ]
            : [];
        const expected =
          ALLOWED[from].includes(to) && (from !== 'Frozen' || to === 'Active');
        expect(canTransition(from, to, { statusHistory: history })).toBe(expected);
      }
    }
  });

  it('requires Frozen lines to return to the status saved before freezing', () => {
    const history = [
      { status: 'Active' as const, date: '2025-01-01' },
      { status: 'Suspended' as const, date: '2025-01-02' },
      { status: 'Frozen' as const, date: '2025-01-03' },
    ];

    expect(getUnfrozenStatus({ statusHistory: history })).toBe('Suspended');
    expect(
      canTransition('Frozen', 'Suspended', { statusHistory: history }),
    ).toBe(true);
    expect(
      canTransition('Frozen', 'Active', { statusHistory: history }),
    ).toBe(false);
  });

  it('returns a history entry for each accepted transition', () => {
    const now = new Date('2025-02-01T10:00:00.000Z');
    const result = applyTransition(line('Active'), 'Frozen', {
      reason: 'Frozen by user',
      now,
    });

    expect(result).toEqual({
      status: 'Frozen',
      historyEntry: {
        status: 'Frozen',
        date: now.toISOString(),
        note: 'Frozen by user',
      },
    });
  });

  it('throws a typed error for an illegal transition', () => {
    expect(() =>
      applyTransition(line('Closed'), 'Active', { reason: 'reopen' }),
    ).toThrow(CreditLineTransitionError);
  });

  it('uses the status rules for draw, repayment, and delinquency eligibility', () => {
    expect(STATUSES.map(canDraw)).toEqual([true, false, false, false, false]);
    expect(STATUSES.map(canRepay)).toEqual([true, true, true, false, true]);
    expect(STATUSES.map(isDelinquentStatus)).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
  });
});
