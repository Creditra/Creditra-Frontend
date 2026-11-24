import { describe, expect, it } from 'vitest';
import type { CreditLine, Transaction } from '@/types/creditLine';
import {
  REPAY_EMPTY_CREDIT_LINES,
  REPAY_TEST_CREDIT_LINES,
} from '@/test/fixtures/repayCreditLines';
import {
  USDC_MONEY_ASSET,
  USDC_MONEY_DECIMALS,
  mapCreditLinesToViews,
  mapCreditLineToView,
  mapTransactionsToMoney,
  mapTransactionToMoney,
  toLegacyNumber,
} from '../mockAdapter';

const USDC = (units: bigint) => ({
  units,
  decimals: USDC_MONEY_DECIMALS,
  asset: USDC_MONEY_ASSET,
});

const baseLine = REPAY_TEST_CREDIT_LINES[0];

function lineWith(overrides: Partial<CreditLine>): CreditLine {
  return { ...baseLine, ...overrides };
}

const drawTx: Transaction = {
  id: 'tx-draw-1',
  type: 'Draw',
  amount: 12.34,
  date: '2025-02-20T14:32:00Z',
  note: 'First draw',
  status: 'Completed',
  txHash: 'abc123',
};

const repayTx: Transaction = {
  id: 'tx-repay-1',
  type: 'Repay',
  amount: 500.5,
  date: '2025-02-21T09:00:00Z',
  status: 'Pending',
};

describe('mockAdapter constants', () => {
  it('exposes USDC as a 7-decimal asset', () => {
    expect(USDC_MONEY_DECIMALS).toBe(7);
    expect(USDC_MONEY_ASSET).toBe('USDC');
  });
});

describe('mapCreditLineToView', () => {
  it('converts limit and utilized to 7-decimal USDC Money and keeps the id', () => {
    const view = mapCreditLineToView(baseLine);

    expect(view.id).toBe(baseLine.id);
    expect(view.limit).toEqual(USDC(5000000000000n));
    expect(view.utilized).toEqual(USDC(1875000000000n));
    expect(view.nextPaymentAmount).toEqual(USDC(32000000000n));
  });

  it('leaves nextPaymentAmount undefined when the source value is absent', () => {
    const view = mapCreditLineToView(lineWith({ nextPaymentAmount: undefined }));

    expect(view.nextPaymentAmount).toBeUndefined();
  });

  it('keeps a zero nextPaymentAmount as Money instead of dropping it', () => {
    const view = mapCreditLineToView(lineWith({ nextPaymentAmount: 0 }));

    expect(view.nextPaymentAmount).toEqual(USDC(0n));
  });

  it('preserves fractional nextPaymentAmount precision', () => {
    const view = mapCreditLineToView(lineWith({ nextPaymentAmount: 123.45 }));

    expect(view.nextPaymentAmount).toEqual(USDC(1234500000n));
  });
});

describe('mapTransactionToMoney', () => {
  it('converts only amount and keeps every other transaction field', () => {
    const mapped = mapTransactionToMoney(drawTx);

    expect(mapped).toEqual({ ...drawTx, amount: USDC(123400000n) });
    expect(mapped.amount).toEqual(USDC(123400000n));
    expect(mapped.id).toBe(drawTx.id);
    expect(mapped.type).toBe(drawTx.type);
    expect(mapped.date).toBe(drawTx.date);
    expect(mapped.note).toBe(drawTx.note);
    expect(mapped.status).toBe(drawTx.status);
    expect(mapped.txHash).toBe(drawTx.txHash);
  });
});

describe('toLegacyNumber', () => {
  it.each([0, 0.0000001, 1, 123.45, 500000])(
    'round-trips %s through Money',
    (value) => {
      const { limit } = mapCreditLineToView(lineWith({ limit: value }));

      expect(toLegacyNumber(limit)).toBeCloseTo(value, 10);
    },
  );

  it('keeps a single stroop as the smallest representable amount', () => {
    const { limit } = mapCreditLineToView(lineWith({ limit: 0.0000001 }));

    expect(limit.units).toBe(1n);
    expect(toLegacyNumber(limit)).toBe(0.0000001);
  });
});

describe('array mapping helpers', () => {
  it('maps every credit line in order, preserving length and ids', () => {
    const views = mapCreditLinesToViews(REPAY_TEST_CREDIT_LINES);

    expect(views).toHaveLength(REPAY_TEST_CREDIT_LINES.length);
    expect(views.map((view) => view.id)).toEqual(
      REPAY_TEST_CREDIT_LINES.map((line) => line.id),
    );
    views.forEach((view, index) => {
      const line = REPAY_TEST_CREDIT_LINES[index];
      expect(view.limit).toEqual(USDC(BigInt(Math.round(line.limit * 10_000_000))));
      expect(view.utilized).toEqual(USDC(BigInt(Math.round(line.utilized * 10_000_000))));
    });
  });

  it('returns an empty array for an empty credit line list', () => {
    expect(mapCreditLinesToViews(REPAY_EMPTY_CREDIT_LINES)).toEqual([]);
  });

  it('maps every transaction in order, preserving length and ids', () => {
    const mapped = mapTransactionsToMoney([drawTx, repayTx]);

    expect(mapped).toHaveLength(2);
    expect(mapped.map((tx) => tx.id)).toEqual([drawTx.id, repayTx.id]);
    expect(mapped[0].amount).toEqual(USDC(123400000n));
    expect(mapped[1].amount).toEqual(USDC(5005000000n));
  });

  it('returns an empty array for an empty transaction list', () => {
    expect(mapTransactionsToMoney([])).toEqual([]);
  });
});
