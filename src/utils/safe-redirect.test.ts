import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { safeReturnPath } from './safe-redirect';

const ORIGIN = 'http://creditra.example';
let warnSpy: MockInstance;

function setLocationOrigin(origin: string): void {
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { origin, href: `${origin}/` },
  });
}

beforeEach(() => {
  setLocationOrigin(ORIGIN);
  // import.meta.env.DEV is true in the vitest test mode, so warnings would
  // otherwise noise the output for every rejection case.
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  setLocationOrigin(ORIGIN);
});

describe('safeReturnPath', () => {
  it('returns a known in-app path unchanged, preserving search and hash', () => {
    expect(safeReturnPath('/profile?tab=activity#top')).toBe('/profile?tab=activity#top');
  });

  it('falls back for an absolute external URL', () => {
    expect(safeReturnPath('https://evil.example/x')).toBe('/linked-accounts');
  });

  it('falls back for a protocol-relative URL', () => {
    expect(safeReturnPath('//evil.example')).toBe('/linked-accounts');
  });

  it('falls back for a backslash trick', () => {
    expect(safeReturnPath('/\\evil.example')).toBe('/linked-accounts');
  });

  it('falls back for a javascript: URL', () => {
    expect(safeReturnPath('javascript:alert(1)')).toBe('/linked-accounts');
  });

  it('resolves percent-encoded slashes to a same-origin path and only returns it when allowlisted', () => {
    expect(safeReturnPath('/%2F%2Fevil.example')).toBe('/linked-accounts');
  });

  it('falls back for a path that is not in the allowlist', () => {
    expect(safeReturnPath('/unknown-route')).toBe('/linked-accounts');
  });

  it('falls back for an input containing control characters', () => {
    expect(safeReturnPath('/profile\u0000secret')).toBe('/linked-accounts');
  });

  it('falls back for a path containing a backslash', () => {
    expect(safeReturnPath('/settings\\accounts')).toBe('/linked-accounts');
  });

  it('falls back for an input longer than 512 characters', () => {
    const overLong = '/profile' + 'x'.repeat(600);
    expect(overLong.length).toBeGreaterThan(512);
    expect(safeReturnPath(overLong)).toBe('/linked-accounts');
  });

  it('returns the root path', () => {
    expect(safeReturnPath('/')).toBe('/');
  });

  it('accepts nested allowlisted routes', () => {
    expect(safeReturnPath('/settings/accounts?tab=tokens')).toBe('/settings/accounts?tab=tokens');
  });

  it('uses the custom fallback when provided', () => {
    expect(safeReturnPath('https://evil.example/x', '/profile')).toBe('/profile');
  });

  it('falls back for non-string inputs', () => {
    expect(safeReturnPath(null)).toBe('/linked-accounts');
    expect(safeReturnPath(undefined)).toBe('/linked-accounts');
    expect(safeReturnPath(123)).toBe('/linked-accounts');
  });

  it('logs a warning in development with the rejected value', () => {
    safeReturnPath('https://evil.example/x');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('https://evil.example/x'));
  });
});
