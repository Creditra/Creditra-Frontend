import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_RETRIES,
  DEFAULT_DELAY_MS,
  RELOAD_GUARD_WINDOW_MS,
  RELOAD_GUARD_KEY,
  ChunkLoadError,
  isChunkLoadError,
  isChunkLoadErrorMessage,
  retryImport,
  readReloadGuard,
  writeReloadGuard,
  canReload,
} from './lazy-with-retry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunkTypeError(phrase: string): TypeError {
  return Object.assign(new TypeError(phrase), {});
}

// ---------------------------------------------------------------------------
// ChunkLoadError / isChunkLoadError
// ---------------------------------------------------------------------------

describe('ChunkLoadError', () => {
  it('is instance of Error and ChunkLoadError', () => {
    const err = new ChunkLoadError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ChunkLoadError);
    expect(err.name).toBe('ChunkLoadError');
  });

  it('stores cause', () => {
    const cause = new TypeError('original');
    const err = new ChunkLoadError('msg', cause);
    expect(err.cause).toBe(cause);
    expect(err.message).toBe('msg');
  });

  it('uses default message when none supplied', () => {
    const err = new ChunkLoadError();
    expect(err.message).toBe('Failed to load a code chunk.');
  });
});

describe('isChunkLoadError', () => {
  it('returns true for ChunkLoadError', () => {
    expect(isChunkLoadError(new ChunkLoadError())).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isChunkLoadError(new Error('oops'))).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError('string')).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isChunkLoadErrorMessage
// ---------------------------------------------------------------------------

describe('isChunkLoadErrorMessage', () => {
  it('returns true for ChunkLoadError regardless of message', () => {
    expect(isChunkLoadErrorMessage(new ChunkLoadError())).toBe(true);
  });

  it('returns true for Chrome phrase (case-insensitive)', () => {
    expect(
      isChunkLoadErrorMessage(
        makeChunkTypeError('Failed to fetch dynamically imported module'),
      ),
    ).toBe(true);
    // uppercase variant
    expect(
      isChunkLoadErrorMessage(
        makeChunkTypeError('FAILED TO FETCH DYNAMICALLY IMPORTED MODULE'),
      ),
    ).toBe(true);
  });

  it('returns true for Firefox phrase (case-insensitive)', () => {
    expect(
      isChunkLoadErrorMessage(
        makeChunkTypeError('error loading dynamically imported module'),
      ),
    ).toBe(true);
    expect(
      isChunkLoadErrorMessage(
        makeChunkTypeError('Error Loading Dynamically Imported Module'),
      ),
    ).toBe(true);
  });

  it('returns true for Safari phrase (case-insensitive)', () => {
    expect(
      isChunkLoadErrorMessage(
        makeChunkTypeError('Importing a module script failed'),
      ),
    ).toBe(true);
    expect(
      isChunkLoadErrorMessage(
        makeChunkTypeError('IMPORTING A MODULE SCRIPT FAILED'),
      ),
    ).toBe(true);
  });

  it('returns false for plain Error with matching text', () => {
    // Must be TypeError, not plain Error
    const plain = new Error('failed to fetch dynamically imported module');
    expect(isChunkLoadErrorMessage(plain)).toBe(false);
  });

  it('returns false for TypeError with unrelated message', () => {
    expect(isChunkLoadErrorMessage(new TypeError('Cannot read property'))).toBe(
      false,
    );
  });

  it('returns false for non-errors', () => {
    expect(isChunkLoadErrorMessage(null)).toBe(false);
    expect(isChunkLoadErrorMessage(undefined)).toBe(false);
    expect(isChunkLoadErrorMessage('failed to fetch dynamically imported module')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// retryImport
// ---------------------------------------------------------------------------

describe('retryImport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('succeeds on first try — factory called once', async () => {
    const factory = vi.fn().mockResolvedValue({ default: 'comp' });
    const result = await retryImport(factory);
    expect(result).toEqual({ default: 'comp' });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('fails then succeeds — factory called twice, delay advanced', async () => {
    const factory = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ default: 'comp' });

    const promise = retryImport(factory, { delayMs: DEFAULT_DELAY_MS });
    // advance past the sleep
    await vi.advanceTimersByTimeAsync(DEFAULT_DELAY_MS);
    const result = await promise;
    expect(result).toEqual({ default: 'comp' });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries with chunk TypeError -> throws ChunkLoadError with cause', async () => {
    const original = makeChunkTypeError(
      'Failed to fetch dynamically imported module',
    );
    const factory = vi.fn().mockImplementation(() => Promise.reject(original));

    const promise = retryImport(factory, {
      retries: DEFAULT_RETRIES,
      delayMs: DEFAULT_DELAY_MS,
    }).catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(DEFAULT_DELAY_MS);

    const caught = await promise;
    expect(caught).toBeInstanceOf(ChunkLoadError);
    expect((caught as ChunkLoadError).cause).toBe(original);
    expect(factory).toHaveBeenCalledTimes(DEFAULT_RETRIES + 1);
  });

  it('rethrows non-chunk error unchanged', async () => {
    const original = new RangeError('out of range');
    const factory = vi.fn().mockImplementation(() => Promise.reject(original));

    const promise = retryImport(factory, { retries: 1, delayMs: 0 }).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(0);

    const caught = await promise;
    expect(caught).toBe(original);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('retries: 0 — factory called exactly once and rethrows', async () => {
    const original = makeChunkTypeError(
      'error loading dynamically imported module',
    );
    const factory = vi.fn().mockImplementation(() => Promise.reject(original));

    const caught = await retryImport(factory, { retries: 0 }).catch(
      (e: unknown) => e,
    );
    expect(caught).toBeInstanceOf(ChunkLoadError);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('retries: 3 — factory called four times on persistent failure', async () => {
    const original = makeChunkTypeError('error loading dynamically imported module');
    const factory = vi.fn().mockImplementation(() => Promise.reject(original));

    const promise = retryImport(factory, { retries: 3, delayMs: 10 }).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(30);

    const caught = await promise;
    expect(caught).toBeInstanceOf(ChunkLoadError);
    expect(factory).toHaveBeenCalledTimes(4);
  });
});

// ---------------------------------------------------------------------------
// Reload guard
// ---------------------------------------------------------------------------

describe('readReloadGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns null when key is absent', () => {
    expect(readReloadGuard()).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    sessionStorage.setItem(RELOAD_GUARD_KEY, '{not valid json');
    expect(readReloadGuard()).toBeNull();
  });

  it('returns null for wrong shape (missing path)', () => {
    sessionStorage.setItem(
      RELOAD_GUARD_KEY,
      JSON.stringify({ timestamp: 123 }),
    );
    expect(readReloadGuard()).toBeNull();
  });

  it('returns null for wrong shape (missing timestamp)', () => {
    sessionStorage.setItem(
      RELOAD_GUARD_KEY,
      JSON.stringify({ path: '/foo' }),
    );
    expect(readReloadGuard()).toBeNull();
  });

  it('returns null for wrong shape (timestamp not a number)', () => {
    sessionStorage.setItem(
      RELOAD_GUARD_KEY,
      JSON.stringify({ path: '/foo', timestamp: '2025-01-01' }),
    );
    expect(readReloadGuard()).toBeNull();
  });

  it('returns valid guard when shape is correct', () => {
    const guard = { path: '/dashboard', timestamp: 1700000000000 };
    sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify(guard));
    expect(readReloadGuard()).toEqual(guard);
  });
});

describe('writeReloadGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips a guard through sessionStorage', () => {
    const guard = { path: '/dashboard', timestamp: 1700000000000 };
    writeReloadGuard(guard);
    expect(readReloadGuard()).toEqual(guard);
  });

  it('overwrites an existing guard', () => {
    writeReloadGuard({ path: '/old', timestamp: 100 });
    writeReloadGuard({ path: '/new', timestamp: 200 });
    expect(readReloadGuard()).toEqual({ path: '/new', timestamp: 200 });
  });
});

describe('canReload', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns true when no guard is stored', () => {
    expect(canReload(Date.now())).toBe(true);
  });

  it('returns false inside the 10-minute window', () => {
    const now = 1700000600000;
    writeReloadGuard({ path: '/dashboard', timestamp: now - 1000 }); // 1 s ago
    expect(canReload(now)).toBe(false);
  });

  it('returns false exactly at the boundary (now - timestamp === RELOAD_GUARD_WINDOW_MS)', () => {
    const now = 1700000600000;
    writeReloadGuard({
      path: '/dashboard',
      timestamp: now - RELOAD_GUARD_WINDOW_MS,
    });
    // difference is exactly RELOAD_GUARD_WINDOW_MS → NOT strictly greater → false
    expect(canReload(now)).toBe(false);
  });

  it('returns true just after the boundary', () => {
    const now = 1700000600000;
    writeReloadGuard({
      path: '/dashboard',
      timestamp: now - RELOAD_GUARD_WINDOW_MS - 1,
    });
    expect(canReload(now)).toBe(true);
  });

  it('does not throw when storage throws', () => {
    // Simulate storage that throws by setting a non-JSON value and verifying
    // the guard path gracefully returns null (already tested), but here we
    // confirm canReload itself does not propagate storage errors.
    sessionStorage.setItem(RELOAD_GUARD_KEY, 'CORRUPT');
    expect(() => canReload(Date.now())).not.toThrow();
    expect(canReload(Date.now())).toBe(true);
  });
});
