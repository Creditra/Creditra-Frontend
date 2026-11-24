import type { CreditLine } from '../../types/creditLine';
import { MOCK_CREDIT_LINES } from '../../data/mockData';
import {
  CreditDataError,
  type CreditDataOptions,
  type CreditDataSource,
  type ListTransactionsOptions,
  type TransactionPage,
} from './CreditDataSource';

export class MockCreditDataSource implements CreditDataSource {
  private lines: CreditLine[];

  constructor(initialLines: CreditLine[] = MOCK_CREDIT_LINES) {
    this.lines = [...initialLines];
  }

  async listCreditLines(_borrower: string, options?: CreditDataOptions): Promise<CreditLine[]> {
    if (options?.signal?.aborted) {
      throw new CreditDataError('aborted', 'The operation was aborted');
    }
    return [...this.lines];
  }

  async getCreditLine(id: string, options?: CreditDataOptions): Promise<CreditLine> {
    if (options?.signal?.aborted) {
      throw new CreditDataError('aborted', 'The operation was aborted');
    }
    const found = this.lines.find((line) => line.id === id);
    if (!found) {
      throw new CreditDataError('not_found', `Credit line not found: ${id}`);
    }
    return { ...found };
  }

  async listTransactions(
    lineId: string,
    options?: ListTransactionsOptions,
  ): Promise<TransactionPage> {
    if (options?.signal?.aborted) {
      throw new CreditDataError('aborted', 'The operation was aborted');
    }

    const found = this.lines.find((line) => line.id === lineId);
    if (!found) {
      throw new CreditDataError('not_found', `Credit line not found: ${lineId}`);
    }

    let start = 0;
    if (options?.cursor !== undefined) {
      if (!/^\d+$/.test(options.cursor)) {
        throw new CreditDataError(
          'invalid_response',
          `Invalid pagination cursor: "${options.cursor}"`,
        );
      }
      start = Number(options.cursor);
    }

    const limit = options?.limit;
    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
      throw new CreditDataError(
        'invalid_response',
        `Invalid limit: expected positive integer, got ${String(limit)}`,
      );
    }

    const all = found.transactions;
    const slice = limit !== undefined ? all.slice(start, start + limit) : all.slice(start);
    const nextIndex = start + slice.length;
    const nextCursor = nextIndex < all.length ? String(nextIndex) : undefined;

    return {
      items: slice.map((tx) => ({ ...tx })),
      ...(nextCursor !== undefined ? { nextCursor } : {}),
    };
  }
}
