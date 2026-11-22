export * from './CreditDataSource';
export * from './sorobanCreditDataSource';
export * from './mockCreditDataSource';
export * from './config';
export * from './decoder';
export * from './factory';

import type { CreditLine } from '@/types/creditLine';
import { getGlobalCreditLines, setGlobalCreditLines } from '@/hooks/useCreditLines';

export interface CreditOfferEvaluationResult {
  approved: boolean;
  creditLimit?: number;
  apr?: number;
  riskScore?: number;
  reason?: string;
  offerId?: string;
  expiresAt?: string;
}

export interface CreditDataPort {
  acceptOffer(owner: string, offerId: string): Promise<CreditLine>;
  listCreditLines(owner?: string): Promise<CreditLine[]>;
}

export class MockCreditAdapter implements CreditDataPort {
  async acceptOffer(owner: string, offerId: string): Promise<CreditLine> {
    const existing = getGlobalCreditLines();
    const id = `CL-${Date.now().toString().slice(-4)}`;
    const newLine: CreditLine = {
      id,
      name: `Adaptive Credit Line (${offerId || 'Standard'})`,
      status: 'Active',
      limit: 150000,
      utilized: 0,
      apr: 8.5,
      riskScore: 720,
      openedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transactions: [],
      statusHistory: [
        {
          status: 'Active',
          date: new Date().toISOString(),
          note: `Credit line opened by offer acceptance (${offerId}) for owner ${owner}`,
        },
      ],
    };

    setGlobalCreditLines([newLine, ...existing]);
    return newLine;
  }

  async listCreditLines(_owner?: string): Promise<CreditLine[]> {
    return getGlobalCreditLines();
  }
}

export const creditService: CreditDataPort = new MockCreditAdapter();

