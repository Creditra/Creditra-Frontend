/**
 * Pure helper functions for the collateral substitution flow.
 *
 * All functions are side-effect-free and independently testable.
 */
import type {
  CollateralAsset,
  CollateralAssetCategory,
  LtvSnapshot,
  SlippageResult,
  SlippageTolerance,
  SubstitutionError,
  SubstitutionFailureReason,
  SubstitutionFee,
} from '../types/collateral';

// ─── LTV Calculations ─────────────────────────────────────────────────────────

/**
 * Compute the LTV snapshot for a given collateral asset and loan balance.
 *
 * @param asset         The collateral asset (current or incoming).
 * @param loanBalance   The outstanding loan balance secured by this asset.
 */
export function computeLtvSnapshot(
  asset: CollateralAsset,
  loanBalance: number
): LtvSnapshot {
  const collateralValue = asset.value;
  const ltvRatio = collateralValue > 0 ? loanBalance / collateralValue : 1;
  const isOverLtv = ltvRatio > asset.maxLtvRatio;
  // Available headroom before hitting the max-LTV ceiling, in USD.
  const availableHeadroom = collateralValue * asset.maxLtvRatio - loanBalance;

  return {
    loanBalance,
    collateralValue,
    ltvRatio,
    isOverLtv,
    availableHeadroom,
  };
}

/**
 * Express an LTV ratio (0–1) as a percentage string, e.g. "42.5%".
 */
export function fmtLtv(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Signed LTV delta between the incoming and outgoing snapshots,
 * expressed in percentage points, e.g. "+5.2pp" or "−3.1pp".
 */
export function fmtLtvDelta(
  outgoing: LtvSnapshot,
  incoming: LtvSnapshot
): { text: string; isImprovement: boolean } {
  const deltaPoints = (incoming.ltvRatio - outgoing.ltvRatio) * 100;
  const isImprovement = deltaPoints < 0; // lower LTV = less risk = improvement
  const sign = deltaPoints > 0 ? '+' : '';
  return {
    text: `${sign}${deltaPoints.toFixed(1)} pp`,
    isImprovement,
  };
}

// ─── Fee Computation ──────────────────────────────────────────────────────────

/** Processing-fee rate applied to the outstanding loan balance. */
const PROCESSING_FEE_RATE = 0.005; // 0.5 %

/** Categories that incur an additional appraisal fee. */
const APPRAISAL_CATEGORIES: CollateralAssetCategory[] = [
  'real_estate',
];

/** Flat appraisal fee in USD for applicable asset categories. */
const APPRAISAL_FEE_USD = 250;

/**
 * Compute the fee structure for a substitution.
 *
 * @param loanBalance     Current outstanding balance.
 * @param incomingAsset   The new collateral being pledged.
 */
export function computeSubstitutionFee(
  loanBalance: number,
  incomingAsset: CollateralAsset
): SubstitutionFee {
  const processingFee = Math.round(loanBalance * PROCESSING_FEE_RATE * 100) / 100;
  const appraisalFee = APPRAISAL_CATEGORIES.includes(incomingAsset.category)
    ? APPRAISAL_FEE_USD
    : undefined;
  const total =
    processingFee + (appraisalFee ?? 0);

  return { processingFee, appraisalFee, total };
}

// ─── Mock Asset Catalogue ─────────────────────────────────────────────────────

/**
 * Mock catalogue of available collateral assets a borrower can substitute
 * into. In production this would come from an API.
 */
export const AVAILABLE_COLLATERAL_ASSETS: CollateralAsset[] = [
  {
    id: 'asset-usdc',
    name: 'USDC Treasury',
    ticker: 'USDC',
    value: 500_000,
    maxLtvRatio: 0.85,
    category: 'crypto',
  },
  {
    id: 'asset-xlm',
    name: 'Stellar Lumens',
    ticker: 'XLM',
    value: 320_000,
    maxLtvRatio: 0.65,
    category: 'crypto',
  },
  {
    id: 'asset-btc',
    name: 'Bitcoin',
    ticker: 'BTC',
    value: 750_000,
    maxLtvRatio: 0.70,
    category: 'crypto',
  },
  {
    id: 'asset-real-estate',
    name: 'Commercial Real Estate',
    value: 1_200_000,
    maxLtvRatio: 0.75,
    category: 'real_estate',
  },
  {
    id: 'asset-ar',
    name: 'Accounts Receivable',
    value: 280_000,
    maxLtvRatio: 0.80,
    category: 'receivables',
  },
  {
    id: 'asset-tbill',
    name: 'US T-Bills',
    ticker: 'TBILL',
    value: 420_000,
    maxLtvRatio: 0.90,
    category: 'treasury',
  },
];

/**
 * Map a collateral string from the canonical `CreditLine.collateral`
 * field to the closest asset in the mock catalogue, for pre-populating
 * the "current" side of the comparison.
 */
export function findAssetByName(name: string | undefined): CollateralAsset | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  return AVAILABLE_COLLATERAL_ASSETS.find((a) =>
    a.name.toLowerCase().includes(lower) ||
    lower.includes(a.name.toLowerCase())
  );
}

