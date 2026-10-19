import type { Money } from '../types/money';

export interface CreditLine {
  id: string;
  name: string;
  owner: string;
  limit: Money;
  utilized: Money;
  aprBpsHundredths: number;
}

export interface SubmitRepaymentOpts {
  idempotencyKey: string;
}

export interface SubmitRepaymentResult {
  txId: string;
  txHash?: string;
  newUtilized: Money;
}

export interface CreditSource {
  getLines(owner: string): Promise<CreditLine[]>;
  getLine(owner: string, lineId: string): Promise<CreditLine | null>;
  submitRepayment(
    owner: string,
    lineId: string,
    amount: Money,
    opts: SubmitRepaymentOpts,
  ): Promise<SubmitRepaymentResult>;
}

export class MockCreditSource implements CreditSource {
  private lines = new Map<string, CreditLine>();
  private resultsByKey = new Map<string, SubmitRepaymentResult>();

  constructor(initialLines: CreditLine[] = []) {
    for (const line of initialLines) {
      this.lines.set(this.key(line.owner, line.id), { ...line });
    }
  }

  private key(owner: string, lineId: string): string {
    return `${owner}::${lineId}`;
  }

  async getLines(owner: string): Promise<CreditLine[]> {
    const out: CreditLine[] = [];
    for (const line of this.lines.values()) {
      if (line.owner === owner) out.push({ ...line });
    }
    return out;
  }

  async getLine(owner: string, lineId: string): Promise<CreditLine | null> {
    const line = this.lines.get(this.key(owner, lineId));
    return line ? { ...line } : null;
  }

  async submitRepayment(
    owner: string,
    lineId: string,
    amount: Money,
    opts: SubmitRepaymentOpts,
  ): Promise<SubmitRepaymentResult> {
    const cacheKey = `${owner}::${lineId}::${opts.idempotencyKey}`;
    const cached = this.resultsByKey.get(cacheKey);
    if (cached) return { ...cached };

    const line = this.lines.get(this.key(owner, lineId));
    if (!line) throw new Error(`Credit line ${lineId} not found`);
    if (amount.currency !== line.utilized.currency) {
      throw new Error(`Currency mismatch: ${amount.currency} vs ${line.utilized.currency}`);
    }
    if (amount.minorUnits <= 0) throw new Error('Repayment amount must be positive');
    if (amount.minorUnits > line.utilized.minorUnits) {
      throw new Error('Repayment amount exceeds utilized');
    }

    const newUtilized: Money = {
      currency: line.utilized.currency,
      minorUnits: line.utilized.minorUnits - amount.minorUnits,
    };
    line.utilized = newUtilized;

    const result: SubmitRepaymentResult = {
      txId: `tx-${opts.idempotencyKey}`,
      txHash: `0x${opts.idempotencyKey.replace(/[^a-z0-9]/gi, '').padStart(64, '0').slice(0, 64)}`,
      newUtilized: { ...newUtilized },
    };
    this.resultsByKey.set(cacheKey, result);
    return { ...result };
  }
}
