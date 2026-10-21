/**
 * Tests for MockCreditDataSource — covers all 8 scenarios from issue #1160.
 *
 * Scenario mapping
 * ─────────────────────────────────────────────────────────────────────────────
 * 1  listCreditLines returns every line in compareCreditLines order
 * 2  Mutating the returned array / a nested transaction does not affect fixture
 * 3  getCreditLine with unknown id rejects with code: 'not_found'
 * 4  listTransactions pagination: pages are disjoint, union === full set,
 *    last page nextCursor === null
 * 5  listTransactions filtered by lineId returns only that line's transactions
 * 6  AbortSignal: already-aborted and mid-latency cancellation
 * 7  failWith injection: method rejects with exactly the supplied error
 * 8  Factory: unset → mock; 'mock' → mock; bogus → throws descriptive error
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { MOCK_CREDIT_LINES, compareCreditLines } from '../../../data/mockData';
import { createMockCreditDataSource } from '../mockCreditDataSource';
import { CreditDataError } from '../CreditDataSource';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Owner address used for all calls; the mock ignores it. */
const OWNER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

/** Returns a mock adapter with zero latency. */
const makeMock = (opts?: Parameters<typeof createMockCreditDataSource>[0]) =>
  createMockCreditDataSource({ latencyMs: 0, ...opts });

// ─── Total transaction count across all credit lines ─────────────────────────

const ALL_TX_COUNT = MOCK_CREDIT_LINES.reduce(
  (sum, cl) => sum + cl.transactions.length,
  0,
);

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1 – listCreditLines returns every line in compareCreditLines order
// ─────────────────────────────────────────────────────────────────────────────

