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
