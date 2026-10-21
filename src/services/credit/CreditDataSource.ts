/**
 * CreditDataSource port
 *
 * A typed interface that decouples credit-lifecycle screens from any
 * concrete data source.  Adapters (mock, Horizon, Soroban RPC, HTTP
 * backend) implement this interface; pages never import adapters directly.
 *
 * Error taxonomy
 * ─────────────
 * not_found        – the requested resource does not exist for this owner
 * network          – a transport error occurred (timeout, DNS failure, etc.)
 * invalid_response – the adapter received data that violates the expected schema
 * unauthorized     – the owner lacks permission or is not authenticated
 * unavailable      – the upstream service is temporarily down / rate-limited
 * aborted          – the caller cancelled the request via AbortSignal
 */

import type { CreditLine, Transaction } from '../../types/creditLine';

// ─── Error type ───────────────────────────────────────────────────────────────

export type CreditDataErrorCode =
  | 'not_found'
  | 'network'
  | 'invalid_response'
  | 'unauthorized'
  | 'unavailable'
  | 'aborted';

export class CreditDataError extends Error {
  readonly code: CreditDataErrorCode;
  readonly cause: unknown;

  constructor(
    code: CreditDataErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'CreditDataError';
    this.code = code;
    this.cause = options?.cause;
    // Restore prototype chain in environments that transpile class extends
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Shared query / response shapes ──────────────────────────────────────────

/** Options accepted by every data-source method. */
export interface DataSourceOptions {
  /**
   * When the signal is aborted the method must reject with
   * `CreditDataError { code: 'aborted' }` as soon as possible.
   */
  signal?: AbortSignal;
}

/** A transaction record annotated with the id of its parent credit line. */
export interface TransactionWithLineRef extends Transaction {
  /** The id of the CreditLine this transaction belongs to. */
  lineId: string;
}

/** Query parameters for `listTransactions`. */
export interface TransactionQuery {
  /**
   * Opaque cursor returned by a previous call.  Omit or pass `null` / `undefined`
   * to start from the most recent transaction.
   */
  cursor?: string | null;
  /** Maximum number of items to return. Defaults to the adapter's page size. */
  limit?: number;
  /** When set, only transactions belonging to this credit-line id are returned. */
  lineId?: string;
}

/** Paginated response from `listTransactions`. */
export interface TransactionPage {
  items: TransactionWithLineRef[];
  /**
   * Opaque cursor to pass as `query.cursor` in the next call.
   * `null` means the caller has reached the last page.
   */
  nextCursor: string | null;
}

// ─── Port interface ───────────────────────────────────────────────────────────

/**
 * The single seam between the UI layer and any credit data back-end.
 *
 * All methods:
 * - return Promises (never synchronous values)
 * - return deep copies — callers may mutate the result without affecting
 *   shared fixtures or caches
 * - reject with {@link CreditDataError} on failure
 * - honour {@link DataSourceOptions.signal} and reject with `code: 'aborted'`
 *   when the signal fires
 */
export interface CreditDataSource {
  /**
   * Returns every credit line owned by `owner`, sorted by
   * `compareCreditLines` (ascending by id).
   */
  listCreditLines(
    owner: string,
    opts?: DataSourceOptions,
  ): Promise<CreditLine[]>;

  /**
   * Returns the credit line with the given `id` for `owner`.
   * Rejects with `code: 'not_found'` when no such line exists.
   */
  getCreditLine(
    owner: string,
    id: string,
    opts?: DataSourceOptions,
  ): Promise<CreditLine>;

  /**
   * Returns a cursor-paginated page of transactions across all of the
   * owner's credit lines (or a single line when `query.lineId` is set).
   * Items are ordered newest-first.
   */
  listTransactions(
    owner: string,
    query: TransactionQuery,
    opts?: DataSourceOptions,
  ): Promise<TransactionPage>;
}
