import type { CreditLine } from '../../types/creditLine';

export type CreditDataErrorCode =
  | 'network'
  | 'not_found'
  | 'unavailable'
  | 'invalid_response'
  | 'aborted';

export class CreditDataError extends Error {
  readonly code: CreditDataErrorCode;
  override readonly cause?: unknown;
  /**
   * Structured context for the failure. Simulation errors put the raw RPC
   * message and its diagnostic events here so callers can map contract codes
   * without re-parsing the human-readable `message`.
   */
  readonly details?: unknown;

  constructor(
    code: CreditDataErrorCode,
    message: string,
    options?: { cause?: unknown; details?: unknown },
  ) {
    super(message);
    this.name = 'CreditDataError';
    this.code = code;
    this.cause = options?.cause;
    this.details = options?.details;

    // Restore prototype chain for instanceof checks across transpilation targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface CreditDataOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface CreditDataSource {
  listCreditLines(borrower: string, options?: CreditDataOptions): Promise<CreditLine[]>;
  getCreditLine(id: string, options?: CreditDataOptions): Promise<CreditLine>;
}

export { createCreditDataSource } from './factory';
