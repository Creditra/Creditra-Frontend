import { describe, it, expect } from 'vitest';
import { shortenAddress } from './format-address';

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
