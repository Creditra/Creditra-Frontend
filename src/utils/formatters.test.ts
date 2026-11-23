import { describe, expect, it } from 'vitest';
import {
  getDateTimeFormat,
  getNumberFormat,
  MAX_FORMATTER_CACHE_SIZE,
} from './formatters';

describe('getNumberFormat', () => {
  it('reuses the same instance for identical locale and options', () => {
    const a = getNumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
    const b = getNumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

    expect(a).toBe(b);
  });

  it('is order-insensitive for option keys', () => {
    const a = getNumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
    const b = getNumberFormat('en-US', {
      maximumFractionDigits: 2,
      currency: 'USD',
      style: 'currency',
    });

    expect(a).toBe(b);
  });

  it('returns different instances for different options or locales', () => {
    const usd0 = getNumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
    const usd2 = getNumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
    const deUsd0 = getNumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

    expect(usd0).not.toBe(usd2);
    expect(usd0).not.toBe(deUsd0);
  });

  it('produces identical formatted strings to direct Intl.NumberFormat', () => {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    };
    const cached = getNumberFormat('en-US', options);
    const direct = new Intl.NumberFormat('en-US', options);

    for (const value of [0, 42, 1234.5, -98765.432, 1_000_000]) {
      expect(cached.format(value)).toBe(direct.format(value));
    }
  });

  it('handles undefined options, locale fallback, and NaN input', () => {
    const defaultUndef = getNumberFormat(undefined, undefined);
    const defaultEmpty = getNumberFormat(undefined, {});
    expect(defaultUndef).toBe(defaultEmpty);
    expect(defaultUndef.format(1234.5)).toBe(new Intl.NumberFormat().format(1234.5));

    const fallbackList = getNumberFormat(['en-US', 'en']);
    expect(fallbackList.format(1234)).toBe(new Intl.NumberFormat(['en-US', 'en']).format(1234));

    const usd = getNumberFormat('en-US', { style: 'currency', currency: 'USD' });
    expect(usd.format(Number.NaN)).toBe(
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.NaN),
    );
  });

  it('bounds cache size by evicting the oldest entry', () => {
    const first = getNumberFormat('en-US', { minimumIntegerDigits: 1, useGrouping: false });

    for (let i = 0; i < MAX_FORMATTER_CACHE_SIZE + 5; i += 1) {
      getNumberFormat('en-US', {
        minimumFractionDigits: i % 20,
        maximumFractionDigits: 20,
        minimumIntegerDigits: Math.floor(i / 20) + 1,
      });
    }

    const firstAfterEviction = getNumberFormat('en-US', {
      minimumIntegerDigits: 1,
      useGrouping: false,
    });
    expect(firstAfterEviction).not.toBe(first);
  });
});

describe('getDateTimeFormat', () => {
  it('reuses the same instance for equal options regardless of key order', () => {
    const a = getDateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const b = getDateTimeFormat('en-US', {
      year: 'numeric',
      day: 'numeric',
      month: 'short',
    });

    expect(a).toBe(b);
  });

  it('returns different instances for different options', () => {
    const shortDate = getDateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    const longDate = getDateTimeFormat('en-US', { month: 'long', day: 'numeric' });

    expect(shortDate).not.toBe(longDate);
  });

  it('produces identical formatted strings to direct Intl.DateTimeFormat', () => {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    };
    const sample = new Date('2026-06-15T12:00:00Z');

    expect(getDateTimeFormat('en-US', options).format(sample)).toBe(
      new Intl.DateTimeFormat('en-US', options).format(sample),
    );
  });

  it('handles undefined options and locale fallback', () => {
    const a = getDateTimeFormat(undefined, undefined);
    const b = getDateTimeFormat(undefined, {});
    const sample = new Date('2026-06-15T12:00:00Z');

    expect(a).toBe(b);
    expect(a.format(sample)).toBe(new Intl.DateTimeFormat().format(sample));
  });
});
