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
