/**
 * Types for the collateral substitution flow.
 *
 * Collateral assets are the on-chain or off-chain holdings a borrower
 * pledges against a credit line. The substitution flow lets a borrower
 * swap the currently-pledged asset for a new one, showing a side-by-side
 * LTV comparison and the processing fee before they confirm.
 */

/**
 * Category of a collateral asset. Drives the icon rendered on the
 * comparison card and any category-specific LTV floor rules the UI
 * surfaces as warnings.
 */
export type CollateralAssetCategory =
  | 'crypto'
  | 'real_estate'
  | 'receivables'
  | 'treasury'
  | 'other';

/**
 * A single collateral asset — either the currently-pledged one or a
 * candidate for substitution.
 */
export interface CollateralAsset {
  /** Stable identifier. For mock data this mirrors the credit-line id. */
  id: string;
  /** Human-readable name shown on the comparison card. */
  name: string;
  /** Estimated fair-market value in USD. */
  value: number;
  /** Maximum Loan-To-Value ratio permitted for this asset type (0–1). */
  maxLtvRatio: number;
  /** Coarse asset category for icon selection and UX copy. */
  category: CollateralAssetCategory;
  /** Optional ticker / contract-address shown as a secondary label. */
  ticker?: string;
}

/**
 * Computed LTV metrics derived from a `CollateralAsset` and the
 * outstanding loan balance. Used to drive the comparison cards.
 */
export interface LtvSnapshot {
  /** Current drawn balance secured by this collateral. */
  loanBalance: number;
  /** Collateral fair-market value. */
  collateralValue: number;
  /**
   * Effective LTV ratio — `loanBalance / collateralValue`.
   * Expressed as a fraction (e.g. 0.42 = 42 %).
   */
  ltvRatio: number;
  /**
   * True when `ltvRatio` exceeds the asset's `maxLtvRatio`.
   * The UI surfaces a warning when the *incoming* asset is over-LTV.
   */
  isOverLtv: boolean;
  /**
   * Headroom before the collateral becomes over-LTV, in USD.
   * Negative when already over-LTV.
   */
  availableHeadroom: number;
}

/**
 * Fee structure returned (or derived) for a substitution operation.
 */
export interface SubstitutionFee {
  /** Processing fee in USD. */
  processingFee: number;
  /** Optional appraisal fee in USD (e.g. for real estate). */
  appraisalFee?: number;
  /** Total combined fee. */
  total: number;
}

/**
 * The three steps inside the collateral substitution modal.
 *
 * - `select`   — user picks the incoming collateral from the list
 * - `review`   — side-by-side comparison of current vs. new, LTV delta, fee
 * - `confirm`  — irreversible-action gate; user types to confirm and submits
 */
export type SubstitutionStep = 'select' | 'review' | 'confirm';

/**
 * Outcome states after the network submission in the confirm step.
 */
export type SubstitutionStatus = 'idle' | 'pending' | 'retrying' | 'success' | 'error';

// ─── Slippage ────────────────────────────────────────────────────────────────

/**
 * Predefined slippage tolerance percentages shown as selectable chips
 * on the Review step. The user picks one before advancing to Confirm.
 * If the quoted LTV drifts beyond this tolerance by the time the
 * transaction is submitted, the operation is blocked and the user
 * must re-review.
 */
export type SlippageTolerance = 0.5 | 1 | 2 | 5;

/**
 * Result of comparing the LTV snapshot at review-time against the
 * re-fetched snapshot at submit-time.
 */
export interface SlippageResult {
  /** The LTV ratio when the user entered the Review step. */
  reviewLtvRatio: number;
  /** The LTV ratio re-fetched just before submission. */
  currentLtvRatio: number;
  /** Absolute difference in percentage points. */
  slippagePp: number;
  /** True when the absolute slippage exceeds the chosen tolerance. */
  isExceeded: boolean;
  /** The tolerance that was applied (pp). */
  tolerancePp: number;
}

// ─── Failure classification ──────────────────────────────────────────────────

/**
 * Discriminated failure categories for the substitution submission.
 * Each category drives a distinct user-facing error panel with
 * specific recovery affordances.
 */
export type SubstitutionFailureReason =
  | 'network'
  | 'validation'
  | 'permission'
  | 'timeout'
  | 'slippage'
  | 'unknown';

/**
 * Structured error object that replaces the bare `string` submit-error.
 * The `reason` discriminant drives the error panel variant;
 * `retryable` tells the UI whether to show a Retry button.
 */
export interface SubstitutionError {
  /** Machine-readable failure category. */
  reason: SubstitutionFailureReason;
  /** Human-safe message shown in the error panel body. */
  message: string;
  /** True when the operation can be retried without user intervention. */
  retryable: boolean;
  /** Optional upstream error code for logging / diagnostics. */
  code?: string;
  /** Optional idempotency key for linking errors to specific submission attempts. */
  idempotencyKey?: string;
}

// ─── Idempotency & deduplication ─────────────────────────────────────────────

/**
 * Canonical parameters for a collateral substitution operation.
 * Used to generate deterministic, collision-resistant idempotency keys
 * that prevent retries from creating duplicate intents.
 */
export interface CollateralSubstitutionIntent {
  /** The credit line being modified (stable ID from backend). */
  creditLineId: string;
  /** The asset currently pledged (undefined if none exists). */
  outgoingAssetId?: string;
  /** The asset being pledged. Must be different from outgoing. */
  incomingAssetId: string;
  /** Unix timestamp (ms) when the user initiated this substitution flow. */
  initiatedAtMs: number;
}

/**
 * Tracking state for a single submission attempt in the collateral substitution flow.
 * Persisted locally to detect and prevent duplicate submissions and side-effect replay.
 */
export interface CollateralSubstitutionSubmissionState {
  /** The immutable intent parameters that define this operation. */
  intent: CollateralSubstitutionIntent;
  /** Deterministic idempotency key for this intent (generated from canonical params). */
  idempotencyKey: string;
  /** How many times this key has been submitted to the server. */
  attemptCount: number;
  /** Unix timestamp (ms) of the most recent submission. */
  lastSubmittedAtMs?: number;
  /** The most recent server response, if any (prevents replay of already-succeeded operations). */
  lastServerResponse?: {
    statusOrReason: string;
    message?: string;
    receivedAtMs: number;
  };
}
