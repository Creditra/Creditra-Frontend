import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCompactCurrency,
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
