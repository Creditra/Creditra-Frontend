import { describe, expect, it, vi } from 'vitest';
import {
  CREDIT_RESERVE_LIMIT_RATIO,
  CREDIT_RESERVE_MIN,
  DEFAULT_REPAY_CONFIRM_THRESHOLD,
  getCreditReserveFloor,
  getDrawAmountValidation,
  getRepayAmountValidation,
  getRepayConfirmThreshold,
  getWalletReserveFloor,
  parseAmountInput,
  REPAY_CONFIRM_THRESHOLD,
  requiresRepayConfirmation,
  WALLET_RESERVE_MIN,
  WALLET_RESERVE_RATIO,
} from './amountValidation';

describe('getDrawAmountValidation', () => {
  const creditLine = { limit: 50000, available: 35000 };

  it('returns a warning when a draw would leave less than the reserve target', () => {
    const result = getDrawAmountValidation('32000', creditLine);

    expect(result.isValid).toBe(true);
    expect(result.feedback.severity).toBe('warning');
    expect(result.feedback.title).toBe('Below recommended reserve');
  });

  it('returns an error when the amount exceeds available credit', () => {
    const result = getDrawAmountValidation('36000', creditLine);

    expect(result.isValid).toBe(false);
    expect(result.feedback.severity).toBe('danger');
    expect(result.feedback.title).toBe('Exceeds available credit');
  });

  it('reserves the 1% fee when calculating the maximum draw', () => {
    const result = getDrawAmountValidation('35000', creditLine);
    const maximum = getDrawAmountValidation('34653.47', creditLine);

    expect(result.isValid).toBe(false);
    expect(result.maxAmount).toBe(34653.47);
    expect(result.feedback.message).toContain('$34,653.47');
    expect(maximum.isValid).toBe(true);
  });
});

describe('getRepayAmountValidation', () => {
  it('returns an error when the amount exceeds wallet balance', () => {
    const result = getRepayAmountValidation('6000', 8000, 4000);

    expect(result.isValid).toBe(false);
    expect(result.feedback.severity).toBe('danger');
    expect(result.feedback.title).toBe('Exceeds wallet balance');
  });

  it('returns a warning when repayment leaves too little wallet reserve', () => {
    const result = getRepayAmountValidation('3900', 8000, 4000);

    expect(result.isValid).toBe(true);
    expect(result.feedback.severity).toBe('warning');
    expect(result.feedback.title).toBe('Low wallet reserve');
  });

  it('computes the remaining debt exactly to the cent (decimal-safe)', () => {
    // 10 - 9.99 in raw floats is 0.010000000000000016; the cents-based
    // validation must surface a clean 0.01.
    const result = getRepayAmountValidation('9.99', 10, 100);

    expect(result.isValid).toBe(true);
    expect(result.remainingDebt).toBe(0.01);
    expect(result.remainingWalletBalance).toBe(90.01);
  });

  it('flags a repayment that fully clears the debt as exact full repayment', () => {
    const result = getRepayAmountValidation('999.99', 999.99, 5000);

    expect(result.isValid).toBe(true);
    expect(result.remainingDebt).toBe(0);
    expect(result.feedback.severity).toBe('success');
    expect(result.feedback.title).toBe('Full repayment');
  });

  it('still flags an amount over the wallet as invalid (decimal-safe)', () => {
    const result = getRepayAmountValidation('9.99', 5000, 9.98);

    expect(result.isValid).toBe(false);
    expect(result.feedback.severity).toBe('danger');
    expect(result.feedback.title).toBe('Exceeds wallet balance');
  });

  it('treats an amount exactly equal to the wallet balance as valid', () => {
    const result = getRepayAmountValidation('10.00', 10, 10.0);

    expect(result.isValid).toBe(true);
    expect(result.remainingWalletBalance).toBe(0);
  });
});

