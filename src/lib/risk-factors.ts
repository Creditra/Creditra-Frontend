/**
 * risk-factors.ts
 *
 * Pure computation helpers for the attestation-driven risk factor breakdown.
 *
 * Key design decisions
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Weights must sum to 1 (± WEIGHT_SUM_TOLERANCE). `computeRiskFactors`
 *    validates this and throws if the invariant is violated, so callers notice
 *    misconfigured factor sets during development/test rather than silently
 *    producing wrong totals.
 *
 * 2. `contribution` = weight × value × scale.  For a 0–100 gauge the scale is
 *    100; contributions therefore sum to the displayed score within floating-
 *    point rounding (± 0.5 after `Math.round`).
 *
 * 3. Trend is derived from the difference between `value` and `previousValue`.
 *    A change smaller than TREND_THRESHOLD is treated as `flat` to suppress
 *    spurious movement indicators.
 *
 * 4. The module contains no React or DOM imports — it is usable in workers and
 *    Node test environments without any special configuration.
 */

import type { RiskFactor, RiskFactorTrend } from '../types/attestation';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum absolute difference between `value` and `previousValue` required to
 * register as an `up` or `down` trend.  Differences below this are `flat`.
 * 0.005 corresponds to 0.5% of the normalised 0–1 value range.
 */
export const TREND_THRESHOLD = 0.005;

/**
 * Maximum allowed deviation from 1.0 when summing all factor weights.
 * Exceeding this triggers a thrown error from `computeRiskFactors`.
 */
export const WEIGHT_SUM_TOLERANCE = 0.001;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The derived outputs produced by `computeRiskFactors` for each factor.
 */
export interface ComputedRiskFactor {
  /** Stable identifier — echoed from the input `RiskFactor`. */
  id: string;
  /** Human-readable label — echoed from the input `RiskFactor`. */
  label: string;
  /** Relative importance weight (0–1). */
  weight: number;
  /** Normalised current value (0–1). */
  value: number;
  /** Previous value if available; `undefined` otherwise. */
  previousValue: number | undefined;
  /**
   * Points this factor contributes to the overall score on the target scale.
   * Computed as `weight × value × scale`, rounded to `roundingDecimals`.
   *
   * Example: weight=0.3, value=0.8, scale=100 → contribution=24.
   */
  contribution: number;
  /**
   * Direction the factor value moved vs `previousValue`.
   * `flat` when no prior value is available or the change is below
   * `TREND_THRESHOLD`.
   */
  trend: RiskFactorTrend;
}

/** Options accepted by `computeRiskFactors`. */
export interface ComputeRiskFactorsOptions {
  /**
   * The scale of the target score.  Set to 100 for a 0–100 gauge; set to 850
   * for a FICO-style 0–850 gauge.  Contributions are multiplied by this value.
   * @default 100
   */
  scale?: number;
  /**
   * Number of decimal places to round contributions to.  Keeping 1 decimal
   * provides enough precision for a readable display while ensuring the sum
   * rounds correctly to the displayed integer score.
   * @default 1
   */
  roundingDecimals?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function deriveTrend(
  value: number,
  previousValue: number | undefined,
): RiskFactorTrend {
  if (previousValue === undefined) return 'flat';
  const delta = value - previousValue;
  if (Math.abs(delta) < TREND_THRESHOLD) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Computes contribution and trend for each factor in `factors`.
 *
 * @param factors - Array of `RiskFactor` objects from `src/types/attestation.ts`.
 *   The array may be empty; an empty array returns an empty result array (no throw).
 *   Weights must sum to 1 (± `WEIGHT_SUM_TOLERANCE`) when at least one factor
 *   is present; otherwise an error is thrown.
 *
 * @param options - Optional tuning; see `ComputeRiskFactorsOptions`.
 *
 * @returns `ComputedRiskFactor[]` in the same order as the input.
 *
 * @throws {Error} when weights do not sum to 1 (± tolerance).
 *
 * @example
 * ```ts
 * const factors: RiskFactor[] = [
 *   { id: 'identity', label: 'Identity Bond', weight: 0.4, value: 0.9 },
 *   { id: 'revenue',  label: 'Revenue Proof', weight: 0.3, value: 0.7, previousValue: 0.6 },
 *   { id: 'collateral', label: 'Collateral',  weight: 0.3, value: 0.5, previousValue: 0.5 },
 * ];
 * const computed = computeRiskFactors(factors, { scale: 100 });
 * // contributions: 36, 21, 15 → sum = 72 (matches overall score)
 * ```
 */
export function computeRiskFactors(
  factors: RiskFactor[],
  options: ComputeRiskFactorsOptions = {},
): ComputedRiskFactor[] {
  const { scale = 100, roundingDecimals = 1 } = options;

  if (factors.length === 0) {
    return [];
  }

  // Validate that weights sum to 1 within tolerance.
  const weightSum = factors.reduce((acc, f) => acc + f.weight, 0);
  if (Math.abs(weightSum - 1) > WEIGHT_SUM_TOLERANCE) {
    throw new Error(
      `Risk factor weights must sum to 1 (± ${WEIGHT_SUM_TOLERANCE}). ` +
        `Got ${weightSum.toFixed(6)} across ${factors.length} factor(s).`,
    );
  }

  return factors.map((factor) => ({
    id: factor.id,
    label: factor.label,
    weight: factor.weight,
    value: factor.value,
    previousValue: factor.previousValue,
    contribution: roundTo(factor.weight * factor.value * scale, roundingDecimals),
    trend: deriveTrend(factor.value, factor.previousValue),
  }));
}

/**
 * Convenience: returns the sum of all contributions.
 * Useful to verify contributions match the displayed score (rounding policy:
 * within ±0.5 on the target scale).
 */
export function sumContributions(computed: ComputedRiskFactor[]): number {
  return computed.reduce((acc, f) => acc + f.contribution, 0);
}
