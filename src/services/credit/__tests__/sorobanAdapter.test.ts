import { describe, it, expect } from 'vitest';
import {
  SOROBAN_TOKEN_DECIMALS,
  toMoney,
  mapCreditLine,
  mapTransaction,
  sumLimits,
  sumUtilized,
  totalAvailable,
  compareBalance,
  applyFeeRate,
  type SorobanCreditLineRaw,
  type SorobanTransactionRaw,
} from '../sorobanAdapter';
import { MoneyError } from '@/utils/money';

describe('sorobanAdapter', () => {
  describe('toMoney', () => {
    it('converts decimal i128 strings and bigints to 7-decimal Money', () => {
      expect(toMoney('10000000', 'USDC')).toEqual({
        units: 10_000_000n,
        decimals: SOROBAN_TOKEN_DECIMALS,
        asset: 'USDC',
      });

      expect(toMoney(25_000_000n, 'XLM')).toEqual({
        units: 25_000_000n,
        decimals: SOROBAN_TOKEN_DECIMALS,
        asset: 'XLM',
      });
    });

    it('throws MoneyError for invalid i128 strings', () => {
      expect(() => toMoney('12.34', 'USDC')).toThrow(MoneyError);
      expect(() => toMoney('not-a-number', 'USDC')).toThrow(MoneyError);
      expect(() => toMoney('', 'USDC')).toThrow(MoneyError);
    });

    it('throws when asset is empty', () => {
      expect(() => toMoney('1000', '')).toThrow('Soroban adapter: missing asset identifier');
    });
  });

  describe('mapCreditLine', () => {
    const requiredOnly: SorobanCreditLineRaw = {
      id: 'cl-001',
      asset: 'USDC',
      limitI128: '50000000000',
      utilizedI128: '12500000000',
    };

    it('maps required-only input and omits absent optional fields', () => {
      const result = mapCreditLine(requiredOnly);

      expect(result).toEqual({
        id: 'cl-001',
        asset: 'USDC',
        limit: { units: 50_000_000_000n, decimals: 7, asset: 'USDC' },
        utilized: { units: 12_500_000_000n, decimals: 7, asset: 'USDC' },
      });
      expect('nextPaymentAmount' in result).toBe(false);
      expect('fee' in result).toBe(false);
      expect('interest' in result).toBe(false);
      expect('collateral' in result).toBe(false);
      expect('status' in result).toBe(false);
      expect('openedAt' in result).toBe(false);
      expect('dueAt' in result).toBe(false);
    });

    it('populates nextPaymentAmount when nextPaymentAmountI128 is supplied', () => {
      const result = mapCreditLine({
        ...requiredOnly,
        nextPaymentAmountI128: '2500000000',
      });

      expect(result.nextPaymentAmount).toEqual({
        units: 2_500_000_000n,
        decimals: 7,
        asset: 'USDC',
      });
    });

    it('maps all optional fields when present', () => {
      const raw: SorobanCreditLineRaw = {
        ...requiredOnly,
        nextPaymentAmountI128: '1000000000',
        feeI128: '5000000',
        interestI128: '12000000',
        collateralI128: '75000000000',
        status: 'Active',
        openedAt: '2026-01-01T00:00:00Z',
        dueAt: '2026-06-01T00:00:00Z',
      };

      const result = mapCreditLine(raw);

      expect(result).toEqual({
        id: 'cl-001',
        asset: 'USDC',
        limit: { units: 50_000_000_000n, decimals: 7, asset: 'USDC' },
        utilized: { units: 12_500_000_000n, decimals: 7, asset: 'USDC' },
        nextPaymentAmount: { units: 1_000_000_000n, decimals: 7, asset: 'USDC' },
        fee: { units: 5_000_000n, decimals: 7, asset: 'USDC' },
        interest: { units: 12_000_000n, decimals: 7, asset: 'USDC' },
        collateral: { units: 75_000_000_000n, decimals: 7, asset: 'USDC' },
        status: 'Active',
        openedAt: '2026-01-01T00:00:00Z',
        dueAt: '2026-06-01T00:00:00Z',
      });
    });

    it('throws MoneyError on invalid i128 strings in required or optional fields', () => {
      expect(() =>
        mapCreditLine({ ...requiredOnly, limitI128: 'invalid' }),
      ).toThrow(MoneyError);

      try {
        mapCreditLine({ ...requiredOnly, utilizedI128: '12.5' });
        expect.unreachable('expected MoneyError');
      } catch (err) {
        expect(err).toBeInstanceOf(MoneyError);
        expect((err as MoneyError).code).toBe('invalid_base_units');
      }

      expect(() =>
        mapCreditLine({ ...requiredOnly, nextPaymentAmountI128: '1e5' }),
      ).toThrow(MoneyError);
      expect(() =>
        mapCreditLine({ ...requiredOnly, feeI128: 'abc' }),
      ).toThrow(MoneyError);
      expect(() =>
        mapCreditLine({ ...requiredOnly, interestI128: '' }),
      ).toThrow(MoneyError);
      expect(() =>
        mapCreditLine({ ...requiredOnly, collateralI128: '99.9' }),
      ).toThrow(MoneyError);
    });

    it('throws when asset is empty', () => {
      expect(() =>
        mapCreditLine({ ...requiredOnly, asset: '' }),
      ).toThrow('Soroban adapter: missing asset identifier');
    });
  });

  describe('mapTransaction', () => {
    const baseTx: SorobanTransactionRaw = {
      id: 'tx-001',
      asset: 'USDC',
      amountI128: '3500000000',
      type: 'borrow',
    };

    it('maps transaction without timestamp', () => {
      const result = mapTransaction(baseTx);

      expect(result).toEqual({
        id: 'tx-001',
        asset: 'USDC',
        amount: { units: 3_500_000_000n, decimals: 7, asset: 'USDC' },
        type: 'borrow',
      });
      expect('timestamp' in result).toBe(false);
    });

    it('maps transaction with timestamp', () => {
      const result = mapTransaction({
        ...baseTx,
        type: 'repay',
        timestamp: '2026-03-15T12:30:00Z',
      });

      expect(result).toEqual({
        id: 'tx-001',
        asset: 'USDC',
        amount: { units: 3_500_000_000n, decimals: 7, asset: 'USDC' },
        type: 'repay',
        timestamp: '2026-03-15T12:30:00Z',
      });
    });

    it('throws MoneyError for invalid amountI128 and throws for empty asset', () => {
      expect(() =>
        mapTransaction({ ...baseTx, amountI128: 'bad' }),
      ).toThrow(MoneyError);
      expect(() =>
        mapTransaction({ ...baseTx, asset: '' }),
      ).toThrow('Soroban adapter: missing asset identifier');
    });
  });

  describe('sumLimits, sumUtilized, and totalAvailable', () => {
    const lineA = mapCreditLine({
      id: 'cl-a',
      asset: 'USDC',
      limitI128: '50000000000',
      utilizedI128: '10000000000',
    });
    const lineB = mapCreditLine({
      id: 'cl-b',
      asset: 'USDC',
      limitI128: '30000000000',
      utilizedI128: '5000000000',
    });
    const lineXlm = mapCreditLine({
      id: 'cl-xlm',
      asset: 'XLM',
      limitI128: '20000000000',
      utilizedI128: '1000000000',
    });

    it('sums a single credit line without double-counting', () => {
      expect(sumLimits([lineA])).toEqual({
        units: 50_000_000_000n,
        decimals: 7,
        asset: 'USDC',
      });
      expect(sumUtilized([lineA])).toEqual({
        units: 10_000_000_000n,
        decimals: 7,
        asset: 'USDC',
      });
      expect(totalAvailable([lineA])).toEqual({
        units: 40_000_000_000n,
        decimals: 7,
        asset: 'USDC',
      });
    });

    it('sums multiple credit lines of the same asset', () => {
      expect(sumLimits([lineA, lineB])).toEqual({
        units: 80_000_000_000n,
        decimals: 7,
        asset: 'USDC',
      });
      expect(sumUtilized([lineA, lineB])).toEqual({
        units: 15_000_000_000n,
        decimals: 7,
        asset: 'USDC',
      });
      expect(totalAvailable([lineA, lineB])).toEqual({
        units: 65_000_000_000n,
        decimals: 7,
        asset: 'USDC',
      });
    });

    it('throws on an empty list', () => {
      expect(() => sumLimits([])).toThrow('sumLimits: no credit lines to aggregate');
      expect(() => sumUtilized([])).toThrow('sumUtilized: no credit lines to aggregate');
      expect(() => totalAvailable([])).toThrow('sumLimits: no credit lines to aggregate');
    });

    it('throws MoneyError with asset_mismatch for mixed assets', () => {
      for (const fn of [sumLimits, sumUtilized, totalAvailable]) {
        try {
          fn([lineA, lineXlm]);
          expect.unreachable('expected MoneyError');
        } catch (err) {
          expect(err).toBeInstanceOf(MoneyError);
          expect((err as MoneyError).code).toBe('asset_mismatch');
        }
      }
    });
  });

  describe('compareBalance', () => {
    it('compares balances of the same asset', () => {
      const low = toMoney('100', 'USDC');
      const high = toMoney('200', 'USDC');

      expect(compareBalance(low, high)).toBe(-1);
      expect(compareBalance(high, low)).toBe(1);
      expect(compareBalance(low, toMoney('100', 'USDC'))).toBe(0);
    });

    it('throws asset_mismatch when comparing different assets', () => {
      try {
        compareBalance(toMoney('100', 'USDC'), toMoney('100', 'XLM'));
        expect.unreachable('expected MoneyError');
      } catch (err) {
        expect(err).toBeInstanceOf(MoneyError);
        expect((err as MoneyError).code).toBe('asset_mismatch');
      }
    });
  });

  describe('applyFeeRate', () => {
    it('returns zero for 0 bps', () => {
      expect(applyFeeRate(toMoney('123456789', 'USDC'), 0)).toEqual({
        units: 0n,
        decimals: 7,
        asset: 'USDC',
      });
    });

    it('rounds half-up away from zero at .5 boundaries', () => {
      // 1 * 5000 / 10000 = 0.5 -> rounds up to 1
      expect(applyFeeRate(toMoney('1', 'USDC'), 5000).units).toBe(1n);
      // 3 * 5000 / 10000 = 1.5 -> rounds up to 2
      expect(applyFeeRate(toMoney('3', 'USDC'), 5000).units).toBe(2n);
      // 1 * 4999 / 10000 = 0.4999 -> rounds down to 0
      expect(applyFeeRate(toMoney('1', 'USDC'), 4999).units).toBe(0n);
    });

    it('handles negative amounts and rounds .5 away from zero', () => {
      // -10000 * 250 / 10000 = -250
      expect(applyFeeRate(toMoney('-10000', 'USDC'), 250).units).toBe(-250n);
      // -1 * 5000 / 10000 = -0.5 -> rounds away from zero to -1
      expect(applyFeeRate(toMoney('-1', 'USDC'), 5000).units).toBe(-1n);
      // -1 * 4999 / 10000 = -0.4999 -> rounds toward zero to 0
      expect(applyFeeRate(toMoney('-1', 'USDC'), 4999).units).toBe(0n);
    });
  });
});
