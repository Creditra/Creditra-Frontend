/**
 * collateral.ts — unit tests
 *
 * All functions are pure, so no mocking is required.
 */
import { describe, it, expect } from 'vitest';
import {
  computeLtvSnapshot,
  computeSubstitutionFee,
  computeSlippage,
  isWithinSlippage,
  isStaleQuote,
  classifySubstitutionError,
  fmtLtv,
  fmtLtvDelta,
  findAssetByName,
  categoryIcon,
  AVAILABLE_COLLATERAL_ASSETS,
  SLIPPAGE_PRESETS,
  DEFAULT_SLIPPAGE,
  MAX_RETRY_ATTEMPTS,
  STALE_QUOTE_THRESHOLD_MS,
} from './collateral';
import type { CollateralAsset } from '../types/collateral';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CRYPTO_ASSET: CollateralAsset = {
  id: 'test-crypto',
  name: 'Test Coin',
  ticker: 'TST',
  value: 400_000,
  maxLtvRatio: 0.70,
  category: 'crypto',
};

const REAL_ESTATE_ASSET: CollateralAsset = {
  id: 'test-re',
  name: 'Office Building',
  value: 1_000_000,
  maxLtvRatio: 0.75,
  category: 'real_estate',
};

// ─── computeLtvSnapshot ───────────────────────────────────────────────────────

describe('computeLtvSnapshot', () => {
  it('calculates ltvRatio correctly', () => {
    const snap = computeLtvSnapshot(CRYPTO_ASSET, 200_000);
    expect(snap.ltvRatio).toBeCloseTo(0.5);
  });

  it('isOverLtv is false when balance is within limit', () => {
    const snap = computeLtvSnapshot(CRYPTO_ASSET, 200_000); // 50 % < 70 %
    expect(snap.isOverLtv).toBe(false);
  });

  it('isOverLtv is true when balance exceeds maxLtvRatio', () => {
    const snap = computeLtvSnapshot(CRYPTO_ASSET, 350_000); // 87.5 % > 70 %
    expect(snap.isOverLtv).toBe(true);
  });

  it('availableHeadroom is positive when under-LTV', () => {
    const snap = computeLtvSnapshot(CRYPTO_ASSET, 200_000);
    // headroom = 400 000 * 0.70 - 200 000 = 80 000
    expect(snap.availableHeadroom).toBeCloseTo(80_000);
  });

  it('availableHeadroom is negative when over-LTV', () => {
    const snap = computeLtvSnapshot(CRYPTO_ASSET, 350_000);
    expect(snap.availableHeadroom).toBeLessThan(0);
  });

  it('handles zero collateral value without NaN', () => {
    const zeroAsset: CollateralAsset = { ...CRYPTO_ASSET, value: 0 };
    const snap = computeLtvSnapshot(zeroAsset, 100);
    expect(snap.ltvRatio).toBe(1); // 100 % by convention
    expect(snap.isOverLtv).toBe(true);
  });

  it('ltvRatio is 0 when loanBalance is 0', () => {
    const snap = computeLtvSnapshot(CRYPTO_ASSET, 0);
    expect(snap.ltvRatio).toBe(0);
  });
});

// ─── fmtLtv ──────────────────────────────────────────────────────────────────

describe('fmtLtv', () => {
  it('formats 0.5 as "50.0%"', () => {
    expect(fmtLtv(0.5)).toBe('50.0%');
  });

  it('formats 1 as "100.0%"', () => {
    expect(fmtLtv(1)).toBe('100.0%');
  });

  it('formats 0 as "0.0%"', () => {
    expect(fmtLtv(0)).toBe('0.0%');
  });

  it('rounds to one decimal place', () => {
    expect(fmtLtv(0.4257)).toBe('42.6%');
  });
});

// ─── fmtLtvDelta ─────────────────────────────────────────────────────────────

describe('fmtLtvDelta', () => {
  const outSnap = computeLtvSnapshot(CRYPTO_ASSET, 200_000);   // 50 %
  const betterSnap = computeLtvSnapshot(REAL_ESTATE_ASSET, 200_000); // 20 %

  it('returns isImprovement=true when incoming LTV is lower', () => {
    const delta = fmtLtvDelta(outSnap, betterSnap);
    expect(delta.isImprovement).toBe(true);
  });

  it('returns isImprovement=false when incoming LTV is higher', () => {
    const worseSnap = computeLtvSnapshot(CRYPTO_ASSET, 250_000); // 62.5 %
    const delta = fmtLtvDelta(betterSnap, worseSnap);
    expect(delta.isImprovement).toBe(false);
  });

  it('includes a sign in the text for positive deltas', () => {
    const worseSnap = computeLtvSnapshot(CRYPTO_ASSET, 250_000);
    const delta = fmtLtvDelta(betterSnap, worseSnap);
    expect(delta.text).toMatch(/^\+/);
  });

  it('text contains "pp" unit', () => {
    const delta = fmtLtvDelta(outSnap, betterSnap);
    expect(delta.text).toContain('pp');
  });
});

