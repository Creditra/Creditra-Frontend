import { describe, expect, it } from 'vitest';
import {
  formatMiney,
  formatMineyCents,
  formatMoney,
  formatMoneyCents,
  fromBaseUnits,
  MoneyError,
  parseMoney,
  type MoneyErrorCode,
} from './money';

describe('money formatting aliases', () => {
  it('exports deprecated aliases as the same function references', () => {
    expect(formatMiney).toBe(formatMoney);
    expect(formatMineyCents).toBe(formatMoneyCents);
  });

  it('formats negative amounts without behavior changes', () => {
    const money = fromBaseUnits(-12345n, 2, 'USD');

    expect(formatMoney(money)).toBe('-123.45');
    expect(formatMiney(money)).toBe(formatMoney(money));
    expect(formatMoneyCents(money)).toBe('-123.45');
    expect(formatMineyCents(money)).toBe(formatMoneyCents(money));
  });

  it('handles locale undefined and de-DE the same for aliases', () => {
    const money = fromBaseUnits(123456n, 2, 'USD');

    expect(formatMoney(money)).toBe('1234.56');
    expect(formatMoney(money, undefined)).toBe('1234.56');
    expect(formatMiney(money)).toBe(formatMoney(money));
    expect(formatMiney(money, 'de-DE')).toBe(formatMoney(money, 'de-DE'));

    expect(formatMoneyCents(money)).toBe('1234.56');
    expect(formatMoneyCents(money, undefined)).toBe('1234.56');
    expect(formatMineyCents(money)).toBe(formatMoneyCents(money));
    expect(formatMineyCents(money, 'de-DE')).toBe(
      formatMoneyCents(money, 'de-DE'),
    );
  });
});

describe('formatMoney / formatMiney precision above 2^53', () => {
  it('preserves every digit above Number.MAX_SAFE_INTEGER in en-US', () => {
    const money = {
      units: 90071992547409930000000n,
      decimals: 7,
      asset: 'USDC',
    };

    expect(formatMiney(money, 'en-US')).toBe('9,007,199,254,740,993.0000000');
    expect(formatMoney(money, 'en-US')).toBe('9,007,199,254,740,993.0000000');
    expect(formatMoney(money)).toBe('9007199254740993.0000000');
  });

  it('preserves precision and decimal separators for de-DE, fr-FR, and en-IN', () => {
    const money = {
      units: 90071992547409931234567n,
      decimals: 7,
      asset: 'USDC',
    };

    expect(formatMoney(money, 'de-DE')).toBe('9.007.199.254.740.993,1234567');
    expect(formatMoney(money, 'en-IN')).toBe('9,00,71,99,25,47,40,993.1234567');

    const frFormatted = formatMoney(money, 'fr-FR');
    expect(frFormatted).toBe(
      `${9007199254740993n.toLocaleString('fr-FR')},1234567`,
    );
    expect(frFormatted).toMatch(/[\u00a0\u202f]/);
    expect(frFormatted.replace(/[\u00a0\u202f]/g, '')).toBe(
      '9007199254740993,1234567',
    );
  });

  it('handles negative values above Number.MAX_SAFE_INTEGER and -0.0000001', () => {
    const largeNegative = {
      units: -90071992547409950000001n,
      decimals: 7,
      asset: 'USDC',
    };

    expect(formatMoney(largeNegative, 'en-US')).toBe(
      '-9,007,199,254,740,995.0000001',
    );
    expect(formatMoney(largeNegative, 'de-DE')).toBe(
      '-9.007.199.254.740.995,0000001',
    );
    expect(formatMoney(largeNegative)).toBe('-9007199254740995.0000001');

    const tinyNegative = fromBaseUnits(-1n, 7, 'USDC');
    expect(formatMoney(tinyNegative)).toBe('-0.0000001');
    expect(formatMoney(tinyNegative, 'en-US')).toBe('-0.0000001');
    expect(formatMoney(tinyNegative, 'de-DE')).toBe('-0,0000001');
    expect(formatMoney(tinyNegative, 'fr-FR')).toBe('-0,0000001');
  });

  it('handles zero decimals above Number.MAX_SAFE_INTEGER', () => {
    const zeroDecimals = fromBaseUnits(9007199254740993n, 0, 'UNIT');
    const negZeroDecimals = fromBaseUnits(-9007199254740993n, 0, 'UNIT');

    expect(formatMoney(zeroDecimals)).toBe('9007199254740993');
    expect(formatMoney(zeroDecimals, 'en-US')).toBe('9,007,199,254,740,993');
    expect(formatMoney(zeroDecimals, 'de-DE')).toBe('9.007.199.254.740.993');
    expect(formatMoney(zeroDecimals, 'en-IN')).toBe('9,00,71,99,25,47,40,993');
    expect(formatMoney(negZeroDecimals, 'en-US')).toBe(
      '-9,007,199,254,740,993',
    );
  });
});

