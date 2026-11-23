import { describe, it, expect } from 'vitest';
import {
  buildMonthlyStatement,
  buildStatementCsv,
  formatCents,
  getAvailableMonths,
} from './statement';
import type { CreditLine, Transaction } from '@/types/creditLine';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLine(overrides: Partial<CreditLine> = {}): CreditLine {
  return {
    id: 'CL-TEST-001',
    name: 'Test Line',
    status: 'Active',
    limit: 10000,
    utilized: 0,
    apr: 10,
    riskScore: 720,
    openedAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
    transactions: [],
    statusHistory: [],
    ...overrides,
  };
}

function tx(
  overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>,
): Transaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    status: 'Completed',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatCents
// ---------------------------------------------------------------------------

describe('formatCents', () => {
  it('formats zero', () => expect(formatCents(0n)).toBe('0.00'));
  it('formats whole dollars', () => expect(formatCents(100n)).toBe('1.00'));
  it('formats cents', () => expect(formatCents(199n)).toBe('1.99'));
  it('formats negative', () => expect(formatCents(-500n)).toBe('-5.00'));
  it('formats large value', () => expect(formatCents(1234567n)).toBe('12345.67'));
});

// ---------------------------------------------------------------------------
// buildMonthlyStatement – basic reconciliation
// ---------------------------------------------------------------------------

