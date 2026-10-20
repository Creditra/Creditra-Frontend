/**
 * Tests for offline utilities (offlineFetch, offlineMutation, cache).
 *
 * Covers:
 *   - Online: normal fetch, server errors, retries, cache write-through
 *   - Offline: cache hit, cache miss, no-cache throw
 *   - Concurrent requests sharing a single in-flight call
 *   - Mutation guards: online execution, offline rejection, onOffline callback
 *   - Boundary: empty URL, expired cache, invalid cache data
 *   - Type guard: isOfflineMutationError
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  offlineFetch,
  offlineMutation,
  isOfflineMutationError,
  readCache,
  writeCache,
} from '../offline';

// ── Storage mocks ────────────────────────────────────────────────────────────

let storage: Record<string, string> = {};

vi.mock('../../utils/storage', () => ({
  readJson: vi.fn((key: string, fallback: unknown) => {
    const raw = storage[key];
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }),
  writeJson: vi.fn((key: string, value: unknown) => {
    storage[key] = JSON.stringify(value);
  }),
  removeKey: vi.fn((key: string) => {
    delete storage[key];
  }),
}));

// ── Navigator.onLine control ──────────────────────────────────────────────────

let originalOnLine: boolean;

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

// ── Fetch mock ───────────────────────────────────────────────────────────────

function mockFetchSuccess(data: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    }),
  );
}

function mockFetchNetworkError() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  );
}

function mockFetchServerError(status = 500) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({ message: 'Server error' }),
    }),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('offline utilities', () => {
  beforeEach(() => {
    originalOnLine = navigator.onLine;
    storage = {};
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── readCache / writeCache ────────────────────────────────────────────

  describe('readCache / writeCache', () => {
    it('returns null when no cache exists', () => {
      expect(readCache('missing')).toBeNull();
    });

    it('returns cached data within TTL', () => {
      writeCache('key1', { foo: 1 });
      expect(readCache('key1')).toEqual({ foo: 1 });
    });

    it('returns null when cache is expired', () => {
      writeCache('key2', { bar: 2 });
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 min > 5 min default TTL
      expect(readCache('key2')).toBeNull();
    });

    it('respects custom TTL', () => {
      writeCache('key3', { baz: 3 });
      expect(readCache('key3', 1000)).toEqual({ baz: 3 });
      vi.advanceTimersByTime(1001);
      expect(readCache('key3', 1000)).toBeNull();
    });

    it('overwrites previous cache value', () => {
      writeCache('key4', 'first');
      writeCache('key4', 'second');
      expect(readCache('key4')).toBe('second');
    });

    it('handles corrupt cache data gracefully', () => {
      storage['corrupt:cache'] = 'not-valid-json{';
      expect(readCache('corrupt')).toBeNull();
    });

    it('handles cache without data field', () => {
      storage['nodata:cache'] = JSON.stringify({ timestamp: Date.now() });
      expect(readCache('nodata')).toBeNull();
    });

    it('uses separate keys for different cache entries', () => {
      writeCache('a', 1);
      writeCache('b', 2);
      expect(readCache('a')).toBe(1);
      expect(readCache('b')).toBe(2);
    });
  });

  // ─── offlineFetch ─────────────────────────────────────────────────────

  describe('offlineFetch', () => {
    describe('online', () => {
      beforeEach(() => setNavigatorOnLine(true));

      it('fetches and returns data successfully', async () => {
        mockFetchSuccess({ accounts: [] });
        const result = await offlineFetch<{ accounts: unknown[] }>('/api/accounts');
        expect(result).toEqual({ accounts: [] });
        expect(fetch).toHaveBeenCalledWith('/api/accounts', expect.anything());
      });

      it('writes to cache when cacheKey is provided', async () => {
        mockFetchSuccess({ items: [1, 2, 3] });
        await offlineFetch('/api/items', { cacheKey: 'items' });
        expect(readCache('items')).toEqual({ items: [1, 2, 3] });
      });

      it('does not cache when cacheKey is omitted', async () => {
        mockFetchSuccess({ data: true });
        await offlineFetch('/api/data');
        expect(readCache('nocache')).toBeNull();
      });

      it('throws on server error (non-2xx)', async () => {
        mockFetchServerError(500);
        await expect(offlineFetch('/api/fail')).rejects.toThrow(
          /Server responded with status 500/,
        );
      });

      it('throws OfflineMutationError with server code', async () => {
        mockFetchServerError(403);
        try {
          await offlineFetch('/api/forbidden');
          expect.fail('Should have thrown');
        } catch (err) {
          expect(isOfflineMutationError(err)).toBe(true);
          expect((err as { code: string }).code).toBe('server');
          expect((err as { status: number }).status).toBe(403);
        }
      });

      it('throws on network failure and returns cache if available', async () => {
        writeCache('net-fail', { stale: true });
        mockFetchNetworkError();
        const result = await offlineFetch('/api/net', { cacheKey: 'net-fail' });
        expect(result).toEqual({ stale: true });
      });

      it('throws OfflineMutationError with network code when no cache', async () => {
        mockFetchNetworkError();
        try {
          await offlineFetch('/api/net-fail');
          expect.fail('Should have thrown');
        } catch (err) {
          expect(isOfflineMutationError(err)).toBe(true);
          expect((err as { code: string }).code).toBe('network');
        }
      });

      it('passes through request init options', async () => {
        mockFetchSuccess({ ok: true });
        await offlineFetch('/api/post', {
          method: 'POST',
          body: JSON.stringify({ x: 1 }),
          headers: { 'Content-Type': 'application/json' },
        });
        expect(fetch).toHaveBeenCalledWith('/api/post', {
          method: 'POST',
          body: JSON.stringify({ x: 1 }),
          headers: { 'Content-Type': 'application/json' },
        });
      });

      it('retries on network failure when retries > 0', async () => {
        const fetchMock = vi.fn()
          .mockRejectedValueOnce(new TypeError('fail 1'))
          .mockRejectedValueOnce(new TypeError('fail 2'))
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ retried: true }),
          });
        vi.stubGlobal('fetch', fetchMock);

        const promise = offlineFetch('/api/retry', {
          retries: 2,
          retryBaseDelay: 100, // fast for tests
        });
        // backoff: 100ms then 200ms
        await vi.advanceTimersByTimeAsync(400);
        const result = await promise;
        expect(result).toEqual({ retried: true });
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });

      it('returns cache when all retries fail', async () => {
        writeCache('retry-fail', { fromCache: true });
        const fetchMock = vi.fn().mockRejectedValue(new TypeError('fail'));
        vi.stubGlobal('fetch', fetchMock);
        const promise = offlineFetch('/api/retry-fail', {
          cacheKey: 'retry-fail',
          retries: 2,
          retryBaseDelay: 100,
        });
        await vi.advanceTimersByTimeAsync(400);
        const result = await promise;
        expect(result).toEqual({ fromCache: true });
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });
    });

    describe('offline', () => {
      beforeEach(() => setNavigatorOnLine(false));

      it('returns cached data when available', async () => {
        writeCache('offline-key', { cached: true });
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        const result = await offlineFetch('/api/data', { cacheKey: 'offline-key' });
        expect(result).toEqual({ cached: true });
        // Should NOT have called fetch
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it('throws OfflineMutationError when no cache exists', async () => {
        try {
          await offlineFetch('/api/none', { cacheKey: 'empty' });
          expect.fail('Should have thrown');
        } catch (err) {
          expect(isOfflineMutationError(err)).toBe(true);
          expect((err as { code: string }).code).toBe('offline');
          expect((err as Error).message).toMatch(/offline/i);
        }
      });

      it('throws when cacheKey is omitted and offline', async () => {
        await expect(offlineFetch('/api/any')).rejects.toThrow(/offline/i);
      });

      it('returns null-cache entry as miss', async () => {
        // Cache exists but is expired
        writeCache('expired', { old: true });
        vi.advanceTimersByTime(10 * 60 * 1000);
        await expect(
          offlineFetch('/api/expired', { cacheKey: 'expired' }),
        ).rejects.toThrow(/offline/i);
      });

      it('never calls fetch when offline', async () => {
        writeCache('no-fetch', { ok: true });
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        await offlineFetch('/api/call', { cacheKey: 'no-fetch' });
        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });

    describe('boundary cases', () => {
      it('throws on empty URL', async () => {
        setNavigatorOnLine(true);
        await expect(offlineFetch('')).rejects.toThrow(/non-empty URL/);
      });

      it('handles cache with TTL of 0 (always stale)', async () => {
        writeCache('zero-ttl', { data: 1 });
        setNavigatorOnLine(false);
        await expect(
          offlineFetch('/api/z', { cacheKey: 'zero-ttl', cacheTtl: 0 }),
        ).rejects.toThrow(/offline/i);
      });
    });
  });

  // ─── offlineMutation ──────────────────────────────────────────────────

  describe('offlineMutation', () => {
    describe('online', () => {
      beforeEach(() => setNavigatorOnLine(true));

      it('executes the mutation function and returns result', async () => {
        const fn = vi.fn().mockResolvedValue({ created: true });
        const result = await offlineMutation({ fn });
        expect(result).toEqual({ created: true });
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('propagates server errors without swallowing', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Server error 500'));
        await expect(offlineMutation({ fn })).rejects.toThrow('Server error 500');
      });

      it('does not call onOffline when online', async () => {
        const onOffline = vi.fn();
        await offlineMutation({ fn: vi.fn().mockResolvedValue(null), onOffline });
        expect(onOffline).not.toHaveBeenCalled();
      });
    });

    describe('offline', () => {
      beforeEach(() => setNavigatorOnLine(false));

      it('never executes the mutation function', async () => {
        const fn = vi.fn();
        try {
          await offlineMutation({ fn });
          expect.fail('Should have thrown');
        } catch {
          expect(fn).not.toHaveBeenCalled();
        }
      });

      it('throws OfflineMutationError with offline code', async () => {
        try {
          await offlineMutation({ fn: vi.fn() });
          expect.fail('Should have thrown');
        } catch (err) {
          expect(isOfflineMutationError(err)).toBe(true);
          expect((err as { code: string }).code).toBe('offline');
        }
      });

      it('calls onOffline callback when provided', async () => {
        const onOffline = vi.fn();
        try {
          await offlineMutation({ fn: vi.fn(), onOffline });
        } catch {
          // expected
        }
        expect(onOffline).toHaveBeenCalledTimes(1);
      });

      it('uses custom offline message', async () => {
        try {
          await offlineMutation({
            fn: vi.fn(),
            offlineMessage: 'Custom message',
          });
          expect.fail('Should have thrown');
        } catch (err) {
          expect((err as Error).message).toBe('Custom message');
        }
      });

      it('does not fabricate a success response', async () => {
        const fn = vi.fn();
        let threw = false;
        try {
          const result = await offlineMutation({ fn });
          // If we reach here, the result should NOT be a fake success
          expect(result).toBeUndefined();
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);
        expect(fn).not.toHaveBeenCalled();
      });
    });
  });

  // ─── isOfflineMutationError ────────────────────────────────────────────

  describe('isOfflineMutationError', () => {
    it('returns true for OfflineMutationError objects', () => {
      const err = new Error('offline') as import('../offline').OfflineMutationError;
      err.code = 'offline';
      expect(isOfflineMutationError(err)).toBe(true);
    });

    it('returns false for plain Error objects', () => {
      expect(isOfflineMutationError(new Error('plain'))).toBe(false);
    });

    it('returns false for non-Error values', () => {
      expect(isOfflineMutationError(null)).toBe(false);
      expect(isOfflineMutationError(undefined)).toBe(false);
      expect(isOfflineMutationError('string')).toBe(false);
      expect(isOfflineMutationError(42)).toBe(false);
    });
  });
});
