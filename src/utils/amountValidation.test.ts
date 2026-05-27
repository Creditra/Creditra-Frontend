import { describe, expect, it } from 'vitest';
import {
  getDrawAmountValidation,
  getRepayAmountValidation,
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
});
