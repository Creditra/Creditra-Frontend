import type { CreditLine } from '../../types/creditLine';
import { MOCK_CREDIT_LINES } from '../../data/mockData';
import {
  CreditDataError,
  type CreditDataOptions,
  type CreditDataSource,
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
}
