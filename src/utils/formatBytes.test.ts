import { describe, it, expect } from 'vitest';
import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
  it('returns "0 Bytes" for 0', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('formats byte values from 1 up to 1023', () => {
    expect(formatBytes(1)).toBe('1 Bytes');
    expect(formatBytes(1023)).toBe('1023 Bytes');
  });

  it('formats fractional positive values below 1 byte without undefined units', () => {
    expect(formatBytes(0.5)).toBe('0.5 Bytes');
  });

  it('formats KB, MB, GB, and TB values', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
    expect(formatBytes(5 * 1024 ** 4)).toBe('5 TB');
  });

  it('clamps sizes beyond TB to TB instead of returning undefined', () => {
    expect(formatBytes(1024 ** 5)).toBe('1024 TB');
  });

  it('returns "0 Bytes" for negative, NaN, and non-finite inputs', () => {
    expect(formatBytes(-1)).toBe('0 Bytes');
    expect(formatBytes(-1024)).toBe('0 Bytes');
    expect(formatBytes(NaN)).toBe('0 Bytes');
    expect(formatBytes(Infinity)).toBe('0 Bytes');
    expect(formatBytes(-Infinity)).toBe('0 Bytes');
  });
});
