import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAccruedInterest,
  getAccruedInterestDays,
  resetInterestWarnings,
} from './interest';

const line = (date: string) => ({
  utilized: 10_000,
  apr: 9.125,
  transactions: [{ type: 'Interest', date }],
});

describe('getAccruedInterest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetInterestWarnings();
  });

  it('returns zero for zero elapsed days', () => {
    expect(getAccruedInterest(line('2025-01-01'), new Date('2025-01-01T23:00:00Z'))).toBe(0);
  });

  it('accrues 2.50 for one ACT/365 day', () => {
    expect(getAccruedInterest(line('2025-01-01'), new Date('2025-01-02T00:00:00Z'))).toBe(2.5);
  });

  it('accrues 77.50 for 31 days', () => {
    expect(getAccruedInterest(line('2025-01-01'), new Date('2025-02-01T00:00:00Z'))).toBe(77.5);
  });

  it('clamps negative elapsed days caused by clock skew to zero', () => {
    expect(getAccruedInterest(line('2025-01-02'), new Date('2025-01-01T00:00:00Z'))).toBe(0);
  });

  it('uses the flat-month fallback and warns when accrual dates are missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(getAccruedInterest({ utilized: 10_000, apr: 9.125 }, new Date('2025-02-01'))).toBe(76.04);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('supports ACT/360', () => {
    expect(getAccruedInterest(line('2025-01-01'), new Date('2025-01-02T00:00:00Z'), { dayCount: 'ACT/360' })).toBe(2.53);
  });

  it('derives the period start from the next scheduled accrual date', () => {
    expect(getAccruedInterest(
      { utilized: 10_000, apr: 9.125, nextInterestAccrualDate: '2025-02-01' },
      new Date('2025-01-02T00:00:00Z'),
    )).toBe(2.5);
  });

  it('uses the latest interest ledger date and agrees across payoff callers', () => {
    const sameLine = {
      utilized: 10_000,
      apr: 9.125,
      nextInterestAccrualDate: '2025-03-01',
      transactions: [
        { type: 'Interest', date: '2025-01-01' },
        { type: 'Interest', date: '2025-01-15' },
      ],
    };
    const now = new Date('2025-02-15T00:00:00Z');
    expect(getAccruedInterest(sameLine, now)).toBe(77.5);
    expect(getAccruedInterestDays(sameLine, now)).toBe(31);
  });

  it('regression: no accrual data returns the former full-month amount of 76.04', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(getAccruedInterest({ utilized: 10_000, apr: 9.125 }, new Date('2025-02-01'))).toBe(76.04);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns only once per credit line across repeated calls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const lineWithoutAccrual = { id: 'cl-repeat', utilized: 10_000, apr: 9.125 };
    const now = new Date('2025-02-01');

    expect(getAccruedInterest(lineWithoutAccrual, now)).toBe(76.04);
    expect(getAccruedInterest(lineWithoutAccrual, now)).toBe(76.04);
    expect(getAccruedInterest(lineWithoutAccrual, now)).toBe(76.04);

    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns separately for different credit line ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const now = new Date('2025-02-01');

    getAccruedInterest({ id: 'cl-a', utilized: 10_000, apr: 9.125 }, now);
    getAccruedInterest({ id: 'cl-b', utilized: 10_000, apr: 9.125 }, now);

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('uses a fixed unknown key when the line has no id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const now = new Date('2025-02-01');

    getAccruedInterest({ utilized: 10_000, apr: 9.125 }, now);
    getAccruedInterest({ utilized: 5_000, apr: 4 }, now);

    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns again for the same id after resetInterestWarnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const lineWithoutAccrual = { id: 'cl-reset', utilized: 10_000, apr: 9.125 };
    const now = new Date('2025-02-01');

    getAccruedInterest(lineWithoutAccrual, now);
    resetInterestWarnings();
    getAccruedInterest(lineWithoutAccrual, now);

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not warn for lines with a known accrual date', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const lineWithAccrual = {
      id: 'cl-known',
      utilized: 10_000,
      apr: 9.125,
      transactions: [{ type: 'Interest', date: '2025-01-01' }],
    };

    getAccruedInterest(lineWithAccrual, new Date('2025-01-02T00:00:00Z'));
    getAccruedInterest(lineWithAccrual, new Date('2025-01-02T00:00:00Z'));

    expect(warn).not.toHaveBeenCalled();
  });
});
