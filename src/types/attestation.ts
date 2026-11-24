/**
 * Verification state of a single attestation. `Missing` covers both a
 * never-submitted attestation and one that has already lapsed — both
 * require the same remediation.
 */
export type AttestationStatus = 'Verified' | 'Expiring' | 'Missing';

/**
 * A single attestation tracked against the connected wallet (identity
 * bond, revenue proof, etc.). Backs the Dashboard's AttestationCard.
 */
export interface Attestation {
  id: string;
  /** Human-readable label, e.g. "Identity Bond". */
  label: string;
  /** ISO 8601 timestamp of the last successful verification. Absent when never verified. */
  lastVerifiedAt?: string;
  /** ISO 8601 timestamp the attestation lapses. Absent when never verified. */
  expiresAt?: string;
  /** `RequestEvaluation` step (`?step=<n>`) the remediation CTA deep-links to. */
  remediationStep: number;
}

// ─── Risk factor types ────────────────────────────────────────────────────────

/**
 * Direction a factor's value has moved since the previous evaluation.
 * `up` and `down` describe raw value movement (not necessarily good/bad).
 * `flat` means no measurable change.
 */
export type RiskFactorTrend = 'up' | 'down' | 'flat';

/**
 * A single attestation-derived factor that contributes to the overall risk
 * score. Used by `src/lib/risk-factors.ts` and `RiskFactorBreakdown`.
 *
 * Weights across all factors for a given evaluation MUST sum to 1 (± 0.001).
 */
export interface RiskFactor {
  /**
   * Stable machine identifier for the factor, e.g. `"identity_bond"`.
   * Must be unique within a set of factors.
   */
  id: string;
  /** Human-readable name shown in the breakdown table, e.g. "Identity Bond". */
  label: string;
  /**
   * Relative importance of this factor (0–1). All weights in a factor set
   * must sum to 1.
   */
  weight: number;
  /**
   * Normalised current value for this factor (0–1). Combined with `weight`
   * to produce `contribution` (see `computeRiskFactors`).
   */
  value: number;
  /**
   * Normalised value from the previous evaluation period. When present, used
   * to derive the `trend`. Absent on a first evaluation or when no prior data
   * exists.
   */
  previousValue?: number;
}