/**
 * Return the emoji icon for an asset category.
 * Used where a proper SVG icon is not available.
 */
export function categoryIcon(category: CollateralAssetCategory): string {
  switch (category) {
    case 'crypto':      return '🔷';
    case 'real_estate': return '🏢';
    case 'receivables': return '📄';
    case 'treasury':    return '🏛️';
    default:            return '💎';
  }
}

// ─── Slippage ────────────────────────────────────────────────────────────────

/**
 * Selectable slippage tolerance presets, shown as chips on the Review step.
 * Each value is in percentage points (e.g. 1 = 1 pp tolerance).
 */
export const SLIPPAGE_PRESETS: SlippageTolerance[] = [0.5, 1, 2, 5];

/** Default slippage tolerance applied when the user does not explicitly choose one. */
export const DEFAULT_SLIPPAGE: SlippageTolerance = 1;

/**
 * Maximum number of submission attempts before the retry button is hidden
 * and a "contact support" message is shown instead.
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Maximum age (ms) of a reviewed LTV snapshot before it is considered stale
 * and must be re-fetched before the user can submit.
 */
export const STALE_QUOTE_THRESHOLD_MS = 60_000; // 60 seconds

/**
 * Compute the slippage between a review-time LTV and a submit-time LTV.
 *
 * @param reviewLtv    LTV ratio captured when the user entered the Review step.
 * @param currentLtv   Re-fetched LTV ratio just before submission.
 * @param tolerancePp  Allowed slippage in percentage points (e.g. 1 = 1 %).
 */
export function computeSlippage(
  reviewLtv: number,
  currentLtv: number,
  tolerancePp: number,
): SlippageResult {
  const slippagePp = Math.abs((currentLtv - reviewLtv) * 100);
  return {
    reviewLtvRatio: reviewLtv,
    currentLtvRatio: currentLtv,
    slippagePp,
    isExceeded: slippagePp > tolerancePp,
    tolerancePp,
  };
}

/**
 * Convenience predicate: returns true when the slippage is within tolerance.
 */
export function isWithinSlippage(
  reviewLtv: number,
  currentLtv: number,
  tolerancePp: number,
): boolean {
  return !computeSlippage(reviewLtv, currentLtv, tolerancePp).isExceeded;
}

/**
 * Returns true when the review-time snapshot is older than
 * `STALE_QUOTE_THRESHOLD_MS` and should be refreshed.
 */
export function isStaleQuote(reviewTimestampMs: number, nowMs?: number): boolean {
  const now = nowMs ?? Date.now();
  return now - reviewTimestampMs > STALE_QUOTE_THRESHOLD_MS;
}

// ─── Error classification ────────────────────────────────────────────────────

/**
 * Message templates for each failure reason. The `{message}` placeholder
 * in the raw error is interpolated if present; otherwise the template
 * body is used as-is.
 */
const ERROR_TEMPLATES: Record<
  SubstitutionFailureReason,
  { message: string; retryable: boolean }
> = {
  network: {
    message:
      'A network error prevented the substitution from completing. Check your connection and try again.',
    retryable: true,
  },
  validation: {
    message:
      'The substitution was rejected due to a validation error. Review your collateral selection and try again.',
    retryable: false,
  },
  permission: {
    message:
      'You do not have permission to modify this credit line. Contact your administrator.',
    retryable: false,
  },
  timeout: {
    message:
      'The request timed out. The network may be congested — try again in a moment.',
    retryable: true,
  },
  slippage: {
    message:
      'Collateral prices have moved beyond your slippage tolerance. Re-review the comparison before submitting.',
    retryable: false,
  },
  unknown: {
    message:
      'An unexpected error occurred. Please try again or contact support if the issue persists.',
    retryable: true,
  },
};

/**
 * Classify a raw error (from a catch block or API response) into a
 * structured `SubstitutionError` with a reason discriminant, a
 * human-safe message, and a retryability flag.
 *
 * @param raw  The caught error or unknown value.
 */
