/**
 * Tests for src/lib/repay-eligibility.ts
 *
 * Issue #1185 – one getRepayableLines selector used everywhere.
 *
 * Covers:
 *  - isRepayable predicate table for every status × balance combination
 *  - getRepayableLines filtering (fixture lines from mock data)
 *  - getRepayableLines ordering (Defaulted/Suspended before Active)
 *  - Regression guard: old Active-only filter misses Suspended + Defaulted
 */

import { describe, it, expect } from 'vitest';
import { isRepayable, isDelinquentLine, getRepayableLines } from './repay-eligibility';
import type { CreditLine } from '../types/creditLine';

// ─── minimal fixture builder ──────────────────────────────────────────────────

function makeLine(
  overrides: Partial<CreditLine> & { id: string; status: CreditLine['status'] },
): CreditLine {
  return {
    name: `Line ${overrides.id}`,
    limit: 100_000,
    utilized: 50_000,
    apr: 9.0,
    riskScore: 650,
    openedAt: '2023-01-01',
    updatedAt: '2024-01-01T00:00:00Z',
    transactions: [],
    statusHistory: [],
    ...overrides,
  };
}

// ─── fixture lines mirroring the mock data ────────────────────────────────────

const CL_001 = makeLine({
  id: 'CL-2024-001',
  status: 'Active',
  utilized: 187_500,
  updatedAt: '2025-02-20T14:32:00Z',
});

const CL_002 = makeLine({
  id: 'CL-2024-002',
  status: 'Active',
  utilized: 210_000,
  updatedAt: '2025-02-19T09:15:00Z',
});

const CL_003 = makeLine({
  id: 'CL-2023-003',
  status: 'Suspended',
  utilized: 45_000,
  updatedAt: '2025-01-15T16:45:00Z',
});

const CL_004 = makeLine({
  id: 'CL-2023-004',
  status: 'Defaulted',
  utilized: 75_000,
  updatedAt: '2024-11-01T10:00:00Z',
});

const CL_005 = makeLine({
  id: 'CL-2022-005',
  status: 'Closed',
  utilized: 0,
  updatedAt: '2024-06-30T12:00:00Z',
});

const CL_006 = makeLine({
  id: 'CL-2025-006',
  status: 'Active',
  utilized: 0,
  updatedAt: '2025-02-20T10:00:00Z',
});

const ALL_LINES = [CL_001, CL_002, CL_003, CL_004, CL_005, CL_006];

// ─── Test 6: isRepayable predicate table ─────────────────────────────────────

describe('isRepayable — predicate table', () => {
  it.each([
    // status, utilized, expected
    ['Active', 100, true],
    ['Active', 0, false],
    ['Suspended', 100, true],
    ['Suspended', 0, false],
    ['Defaulted', 100, true],
    ['Defaulted', 0, false],
    ['Frozen', 100, true],
    ['Frozen', 0, false],
    ['Closed', 100, false],  // Closed is never repayable, even with balance
    ['Closed', 0, false],
  ] as const)(
    'status=%s, utilized=%d → %s',
    (status, utilized, expected) => {
      const line = makeLine({ id: 'test', status, utilized });
      expect(isRepayable(line)).toBe(expected);
    },
  );
});

// ─── Test 1: fixture lines in picker ─────────────────────────────────────────

describe('getRepayableLines — fixture lines (Test 1)', () => {
  it('includes Active lines with balance', () => {
    const result = getRepayableLines(ALL_LINES);
    const ids = result.map((l) => l.id);
    expect(ids).toContain('CL-2024-001');
    expect(ids).toContain('CL-2024-002');
  });

  it('includes Suspended lines with balance', () => {
    const result = getRepayableLines(ALL_LINES);
    const ids = result.map((l) => l.id);
    expect(ids).toContain('CL-2023-003');
  });

  it('includes Defaulted lines with balance', () => {
    const result = getRepayableLines(ALL_LINES);
    const ids = result.map((l) => l.id);
    expect(ids).toContain('CL-2023-004');
  });

  it('excludes Closed lines regardless of balance', () => {
    const result = getRepayableLines(ALL_LINES);
    const ids = result.map((l) => l.id);
    expect(ids).not.toContain('CL-2022-005');
  });

  it('excludes Active lines with zero balance', () => {
    const result = getRepayableLines(ALL_LINES);
    const ids = result.map((l) => l.id);
    expect(ids).not.toContain('CL-2025-006');
  });

  it('returns exactly 4 lines from the fixture set', () => {
    expect(getRepayableLines(ALL_LINES)).toHaveLength(4);
  });
});

// ─── Test 2: ordering ─────────────────────────────────────────────────────────