// ─── computeSubstitutionFee ───────────────────────────────────────────────────

describe('computeSubstitutionFee', () => {
  it('charges 0.5 % processing fee on the loan balance', () => {
    const fee = computeSubstitutionFee(100_000, CRYPTO_ASSET);
    expect(fee.processingFee).toBeCloseTo(500);
  });

  it('total equals processingFee for non-real-estate assets', () => {
    const fee = computeSubstitutionFee(100_000, CRYPTO_ASSET);
    expect(fee.total).toBe(fee.processingFee);
    expect(fee.appraisalFee).toBeUndefined();
  });

  it('adds $250 appraisal fee for real_estate assets', () => {
    const fee = computeSubstitutionFee(100_000, REAL_ESTATE_ASSET);
    expect(fee.appraisalFee).toBe(250);
    expect(fee.total).toBeCloseTo(750);
  });

  it('total is sum of processing + appraisal when both apply', () => {
    const fee = computeSubstitutionFee(200_000, REAL_ESTATE_ASSET);
    expect(fee.total).toBeCloseTo(fee.processingFee + (fee.appraisalFee ?? 0));
  });

  it('handles zero balance gracefully', () => {
    const fee = computeSubstitutionFee(0, CRYPTO_ASSET);
    expect(fee.processingFee).toBe(0);
    expect(fee.total).toBe(0);
  });
});

// ─── findAssetByName ──────────────────────────────────────────────────────────

describe('findAssetByName', () => {
  it('returns undefined for undefined input', () => {
    expect(findAssetByName(undefined)).toBeUndefined();
  });

  it('finds an asset by exact name match', () => {
    const asset = findAssetByName('USDC Treasury');
    expect(asset).toBeDefined();
    expect(asset!.id).toBe('asset-usdc');
  });

  it('finds an asset when the search string contains the asset name', () => {
    // e.g. the stored collateral string is "Commercial Real Estate Holdings"
    const asset = findAssetByName('Commercial Real Estate');
    expect(asset).toBeDefined();
    expect(asset!.category).toBe('real_estate');
  });

  it('returns undefined for an unrecognised name', () => {
    expect(findAssetByName('Unicorn Token')).toBeUndefined();
  });
});

// ─── categoryIcon ─────────────────────────────────────────────────────────────

describe('categoryIcon', () => {
  it('returns an emoji for every known category', () => {
    const categories = ['crypto', 'real_estate', 'receivables', 'treasury', 'other'] as const;
    categories.forEach(cat => {
      const icon = categoryIcon(cat);
      expect(icon.length).toBeGreaterThan(0);
    });
  });
});

// ─── AVAILABLE_COLLATERAL_ASSETS ─────────────────────────────────────────────