/**
 * `parseMoney` accepts the shapes a user can leave in an amount field and
 * rejects everything else with a typed `MoneyError`. These tests pin the
 * digit-less input fix (`"."` used to parse as zero) and the forms accepted
 * around the decimal point, so the behaviour cannot drift silently.
 */

function moneyErrorOf(fn: () => unknown): MoneyError {
  try {
    fn();
  } catch (error) {
    if (error instanceof MoneyError) return error;
    throw error;
  }
  throw new Error('Expected a MoneyError, but the call succeeded');
}

function expectCode(fn: () => unknown, code: MoneyErrorCode): void {
  const error = moneyErrorOf(fn);
  expect(error.code).toBe(code);
}

describe('parseMoney', () => {
  describe('digit-less input', () => {
    it('rejects a bare decimal point', () => {
      expectCode(() => parseMoney('.', 7, 'USDC'), 'invalid_input');
    });

    it('rejects a bare decimal point regardless of asset decimals', () => {
      expectCode(() => parseMoney('.', 2, 'USD'), 'invalid_input');
      expectCode(() => parseMoney('.', 0, 'XLM'), 'invalid_input');
    });

    it('rejects a bare decimal point surrounded by whitespace', () => {
      expectCode(() => parseMoney(' . ', 7, 'USDC'), 'invalid_input');
      expectCode(() => parseMoney('\t.\n', 2, 'USD'), 'invalid_input');
    });

    it('explains why the input was rejected', () => {
      const error = moneyErrorOf(() => parseMoney('.', 7, 'USDC'));
      expect(error.message).toContain('at least one digit');
    });
  });

  describe('accepted forms', () => {
    it('keeps a leading decimal point (".5" is 0.5)', () => {
      expect(parseMoney('.5', 7, 'USDC').units).toBe(5_000_000n);
      expect(parseMoney('.5', 2, 'USD').units).toBe(50n);
    });

    it('keeps a trailing decimal point ("5." is 5)', () => {
      expect(parseMoney('5.', 7, 'USDC').units).toBe(50_000_000n);
      expect(parseMoney('5.', 2, 'USD').units).toBe(500n);
    });

    it('treats zero with either decimal point as zero', () => {
      expect(parseMoney('0.', 2, 'USD').units).toBe(0n);
      expect(parseMoney('.0', 2, 'USD').units).toBe(0n);
      expect(parseMoney('.0', 7, 'USDC').units).toBe(0n);
    });

    it('parses the previously valid inputs to the same values', () => {
      expect(parseMoney('10', 2, 'USD')).toEqual({
        units: 1_000n,
        decimals: 2,
        asset: 'USD',
      });
      expect(parseMoney('12.34', 2, 'USD')).toEqual({
        units: 1_234n,
        decimals: 2,
        asset: 'USD',
      });
      expect(parseMoney('0.5', 7, 'USDC')).toEqual({
        units: 5_000_000n,
        decimals: 7,
        asset: 'USDC',
      });
    });

    it('ignores surrounding whitespace', () => {
      expect(parseMoney(' 5. ', 2, 'USD').units).toBe(500n);
      expect(parseMoney('  .5  ', 2, 'USD').units).toBe(50n);
    });
  });

  describe('other rejected input', () => {
    it('rejects empty and whitespace-only input as empty_input', () => {
      expectCode(() => parseMoney('', 2, 'USD'), 'empty_input');
      expectCode(() => parseMoney('   ', 2, 'USD'), 'empty_input');
    });

    it('rejects signs', () => {
      expectCode(() => parseMoney('+1', 2, 'USD'), 'sign_not_allowed');
      expectCode(() => parseMoney('-1', 2, 'USD'), 'sign_not_allowed');
      expectCode(() => parseMoney('-.', 2, 'USD'), 'sign_not_allowed');
    });

    it('rejects exponent notation', () => {
      expectCode(() => parseMoney('1e3', 2, 'USD'), 'exponent_notation');
      expectCode(() => parseMoney('1E3', 2, 'USD'), 'exponent_notation');
    });

    it('rejects repeated or foreign punctuation as invalid_input', () => {
      expectCode(() => parseMoney('..', 2, 'USD'), 'invalid_input');
      expectCode(() => parseMoney('1.2.3', 2, 'USD'), 'invalid_input');
      expectCode(() => parseMoney('1,5', 2, 'USD'), 'invalid_input');
      expectCode(() => parseMoney('abc', 2, 'USD'), 'invalid_input');
    });

    it('rejects more fractional digits than the asset supports', () => {
      expectCode(() => parseMoney('1.12345678', 7, 'USDC'), 'too-many-decimals');
      expectCode(() => parseMoney('.123', 2, 'USD'), 'too-many-decimals');
    });
  });
});
