import { describe, it, expect } from 'vitest';
import { suggestRepayAmount, type SuggestRepayParams } from '../suggestRepay';

describe('suggestRepayAmount', () => {
  const BASE: SuggestRepayParams = {
    totalDue: 100_000,
    limit: 200_000,
    walletBalance: 50_000,
    apr: 8.5,
  };

  it('disables a suggestion when an $80 wallet cannot cover the $3,200 minimum', () => {
    expect(suggestRepayAmount({
      ...BASE, totalDue: 3_200, walletBalance: 80, nextPaymentAmount: 3_200,
    })).toEqual({ amount: 0, reason: 'insufficient_for_minimum' });
  });

  it('regression: pays the $3,200 minimum from $3,300, rather than the old $2,970 cap', () => {
    expect(suggestRepayAmount({
      ...BASE, totalDue: 3_200, walletBalance: 3_300, nextPaymentAmount: 3_200,
    })).toEqual({ amount: 3_200, reason: 'minimum_due' });
  });

  it('targets 50% utilization when the wallet is ample', () => {
    expect(suggestRepayAmount({
      ...BASE, totalDue: 150_000, walletBalance: 80_000, nextPaymentAmount: 3_200,
    })).toEqual({ amount: 50_000, reason: 'target_utilization' });
  });

  it('explains when nothing is due, including when the wallet is also empty', () => {
    for (const walletBalance of [0, 50_000]) {
      expect(suggestRepayAmount({ ...BASE, totalDue: 0, walletBalance }))
        .toEqual({ amount: 0, reason: 'nothing_due' });
    }
  });

  it('explains an empty wallet', () => {
    expect(suggestRepayAmount({ ...BASE, walletBalance: 0 }))
      .toEqual({ amount: 0, reason: 'empty_wallet' });
  });

  it('uses the minimum due even when it exceeds the utilization target', () => {
    expect(suggestRepayAmount({
      ...BASE, totalDue: 120_000, walletBalance: 80_000, nextPaymentAmount: 25_000,
    })).toEqual({ amount: 25_000, reason: 'minimum_due' });
  });

  it('uses the entire wallet when it exactly covers the minimum', () => {
    expect(suggestRepayAmount({ ...BASE, walletBalance: 3_200, nextPaymentAmount: 3_200 }))
      .toEqual({ amount: 3_200, reason: 'minimum_due' });
  });

  it('allows a small wallet to use its reserve for an affordable minimum', () => {
    expect(suggestRepayAmount({ ...BASE, walletBalance: 80, nextPaymentAmount: 50 }))
      .toEqual({ amount: 50, reason: 'minimum_due' });
  });

  it('keeps a reserve when capping a larger utilization payment', () => {
    expect(suggestRepayAmount({
      ...BASE, totalDue: 150_000, walletBalance: 10_000, nextPaymentAmount: 3_200,
    })).toEqual({ amount: 9_000, reason: 'capped_by_wallet' });
  });

  it('uses estimated monthly interest when no scheduled payment is provided', () => {
    expect(suggestRepayAmount({ ...BASE, totalDue: 10_000, apr: 7.5 }))
      .toEqual({ amount: 62.5, reason: 'interest_only' });
  });

  it('keeps the $1 fallback and caps it by the outstanding debt', () => {
    expect(suggestRepayAmount({ ...BASE, totalDue: 100, apr: 0 }))
      .toEqual({ amount: 1, reason: 'interest_only' });
    expect(suggestRepayAmount({ ...BASE, totalDue: 0.75, apr: 0 }))
      .toEqual({ amount: 0.75, reason: 'interest_only' });
  });

  it('does not exceed the debt when the scheduled minimum exceeds it', () => {
    expect(suggestRepayAmount({ ...BASE, totalDue: 50, walletBalance: 80, nextPaymentAmount: 100 }))
      .toEqual({ amount: 50, reason: 'minimum_due' });
  });

  it('keeps cents at the affordable-minimum boundary', () => {
    expect(suggestRepayAmount({ ...BASE, walletBalance: 80.01, nextPaymentAmount: 80.01 }))
      .toEqual({ amount: 80.01, reason: 'minimum_due' });
    expect(suggestRepayAmount({ ...BASE, walletBalance: 80, nextPaymentAmount: 80.01 }))
      .toEqual({ amount: 0, reason: 'insufficient_for_minimum' });
  });

  it('honors an explicit zero scheduled payment below the utilization target', () => {
    expect(suggestRepayAmount({ ...BASE, nextPaymentAmount: 0 }))
      .toEqual({ amount: 0, reason: 'nothing_due' });
  });

  it('does not round fractional balances up past the debt or wallet', () => {
    expect(suggestRepayAmount({ ...BASE, totalDue: 80.009, nextPaymentAmount: 100 }))
      .toEqual({ amount: 80, reason: 'minimum_due' });
    expect(suggestRepayAmount({ ...BASE, walletBalance: 80.009, nextPaymentAmount: 80.01 }))
      .toEqual({ amount: 0, reason: 'insufficient_for_minimum' });
  });

  it('keeps the result finite for very large finite balances', () => {
    const { amount } = suggestRepayAmount({
      ...BASE, totalDue: Number.MAX_VALUE, walletBalance: Number.MAX_VALUE, limit: 0,
    });
    expect(Number.isFinite(amount)).toBe(true);
    expect(amount).toBeGreaterThanOrEqual(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('handles invalid balances (%s) without NaN', (value) => {
    expect(suggestRepayAmount({ ...BASE, totalDue: value }))
      .toEqual({ amount: 0, reason: 'nothing_due' });
    expect(suggestRepayAmount({ ...BASE, walletBalance: value }))
      .toEqual({ amount: 0, reason: 'empty_wallet' });
  });

  it('preserves bounds, affordable minimums, and whole cents across generated currency inputs', () => {
    // Fixed seed makes property failures reproducible without adding a dependency.
    let seed = 1186;
    const nextCents = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % 20_000_001;
    };
    for (let i = 0; i < 1_000; i++) {
      const totalDue = nextCents() / 100;
      const walletBalance = nextCents() / 100;
      const nextPaymentAmount = nextCents() / 100;
      const { amount } = suggestRepayAmount({
        totalDue, walletBalance, nextPaymentAmount, limit: nextCents() / 100, apr: 8.5,
      });
      expect(Number.isFinite(amount)).toBe(true);
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(Math.min(totalDue, walletBalance));
      expect(amount).toBe(Math.round(amount * 100) / 100);
      const minimum = Math.min(totalDue, nextPaymentAmount);
      if (walletBalance >= minimum) expect(amount).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('never decreases as the wallet grows, including reserve-rounding and minimum boundaries', () => {
    for (const minimum of [0, 50, 1_000.05]) {
      let previous = 0;
      for (let cents = 99_940; cents <= 100_110; cents++) {
        const { amount } = suggestRepayAmount({
          ...BASE, totalDue: 150_000, walletBalance: cents / 100, nextPaymentAmount: minimum,
        });
        expect(amount).toBeGreaterThanOrEqual(previous);
        previous = amount;
      }
    }
  });
});
