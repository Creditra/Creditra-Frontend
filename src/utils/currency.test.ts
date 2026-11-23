import { describe, it, expect, vi } from 'vitest';
import {
  formatCurrency,
  formatCompactCurrency,
  formatUsd,
  roundToCents,
  computeMonthlyAccruedInterest,
  computeFullPayoffAmount,
  formatAmountInputValue,
} from './currency';

describe('formatCurrency', () => {
  it('formats a whole-dollar amount in USD by default', () => {
    expect(formatCurrency(1234)).toBe('$1,234.00');
  });

  it('respects an explicit currency code', () => {
    const result = formatCurrency(1234, 'EUR', 'en-US');
    expect(result).toMatch(/€/);
    expect(result).toContain('1,234');
  });

  it('formats zero as $0.00', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('accepts lower-case currency codes', () => {
    expect(formatCurrency(1234, 'usd', 'en-US')).toBe('$1,234.00');
  });

  it('normalizes underscore locales such as en_US', () => {
    expect(formatCurrency(1234, 'USD', 'en_US')).toBe('$1,234.00');
  });

  it('falls back cleanly on invalid locales and currencies without throwing or logging', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => formatCurrency(1234, 'USD', 'xx-INVALID')).not.toThrow();
      expect(formatCurrency(1234, 'USD', 'xx-INVALID')).toBe('$1,234.00');

      expect(() => formatCurrency(1234, 'USD', '')).not.toThrow();
      expect(formatCurrency(1234, 'USD', '')).toBe('$1,234.00');

      expect(() => formatCurrency(1234, 'US', 'en-US')).not.toThrow();
      expect(formatCurrency(1234, 'US', 'en-US')).toBe('$1,234.00');

      expect(() => formatCurrency(1234, 'XXXX', 'en-US')).not.toThrow();
      expect(formatCurrency(1234, 'XXXX', 'en-US')).toBe('$1,234.00');

      expect(() => formatCurrency(1234, '', 'en-US')).not.toThrow();
      expect(formatCurrency(1234, '', 'en-US')).toBe('$1,234.00');

      // Loosely typed callers passing null/undefined
      expect(
        formatCurrency(
          1234,
          null as unknown as string,
          null as unknown as string,
        ),
      ).toBe('$1,234.00');
      expect(
        formatCurrency(
          1234,
          undefined as unknown as string,
          undefined as unknown as string,
        ),
      ).toBe('$1,234.00');

      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('returns placeholder for non-finite amounts', () => {
    expect(formatCurrency(Number.NaN)).toBe('—');
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatCurrency(Number.NEGATIVE_INFINITY)).toBe('—');
  });
});

describe('formatCompactCurrency', () => {
  it('produces a short representation for thousands', () => {
    const result = formatCompactCurrency(1200);
    // Locales differ in exactly how compact units are rendered, but the
    // string must be shorter than the long form.
    expect(result.length).toBeLessThan(formatCurrency(1200).length);
    expect(result).toMatch(/K/i);
  });

  it('produces a short representation for millions', () => {
    const result = formatCompactCurrency(3_400_000);
    expect(result).toMatch(/M/i);
  });

  it('falls back cleanly on invalid locales, currencies, and non-finite amounts', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(formatCompactCurrency(1200, 'usd', 'en_US')).toMatch(/K/i);
      expect(formatCompactCurrency(1200, 'US', 'xx-INVALID')).toMatch(/K/i);
      expect(formatCompactCurrency(1200, 'XXXX', '')).toMatch(/K/i);
      expect(
        formatCompactCurrency(
          1200,
          null as unknown as string,
          null as unknown as string,
        ),
      ).toMatch(/K/i);
      expect(formatCompactCurrency(Number.NaN)).toBe('—');
      expect(formatCompactCurrency(Number.POSITIVE_INFINITY)).toBe('—');

      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

describe('roundToCents', () => {
  it('rounds to two decimal places', () => {
    expect(roundToCents(10.005)).toBe(10.01);
    expect(roundToCents(10.004)).toBe(10);
  });
});

describe('computeMonthlyAccruedInterest', () => {
  it('returns zero for non-positive principal or APR', () => {
    expect(computeMonthlyAccruedInterest(0, 12)).toBe(0);
    expect(computeMonthlyAccruedInterest(1000, 0)).toBe(0);
  });

  it('computes monthly interest from principal and APR', () => {
    expect(computeMonthlyAccruedInterest(3000, 12)).toBe(30);
  });
});

describe('computeFullPayoffAmount', () => {
  const line = { utilized: 3000, apr: 12, nextInterestAccrualDate: '2025-02-01' };
  it('sums principal and day-count accrued interest', () => {
    expect(computeFullPayoffAmount(line, new Date('2025-02-16T00:00:00Z'))).toBe(3014.79);
  });

  it('returns zero when principal is zero', () => {
    expect(computeFullPayoffAmount({ ...line, utilized: 0 }, new Date('2025-02-16T00:00:00Z'))).toBe(0);
  });
});

describe('formatAmountInputValue', () => {
  it('formats with two fixed decimals', () => {
    expect(formatAmountInputValue(3030)).toBe('3030.00');
    expect(formatAmountInputValue(10.5)).toBe('10.50');
  });
});

describe('formatUsd', () => {
  it('formats with 2 decimals by default', () => {
    expect(formatUsd(1234)).toBe('$1,234.00');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('formats with 0 decimals when requested', () => {
    expect(formatUsd(1234.56, { decimals: 0 })).toBe('$1,235');
    expect(formatUsd(0, { decimals: 0 })).toBe('$0');
  });

  it('formats negative values', () => {
    expect(formatUsd(-42.5, { decimals: 2 })).toBe('-$42.50');
    expect(formatUsd(-42.5, { decimals: 0 })).toBe('-$43');
  });

  it('formats large values with grouping separators', () => {
    expect(formatUsd(12_345_678.9, { decimals: 2 })).toBe('$12,345,678.90');
    expect(formatUsd(12_345_678.9, { decimals: 0 })).toBe('$12,345,679');
  });

  it('returns placeholder for non-finite numbers', () => {
    expect(formatUsd(Number.NaN)).toBe('—');
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
