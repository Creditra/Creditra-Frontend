import { describe, expect, it } from 'vitest';
import { CreditDataError } from '../CreditDataSource';
import { decodeLosslessAmount } from '../decoder';

function expectInvalidAmount(value: unknown): void {
  try {
    decodeLosslessAmount(value);
  } catch (error) {
    expect(error).toBeInstanceOf(CreditDataError);
    expect((error as CreditDataError).code).toBe('invalid_response');
    return;
  }

  throw new Error('Expected decodeLosslessAmount to throw');
}

describe('decodeLosslessAmount', () => {
  it('decodes bigint stroops below Number.MAX_SAFE_INTEGER', () => {
    expect(decodeLosslessAmount(12_345_678n)).toBe(1.2345678);
    expect(decodeLosslessAmount(9_007_199_254_740_991n)).toBe(
      Number('900719925.4740991'),
    );
  });

  it('converts bigint stroops above Number.MAX_SAFE_INTEGER through one decimal parse', () => {
    const stroops = 9_007_199_254_740_992n;

    expect(stroops).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    expect(decodeLosslessAmount(stroops)).toBe(Number('900719925.4740992'));
  });

  it('preserves the sign when decoding negative bigint stroops', () => {
    expect(decodeLosslessAmount(-12_345_678n)).toBe(-1.2345678);
    expect(decodeLosslessAmount(-1n)).toBe(-0.0000001);
  });

  it('decodes zero bigint stroops', () => {
    expect(decodeLosslessAmount(0n)).toBe(0);
  });

  it('treats finite numbers as standard units by default', () => {
    expect(decodeLosslessAmount(1.5)).toBe(1.5);
    expect(decodeLosslessAmount(0)).toBe(0);
    expect(decodeLosslessAmount(-1.5)).toBe(-1.5);
  });

  it('scales numeric stroops when numberUnit is stroops', () => {
    expect(decodeLosslessAmount(15_000_000, { numberUnit: 'stroops' })).toBe(1.5);
    expect(decodeLosslessAmount(-15_000_000, { numberUnit: 'stroops' })).toBe(-1.5);
  });

  it('rejects non-finite numbers with invalid_response', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expectInvalidAmount(value);
    }
  });

  it('rejects strings and other unsupported values with invalid_response', () => {
    for (const value of ['1.5', null, undefined, {}, []]) {
      expectInvalidAmount(value);
    }
  });
});
