import { describe, it, expect } from 'vitest';
import { shortenAddress, looksLikeStellarAddress } from './format-address';

describe('shortenAddress', () => {
  it('truncates long addresses with an ellipsis in the middle', () => {
    const input = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX';
    const result = shortenAddress(input);
    expect(result.startsWith('GABCDE')).toBe(true);
    expect(result.endsWith('UVWX')).toBe(true);
    expect(result).toContain('…');
  });

  it('returns short inputs untouched', () => {
    expect(shortenAddress('GABC')).toBe('GABC');
  });

  it('handles an empty string', () => {
    expect(shortenAddress('')).toBe('');
  });

  it('respects custom lead and tail sizes', () => {
    expect(shortenAddress('ABCDEFGHIJK', 2, 2)).toBe('AB…JK');
  });
});

describe('looksLikeStellarAddress', () => {
  it('accepts a checksum-valid Stellar G-address', () => {
    const address = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
    expect(looksLikeStellarAddress(address)).toBe(true);
  });

  it('rejects a G-address with an invalid checksum', () => {
    const address = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBA';
    expect(looksLikeStellarAddress(address)).toBe(false);
  });

  it('rejects addresses with the wrong length', () => {
    expect(looksLikeStellarAddress('GABC')).toBe(false);
  });

  it('rejects addresses that do not start with G', () => {
    expect(looksLikeStellarAddress('A' + 'A'.repeat(55))).toBe(false);
  });
});
