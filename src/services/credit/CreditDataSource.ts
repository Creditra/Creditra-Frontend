import type { CreditLine } from '../../types/creditLine';

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

export interface CreditDataSource {
  listCreditLines(borrower: string, options?: CreditDataOptions): Promise<CreditLine[]>;
  getCreditLine(id: string, options?: CreditDataOptions): Promise<CreditLine>;
}

export { createCreditDataSource } from './factory';