describe('getRepayableLines — ordering (Test 2)', () => {
  it('delinquent lines (Defaulted, Suspended) come before Active lines', () => {
    const result = getRepayableLines(ALL_LINES);
    const delinquentIds = ['CL-2023-003', 'CL-2023-004'];
    const activeIds = ['CL-2024-001', 'CL-2024-002'];

    const lastDelinquent = Math.max(
      ...delinquentIds.map((id) => result.findIndex((l) => l.id === id)),
    );
    const firstActive = Math.min(
      ...activeIds.map((id) => result.findIndex((l) => l.id === id)),
    );

    expect(lastDelinquent).toBeLessThan(firstActive);
  });

  it('within delinquent group, most recently updated first', () => {
    const result = getRepayableLines(ALL_LINES);
    const delinquent = result.filter(
      (l) => l.status === 'Defaulted' || l.status === 'Suspended',
    );
    // CL-2023-003 (Suspended) updatedAt 2025-01-15 > CL-2023-004 (Defaulted) updatedAt 2024-11-01
    expect(delinquent[0].id).toBe('CL-2023-003');
    expect(delinquent[1].id).toBe('CL-2023-004');
  });

  it('within non-delinquent group, most recently updated first', () => {
    const result = getRepayableLines(ALL_LINES);
    const active = result.filter((l) => l.status === 'Active');
    // CL-2024-001 updatedAt 2025-02-20 > CL-2024-002 updatedAt 2025-02-19
    expect(active[0].id).toBe('CL-2024-001');
    expect(active[1].id).toBe('CL-2024-002');
  });

  it('Defaulted and Suspended both rank before Active in a mixed list', () => {
    const result = getRepayableLines(ALL_LINES);
    const ids = result.map((l) => l.id);
    // First two must be delinquent
    expect(['CL-2023-003', 'CL-2023-004']).toContain(ids[0]);
    expect(['CL-2023-003', 'CL-2023-004']).toContain(ids[1]);
    // Last two must be active
    expect(['CL-2024-001', 'CL-2024-002']).toContain(ids[2]);
    expect(['CL-2024-001', 'CL-2024-002']).toContain(ids[3]);
  });
});

// ─── Test 5: QuickRepay candidate set equals getRepayableLines ────────────────

describe('QuickRepay candidate set (Test 5)', () => {
  it('set of ids from getRepayableLines equals what QuickRepay should show', () => {
    // Old QuickRepay filter: utilized > 0, no status restriction
    // New rule: getRepayableLines (utilized > 0 && status !== Closed)
    // For these fixtures the results are the same because no Closed line has utilized > 0,
    // but the predicate is now formally correct and explicit.
    const newResult = getRepayableLines(ALL_LINES).map((l) => l.id);
    // Direct verification: all four repayable lines are present
    expect(newResult).toContain('CL-2024-001');
    expect(newResult).toContain('CL-2024-002');
    expect(newResult).toContain('CL-2023-003');
    expect(newResult).toContain('CL-2023-004');
    expect(newResult).not.toContain('CL-2022-005');
    expect(newResult).not.toContain('CL-2025-006');
  });

  it('a hypothetical Closed line with balance is never repayable', () => {
    const closedWithBalance = makeLine({
      id: 'CL-CLOSED-DEBT',
      status: 'Closed',
      utilized: 5_000,
    });
    expect(isRepayable(closedWithBalance)).toBe(false);
    const result = getRepayableLines([closedWithBalance]);
    expect(result).toHaveLength(0);
  });
});

// ─── isDelinquentLine helper ──────────────────────────────────────────────────

describe('isDelinquentLine', () => {
  it('returns true for Defaulted', () => {
    expect(isDelinquentLine(CL_004)).toBe(true);
  });
  it('returns true for Suspended', () => {
    expect(isDelinquentLine(CL_003)).toBe(true);
  });
  it('returns false for Active', () => {
    expect(isDelinquentLine(CL_001)).toBe(false);
  });
  it('returns false for Frozen', () => {
    const frozen = makeLine({ id: 'frozen', status: 'Frozen' });
    expect(isDelinquentLine(frozen)).toBe(false);
  });
  it('returns false for Closed', () => {
    expect(isDelinquentLine(CL_005)).toBe(false);
  });
});

// ─── Test 7: Regression guard ────────────────────────────────────────────────

describe('Regression: old Active-only filter (Test 7)', () => {
  it('old filter (Active && utilized > 0) omits CL-2023-003 Suspended', () => {
    const oldFilter = ALL_LINES.filter(
      (cl) => cl.status === 'Active' && cl.utilized > 0,
    );
    expect(oldFilter.map((l) => l.id)).not.toContain('CL-2023-003');
  });

  it('old filter omits CL-2023-004 Defaulted', () => {
    const oldFilter = ALL_LINES.filter(
      (cl) => cl.status === 'Active' && cl.utilized > 0,
    );
    expect(oldFilter.map((l) => l.id)).not.toContain('CL-2023-004');
  });

  it('new getRepayableLines includes both Suspended and Defaulted', () => {
    const newFilter = getRepayableLines(ALL_LINES);
    const ids = newFilter.map((l) => l.id);
    expect(ids).toContain('CL-2023-003');
    expect(ids).toContain('CL-2023-004');
  });
});
