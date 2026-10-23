import { describe, it, expect } from 'vitest';
import { suggestRepayAmount } from '../suggestRepay';

describe('suggestRepayAmount', () => {

  it('returns 0 when totalDue is 0', () => {
    expect(suggestRepayAmount(0, 100_000, 50_000, 8.5)).toBe(0);
  });

  it('returns 0 when walletBalance is 0', () => {
    expect(suggestRepayAmount(100_000, 200_000, 0, 8.5)).toBe(0);
  });

  it('returns 0 when totalDue is 0 and walletBalance is 0', () => {
    expect(suggestRepayAmount(0, 200_000, 0, 8.5)).toBe(0);
  });

  it('suggests enough to bring utilization to 50% when above 50%', () => {
    const result = suggestRepayAmount(150_000, 200_000, 80_000, 8.5);
    const expected = 150_000 - 100_000;
    expect(result).toBe(expected);
  });

  it('does not exceed wallet balance minus reserve', () => {
    const result = suggestRepayAmount(200_000, 250_000, 10_000, 8.5);
    const walletReserve = Math.min(10_000, Math.max(100, Math.round(10_000 * 0.1)));
    const maxAffordable = 10_000 - walletReserve;
    expect(result).toBeLessThanOrEqual(maxAffordable);
  });

  it('never exceeds totalDue', () => {
    const result = suggestRepayAmount(5_000, 200_000, 100_000, 8.5);
    expect(result).toBeLessThanOrEqual(5_000);
  });

  it('never exceeds walletBalance minus reserve', () => {
    const result = suggestRepayAmount(100_000, 200_000, 1_000, 8.5);
    const walletReserve = Math.min(1_000, Math.max(100, Math.round(1_000 * 0.1)));
    const maxAffordable = 1_000 - walletReserve;
    expect(result).toBeLessThanOrEqual(maxAffordable);
  });

  it('returns at least 1 when there is debt and wallet balance', () => {
    const result = suggestRepayAmount(100, 200_000, 100_000, 8.5);
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('uses nextPaymentAmount when utilization is at or below 50%', () => {
    const result = suggestRepayAmount(50_000, 200_000, 100_000, 8.5, 3_200);
    expect(result).toBeGreaterThanOrEqual(3_200);
  });

  it('returns monthly interest as floor when no nextPaymentAmount and utilization <= 50%', () => {
    const monthlyInterest = 50_000 * (8.5 / 100) / 12;
    const result = suggestRepayAmount(50_000, 200_000, 100_000, 8.5);
    expect(result).toBeGreaterThanOrEqual(Math.round(monthlyInterest * 100) / 100);
  });

  it('handles high APR correctly', () => {
    const result = suggestRepayAmount(100_000, 200_000, 80_000, 25);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(80_000);
  });

  it('returns suggested amount as a number with max 2 decimal places', () => {
    const result = suggestRepayAmount(100_000, 200_000, 50_000, 8.5);
    const decimalParts = result.toString().split('.');
    if (decimalParts.length > 1) {
      expect(decimalParts[1].length).toBeLessThanOrEqual(2);
    }
  });

  it('prefers target-util amount over nextPaymentAmount when utilization > 50%', () => {
    const result = suggestRepayAmount(120_000, 200_000, 100_000, 8.5, 500);
    const amountToTargetUtil = 120_000 - 100_000;
    expect(result).toBeGreaterThanOrEqual(amountToTargetUtil);
  });

  it('rounds the result to 2 decimal places', () => {
    const result = suggestRepayAmount(100_000, 200_000, 50_000, 8.5);
    expect(Number.isFinite(result)).toBe(true);
    expect(Math.round(result * 100) / 100).toBe(result);
  });
});