describe('buildMonthlyStatement – reconciliation', () => {
  it('empty month: opening == closing, all totals zero', () => {
    const line = makeLine({ utilized: 500 });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    expect(stmt.openingBalance).toBe(500);
    expect(stmt.closingBalance).toBe(500);
    expect(stmt.draws).toBe(0);
    expect(stmt.repayments).toBe(0);
    expect(stmt.interest).toBe(0);
    expect(stmt.fees).toBe(0);
    expect(stmt.entries).toHaveLength(0);
  });

  it('single draw increases closing balance', () => {
    const line = makeLine({
      utilized: 1000,
      transactions: [tx({ type: 'Draw', amount: 500, date: '2025-06-15T10:00:00.000Z' })],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    expect(stmt.openingBalance).toBe(500);
    expect(stmt.draws).toBe(500);
    expect(stmt.closingBalance).toBe(1000);
  });

  it('single repayment decreases closing balance', () => {
    const line = makeLine({
      utilized: 400,
      transactions: [tx({ type: 'Repay', amount: 100, date: '2025-06-10T12:00:00.000Z' })],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    expect(stmt.openingBalance).toBe(500);
    expect(stmt.repayments).toBe(100);
    expect(stmt.closingBalance).toBe(400);
  });

  it('interest and fee totals are separated', () => {
    const line = makeLine({
      utilized: 630,
      transactions: [
        tx({ type: 'Interest', amount: 30, date: '2025-06-01T00:00:00.000Z' }),
        tx({ type: 'Fee', amount: 100, date: '2025-06-05T00:00:00.000Z' }),
        tx({ type: 'Draw', amount: 500, date: '2025-06-20T00:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    expect(stmt.interest).toBe(30);
    expect(stmt.fees).toBe(100);
    expect(stmt.draws).toBe(500);
    expect(stmt.openingBalance).toBe(0);
    expect(stmt.closingBalance).toBe(630);
  });

  it('invariant: opening + draws + interest + fees − repayments === closing', () => {
    const line = makeLine({
      utilized: 1200,
      transactions: [
        tx({ type: 'Draw', amount: 500, date: '2025-06-01T00:00:00.000Z' }),
        tx({ type: 'Repay', amount: 200, date: '2025-06-10T00:00:00.000Z' }),
        tx({ type: 'Interest', amount: 15, date: '2025-06-15T00:00:00.000Z' }),
        tx({ type: 'Fee', amount: 10, date: '2025-06-20T00:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    const computed =
      stmt.openingBalance +
      stmt.draws +
      stmt.interest +
      stmt.fees -
      stmt.repayments;
    expect(computed).toBeCloseTo(stmt.closingBalance, 2);
  });
});

// ---------------------------------------------------------------------------
// Failed / Pending transactions ignored
// ---------------------------------------------------------------------------

describe('buildMonthlyStatement – failed/pending ignored', () => {
  it('ignores Failed transactions', () => {
    const line = makeLine({
      utilized: 500,
      transactions: [
        tx({ type: 'Draw', amount: 999, date: '2025-06-10T00:00:00.000Z', status: 'Failed' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    expect(stmt.openingBalance).toBe(500);
    expect(stmt.draws).toBe(0);
    expect(stmt.closingBalance).toBe(500);
    expect(stmt.entries).toHaveLength(0);
  });

  it('ignores Pending transactions', () => {
    const line = makeLine({
      utilized: 300,
      transactions: [
        tx({ type: 'Repay', amount: 100, date: '2025-06-05T00:00:00.000Z', status: 'Pending' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    expect(stmt.openingBalance).toBe(300);
    expect(stmt.repayments).toBe(0);
    expect(stmt.closingBalance).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Month boundaries
// ---------------------------------------------------------------------------

describe('buildMonthlyStatement – month boundaries', () => {
  it('transaction on first of month is included', () => {
    const line = makeLine({
      utilized: 100,
      transactions: [
        tx({ type: 'Draw', amount: 100, date: '2025-06-01T00:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    expect(stmt.draws).toBe(100);
  });

  it('transaction on last day of month is included', () => {
    const line = makeLine({
      utilized: 100,
      transactions: [
        // Use noon local time to avoid UTC date boundary issues
        tx({ type: 'Draw', amount: 100, date: '2025-06-30T12:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    expect(stmt.draws).toBe(100);
  });

  it('transaction in previous month is excluded from entries but shifts opening balance', () => {
    // A draw of 600 in May means the opening balance for June is 600.
    // The draw should not appear in June entries, but the opening should reflect it.
    const line = makeLine({
      utilized: 600,
      transactions: [
        tx({ type: 'Draw', amount: 600, date: '2025-05-15T12:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    // The May draw sets the opening balance to 600 — not zero
    expect(stmt.openingBalance).toBe(600);
    // No entries in June
    expect(stmt.entries).toHaveLength(0);
    // Closing equals opening since there is no June activity
    expect(stmt.closingBalance).toBe(600);
  });

  it('transaction in next month is excluded', () => {
    const line = makeLine({
      utilized: 500,
      transactions: [
        tx({ type: 'Draw', amount: 500, date: '2025-07-01T00:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    // The draw is in July; June opening should equal utilized minus that draw
    expect(stmt.draws).toBe(0);
    expect(stmt.entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Line opened mid-month
// ---------------------------------------------------------------------------

describe('buildMonthlyStatement – line opened mid-month', () => {
  it('opening balance is 0 for the month the line opened with no prior transactions', () => {
    const line = makeLine({
      utilized: 200,
      openedAt: '2025-06-15T00:00:00.000Z',
      transactions: [
        tx({ type: 'Draw', amount: 200, date: '2025-06-20T00:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    expect(stmt.openingBalance).toBe(0);
    expect(stmt.draws).toBe(200);
    expect(stmt.closingBalance).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Leap year February
// ---------------------------------------------------------------------------

describe('buildMonthlyStatement – leap year February', () => {
  it('Feb 29 transaction is included in a leap year', () => {
    const line = makeLine({
      utilized: 100,
      openedAt: '2024-01-01T00:00:00.000Z',
      transactions: [
        tx({ type: 'Draw', amount: 100, date: '2024-02-29T12:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2024, 2);
    expect(stmt.entries).toHaveLength(1);
    expect(stmt.draws).toBe(100);
  });

  it('periodEnd is Feb 29 in a leap year', () => {
    const line = makeLine({ utilized: 0, openedAt: '2024-01-01T00:00:00.000Z' });
    const stmt = buildMonthlyStatement(line, 2024, 2);
    expect(stmt.periodEnd).toBe('2024-02-29');
  });

  it('periodEnd is Feb 28 in a non-leap year', () => {
    const line = makeLine({ utilized: 0 });
    const stmt = buildMonthlyStatement(line, 2025, 2);
    expect(stmt.periodEnd).toBe('2025-02-28');
  });
});

// ---------------------------------------------------------------------------
// buildStatementCsv
// ---------------------------------------------------------------------------

describe('buildStatementCsv', () => {
  it('includes header row', () => {
    const line = makeLine({ utilized: 0 });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    const csv = buildStatementCsv(stmt);
    expect(csv).toContain('date');
    expect(csv).toContain('type');
    expect(csv).toContain('amount');
  });

  it('includes line name and id in summary', () => {
    const line = makeLine({ utilized: 0, name: 'My Line', id: 'CL-001' });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    const csv = buildStatementCsv(stmt);
    expect(csv).toContain('My Line');
    expect(csv).toContain('CL-001');
  });

  it('includes entry rows for each transaction', () => {
    const line = makeLine({
      utilized: 500,
      transactions: [
        tx({ type: 'Draw', amount: 500, date: '2025-06-10T00:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    const csv = buildStatementCsv(stmt);
    expect(csv).toContain('Draw');
    expect(csv).toContain('500.00');
  });

  it('CSV figures match on-screen figures', () => {
    const line = makeLine({
      utilized: 1200,
      transactions: [
        tx({ type: 'Draw', amount: 500, date: '2025-06-01T00:00:00.000Z' }),
        tx({ type: 'Repay', amount: 200, date: '2025-06-15T00:00:00.000Z' }),
      ],
    });
    const stmt = buildMonthlyStatement(line, 2025, 6);
    const csv = buildStatementCsv(stmt);
    expect(csv).toContain(stmt.openingBalance.toFixed(2));
    expect(csv).toContain(stmt.closingBalance.toFixed(2));
  });
});

// ---------------------------------------------------------------------------
// getAvailableMonths
// ---------------------------------------------------------------------------

describe('getAvailableMonths', () => {
  it('returns at least the opening month', () => {
    const line = makeLine({ openedAt: new Date().toISOString() });
    const months = getAvailableMonths(line);
    expect(months.length).toBeGreaterThanOrEqual(1);
  });

  it('first entry is the month the line opened', () => {
    const line = makeLine({ openedAt: '2025-03-15T00:00:00.000Z' });
    const months = getAvailableMonths(line);
    expect(months[0].year).toBe(2025);
    expect(months[0].month).toBe(3);
  });

  it('months are in chronological order', () => {
    const line = makeLine({ openedAt: '2024-11-01T00:00:00.000Z' });
    const months = getAvailableMonths(line);
    for (let i = 1; i < months.length; i++) {
      const prev = months[i - 1];
      const curr = months[i];
      expect(curr.year * 12 + curr.month).toBeGreaterThan(prev.year * 12 + prev.month);
    }
  });
});
