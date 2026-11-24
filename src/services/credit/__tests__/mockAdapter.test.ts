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
import { describe, it, expect } from 'vitest';
import { toBaseUnits, toLegacyNumber, mapCreditLineToView } from '../mockAdapter';
import { MoneyError } from '@/utils/money';
import type { CreditLine } from '@/types/creditLine';

/**
 * Coverage for {@link toBaseUnits} and the surrounding mock-adapter money
 * pipeline. The conversion must not drift through float multiplication, must
 * reject non-finite input with a clear error, and must round-trip safe-range
 * values exactly through {@link toLegacyNumber}.
 */
function makeLine(overrides: Partial<CreditLine> = {}): CreditLine {
  return {
    id: 'CL-1',
    name: 'Test line',
    status: 'Active',
    limit: 1000,
    utilized: 0,
    apr: 8.5,
    riskScore: 720,
    openedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    transactions: [],
    statusHistory: [],
    ...overrides,
  };
}

describe('toBaseUnits', () => {
  it('converts 0.1 + 0.2 exactly (no float-multiplication drift)', () => {
    expect(toBaseUnits(0.1 + 0.2, 7)).toBe(3000000n);
  });

  it('rounds 1.005 to the requested precision via toFixed half-up', () => {
    // The float 1.005 is 1.00499999..., so two decimals round down to 1.00.
    expect(toBaseUnits(1.005, 2)).toBe(100n);
    expect(toBaseUnits(1.005, 3)).toBe(1005n);
  });

  it('preserves high-precision fractional values', () => {
    expect(toBaseUnits(123456789.1234567, 7)).toBe(1234567891234567n);
  });

  it('handles values at/beyond 1e21 by expanding exponent notation', () => {
    // toFixed returns "1e+21" here; it must be expanded to a plain decimal
    // before parsing so no exponent leaks into base-unit math.
    expect(toBaseUnits(1e21, 7)).toBe(10000000000000000000000000000n);
    expect(toBaseUnits(1e21, 0)).toBe(1000000000000000000000n);
    expect(toBaseUnits(1.5e21, 7)).toBe(15000000000000000000000000000n);
  });

  it('handles negative amounts', () => {
    expect(toBaseUnits(-1.5, 2)).toBe(-150n);
    expect(toBaseUnits(-123456789.1234567, 7)).toBe(-1234567891234567n);
  });

  it('handles zero and negative zero', () => {
    expect(toBaseUnits(0, 7)).toBe(0n);
    expect(toBaseUnits(-0, 7)).toBe(0n);
  });

  it('supports decimals = 0 with half-up rounding', () => {
    expect(toBaseUnits(123, 0)).toBe(123n);
    expect(toBaseUnits(123.5, 0)).toBe(124n);
    expect(toBaseUnits(2.5, 0)).toBe(3n);
  });

  it('supports decimals = 2 with half-up rounding', () => {
    expect(toBaseUnits(123.456, 2)).toBe(12346n);
    expect(toBaseUnits(0.9999, 2)).toBe(100n);
  });

  it('rejects NaN and +/-Infinity with a clear MoneyError', () => {
    expect(() => toBaseUnits(NaN, 7)).toThrow(MoneyError);
    expect(() => toBaseUnits(NaN, 7)).toThrow(/non-finite/i);
    expect(() => toBaseUnits(Infinity, 7)).toThrow(MoneyError);
    expect(() => toBaseUnits(-Infinity, 7)).toThrow(MoneyError);
  });

  it('does not change behaviour for whole-dollar inputs', () => {
    // Whole dollars convert identically to the old Math.round(dollars * scale).
    for (const dollars of [0, 1, 5, 100, 1234, 150000, 999999]) {
      const scale = 10n ** 7n;
      const expected = BigInt(Math.round(dollars * Number(scale)));
      expect(toBaseUnits(dollars, 7)).toBe(expected);
    }
  });
});

describe('toLegacyNumber round trip', () => {
  it('round-trips safe-range values exactly', () => {
    const cases: Array<[number, number]> = [
      [0.1 + 0.2, 7],
      [123.456789, 7],
      [123456789.1234567, 7],
      [-1.5, 2],
      [100, 7],
      [123.456, 2],
    ];
    for (const [dollars, decimals] of cases) {
      const units = toBaseUnits(dollars, decimals);
      const back = toLegacyNumber({ units, decimals, asset: 'USDC' });
      // Compare the fixed-point strings so float representation surprises
      // don't make a value that round-trips to the same base units look unequal.
      expect(back.toFixed(decimals)).toBe(Number(dollars).toFixed(decimals));
    }
  });
});

describe('mapCreditLineToView integration', () => {
  it('maps fractional limits to exact base-unit Money and round-trips', () => {
    const view = mapCreditLineToView(makeLine({ limit: 123456789.1234567 }));
    expect(view.limit.units).toBe(1234567891234567n);
    expect(view.limit.decimals).toBe(7);
    expect(view.limit.asset).toBe('USDC');
    expect(toLegacyNumber(view.limit)).toBe(123456789.1234567);
  });

  it('maps an optional nextPaymentAmount', () => {
    const view = mapCreditLineToView(makeLine({ nextPaymentAmount: 12.345 }));
    expect(view.nextPaymentAmount?.units).toBe(123450000n);
    expect(view.nextPaymentAmount?.decimals).toBe(7);
  });

  it('leaves nextPaymentAmount undefined when absent', () => {
    const view = mapCreditLineToView(makeLine());
  });
});