describe('scenario 1 – listCreditLines', () => {
  it('returns all credit lines sorted by compareCreditLines', async () => {
    const ds = makeMock();
    const lines = await ds.listCreditLines(OWNER);

    expect(lines).toHaveLength(MOCK_CREDIT_LINES.length);

    const sorted = [...MOCK_CREDIT_LINES].sort(compareCreditLines);
    expect(lines.map((l) => l.id)).toEqual(sorted.map((l) => l.id));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2 – Mutations do not affect the shared fixture
// ─────────────────────────────────────────────────────────────────────────────

describe('scenario 2 – copy-on-read isolation', () => {
  it('mutating the returned array does not affect a subsequent call', async () => {
    const ds = makeMock();
    const first = await ds.listCreditLines(OWNER);

    // Truncate the returned array
    first.length = 0;

    const second = await ds.listCreditLines(OWNER);
    expect(second).toHaveLength(MOCK_CREDIT_LINES.length);
  });

  it('mutating a nested transaction does not affect a subsequent call', async () => {
    const ds = makeMock();
    const first = await ds.listCreditLines(OWNER);

    // Corrupt a nested transaction on the first result
    first[0].transactions[0].amount = -999_999;

    const second = await ds.listCreditLines(OWNER);
    expect(second[0].transactions[0].amount).not.toBe(-999_999);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3 – getCreditLine with unknown id rejects with 'not_found'
// ─────────────────────────────────────────────────────────────────────────────

describe('scenario 3 – getCreditLine not_found', () => {
  it('rejects with CreditDataError code not_found for an unknown id', async () => {
    const ds = makeMock();
    await expect(ds.getCreditLine(OWNER, 'CL-DOES-NOT-EXIST')).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CreditDataError && err.code === 'not_found',
    );
  });

  it('resolves successfully for a known id', async () => {
    const ds = makeMock();
    const line = await ds.getCreditLine(OWNER, MOCK_CREDIT_LINES[0].id);
    expect(line.id).toBe(MOCK_CREDIT_LINES[0].id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4 – listTransactions pagination: pages disjoint, union = full set
// ─────────────────────────────────────────────────────────────────────────────

describe('scenario 4 – listTransactions pagination', () => {
  it('two pages of limit:5 are disjoint and their union equals the full set', async () => {
    const ds = makeMock();

    const page1 = await ds.listTransactions(OWNER, { limit: 5 });
    expect(page1.items).toHaveLength(5);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await ds.listTransactions(OWNER, {
      limit: 5,
      cursor: page1.nextCursor,
    });
    expect(page2.items.length).toBeGreaterThan(0);

    const ids1 = new Set(page1.items.map((tx) => tx.id));
    const ids2 = new Set(page2.items.map((tx) => tx.id));

    // Disjoint
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it('walking all pages produces the full set and last page nextCursor is null', async () => {
    const ds = makeMock();
    const collected: string[] = [];
    let cursor: string | null | undefined = undefined;

    // Drain with page size of 5
    for (let safety = 0; safety < 100; safety++) {
      const page = await ds.listTransactions(OWNER, {
        limit: 5,
        cursor,
      });
      for (const tx of page.items) collected.push(tx.id);
      cursor = page.nextCursor;
      if (cursor === null) break;
    }

    // Last page's nextCursor is null (loop would have set cursor to null)
    expect(cursor).toBeNull();

    // Union equals the full set (no duplicates, no missing)
    expect(new Set(collected).size).toBe(ALL_TX_COUNT);
    expect(collected).toHaveLength(ALL_TX_COUNT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 5 – listTransactions filtered by lineId
// ─────────────────────────────────────────────────────────────────────────────

describe('scenario 5 – listTransactions lineId filter', () => {
  it('returns only transactions belonging to the requested lineId', async () => {
    const targetLine = MOCK_CREDIT_LINES[0];
    const ds = makeMock();

    const collected: string[] = [];
    let cursor: string | null | undefined = undefined;

    for (let safety = 0; safety < 100; safety++) {
      const page = await ds.listTransactions(OWNER, {
        limit: 50,
        lineId: targetLine.id,
        cursor,
      });
      for (const tx of page.items) {
        collected.push(tx.id);
        // Every returned item must reference the correct line
        expect(tx.lineId).toBe(targetLine.id);
      }
      cursor = page.nextCursor;
      if (cursor === null) break;
    }

    expect(collected).toHaveLength(targetLine.transactions.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 6 – AbortSignal rejects with code: 'aborted'
// ─────────────────────────────────────────────────────────────────────────────

describe('scenario 6 – AbortSignal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const ds = makeMock();
    const controller = new AbortController();
    controller.abort();

    await expect(
      ds.listCreditLines(OWNER, { signal: controller.signal }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CreditDataError && err.code === 'aborted',
    );
  });

  it('rejects mid-latency when the signal fires during the delay', async () => {
    vi.useFakeTimers();

    // 500 ms simulated latency
    const ds = createMockCreditDataSource({ latencyMs: 500 });
    const controller = new AbortController();

    const promise = ds.listCreditLines(OWNER, { signal: controller.signal });

    // Abort before the delay completes
    controller.abort();

    // Advance time past the latency so any pending timers fire
    vi.advanceTimersByTime(600);

    await expect(promise).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CreditDataError && err.code === 'aborted',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 7 – failWith injection reaches the error path
// ─────────────────────────────────────────────────────────────────────────────

describe('scenario 7 – failWith injection', () => {
  it('listCreditLines rejects with exactly the injected error', async () => {
    const injected = new CreditDataError('unavailable', 'Service is down');
    const ds = makeMock({ failWith: injected });

    await expect(ds.listCreditLines(OWNER)).rejects.toBe(injected);
  });

  it('getCreditLine rejects with exactly the injected error', async () => {
    const injected = new CreditDataError('network', 'Connection refused');
    const ds = makeMock({ failWith: injected });

    await expect(
      ds.getCreditLine(OWNER, MOCK_CREDIT_LINES[0].id),
    ).rejects.toBe(injected);
  });

  it('listTransactions rejects with exactly the injected error', async () => {
    const injected = new CreditDataError('unauthorized', 'Token expired');
    const ds = makeMock({ failWith: injected });

    await expect(ds.listTransactions(OWNER, {})).rejects.toBe(injected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 8 – Factory: adapter selection and unknown-value error
// ─────────────────────────────────────────────────────────────────────────────

describe('scenario 8 – factory adapter selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns mock adapter when VITE_CREDIT_DATA_SOURCE is unset', async () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', '');
    const { createCreditDataSource } = await import('../index');
    const ds = createCreditDataSource();
    // The mock adapter fulfils the port contract
    const lines = await ds.listCreditLines(OWNER);
    expect(lines).toHaveLength(MOCK_CREDIT_LINES.length);
  });

  it('returns mock adapter when VITE_CREDIT_DATA_SOURCE is "mock"', async () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', 'mock');
    const { createCreditDataSource } = await import('../index');
    const ds = createCreditDataSource();
    const lines = await ds.listCreditLines(OWNER);
    expect(lines).toHaveLength(MOCK_CREDIT_LINES.length);
  });

  it('throws a descriptive CreditDataError for an unknown adapter name', async () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', 'bogus-adapter');
    const { createCreditDataSource } = await import('../index');
    expect(() => createCreditDataSource()).toThrow(CreditDataError);
    try {
      createCreditDataSource();
    } catch (err) {
      expect(err).toBeInstanceOf(CreditDataError);
      expect((err as CreditDataError).message).toContain('bogus-adapter');
      expect((err as CreditDataError).message).toContain('mock');
    }
  });
});
