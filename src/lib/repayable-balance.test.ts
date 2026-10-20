import { describe, expect, it } from 'vitest';
import {
  getRepayableBalance,
  moneyCoversAmount,
  moneyToNumber,
  parseMoney,
} from './repayable-balance';

describe('getRepayableBalance', () => {
  const settlementAsset = { code: 'USDC', issuer: 'issuer-a' };

  it('selects the settlement asset and ignores other wallet assets', () => {
    const result = getRepayableBalance(
      [
        { asset: 'XLM', balance: '10000' },
        { asset: 'USDC', issuer: 'issuer-a', balance: '5.0000000' },
      ],
      settlementAsset,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(moneyToNumber(result.amount)).toBe(5);
    }
  });

  it('does not match a same-code asset with a different issuer', () => {
    expect(
      getRepayableBalance(
        [{ asset: 'USDC', issuer: 'issuer-b', balance: '500' }],
        settlementAsset,
      ),
    ).toEqual({ amount: null, status: 'no_trustline' });
  });

  it('reports loading until wallet balances have been fetched', () => {
    expect(getRepayableBalance(null, settlementAsset)).toEqual({
      amount: null,
      status: 'loading',
    });
  });

  it('parses Horizon values at seven-decimal precision without floating-point parsing', () => {
    expect(parseMoney('5.0000001')).toBe(50_000_001n);
    expect(moneyToNumber(parseMoney('5.0000001'))).toBe(5);
    expect(moneyToNumber(parseMoney('4.9999999'))).toBe(4.99);
    expect(moneyCoversAmount(parseMoney('4.9999999'), 5)).toBe(false);
    expect(moneyCoversAmount(parseMoney('5.0000000'), 5)).toBe(true);
  });
});
