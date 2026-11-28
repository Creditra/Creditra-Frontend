import { describe, expect, it } from 'vitest';
import {
  add,
  cmp,
  formatMiney,
  formatMineyCents,
  formatMoney,
  formatMoneyCents,
  formatMoneyCents_,
  formatMoney_,
  fromBaseUnits,
  MoneyError,
  mulRate,
  parseMoney,
  roundMoneyToCents,
  sub,
  toDisplayNumber,
  toLegacyNumber,
  type Money,
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

/**
 * Exact-arithmetic coverage. The sections above pin the parser and formatter
 * shapes; these pin arithmetic, rounding and the MoneyError code surface.
 * money.ts is intentionally untouched — any mismatch here is a bug to file.
 */
function mkMoney(units: bigint, decimals = 2, asset = 'USDC'): Money {
  return { units, decimals, asset };
}

describe('MoneyError', () => {
  it('carries a stable name and machine-readable code', () => {
    const error = new MoneyError('invalid_input', 'bad input');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('MoneyError');
    expect(error.code).toBe('invalid_input');
    expect(error.message).toBe('bad input');
  });

  it('is the error class thrown by the helpers', () => {
    expect(moneyErrorOf(() => parseMoney('abc', 2, 'USDC'))).toBeInstanceOf(
      MoneyError,
    );
  });
});

describe('fromBaseUnits validation', () => {
  it('accepts bigint, padded integer strings and negatives', () => {
    expect(fromBaseUnits(1_234_567n, 7, 'XLM')).toEqual({
      units: 1_234_567n,
      decimals: 7,
      asset: 'XLM',
    });
    expect(fromBaseUnits('  42  ', 0, 'USDC').units).toBe(42n);
    expect(fromBaseUnits('-987', 7, 'XLM').units).toBe(-987n);
    expect(fromBaseUnits('0', 2, 'USDC').units).toBe(0n);
  });

  it('rejects non-integer strings with invalid_base_units', () => {
    for (const input of ['12.3', 'abc', '', '   ', '+1', '1e3']) {
      expectCode(() => fromBaseUnits(input, 2, 'USDC'), 'invalid_base_units');
    }
  });

  it('rejects decimals outside 0..38 or non-integral', () => {
    for (const decimals of [-1, 39, 1.5]) {
      expectCode(() => fromBaseUnits(1n, decimals, 'USDC'), 'invalid_decimals');
    }
  });
});

describe('parseMoney code surface and decimal limits', () => {
  it('every documented parse error code is reachable', () => {
    expectCode(() => parseMoney('abc', 2, 'USDC'), 'invalid_input');
    expectCode(() => parseMoney('', 2, 'USDC'), 'empty_input');
    expectCode(() => parseMoney('1e3', 2, 'USDC'), 'exponent_notation');
    expectCode(() => parseMoney('+1', 2, 'USDC'), 'sign_not_allowed');
    expectCode(() => parseMoney('1.2.3', 2, 'USDC'), 'invalid_input');
    expectCode(() => parseMoney('1.234', 2, 'USDC'), 'too-many-decimals');
  });

  it('rejects a non-string input with invalid_input', () => {
    expectCode(
      () => parseMoney(123 as unknown as string, 2, 'USDC'),
      'invalid_input',
    );
  });

  it('supports zero-decimal assets and rejects fractions for them', () => {
    expect(parseMoney('42', 0, 'XLM')).toEqual({
      units: 42n,
      decimals: 0,
      asset: 'XLM',
    });
    expectCode(() => parseMoney('42.9', 0, 'XLM'), 'too-many-decimals');
  });

  it('supports exactly 38 decimals without float conversion', () => {
    const parsed = parseMoney(`1.${'0'.repeat(38)}`, 38, 'XLM');
    expect(parsed.units).toBe(10n ** 38n);
    expect(parsed.decimals).toBe(38);
    expectCode(() => parseMoney('1', 39, 'XLM'), 'invalid_decimals');
    expectCode(() => parseMoney('1', -1, 'XLM'), 'invalid_decimals');
    expectCode(() => parseMoney('1', 1.5, 'XLM'), 'invalid_decimals');
  });
});

describe('add / sub / cmp', () => {
  it('adds base units and preserves asset metadata', () => {
    expect(add(mkMoney(125n), mkMoney(275n))).toEqual({
      units: 400n,
      decimals: 2,
      asset: 'USDC',
    });
  });

  it('subtracts base units, including negative results', () => {
    expect(sub(mkMoney(275n), mkMoney(125n)).units).toBe(150n);
    expect(sub(mkMoney(125n), mkMoney(275n)).units).toBe(-150n);
  });

  it('compares base units', () => {
    expect(cmp(mkMoney(1n), mkMoney(2n))).toBe(-1);
    expect(cmp(mkMoney(2n), mkMoney(2n))).toBe(0);
    expect(cmp(mkMoney(3n), mkMoney(2n))).toBe(1);
  });

  it('throws asset_mismatch from all three helpers', () => {
    expectCode(
      () => add(mkMoney(1n, 2, 'USDC'), mkMoney(1n, 2, 'XLM')),
      'asset_mismatch',
    );
    expectCode(
      () => sub(mkMoney(1n, 2, 'USDC'), mkMoney(1n, 2, 'XLM')),
      'asset_mismatch',
    );
    expectCode(
      () => cmp(mkMoney(1n, 2, 'USDC'), mkMoney(1n, 2, 'XLM')),
      'asset_mismatch',
    );
  });

  it('throws decimals_mismatch from all three helpers', () => {
    expectCode(
      () => add(mkMoney(1n, 2), mkMoney(1n, 7)),
      'decimals_mismatch',
    );
    expectCode(
      () => sub(mkMoney(1n, 2), mkMoney(1n, 7)),
      'decimals_mismatch',
    );
    expectCode(
      () => cmp(mkMoney(1n, 2), mkMoney(1n, 7)),
      'decimals_mismatch',
    );
  });
});

describe('mulRate', () => {
  it('applies bps exactly and preserves asset metadata', () => {
    expect(mulRate(mkMoney(12_345n), 250)).toEqual({
      units: 309n, // 12345 * 250 / 10000 = 308.625 -> 309
      decimals: 2,
      asset: 'USDC',
    });
    expect(mulRate(mkMoney(10_000n, 7, 'XLM'), 1_000)).toEqual({
      units: 1_000n,
      decimals: 7,
      asset: 'XLM',
    });
    expect(mulRate(mkMoney(100n), 0).units).toBe(0n);
  });

  it('rounds exact .5 up for positive values', () => {
    expect(mulRate(mkMoney(1n), 5_000).units).toBe(1n); // 0.5 -> 1
    expect(mulRate(mkMoney(3n), 5_000).units).toBe(2n); // 1.5 -> 2
    expect(mulRate(mkMoney(1n), 5_001).units).toBe(1n);
  });

  it('rounds just below .5 down for positive values', () => {
    expect(mulRate(mkMoney(1n), 4_999).units).toBe(0n);
    expect(mulRate(mkMoney(3n), 4_999).units).toBe(1n);
  });

  it('rounds exact .5 away from zero for negative values', () => {
    expect(mulRate(mkMoney(-1n), 5_000).units).toBe(-1n); // -0.5 -> -1
    expect(mulRate(mkMoney(-3n), 5_000).units).toBe(-2n); // -1.5 -> -2
    expect(mulRate(mkMoney(-1n), 5_001).units).toBe(-1n);
  });

  it('rounds just below .5 toward zero for negative values', () => {
    expect(mulRate(mkMoney(-1n), 4_999).units).toBe(0n);
    expect(mulRate(mkMoney(-3n), 4_999).units).toBe(-1n);
  });

  it('rejects non-integer bps with invalid_input', () => {
    for (const bps of [1.5, NaN, Infinity]) {
      expectCode(() => mulRate(mkMoney(100n), bps), 'invalid_input');
    }
  });
});

describe('toDisplayNumber', () => {
  it('converts base units to a display number', () => {
    expect(toDisplayNumber(mkMoney(123n))).toBe(1.23);
    expect(toDisplayNumber(mkMoney(-123n))).toBe(-1.23);
    expect(toDisplayNumber(mkMoney(42n, 0, 'XLM'))).toBe(42);
  });

  it('pins the documented display-only precision limit above 2^53', () => {
    const exact = 9_007_199_254_740_993n;
    expect(BigInt(toDisplayNumber(mkMoney(exact, 0)))).not.toBe(exact);
  });

  it('fails for malformed decimals rather than silently coercing them', () => {
    expect(() => toDisplayNumber(mkMoney(1n, -1))).toThrow(RangeError);
  });
});

describe('toLegacyNumber', () => {
  it('matches toDisplayNumber for legacy consumers', () => {
    expect(toLegacyNumber(mkMoney(123n))).toBe(1.23);
    expect(toLegacyNumber(mkMoney(-123n))).toBe(-1.23);
  });

  it('inherits the display-only precision limit', () => {
    const exact = 9_007_199_254_740_993n;
    expect(BigInt(toLegacyNumber(mkMoney(exact, 0)))).not.toBe(exact);
  });

  it('fails for malformed decimals', () => {
    expect(() => toLegacyNumber(mkMoney(1n, -1))).toThrow(RangeError);
  });
});

describe('roundMoneyToCents', () => {
  it('rounds exact .005 half-up away from zero', () => {
    expect(roundMoneyToCents(mkMoney(50n, 4))).toEqual({
      units: 1n,
      decimals: 2,
      asset: 'USDC',
    });
    expect(roundMoneyToCents(mkMoney(5n, 3)).units).toBe(1n);
    expect(roundMoneyToCents(mkMoney(-5n, 3)).units).toBe(-1n);
    expect(roundMoneyToCents(mkMoney(150n, 4)).units).toBe(2n);
  });

  it('rounds .0049 down and negative .005 away from zero', () => {
    expect(roundMoneyToCents(mkMoney(49n, 4)).units).toBe(0n);
    expect(roundMoneyToCents(mkMoney(-49n, 4)).units).toBe(0n);
    expect(roundMoneyToCents(mkMoney(-50n, 4)).units).toBe(-1n);
  });

  it('scales up assets with at most two decimals', () => {
    expect(roundMoneyToCents(mkMoney(5n, 0, 'XLM'))).toEqual({
      units: 500n,
      decimals: 2,
      asset: 'XLM',
    });
    expect(roundMoneyToCents(mkMoney(5n, 1)).units).toBe(50n);
    expect(roundMoneyToCents(mkMoney(5n, 2)).units).toBe(5n);
    expect(roundMoneyToCents(mkMoney(-5n, 0)).units).toBe(-500n);
  });

  it('fails for malformed decimals instead of guessing a scale', () => {
    expect(() => roundMoneyToCents(mkMoney(5n, NaN))).toThrow(RangeError);
  });
});

describe('formatMoneyCents rounding and failures', () => {
  it('formats rounded cents as a fixed two-decimal string', () => {
    expect(formatMoneyCents(mkMoney(50n, 4))).toBe('0.01');
    expect(formatMoneyCents(mkMoney(49n, 4))).toBe('0.00');
    expect(formatMoneyCents(mkMoney(-50n, 4))).toBe('-0.01');
    expect(formatMoneyCents(mkMoney(5n, 0, 'XLM'))).toBe('5.00');
  });

  it('uses locale grouping for cents', () => {
    expect(formatMoneyCents(mkMoney(123_456n, 2), 'en-US')).toBe('1,234.56');
  });

  it('rejects an invalid locale', () => {
    expect(() => formatMoneyCents(mkMoney(50n, 4), 'not a locale!')).toThrow(
      RangeError,
    );
  });
});

describe('formatting failure paths and underscore aliases', () => {
  it('formatMoney and formatMiney reject an invalid locale', () => {
    expect(() => formatMoney(mkMoney(123n), 'not a locale!')).toThrow(
      RangeError,
    );
    expect(() => formatMiney(mkMoney(123n), 'not a locale!')).toThrow(
      RangeError,
    );
  });

  it('underscore aliases stay identical to their current spelling', () => {
    expect(formatMoney_).toBe(formatMoney);
    expect(formatMoneyCents_).toBe(formatMoneyCents);
    expect(formatMoney_(mkMoney(-123n))).toBe('-1.23');
    expect(formatMoneyCents_(mkMoney(-50n, 4))).toBe('-0.01');
  });

  it('underscore aliases share the invalid-locale failure', () => {
    expect(() => formatMoney_(mkMoney(123n), 'not a locale!')).toThrow(
      RangeError,
    );
    expect(() =>
      formatMoneyCents_(mkMoney(50n, 4), 'not a locale!'),
    ).toThrow(RangeError);
  });
});