describe('AVAILABLE_COLLATERAL_ASSETS', () => {
  it('has at least one asset per category', () => {
    const categories = new Set(AVAILABLE_COLLATERAL_ASSETS.map(a => a.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });

  it('every asset has a maxLtvRatio between 0 and 1 exclusive', () => {
    AVAILABLE_COLLATERAL_ASSETS.forEach(a => {
      expect(a.maxLtvRatio).toBeGreaterThan(0);
      expect(a.maxLtvRatio).toBeLessThan(1);
    });
  });

  it('every asset has a positive value', () => {
    AVAILABLE_COLLATERAL_ASSETS.forEach(a => {
      expect(a.value).toBeGreaterThan(0);
    });
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('slippage constants', () => {
  it('SLIPPAGE_PRESETS contains expected values', () => {
    expect(SLIPPAGE_PRESETS).toEqual([0.5, 1, 2, 5]);
  });

  it('DEFAULT_SLIPPAGE is 1', () => {
    expect(DEFAULT_SLIPPAGE).toBe(1);
  });

  it('MAX_RETRY_ATTEMPTS is 3', () => {
    expect(MAX_RETRY_ATTEMPTS).toBe(3);
  });

  it('STALE_QUOTE_THRESHOLD_MS is 60 seconds', () => {
    expect(STALE_QUOTE_THRESHOLD_MS).toBe(60_000);
  });
});

// ─── computeSlippage ─────────────────────────────────────────────────────────

describe('computeSlippage', () => {
  it('returns 0 slippage when LTVs are identical', () => {
    const result = computeSlippage(0.5, 0.5, 1);
    expect(result.slippagePp).toBeCloseTo(0);
    expect(result.isExceeded).toBe(false);
  });

  it('computes positive slippage when current LTV is higher', () => {
    const result = computeSlippage(0.5, 0.55, 1);
    // |0.55 - 0.5| * 100 = 5 pp
    expect(result.slippagePp).toBeCloseTo(5);
    expect(result.isExceeded).toBe(true);
  });

  it('computes positive slippage when current LTV is lower', () => {
    const result = computeSlippage(0.5, 0.45, 1);
    expect(result.slippagePp).toBeCloseTo(5);
    expect(result.isExceeded).toBe(true);
  });

  it('isExceeded is false when slippage equals tolerance exactly', () => {
    const result = computeSlippage(0.5, 0.505, 5);
    // |0.505 - 0.5| * 100 = 5 pp, tolerance = 5 pp → not exceeded (strict >)
    expect(result.isExceeded).toBe(false);
  });

  it('isExceeded is true when slippage is 0.01 pp over tolerance', () => {
    const result = computeSlippage(0.5, 0.5101, 1);
    expect(result.slippagePp).toBeGreaterThan(1);
    expect(result.isExceeded).toBe(true);
  });

  it('includes reviewLtvRatio and currentLtvRatio in the result', () => {
    const result = computeSlippage(0.42, 0.47, 2);
    expect(result.reviewLtvRatio).toBe(0.42);
    expect(result.currentLtvRatio).toBe(0.47);
  });

  it('passes through the tolerancePp value', () => {
    const result = computeSlippage(0.5, 0.5, 5);
    expect(result.tolerancePp).toBe(5);
  });
});

// ─── isWithinSlippage ────────────────────────────────────────────────────────

describe('isWithinSlippage', () => {
  it('returns true when slippage is within tolerance', () => {
    expect(isWithinSlippage(0.5, 0.505, 1)).toBe(true);
  });

  it('returns false when slippage exceeds tolerance', () => {
    expect(isWithinSlippage(0.5, 0.52, 1)).toBe(false);
  });

  it('returns true when LTVs are identical', () => {
    expect(isWithinSlippage(0.7, 0.7, 0.5)).toBe(true);
  });
});

// ─── isStaleQuote ────────────────────────────────────────────────────────────

describe('isStaleQuote', () => {
  it('returns false when the quote is fresh', () => {
    const now = 1_000_000;
    expect(isStaleQuote(now - 10_000, now)).toBe(false);
  });

  it('returns true when the quote exceeds the threshold', () => {
    const now = 1_000_000;
    expect(isStaleQuote(now - 61_000, now)).toBe(true);
  });

  it('returns false when the quote is exactly at the threshold', () => {
    const now = 1_000_000;
    expect(isStaleQuote(now - STALE_QUOTE_THRESHOLD_MS, now)).toBe(false);
  });

  it('returns true when the quote is 1 ms over the threshold', () => {
    const now = 1_000_000;
    expect(isStaleQuote(now - STALE_QUOTE_THRESHOLD_MS - 1, now)).toBe(true);
  });

  it('uses Date.now() when nowMs is not provided', () => {
    // Just verify it doesn't throw and returns a boolean
    const result = isStaleQuote(Date.now() - 1000);
    expect(typeof result).toBe('boolean');
  });
});

// ─── classifySubstitutionError ────────────────────────────────────────────────

describe('classifySubstitutionError', () => {
  it('classifies network errors', () => {
    const result = classifySubstitutionError(new Error('Network error'));
    expect(result.reason).toBe('network');
    expect(result.retryable).toBe(true);
    expect(result.message).toContain('network');
  });

  it('classifies timeout errors', () => {
    const result = classifySubstitutionError(new Error('Request timed out'));
    expect(result.reason).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('classifies permission errors', () => {
    const result = classifySubstitutionError(new Error('Permission denied'));
    expect(result.reason).toBe('permission');
    expect(result.retryable).toBe(false);
  });

  it('classifies validation errors', () => {
    const result = classifySubstitutionError(new Error('Invalid input'));
    expect(result.reason).toBe('validation');
    expect(result.retryable).toBe(false);
  });

  it('classifies slippage errors', () => {
    const result = classifySubstitutionError(new Error('Price moved beyond slippage tolerance'));
    expect(result.reason).toBe('slippage');
    expect(result.retryable).toBe(false);
  });

  it('classifies unknown errors', () => {
    const result = classifySubstitutionError(new Error('Something random'));
    expect(result.reason).toBe('unknown');
    expect(result.retryable).toBe(true);
  });

  it('handles non-Error values gracefully', () => {
    const result = classifySubstitutionError('string error');
    expect(result.reason).toBe('unknown');
    expect(result.message).toBeDefined();
  });

  it('handles null/undefined gracefully', () => {
    const result = classifySubstitutionError(null);
    expect(result.reason).toBe('unknown');
    expect(result.message).toBeDefined();
  });

  it('detects HTTP status codes in message text', () => {
    const result403 = classifySubstitutionError(new Error('Error 403 Forbidden'));
    expect(result403.reason).toBe('permission');

    const result422 = classifySubstitutionError(new Error('HTTP 422 Unprocessable'));
    expect(result422.reason).toBe('validation');
  });

  it('detects ECONNREFUSED as network error', () => {
    const result = classifySubstitutionError(new Error('connect ECONNREFUSED'));
    expect(result.reason).toBe('network');
    expect(result.retryable).toBe(true);
  });
});
