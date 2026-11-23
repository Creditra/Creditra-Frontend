import { describe, expect, it } from 'vitest';
import {
  allocateBatchRepayment,
  allocateRepayment,
} from './repay-allocation';

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

describe('allocateBatchRepayment', () => {
  it('handles zero selected lines with full unallocated remainder', () => {
    const result = allocateBatchRepayment([], 500, {}, 'highest-apr');

    expect(result.items).toEqual([]);
    expect(result.allocations).toEqual({});
    expect(result.totalAllocated).toBe(0);
    expect(result.totalInterestPaid).toBe(0);
    expect(result.totalPrincipalPaid).toBe(0);
    expect(result.totalRemaining).toBe(0);
    expect(result.unallocatedRemainder).toBe(500);
  });

  it('matches allocateRepayment exactly when one line is selected', () => {
    const singleLine = { id: 'CL-1', utilized: 10_000, apr: 9 };
    const single = allocateRepayment(singleLine, 4_500.25, 75);
    const batch = allocateBatchRepayment(
      [singleLine],
      4_500.25,
      { 'CL-1': 75 },
      'highest-apr',
    );

    expect(batch.allocations['CL-1']).toEqual(single);
    expect(batch.unallocatedRemainder).toBe(0);
    expect(
      cents(batch.totalInterestPaid) + cents(batch.totalPrincipalPaid),
    ).toBe(cents(4_500.25));
  });

  it('allocates highest-apr first in integer cents', () => {
    const lines = [
      { id: 'CL-low', utilized: 1_000, apr: 6 },
      { id: 'CL-high', utilized: 1_000, apr: 18 },
      { id: 'CL-mid', utilized: 1_000, apr: 12 },
    ];
    const accrued = { 'CL-low': 10, 'CL-high': 20, 'CL-mid': 15 };

    const result = allocateBatchRepayment(lines, 1_500, accrued, 'highest-apr');

    // CL-high owes 1,020 -> paid in full; remaining 480 goes to CL-mid
    expect(result.allocations['CL-high'].interestPaid).toBe(20);
    expect(result.allocations['CL-high'].principalPaid).toBe(1_000);
    expect(result.allocations['CL-high'].isFullPayoff).toBe(true);

    expect(result.allocations['CL-mid'].interestPaid).toBe(15);
    expect(result.allocations['CL-mid'].principalPaid).toBe(465);
    expect(result.allocations['CL-mid'].remainingTotal).toBe(535);

    expect(result.allocations['CL-low'].interestPaid).toBe(0);
    expect(result.allocations['CL-low'].principalPaid).toBe(0);
    expect(result.allocations['CL-low'].remainingTotal).toBe(1_010);

    expect(result.unallocatedRemainder).toBe(0);
    expect(
      cents(result.totalInterestPaid) + cents(result.totalPrincipalPaid),
    ).toBe(cents(1_500));
  });

  it('handles cent rounding with three equal lines under pro-rata without losing a cent', () => {
    const lines = [
      { id: 'CL-1', utilized: 1_000, apr: 10 },
      { id: 'CL-2', utilized: 1_000, apr: 10 },
      { id: 'CL-3', utilized: 1_000, apr: 10 },
    ];

    const result = allocateBatchRepayment(lines, 100, {}, 'pro-rata');

    const allocatedAmounts = result.items.map((i) => i.allocatedAmount);
    expect(allocatedAmounts).toEqual([33.34, 33.33, 33.33]);
    expect(
      cents(result.totalInterestPaid) + cents(result.totalPrincipalPaid),
    ).toBe(cents(100));
    expect(result.unallocatedRemainder).toBe(0);
  });

  it('caps overpayment at total owed and reports unallocated remainder', () => {
    const lines = [
      { id: 'CL-1', utilized: 500, apr: 12 },
      { id: 'CL-2', utilized: 300, apr: 8 },
    ];
    const accrued = { 'CL-1': 10, 'CL-2': 5 }; // total owed = 815

    const result = allocateBatchRepayment(lines, 1_000, accrued, 'pro-rata');

    expect(result.totalAllocated).toBe(815);
    expect(result.totalRemaining).toBe(0);
    expect(result.unallocatedRemainder).toBe(185);
    expect(result.allocations['CL-1'].isFullPayoff).toBe(true);
    expect(result.allocations['CL-2'].isFullPayoff).toBe(true);
  });

  it('handles a line with zero balance alongside non-zero lines', () => {
    const lines = [
      { id: 'CL-zero', utilized: 0, apr: 25 },
      { id: 'CL-owed', utilized: 200, apr: 10 },
    ];

    const result = allocateBatchRepayment(
      lines,
      100,
      { 'CL-zero': 0, 'CL-owed': 5 },
      'highest-apr',
    );

    expect(result.allocations['CL-zero'].interestPaid).toBe(0);
    expect(result.allocations['CL-zero'].principalPaid).toBe(0);
    expect(result.allocations['CL-zero'].isFullPayoff).toBe(true);

    expect(result.allocations['CL-owed'].interestPaid).toBe(5);
    expect(result.allocations['CL-owed'].principalPaid).toBe(95);
    expect(result.allocations['CL-owed'].remainingTotal).toBe(105);
    expect(result.unallocatedRemainder).toBe(0);
  });
});
