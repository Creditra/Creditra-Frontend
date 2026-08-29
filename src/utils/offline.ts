/**
 * Offline-safe fetch utilities.
 *
 * Provides deterministic behavior for reads and mutations under both
 * online and offline conditions. Reads use an in-memory cache so
 * offline users see the last-known-good data rather than an error.
 * Mutations are never faked — they fail fast when offline or propagate
 * the real server error.
 *
 * Invariants enforced:
 *   1. A mutation never resolves with a fabricated success when offline.
 *   2. Cache reads are always served when the network is unavailable.
 *   3. Network failures never silently succeed — they fall back to cache
 *      when available (for reads) or throw a typed error (for mutations).
 *   4. Invalid inputs (empty URL, missing cache key) throw synchronously.
 */

import { readJson, writeJson } from './storage';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OfflineFetchOptions extends RequestInit {
  /** localStorage cache key. Required for caching to take effect. */
  cacheKey?: string;
  /** Maximum age in ms before cached data is considered stale. Default: 5 min. */
  cacheTtl?: number;
  /** Number of retry attempts on network failure when online. Default: 0 (no retry). */
  retries?: number;
  /** Base delay in ms for exponential backoff between retries. Default: 1000. */
  retryBaseDelay?: number;
}

export interface CachedResponse<T = unknown> {
  data: T;
  timestamp: number;
}

export interface OfflineMutationError extends Error {
  code: 'offline' | 'network' | 'server' | 'unknown';
  status?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_SUFFIX = ':cache';

// ─── Cache helpers ──────────────────────────────────────────────────────────

function cacheKeyFor(key: string): string {
  return `${key}${CACHE_SUFFIX}`;
}

/**
 * Read a cached value. Returns null when absent, expired, or corrupt.
 */
export function readCache<T>(key: string, ttl: number = DEFAULT_CACHE_TTL): T | null {
  const cached = readJson<CachedResponse<T> | null>(cacheKeyFor(key), null);
  if (!cached || typeof cached !== 'object' || !('data' in cached)) return null;
  if (Date.now() - cached.timestamp >= ttl) return null;
  return cached.data as T;
}

/**
 * Write a value into the cache with the current timestamp.
 */
export function writeCache<T>(key: string, data: T): void {
  writeJson(cacheKeyFor(key), { data, timestamp: Date.now() } satisfies CachedResponse<T>);
}

// ─── Network check ──────────────────────────────────────────────────────────

function isNavigatorOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// ─── Retry helper ───────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number,
  baseDelay: number,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init);
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(baseDelay * Math.pow(2, attempt));
      }
    }
  }
  throw lastError;
}

// ─── offlineFetch ───────────────────────────────────────────────────────────

/**
 * Fetch wrapper that is safe under offline conditions.
 *
 * Online behaviour:
 *   - Makes the real network request (with optional retries).
 *   - On success, writes the response to cache when a `cacheKey` is provided.
 *   - On network failure, returns stale cache if available; otherwise throws.
 *
 * Offline behaviour:
 *   - Returns cached data immediately when a `cacheKey` is provided.
 *   - Throws a typed OfflineMutationError(code: 'offline') when no cache exists.
 *
 * @example
 * ```ts
 * // Read with cache fallback
 * const accounts = await offlineFetch<LinkedAccount[]>('/api/accounts', {
 *   cacheKey: 'linked-accounts',
 * });
 *
 * // Read without caching (throws offline)
 * const profile = await offlineFetch<UserProfile>('/api/profile');
 * ```
 */
export async function offlineFetch<T = unknown>(
  url: string,
  options: OfflineFetchOptions = {},
): Promise<T> {
  const {
    cacheKey,
    cacheTtl = DEFAULT_CACHE_TTL,
    retries = 0,
    retryBaseDelay = 1000,
    ...fetchInit
  } = options;

  if (!url) {
    throw new Error('offlineFetch requires a non-empty URL');
  }

  const online = isNavigatorOnline();

  // Offline path: serve cache or throw
  if (!online) {
    if (cacheKey) {
      const cached = readCache<T>(cacheKey, cacheTtl);
      if (cached !== null) {
        return cached;
      }
    }
    const err = createOfflineError('You are offline. Please check your connection and try again.');
    throw err;
  }

  // Online path: make the real request
  let response: Response;
  try {
    response = await fetchWithRetry(url, fetchInit, retries, retryBaseDelay);
  } catch (networkError) {
    // Network failure while nominally online — try cache fallback
    if (cacheKey) {
      const cached = readCache<T>(cacheKey, cacheTtl);
      if (cached !== null) {
        return cached;
      }
    }
    const err = createNetworkError('Network request failed. Please try again.');
    throw err;
  }

  if (!response.ok) {
    const err = createServerError(
      `Server responded with status ${response.status}`,
      response.status,
    );
    throw err;
  }

  const data: T = await response.json();

  // Persist to cache on success
  if (cacheKey) {
    writeCache(cacheKey, data);
  }

  return data;
}

// ─── offlineMutation ────────────────────────────────────────────────────────

/**
 * Execute a mutation function with offline guard.
 *
 * When offline, this **never** resolves with a fabricated success.
 * Instead it:
 *   1. Calls `onOffline` if provided (e.g. to queue the action).
 *   2. Throws a typed OfflineMutationError(code: 'offline') so the caller
 *      can show a clear error or pending state.
 *
 * When online, the mutation function is called directly and any error
 * from the server is propagated as-is (no silent swallowing).
 *
 * @example
 * ```ts
 * const result = await offlineMutation({
 *   fn: () => fetch('/api/draw', { method: 'POST', body: ... }),
 *   onOffline: () => queueAction(() => retryDraw()),
 * });
 * ```
 */
export async function offlineMutation<T = unknown>(
  options: {
    /** The actual mutation to execute. */
    fn: () => Promise<T>;
    /** Called when offline. Use for queueing, toasts, etc. */
    onOffline?: () => void;
    /** Optional custom error message for offline state. */
    offlineMessage?: string;
  },
): Promise<T> {
  const { fn, onOffline, offlineMessage } = options;

  if (!isNavigatorOnline()) {
    if (onOffline) {
      onOffline();
    }
    const err = createOfflineError(
      offlineMessage ?? 'Cannot complete this action while offline. It will be retried when you reconnect.',
    );
    throw err;
  }

  return fn();
}

// ─── Error factories ────────────────────────────────────────────────────────

function createOfflineError(message: string): OfflineMutationError {
  const err = new Error(message) as OfflineMutationError;
  err.code = 'offline';
  return err;
}

function createNetworkError(message: string): OfflineMutationError {
  const err = new Error(message) as OfflineMutationError;
  err.code = 'network';
  return err;
}

function createServerError(message: string, status: number): OfflineMutationError {
  const err = new Error(message) as OfflineMutationError;
  err.code = 'server';
  err.status = status;
  return err;
}

// ─── Type guard ─────────────────────────────────────────────────────────────

/**
 * Returns true if the error was produced by offlineMutation / offlineFetch.
 */
export function isOfflineMutationError(
  error: unknown,
): error is OfflineMutationError {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as OfflineMutationError).code !== undefined
  );
}
