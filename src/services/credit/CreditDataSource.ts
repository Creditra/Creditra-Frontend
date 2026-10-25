import type { CreditLine, Transaction } from '../../types/creditLine';

export type CreditDataErrorCode =
  | 'network'
  | 'not_found'
  | 'unavailable'
  | 'invalid_response'
  | 'aborted';

export class CreditDataError extends Error {
  readonly code: CreditDataErrorCode;
  readonly cause?: unknown;

  constructor(code: CreditDataErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'CreditDataError';
    this.code = code;
    this.cause = options?.cause;

    // Restore prototype chain for instanceof checks across transpilation targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface CreditDataOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Which flavour of backing store a source reads from. */
export type CreditDataSourceKind = 'mock' | 'soroban';

/**
 * Page request for transaction history. `cursor` is opaque: it is whatever the
 * source handed back on the previous page (a Horizon `paging_token` for the
 * on-chain source) and callers must never parse or compare it.
 */
export interface TransactionPageQuery extends CreditDataOptions {
  cursor?: string | null;
  limit?: number;
  lineId?: string;
}

export interface TransactionPage {
  transactions: Transaction[];
  /** Cursor for the next page, or `null` when the end of history is reached. */
  nextCursor: string | null;
}

export interface CreditDataSource {
  readonly kind?: CreditDataSourceKind;
  listCreditLines(borrower: string, options?: CreditDataOptions): Promise<CreditLine[]>;
  getCreditLine(id: string, options?: CreditDataOptions): Promise<CreditLine>;
  /**
   * Optional: only sources that can page history out of the ledger implement it.
   * Callers must fall back to the transactions embedded in the credit lines
   * when it is absent.
   */
  listTransactions?(borrower: string, query?: TransactionPageQuery): Promise<TransactionPage>;
}

export { createCreditDataSource } from './factory';