describe('REPAY_CONFIRM_THRESHOLD', () => {
  it('defaults to 5000 when VITE_REPAY_CONFIRM_THRESHOLD is not set', () => {
    expect(REPAY_CONFIRM_THRESHOLD).toBe(5000);
  });

  it('reads a custom value from VITE_REPAY_CONFIRM_THRESHOLD', async () => {
    vi.stubEnv('VITE_REPAY_CONFIRM_THRESHOLD', '1000');
    vi.resetModules();
    const { REPAY_CONFIRM_THRESHOLD: threshold } = await import('./amountValidation');
    expect(threshold).toBe(1000);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('falls back to 5000 when VITE_REPAY_CONFIRM_THRESHOLD is not a valid number', async () => {
    vi.stubEnv('VITE_REPAY_CONFIRM_THRESHOLD', 'not-a-number');
    vi.resetModules();
    const { REPAY_CONFIRM_THRESHOLD: threshold } = await import('./amountValidation');
    expect(threshold).toBe(5000);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('accepts 0 to disable the guard', async () => {
    vi.stubEnv('VITE_REPAY_CONFIRM_THRESHOLD', '0');
    vi.resetModules();
    const { REPAY_CONFIRM_THRESHOLD: threshold, requiresRepayConfirmation: requires } =
      await import('./amountValidation');
    expect(threshold).toBe(0);
    // When threshold is 0 the guard is disabled; no amount triggers confirmation.
    expect(requires(10000)).toBe(false);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe('getRepayConfirmThreshold', () => {
  it('defaults to 5000 when env variable is unset', () => {
    expect(getRepayConfirmThreshold({})).toBe(5000);
    expect(getRepayConfirmThreshold({ VITE_REPAY_CONFIRM_THRESHOLD: undefined })).toBe(5000);
  });

  it('accepts 0 to disable the guard', () => {
    expect(getRepayConfirmThreshold({ VITE_REPAY_CONFIRM_THRESHOLD: '0' })).toBe(0);
  });

  it('falls back to 5000 for negative values', () => {
    expect(getRepayConfirmThreshold({ VITE_REPAY_CONFIRM_THRESHOLD: '-1' })).toBe(5000);
  });

  it('falls back to 5000 for non-numeric strings', () => {
    expect(getRepayConfirmThreshold({ VITE_REPAY_CONFIRM_THRESHOLD: 'abc' })).toBe(5000);
  });

  it('parses valid positive thresholds', () => {
    expect(getRepayConfirmThreshold({ VITE_REPAY_CONFIRM_THRESHOLD: '2500' })).toBe(2500);
  });

  it('uses default import.meta.env when called without arguments', () => {
    expect(getRepayConfirmThreshold()).toBe(5000);
  });
});

describe('requiresRepayConfirmation', () => {
  it('returns false for amounts below the threshold', () => {
    expect(requiresRepayConfirmation(4999)).toBe(false);
    expect(requiresRepayConfirmation(0)).toBe(false);
    expect(requiresRepayConfirmation(1)).toBe(false);
  });

  it('returns true for amounts at the threshold', () => {
    expect(requiresRepayConfirmation(5000)).toBe(true);
  });

  it('returns true for amounts above the threshold', () => {
    expect(requiresRepayConfirmation(5001)).toBe(true);
    expect(requiresRepayConfirmation(10000)).toBe(true);
  });

  it('returns true for non-integer amounts at or above the threshold', () => {
    expect(requiresRepayConfirmation(5000.01)).toBe(true);
    expect(requiresRepayConfirmation(5250.50)).toBe(true);
  });
});

describe('reserve floors and named constants', () => {
  it('falls back to the named default repay threshold', () => {
    expect(DEFAULT_REPAY_CONFIRM_THRESHOLD).toBe(5000);
    expect(getRepayConfirmThreshold({})).toBe(DEFAULT_REPAY_CONFIRM_THRESHOLD);
    expect(getRepayConfirmThreshold({ VITE_REPAY_CONFIRM_THRESHOLD: 'abc' })).toBe(
      DEFAULT_REPAY_CONFIRM_THRESHOLD,
    );
  });

  it('uses the credit reserve minimum at the limit where 10% equals it', () => {
    const boundaryLimit = CREDIT_RESERVE_MIN / CREDIT_RESERVE_LIMIT_RATIO;

    expect(boundaryLimit).toBe(50000);
    expect(getCreditReserveFloor(boundaryLimit, 35000)).toBe(CREDIT_RESERVE_MIN);
    expect(getCreditReserveFloor(boundaryLimit + 10000, 35000)).toBe(6000);
    expect(getCreditReserveFloor(boundaryLimit - 10000, 35000)).toBe(CREDIT_RESERVE_MIN);
  });

  it('caps the credit reserve at available credit when it is smaller than the floor', () => {
    expect(getCreditReserveFloor(50000, CREDIT_RESERVE_MIN - 1)).toBe(CREDIT_RESERVE_MIN - 1);
    expect(getCreditReserveFloor(50000, 0)).toBe(0);
  });

  it('uses the wallet reserve minimum at the balance where 10% equals it', () => {
    const boundaryBalance = WALLET_RESERVE_MIN / WALLET_RESERVE_RATIO;

    expect(boundaryBalance).toBe(1000);
    expect(getWalletReserveFloor(boundaryBalance)).toBe(WALLET_RESERVE_MIN);
    expect(getWalletReserveFloor(boundaryBalance + 1000)).toBe(200);
    expect(getWalletReserveFloor(WALLET_RESERVE_MIN / 2)).toBe(WALLET_RESERVE_MIN / 2);
  });
});

describe('parseAmountInput', () => {
  it('rejects trailing garbage like "12abc"', () => {
    expect(parseAmountInput('12abc')).toBeNull();
  });

  it('rejects scientific notation like "1e3"', () => {
    expect(parseAmountInput('1e3')).toBeNull();
    expect(parseAmountInput('1E3')).toBeNull();
  });

  it('parses leading and trailing decimal forms (".5" and "5.")', () => {
    expect(parseAmountInput('.5')).toBe(0.5);
    expect(parseAmountInput('5.')).toBe(5);
    expect(parseAmountInput('.')).toBeNull();
  });

  it('strips valid thousands-grouped commas by default and rejects them when allowCommas is false', () => {
    expect(parseAmountInput('1,234.56')).toBe(1234.56);
    expect(parseAmountInput('1,234.56', { allowCommas: false })).toBeNull();
    expect(parseAmountInput('1,23')).toBeNull();
  });

  it('parses zero and integers', () => {
    expect(parseAmountInput('0')).toBe(0);
    expect(parseAmountInput('7')).toBe(7);
    expect(parseAmountInput('  7  ')).toBe(7);
  });

  it('rejects signs, hex, and Infinity', () => {
    expect(parseAmountInput('-1')).toBeNull();
    expect(parseAmountInput('+1')).toBeNull();
    expect(parseAmountInput('0x10')).toBeNull();
    expect(parseAmountInput('Infinity')).toBeNull();
  });

  it('enforces maxDecimals (default 2)', () => {
    expect(parseAmountInput('1.23')).toBe(1.23);
    expect(parseAmountInput('1.234')).toBeNull();
    expect(parseAmountInput('1.234', { maxDecimals: 2 })).toBeNull();
    expect(parseAmountInput('1.234', { maxDecimals: 3 })).toBe(1.234);
  });

  it('handles empty input according to allowEmpty', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('   ')).toBeNull();
    expect(parseAmountInput('', { allowEmpty: true })).toBe(0);
    expect(parseAmountInput('   ', { allowEmpty: true })).toBe(0);
  });
});
