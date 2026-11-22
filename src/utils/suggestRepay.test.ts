import { describe, it, expect } from 'vitest';
import {
  optimiseRepayment,
  type OptimiseRepaymentLine,
} from './suggestRepay';

const toCents = (n: number) => Math.round(n * 100);

describe('optimiseRepayment', () => {
  const sampleLines: OptimiseRepaymentLine[] = [
    { id: 'L-high-apr', name: 'High APR Line', balance: 2000, apr: 24, status: 'Active' },
    { id: 'L-small-bal', name: 'Small Balance Line', balance: 500, apr: 8, status: 'Active' },
    { id: 'L-mid', name: 'Mid Line', balance: 1500, apr: 15, status: 'Active' },
  ];

  it('allocates highest APR first under avalanche and saves interest vs pro-rata', () => {
    const plan = optimiseRepayment(sampleLines, 2500, 'avalanche');

    expect(plan.strategy).toBe('avalanche');
    expect(plan.totalAllocated).toBe(2500);
    expect(plan.unallocatedBudget).toBe(0);
    expect(plan.allocations.map((a) => a.lineId)).toEqual([
      'L-high-apr',
      'L-mid',
      'L-small-bal',
    ]);
    expect(plan.allocations.map((a) => a.amount)).toEqual([2000, 500, 0]);
    expect(plan.allocations[0].isFullPayoff).toBe(true);
    expect(plan.projectedAnnualInterestSaved).toBeGreaterThan(0);
    expect(plan.projectedMonthlyInterestSaved).toBeGreaterThan(0);
    expect(plan.rationale).toMatch(/avalanche/i);
  });

  it('allocates smallest balance first under snowball and differs from avalanche', () => {
    const avalanche = optimiseRepayment(sampleLines, 2500, 'avalanche');
    const snowball = optimiseRepayment(sampleLines, 2500, 'snowball');

    expect(snowball.allocations.map((a) => a.lineId)).toEqual([
      'L-small-bal',
      'L-mid',
      'L-high-apr',
    ]);
    expect(snowball.allocations.map((a) => a.amount)).toEqual([500, 1500, 500]);
    expect(snowball.allocations[0].isFullPayoff).toBe(true);
    expect(snowball.allocations[1].isFullPayoff).toBe(true);
    expect(snowball.allocations[0].lineId).not.toBe(avalanche.allocations[0].lineId);
    expect(snowball.totalAllocated).toBe(2500);
    expect(snowball.rationale).toMatch(/snowball/i);
  });

  it('breaks equal APR ties by smallest balance then id', () => {
    const tiedAprLines: OptimiseRepaymentLine[] = [
      { id: 'L-b', name: 'Line B', balance: 1000, apr: 18 },
      { id: 'L-a', name: 'Line A', balance: 400, apr: 18 },
      { id: 'L-c', name: 'Line C', balance: 400, apr: 18 },
    ];

    const plan = optimiseRepayment(tiedAprLines, 600, 'avalanche');

    expect(plan.allocations.map((a) => a.lineId)).toEqual(['L-a', 'L-c', 'L-b']);
    expect(plan.allocations.map((a) => a.amount)).toEqual([400, 200, 0]);
    expect(plan.totalAllocated).toBe(600);
    expect(plan.projectedAnnualInterestSaved).toBe(0);
  });

  it('handles zero budget cleanly', () => {
    const plan = optimiseRepayment(sampleLines, 0, 'avalanche');

    expect(plan.totalAllocated).toBe(0);
    expect(plan.unallocatedBudget).toBe(0);
    expect(plan.allocations.every((a) => a.amount === 0)).toBe(true);
    expect(plan.projectedAnnualInterestSaved).toBe(0);
    expect(plan.rationale).toMatch(/positive budget/i);
  });

  it('handles a single credit line', () => {
    const single: OptimiseRepaymentLine[] = [
      { id: 'L-1', name: 'Only Line', balance: 1234.56, apr: 12 },
    ];
    const plan = optimiseRepayment(single, 500, 'avalanche');

    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0].amount).toBe(500);
    expect(plan.allocations[0].remainingBalance).toBe(734.56);
    expect(plan.totalAllocated).toBe(500);
    expect(plan.projectedAnnualInterestSaved).toBe(0);
  });

  it('caps total allocation at total debt when budget exceeds debt', () => {
    const plan = optimiseRepayment(sampleLines, 10_000, 'avalanche');

    expect(plan.totalDebt).toBe(4000);
    expect(plan.totalAllocated).toBe(4000);
    expect(plan.unallocatedBudget).toBe(6000);
    expect(plan.allocations.every((a) => a.isFullPayoff)).toBe(true);
    expect(plan.allocations.reduce((s, a) => s + toCents(a.amount), 0)).toBe(
      toCents(plan.totalDebt),
    );
    expect(plan.rationale).toMatch(/remaining/i);
  });

  it('preserves exact cent sum with rounding remainders and odd amounts', () => {
    const oddLines: OptimiseRepaymentLine[] = [
      { id: 'L-1', name: 'Line 1', balance: 33.33, apr: 19.99 },
      { id: 'L-2', name: 'Line 2', balance: 33.33, apr: 14.5 },
      { id: 'L-3', name: 'Line 3', balance: 33.34, apr: 9.25 },
    ];
    const budget = 50.01;
    const plan = optimiseRepayment(oddLines, budget, 'avalanche');

    const sumCents = plan.allocations.reduce((s, a) => s + toCents(a.amount), 0);
    expect(sumCents).toBe(toCents(Math.min(budget, plan.totalDebt)));
    expect(plan.allocations[0].amount).toBe(33.33);
    expect(plan.allocations[1].amount).toBe(16.68);
    expect(plan.allocations[2].amount).toBe(0);
  });

  it('funds minimum payments before waterfalling extra budget', () => {
    const linesWithMins: OptimiseRepaymentLine[] = [
      { id: 'L-high', name: 'High APR', balance: 1000, apr: 22, minimumPayment: 100 },
      { id: 'L-low', name: 'Low APR', balance: 1000, apr: 8, minimumPayment: 150 },
    ];

    const plan = optimiseRepayment(linesWithMins, 500, 'avalanche');

    expect(plan.allocations[0].lineId).toBe('L-high');
    expect(plan.allocations[0].minimumApplied).toBe(100);
    expect(plan.allocations[0].extraApplied).toBe(250);
    expect(plan.allocations[0].amount).toBe(350);

    expect(plan.allocations[1].lineId).toBe('L-low');
    expect(plan.allocations[1].minimumApplied).toBe(150);
    expect(plan.allocations[1].extraApplied).toBe(0);
    expect(plan.allocations[1].amount).toBe(150);
    expect(plan.totalAllocated).toBe(500);
  });

  it('excludes Closed, Frozen, and zero-balance lines', () => {
    const mixedLines: OptimiseRepaymentLine[] = [
      { id: 'L-active', name: 'Active', balance: 500, apr: 12, status: 'Active' },
      { id: 'L-closed', name: 'Closed', balance: 800, apr: 25, status: 'Closed' },
      { id: 'L-frozen', name: 'Frozen', balance: 600, apr: 20, status: 'Frozen' },
      { id: 'L-zero', name: 'Zero', balance: 0, apr: 18, status: 'Active' },
    ];

    const plan = optimiseRepayment(mixedLines, 1000, 'avalanche');

    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0].lineId).toBe('L-active');
    expect(plan.allocations[0].amount).toBe(500);
    expect(plan.excludedLineIds).toEqual(['L-closed', 'L-frozen', 'L-zero']);
    expect(plan.totalAllocated).toBe(500);
    expect(plan.unallocatedBudget).toBe(500);
  });
});
