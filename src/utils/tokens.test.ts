import { describe, it, expect } from 'vitest';
import {
  getUtilizationDisplay,
  getUtilizationLevel,
  utilizationPct,
} from './tokens';

describe('getUtilizationDisplay', () => {
  it('flags and clamps an over-limit line', () => {
    const result = getUtilizationDisplay(87_750, 75_000);

    expect(result.available).toBe(0);
    expect(result.overLimitBy).toBe(12_750);
    expect(result.barPct).toBe(100);
    expect(result.pct).toBeCloseTo(117, 5);
  });

  it('reports the true percentage for aria-valuenow', () => {
    const result = getUtilizationDisplay(87_750, 75_000);
    expect(result.pct).toBeCloseTo(117, 5);
  });

  it('returns zero available and no over-limit at the limit exactly', () => {
    const result = getUtilizationDisplay(75_000, 75_000);

    expect(result.available).toBe(0);
    expect(result.overLimitBy).toBe(0);
    expect(result.barPct).toBe(100);
    expect(result.pct).toBeCloseTo(100, 5);
  });

  it('leaves under-limit lines unchanged', () => {
    const result = getUtilizationDisplay(30_000, 75_000);

    expect(result.available).toBe(45_000);
    expect(result.overLimitBy).toBe(0);
    expect(result.barPct).toBeCloseTo(40, 5);
    expect(result.pct).toBeCloseTo(40, 5);
  });

  it('clamps the bar percentage to 100 for over-limit lines', () => {
    const result = getUtilizationDisplay(150_000, 75_000);
    expect(result.barPct).toBe(100);
    expect(result.overLimitBy).toBe(75_000);
  });

  it('sorts over-limit lines as the highest utilisation', () => {
    const over = getUtilizationDisplay(87_750, 75_000);
    const under = getUtilizationDisplay(60_000, 75_000);

    expect(over.pct).toBeGreaterThan(under.pct);
    expect([under, over].sort((a, b) => b.pct - a.pct)[0]).toBe(over);
  });

});

describe('utilizationPct', () => {
  it('returns the unclamped percentage', () => {
    expect(utilizationPct(87_750, 75_000)).toBeCloseTo(117, 5);
  });
});

describe('getUtilizationLevel', () => {
  it('returns a level for an over-limit line', () => {
    expect(getUtilizationLevel(87_750, 75_000)).toBeDefined();
  });
});
