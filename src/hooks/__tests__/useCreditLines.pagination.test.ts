import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreditLine, Transaction } from '../../types/creditLine';
import { useCreditTransactions } from '../useCreditLines';

const mocks = vi.hoisted(() => ({
  lines: [] as unknown[],
  refetchLines: vi.fn(),
}));

vi.mock('../../context/CreditDataContext', () => ({
  useCreditData: () => ({
    status: 'success',
    lines: mocks.lines,
    error: null,
    lastUpdatedAt: null,
    owner: null,
    wallet: null,
    refetch: mocks.refetchLines,
  }),
}));

function transaction(id: string, date: string): Transaction {
  return { id, date, type: 'Draw', amount: 10, status: 'Completed' };
}

const line: CreditLine = {
  id: 'line-1',
  name: 'Pagination line',
  status: 'Active',
  limit: 1_000,
  utilized: 0,
  apr: 5,
  riskScore: 700,
  openedAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  transactions: [
    transaction('t3', '2025-03-01T00:00:00Z'),
    transaction('t2', '2025-02-01T00:00:00Z'),
    transaction('t1', '2025-01-01T00:00:00Z'),
  ],
  statusHistory: [],
};

const ids = (transactions: { id: string }[]) => transactions.map((item) => item.id);

beforeEach(() => {
  mocks.lines = [line];
  mocks.refetchLines.mockReset();
  mocks.refetchLines.mockResolvedValue([line]);
});

describe('useCreditTransactions pagination', () => {
  it('exposes the first page with staleCursor false', () => {
    const { result } = renderHook(() => useCreditTransactions({ limit: 2 }));

    expect(ids(result.current.transactions)).toEqual(['t3', 't2']);
    expect(result.current.nextCursor).toBe('t2');
    expect(result.current.staleCursor).toBe(false);
  });

  it('continues after a valid cursor exactly as before', () => {
    const { result } = renderHook(() =>
      useCreditTransactions({ cursor: 't3', limit: 1 }),
    );

    expect(ids(result.current.transactions)).toEqual(['t2']);
    expect(result.current.nextCursor).toBe('t2');
    expect(result.current.staleCursor).toBe(false);
  });

  it('reports a stale cursor instead of repeating the first page', () => {
    const { result } = renderHook(() =>
      useCreditTransactions({ cursor: 'removed-row', limit: 2 }),
    );

    expect(result.current.transactions).toEqual([]);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.staleCursor).toBe(true);
  });

  it('propagates the stale cursor through refetch when the cursor row disappears', async () => {
    const { result, rerender } = renderHook(() =>
      useCreditTransactions({ cursor: 't2', limit: 1 }),
    );
    expect(ids(result.current.transactions)).toEqual(['t1']);
    expect(result.current.staleCursor).toBe(false);

    const withoutCursorRow: CreditLine = {
      ...line,
      transactions: line.transactions.filter((item) => item.id !== 't2'),
    };
    mocks.refetchLines.mockImplementationOnce(async () => {
      mocks.lines = [withoutCursorRow];
      return mocks.lines;
    });

    let refetched: unknown = null;
    await act(async () => {
      refetched = await result.current.refetch();
    });
    rerender();

    expect(refetched).toEqual([]);
    expect(result.current.transactions).toEqual([]);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.staleCursor).toBe(true);
  });

  it('handles an empty ledger with and without a cursor', () => {
    mocks.lines = [];
    const first = renderHook(() => useCreditTransactions({ limit: 2 }));
    expect(first.result.current.transactions).toEqual([]);
    expect(first.result.current.staleCursor).toBe(false);

    const stale = renderHook(() =>
      useCreditTransactions({ cursor: 'gone', limit: 2 }),
    );
    expect(stale.result.current.transactions).toEqual([]);
    expect(stale.result.current.nextCursor).toBeNull();
    expect(stale.result.current.staleCursor).toBe(true);
  });

  it('returns an empty page for limit 0', () => {
    const { result } = renderHook(() => useCreditTransactions({ limit: 0 }));

    expect(result.current.transactions).toEqual([]);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.staleCursor).toBe(false);
  });
});
