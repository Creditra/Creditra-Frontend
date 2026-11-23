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

  it('logs a warning in development with the rejection reason without logging the rejected value', () => {
    safeReturnPath('//evil.com?token=abc123');
    expect(warnSpy).toHaveBeenCalledWith('[safeReturnPath] rejected redirect: not-relative');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('//evil.com?token=abc123'));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('abc123'));
  });

  it('logs distinct reasons for each rejection branch', () => {
    warnSpy.mockClear();
    safeReturnPath(123);
    expect(warnSpy).toHaveBeenLastCalledWith('[safeReturnPath] rejected redirect: not-a-string');

    warnSpy.mockClear();
    safeReturnPath('/profile' + 'x'.repeat(600));
    expect(warnSpy).toHaveBeenLastCalledWith('[safeReturnPath] rejected redirect: too-long');

    warnSpy.mockClear();
    safeReturnPath('https://evil.example');
    expect(warnSpy).toHaveBeenLastCalledWith('[safeReturnPath] rejected redirect: not-relative');

    warnSpy.mockClear();
    safeReturnPath('/profile\u0000secret');
    expect(warnSpy).toHaveBeenLastCalledWith('[safeReturnPath] rejected redirect: control-characters');

    warnSpy.mockClear();
    setLocationOrigin('invalid-origin');
    safeReturnPath('/profile');
    expect(warnSpy).toHaveBeenLastCalledWith('[safeReturnPath] rejected redirect: parse-error');
    setLocationOrigin(ORIGIN);

    warnSpy.mockClear();
    const urlSpy = vi.spyOn(globalThis, 'URL').mockImplementationOnce(
      () => ({ origin: 'http://other.example' } as unknown as URL)
    );
    safeReturnPath('/profile');
    expect(warnSpy).toHaveBeenLastCalledWith('[safeReturnPath] rejected redirect: cross-origin');
    urlSpy.mockRestore();

    warnSpy.mockClear();
    safeReturnPath('/unknown-route');
    expect(warnSpy).toHaveBeenLastCalledWith('[safeReturnPath] rejected redirect: not-allowlisted');
  });

  it('does not log any part of rejected inputs across edge cases', () => {
    warnSpy.mockClear();

    const edgeCases = [
      { toString: () => 'token=object-secret-token' },
      '/profile?token=very-long-query-token&pad=' + 'x'.repeat(600),
      '/unknown#token=hash-secret-token',
      '//evil.com?token=abc123',
    ];

    for (const input of edgeCases) {
      safeReturnPath(input);
    }

    const allLogged = warnSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(allLogged).not.toContain('object-secret-token');
    expect(allLogged).not.toContain('very-long-query-token');
    expect(allLogged).not.toContain('hash-secret-token');
    expect(allLogged).not.toContain('evil.com');
    expect(allLogged).not.toContain('abc123');
  });
});
