import { describe, expect, it } from 'vitest';
import { allocateRepayment } from './repay-allocation';

const line = { utilized: 10_000 };

const cents = (value: number) => Math.round(value * 100);

describe('allocateRepayment', () => {
  it('scenario 1: exact payoff clears interest and principal', () => {
    const result = allocateRepayment(line, 10_075, 75);

    expect(result.interestPaid).toBe(75);
    expect(result.principalPaid).toBe(10_000);
    expect(result.remainingInterest).toBe(0);
    expect(result.remainingPrincipal).toBe(0);
    expect(result.remainingTotal).toBe(0);
    expect(result.isFullPayoff).toBe(true);
  });

  it('scenario 2: paying principal still leaves accrued interest', () => {
    const result = allocateRepayment(line, 10_000, 75);

    expect(result.interestPaid).toBe(75);
    expect(result.principalPaid).toBe(9_925);
    expect(result.remainingInterest).toBe(0);
    expect(result.remainingPrincipal).toBe(75);
    expect(result.remainingTotal).toBe(75);
    expect(result.isFullPayoff).toBe(false);
  });

  it('scenario 3: a payment below accrued interest only pays interest', () => {
    const result = allocateRepayment(line, 50, 75);

    expect(result.interestPaid).toBe(50);
    expect(result.principalPaid).toBe(0);
    expect(result.remainingInterest).toBe(25);
    expect(result.remainingPrincipal).toBe(10_000);
    expect(result.remainingTotal).toBe(10_025);
    expect(result.isFullPayoff).toBe(false);
  });

  it('scenario 4: an overpayment is fully allocated but only clears the debt', () => {
    const result = allocateRepayment(line, 10_076, 75);

    expect(result.interestPaid).toBe(75);
    expect(result.principalPaid).toBe(10_001);
    expect(result.remainingTotal).toBe(0);
    expect(result.isFullPayoff).toBe(true);
  });

  it('is cents-exact for fractional amounts', () => {
    const result = allocateRepayment({ utilized: 10.01 }, 5.555, 0.555);

    expect(cents(result.interestPaid) + cents(result.principalPaid)).toBe(
      cents(5.555),
    );
    expect(result.remainingTotal).toBe(5.01);
  });

  it('scenario 7: invariant and non-negative remainder hold across ranges', () => {
    const principals = [0, 1, 10, 10_000, 187_500.25];
    const interests = [0, 0.01, 0.75, 75, 1_328.4];
    const amounts = [0, 0.01, 1, 50, 10_000, 10_075, 200_000];

    for (const principal of principals) {
      for (const interest of interests) {
        for (const amount of amounts) {
          const result = allocateRepayment({ utilized: principal }, amount, interest);

          expect(
            cents(result.interestPaid) + cents(result.principalPaid),
          ).toBe(cents(amount));
          expect(result.remainingTotal).toBeGreaterThanOrEqual(0);
          expect(result.remainingInterest).toBeGreaterThanOrEqual(0);
          expect(result.remainingPrincipal).toBeGreaterThanOrEqual(0);
          expect(result.isFullPayoff).toBe(result.remainingTotal === 0);
        }
      }
    }
  });

  it('scenario 8: isFullPayoff is false whenever any balance remains', () => {
    const partial = allocateRepayment(line, 10_000, 75);
    const full = allocateRepayment(line, 10_075, 75);

    expect(partial.isFullPayoff).toBe(false);
    expect(full.isFullPayoff).toBe(true);
  });
});
