/**
 * Tests for src/lib/risk-factors.ts
 *
 * Covers:
 *  1. computeRiskFactors returns empty array for empty input.
 *  2. Contributions are computed correctly (weight × value × scale).
 *  3. Contributions sum to the expected score within rounding policy (±0.5).
 *  4. Trend is 'flat' when no previousValue is provided.
 *  5. Trend is 'up' when value > previousValue by more than TREND_THRESHOLD.
 *  6. Trend is 'down' when value < previousValue by more than TREND_THRESHOLD.
 *  7. Trend is 'flat' when value and previousValue differ by less than TREND_THRESHOLD.
 *  8. Weights not summing to 1 throws an error.
 *  9. Weights summing to 1 within tolerance does NOT throw.
 * 10. Output array preserves input order.
 * 11. sumContributions returns correct total.
 * 12. scale option changes contribution magnitude.
 * 13. roundingDecimals option controls precision.
 * 14. Partial data (some factors missing previousValue) does not crash.
 * 15. Single-factor set (weight=1) works correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  computeRiskFactors,
  sumContributions,
  TREND_THRESHOLD,
  WEIGHT_SUM_TOLERANCE,
} from './risk-factors';
import type { RiskFactor } from '../types/attestation';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const THREE_FACTORS: RiskFactor[] = [
  { id: 'identity', label: 'Identity Bond', weight: 0.4, value: 0.9 },
  {
    id: 'revenue',
    label: 'Revenue Proof',
    weight: 0.3,
    value: 0.7,
    previousValue: 0.6,
  },
  {
    id: 'collateral',
    label: 'Collateral',
    weight: 0.3,
    value: 0.5,
    previousValue: 0.5,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeRiskFactors', () => {
  it('returns empty array when given empty input', () => {
    expect(computeRiskFactors([])).toEqual([]);
  });

  it('computes contributions as weight × value × scale (default scale=100)', () => {
    const result = computeRiskFactors(THREE_FACTORS);
    // identity: 0.4 × 0.9 × 100 = 36.0
    expect(result[0].contribution).toBeCloseTo(36.0, 1);
    // revenue:  0.3 × 0.7 × 100 = 21.0
    expect(result[1].contribution).toBeCloseTo(21.0, 1);
    // collateral: 0.3 × 0.5 × 100 = 15.0
    expect(result[2].contribution).toBeCloseTo(15.0, 1);
  });

  it('contributions sum to displayed score within ±0.5 rounding policy', () => {
    const result = computeRiskFactors(THREE_FACTORS);
    const total = sumContributions(result);
    // 36 + 21 + 15 = 72
    expect(Math.abs(total - 72)).toBeLessThanOrEqual(0.5);
  });

  it("trend is 'flat' when no previousValue is provided", () => {
    const factors: RiskFactor[] = [
      { id: 'a', label: 'A', weight: 1.0, value: 0.8 },
    ];
    const result = computeRiskFactors(factors);
    expect(result[0].trend).toBe('flat');
  });

  it("trend is 'up' when value > previousValue by more than TREND_THRESHOLD", () => {
    const delta = TREND_THRESHOLD + 0.01;
    const factors: RiskFactor[] = [
      {
        id: 'a',
        label: 'A',
        weight: 1.0,
        value: 0.5 + delta,
        previousValue: 0.5,
      },
    ];
    const result = computeRiskFactors(factors);
    expect(result[0].trend).toBe('up');
  });

  it("trend is 'down' when value < previousValue by more than TREND_THRESHOLD", () => {
    const delta = TREND_THRESHOLD + 0.01;
    const factors: RiskFactor[] = [
      {
        id: 'a',
        label: 'A',
        weight: 1.0,
        value: 0.5 - delta,
        previousValue: 0.5,
      },
    ];
    const result = computeRiskFactors(factors);
    expect(result[0].trend).toBe('down');
  });

  it("trend is 'flat' when change is below TREND_THRESHOLD", () => {
    const delta = TREND_THRESHOLD / 2;
    const factors: RiskFactor[] = [
      {
        id: 'a',
        label: 'A',
        weight: 1.0,
        value: 0.5 + delta,
        previousValue: 0.5,
      },
    ];
    const result = computeRiskFactors(factors);
    expect(result[0].trend).toBe('flat');
  });

  it('throws when weights do not sum to 1 outside tolerance', () => {
    const bad: RiskFactor[] = [
      { id: 'x', label: 'X', weight: 0.5, value: 0.5 },
      { id: 'y', label: 'Y', weight: 0.3, value: 0.5 },
      // sum = 0.8, well outside WEIGHT_SUM_TOLERANCE
    ];
    expect(() => computeRiskFactors(bad)).toThrow(/weights must sum to 1/i);
  });

  it('does NOT throw when weights sum to 1 within WEIGHT_SUM_TOLERANCE', () => {
    const almostOne = 1 - WEIGHT_SUM_TOLERANCE / 2;
    const factors: RiskFactor[] = [
      { id: 'a', label: 'A', weight: almostOne, value: 0.8 },
      {
        id: 'b',
        label: 'B',
        weight: 1 - almostOne,
        value: 0.5,
      },
    ];
    expect(() => computeRiskFactors(factors)).not.toThrow();
  });

  it('preserves input array order in output', () => {
    const result = computeRiskFactors(THREE_FACTORS);
    expect(result.map((f) => f.id)).toEqual(['identity', 'revenue', 'collateral']);
  });

  it('echoes id and label from input', () => {
    const result = computeRiskFactors(THREE_FACTORS);
    expect(result[0].id).toBe('identity');
    expect(result[0].label).toBe('Identity Bond');
    expect(result[1].id).toBe('revenue');
  });

  it('echoes value and previousValue from input', () => {
    const result = computeRiskFactors(THREE_FACTORS);
    expect(result[0].value).toBe(0.9);
    expect(result[0].previousValue).toBeUndefined();
    expect(result[1].value).toBe(0.7);
    expect(result[1].previousValue).toBe(0.6);
  });

  it('handles partial data — some factors missing previousValue — without crashing', () => {
    const mixed: RiskFactor[] = [
      { id: 'a', label: 'A', weight: 0.6, value: 0.8, previousValue: 0.75 },
      { id: 'b', label: 'B', weight: 0.4, value: 0.5 }, // no previousValue
    ];
    expect(() => computeRiskFactors(mixed)).not.toThrow();
    const result = computeRiskFactors(mixed);
    expect(result[0].trend).toBe('up'); // 0.8 - 0.75 = 0.05 > TREND_THRESHOLD
    expect(result[1].trend).toBe('flat'); // no prior value
  });

  it('single-factor set (weight=1) computes contribution equal to value × scale', () => {
    const factors: RiskFactor[] = [
      { id: 'only', label: 'Only Factor', weight: 1.0, value: 0.72 },
    ];
    const result = computeRiskFactors(factors);
    expect(result[0].contribution).toBeCloseTo(72.0, 1);
  });

  it('scale option changes contribution magnitude proportionally', () => {
    const factors: RiskFactor[] = [
      { id: 'a', label: 'A', weight: 1.0, value: 0.5 },
    ];
    const r100 = computeRiskFactors(factors, { scale: 100 });
    const r850 = computeRiskFactors(factors, { scale: 850 });
    expect(r100[0].contribution).toBeCloseTo(50, 1);
    expect(r850[0].contribution).toBeCloseTo(425, 1);
  });

  it('roundingDecimals=0 rounds contributions to integers', () => {
    const factors: RiskFactor[] = [
      { id: 'a', label: 'A', weight: 0.333, value: 0.5 },
      { id: 'b', label: 'B', weight: 0.333, value: 0.5 },
      { id: 'c', label: 'C', weight: 0.334, value: 0.5 },
    ];
    const result = computeRiskFactors(factors, { roundingDecimals: 0 });
    result.forEach((f) => {
      expect(Number.isInteger(f.contribution)).toBe(true);
    });
  });
});

describe('sumContributions', () => {
  it('returns 0 for empty array', () => {
    expect(sumContributions([])).toBe(0);
  });

  it('sums contributions from computeRiskFactors output', () => {
    const result = computeRiskFactors(THREE_FACTORS);
    // 36 + 21 + 15 = 72
    expect(sumContributions(result)).toBeCloseTo(72, 1);
  });
});
