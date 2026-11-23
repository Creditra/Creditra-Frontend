import { describe, expect, it } from 'vitest';
import {
  formatMiney,
  formatMineyCents,
  formatMoney,
  formatMoneyCents,
  fromBaseUnits,
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
