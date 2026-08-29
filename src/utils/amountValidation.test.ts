import { describe, expect, it, vi } from 'vitest';
import {
  getDrawAmountValidation,
  getRepayAmountValidation,
  REPAY_CONFIRM_THRESHOLD,
  requiresRepayConfirmation,
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