export function classifySubstitutionError(
  raw: unknown,
): SubstitutionError {
  const message = raw instanceof Error ? raw.message : String(raw);
  const lower = message.toLowerCase();

  let reason: SubstitutionFailureReason;

  if (lower.includes('timeout') || lower.includes('timed out')) {
    reason = 'timeout';
  } else if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound')
  ) {
    reason = 'network';
  } else if (
    lower.includes('permission') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('403')
  ) {
    reason = 'permission';
  } else if (
    lower.includes('validation') ||
    lower.includes('invalid') ||
    lower.includes('rejected') ||
    lower.includes('400') ||
    lower.includes('422')
  ) {
    reason = 'validation';
  } else if (
    lower.includes('slippage') ||
    lower.includes('price moved') ||
    lower.includes('stale')
  ) {
    reason = 'slippage';
  } else {
    reason = 'unknown';
  }

  const template = ERROR_TEMPLATES[reason];

  return {
    reason,
    message: template.message,
    retryable: template.retryable,
  };
}

// ─── Collateral Adjustment Calculations ─────────────────────────────────────

export type CollateralAdjustMode = 'add' | 'withdraw';

export interface CollateralAdjustmentResult {
  mode: CollateralAdjustMode;
  amount: number;
  currentSnapshot: LtvSnapshot;
  adjustedSnapshot: LtvSnapshot;
  adjustedCollateralValue: number;
  maxWithdrawable: number;
  isValid: boolean;
  isBreachingMaxLtv: boolean;
  errorMessage?: string;
}

/**
 * Compute the maximum collateral value that can be withdrawn from a position
 * without breaching the asset's maximum LTV ratio.
 *
 * @param assetOrValue  The collateral asset or its current market value in USD.
 * @param loanBalance   The outstanding loan balance in USD.
 * @param maxLtvRatio   The maximum permitted LTV ratio (0-1), required if assetOrValue is a number.
 */
export function computeMaxWithdrawable(
  assetOrValue: CollateralAsset | number,
  loanBalance: number,
  maxLtvRatio?: number,
): number {
  const collateralValue = typeof assetOrValue === 'number' ? assetOrValue : assetOrValue.value;
  const ratio = typeof assetOrValue === 'number' ? (maxLtvRatio ?? 1) : assetOrValue.maxLtvRatio;
  if (collateralValue <= 0 || ratio <= 0) return 0;
  if (loanBalance <= 0) return Math.max(0, Math.floor(collateralValue * 100) / 100);

  // To maintain LTV <= maxLtvRatio: loanBalance / (collateralValue - withdrawAmount) <= maxLtvRatio
  // => withdrawAmount <= collateralValue - (loanBalance / maxLtvRatio)
  const minRequiredCollateral = loanBalance / ratio;
  const maxWithdrawable = Math.max(0, collateralValue - minRequiredCollateral);
  return Math.min(collateralValue, Math.floor(maxWithdrawable * 100) / 100);
}

/**
 * Compute the adjusted LTV snapshot and safety metrics for adding or withdrawing collateral.
 *
 * @param asset         The current collateral asset.
 * @param loanBalance   The outstanding loan balance in USD.
 * @param mode          'add' to top up collateral, 'withdraw' to remove collateral.
 * @param amount        The adjustment amount in USD.
 */
export function computeCollateralAdjustment(
  asset: CollateralAsset,
  loanBalance: number,
  mode: CollateralAdjustMode,
  amount: number,
): CollateralAdjustmentResult {
  const currentSnapshot = computeLtvSnapshot(asset, loanBalance);
  const maxWithdrawable = computeMaxWithdrawable(asset, loanBalance);
  const safeAmount = Math.max(0, amount);

  let adjustedCollateralValue: number;
  if (mode === 'add') {
    adjustedCollateralValue = asset.value + safeAmount;
  } else {
    adjustedCollateralValue = Math.max(0, asset.value - safeAmount);
  }

  const adjustedAsset: CollateralAsset = {
    ...asset,
    value: adjustedCollateralValue,
  };
  const adjustedSnapshot = computeLtvSnapshot(adjustedAsset, loanBalance);

  let isValid = true;
  let isBreachingMaxLtv = false;
  let errorMessage: string | undefined;

  if (amount <= 0 || Number.isNaN(amount)) {
    isValid = false;
    errorMessage = 'Enter an amount greater than 0.';
  } else if (mode === 'withdraw') {
    if (amount > asset.value) {
      isValid = false;
      errorMessage = 'Withdrawal amount exceeds total pledged collateral.';
    } else if (amount > maxWithdrawable || adjustedSnapshot.isOverLtv) {
      isValid = false;
      isBreachingMaxLtv = true;
      errorMessage = `Withdrawal exceeds safe limit. Maximum withdrawable amount is $${maxWithdrawable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to maintain safe LTV of ${fmtLtv(asset.maxLtvRatio)}.`;
    }
  }

  return {
    mode,
    amount,
    currentSnapshot,
    adjustedSnapshot,
    adjustedCollateralValue,
    maxWithdrawable,
    isValid,
    isBreachingMaxLtv,
    errorMessage,
  };
}

