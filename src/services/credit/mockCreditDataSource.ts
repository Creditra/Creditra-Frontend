/**
 * Mock adapter for CreditDataSource.
 *
 * Wraps MOCK_CREDIT_LINES from src/data/mockData.ts and returns deep copies
 * so callers can never mutate the shared fixture.
 *
 * Design notes
 * ────────────
 * - latencyMs: 0 by default in test mode (import.meta.env.MODE === 'test'),
 *   so tests need no fake timers.  Pass an explicit value to simulate network
 *   latency in dev / Storybook.
 * - failWith: inject a CreditDataError to exercise error paths in tests.
 * - AbortSignal is checked before the latency delay and again after it,
 *   so the adapter rejects promptly whether the signal fires early or late.
 * - paginateByCursor from src/utils/cursorPagination.ts drives listTransactions,
 *   giving stable, insertion-safe pagination.
 */

import { MOCK_CREDIT_LINES, compareCreditLines } from '../../data/mockData';
import { paginateByCursor } from '../../utils/cursorPagination';
import type { CreditLine } from '../../types/creditLine';
import {
  CreditDataError,
  type CreditDataSource,
  type DataSourceOptions,
  type TransactionQuery,
  type TransactionPage,
  type TransactionWithLineRef,
} from './CreditDataSource';

// ─── Configuration ────────────────────────────────────────────────────────────

export interface MockCreditDataSourceOptions {
  /**
   * Simulated network latency in milliseconds.
   *
   * Defaults to `0` when `import.meta.env.MODE === 'test'`, and `400`
   * otherwise, so the UI feels responsive in dev without breaking tests.
   */
  latencyMs?: number;

  /**
   * When set, every method rejects with this error immediately (after the
   * abort check, before the latency delay).  Use this in tests to exercise
   * error paths without mocking at the module level.
   */
  failWith?: CreditDataError;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolves after `ms` milliseconds, or rejects immediately if already aborted. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms === 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CreditDataError('aborted', 'Request was aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new CreditDataError('aborted', 'Request was aborted'));
    });
  });
}

/**
 * Throws a CreditDataError with code 'aborted' when the signal is already
 * aborted.  Inline guard used at the entry of every method.
 */
function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new CreditDataError('aborted', 'Request was aborted');
  }
}

/** Returns a structurally deep copy of `value` via JSON round-trip. */
function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ─── Default latency ─────────────────────────────────────────────────────────

/**
 * Returns the latency to use when the caller did not pass an explicit value.
 * `0` in test mode so tests are synchronous; `400` in dev/production.
 */
function defaultLatencyMs(): number {
  return import.meta.env.MODE === 'test' ? 0 : 400;
}

// ─── Factory function ─────────────────────────────────────────────────────────

/**
 * Creates a MockCreditDataSource.  The returned object satisfies the
 * CreditDataSource interface and is safe to use as a React context value.
 */
export function createMockCreditDataSource(
  opts: MockCreditDataSourceOptions = {},
): CreditDataSource {
  const latencyMs = opts.latencyMs ?? defaultLatencyMs();
  const failWith = opts.failWith;

  // ── Shared pre-flight ──────────────────────────────────────────────────────
  /**
   * Runs abort check, optional injected failure, then waits for latencyMs.
   * Returns a rejected Promise on any failure, resolves on success.
   */
  async function preflight(opts?: DataSourceOptions): Promise<void> {
    assertNotAborted(opts?.signal);
    if (failWith) throw failWith;
    await delay(latencyMs, opts?.signal);
  }

  // ── listCreditLines ────────────────────────────────────────────────────────
  async function listCreditLines(
    _owner: string,
    opts?: DataSourceOptions,
  ): Promise<CreditLine[]> {
    await preflight(opts);
    return deepCopy([...MOCK_CREDIT_LINES].sort(compareCreditLines));
  }

  // ── getCreditLine ──────────────────────────────────────────────────────────
  async function getCreditLine(
    _owner: string,
    id: string,
    opts?: DataSourceOptions,
  ): Promise<CreditLine> {
    await preflight(opts);
    const line = MOCK_CREDIT_LINES.find((cl) => cl.id === id);
    if (!line) {
      throw new CreditDataError(
        'not_found',
        `Credit line "${id}" not found`,
      );
    }
    return deepCopy(line);
  }

  // ── listTransactions ───────────────────────────────────────────────────────
  async function listTransactions(
    _owner: string,
    query: TransactionQuery,
    opts?: DataSourceOptions,
  ): Promise<TransactionPage> {
    await preflight(opts);

    // Build a flat list of TransactionWithLineRef, optionally filtered by lineId.
    const source = query.lineId
      ? MOCK_CREDIT_LINES.filter((cl) => cl.id === query.lineId)
      : MOCK_CREDIT_LINES;

    const allTx: TransactionWithLineRef[] = source.flatMap((cl) =>
      cl.transactions.map((tx) => ({ ...tx, lineId: cl.id })),
    );

    const page = paginateByCursor(allTx, {
      cursor: query.cursor ?? null,
      pageSize: query.limit,
      getDate: (tx) => tx.date,
      getId: (tx) => tx.id,
    });

    return {
      items: deepCopy(page.items),
      nextCursor: page.nextCursor,
    };
  }

  return { listCreditLines, getCreditLine, listTransactions };
}
