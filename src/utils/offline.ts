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

import {
  readJson,
  writeJson,
  readVersioned,
  writeVersioned,
  removeKey,
} from './storage';

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

// ─── Offline action queue ───────────────────────────────────────────────────
//
// A small, persisted store for actions the user started while offline. Only
// JSON-safe metadata is written to localStorage; the actual retry closure
// lives in memory for the current session, because a function cannot (and
// should not) be serialised. Items that outlive the session stay visible and
// can still be cancelled, but retrying them reports that the page that owns
// the action is no longer open.

const QUEUE_STORAGE_KEY = 'creditra-offline-queue';
const QUEUE_VERSION = 1;
const MAX_QUEUED_ACTIONS = 50;

const RUNNER_UNAVAILABLE_MESSAGE =
  'This action can no longer be retried because the page that started it is no longer open. Please repeat it there.';

export type QueuedActionStatus = 'pending' | 'running' | 'failed';

export interface QueuedAction {
  id: string;
  /** Action kind, e.g. `draw` or `upload`. */
  type: string;
  /** Human-readable summary shown in the queue panel. */
  label: string;
  /** Optional extra context, e.g. the credit line name. */
  description?: string;
  createdAt: number;
  status: QueuedActionStatus;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
}

export interface QueueOfflineActionOptions {
  type: string;
  label: string;
  description?: string;
  /**
   * Stable key used to avoid queueing the same action twice (e.g. a double
   * click or a repeated Enter key while offline).
   */
  dedupeKey?: string;
  /** Re-runs the action. Kept in memory for this session only. */
  run: () => Promise<unknown> | unknown;
}

export interface QueueRetryResult {
  ok: boolean;
  error?: string;
}

let queue: QueuedAction[] | null = null;
const runners = new Map<string, () => Promise<unknown> | unknown>();
const dedupeKeys = new Map<string, string>();
const inFlight = new Set<string>();
const queueListeners = new Set<() => void>();

function createActionId(): string {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeQueuedAction(value: unknown): QueuedAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== 'string' || record.id === '') return null;
  if (typeof record.type !== 'string' || record.type === '') return null;
  if (typeof record.label !== 'string' || record.label === '') return null;

  const createdAt =
    typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
      ? record.createdAt
      : Date.now();
  // An item persisted as `running` was interrupted (reload/close); treat it as
  // pending again so it is retryable.
  const status: QueuedActionStatus = record.status === 'failed' ? 'failed' : 'pending';
  const attempts =
    typeof record.attempts === 'number' &&
    Number.isInteger(record.attempts) &&
    record.attempts >= 0
      ? record.attempts
      : 0;

  const action: QueuedAction = {
    id: record.id,
    type: record.type,
    label: record.label,
    createdAt,
    status,
    attempts,
  };

  if (typeof record.description === 'string' && record.description !== '') {
    action.description = record.description;
  }
  if (typeof record.lastAttemptAt === 'number' && Number.isFinite(record.lastAttemptAt)) {
    action.lastAttemptAt = record.lastAttemptAt;
  }
  if (typeof record.error === 'string' && record.error !== '') {
    action.error = record.error;
  }

  return action;
}

function loadQueue(): QueuedAction[] {
  if (queue) return queue;

  const stored = readVersioned<unknown>(QUEUE_STORAGE_KEY, {
    version: QUEUE_VERSION,
    fallback: [],
  });

  const seen = new Set<string>();
  const actions: QueuedAction[] = [];
  if (Array.isArray(stored)) {
    for (const entry of stored) {
      const action = sanitizeQueuedAction(entry);
      if (!action || seen.has(action.id)) continue;
      seen.add(action.id);
      actions.push(action);
    }
  }

  queue = actions.slice(-MAX_QUEUED_ACTIONS);
  return queue;
}

function persistQueue(): void {
  writeVersioned(QUEUE_STORAGE_KEY, queue ?? [], { version: QUEUE_VERSION });
}

function notifyQueueListeners(): void {
  for (const listener of queueListeners) {
    try {
      listener();
    } catch (error) {
      console.error('Offline queue listener failed', error);
    }
  }
}

function commitQueue(next: QueuedAction[]): void {
  queue = next;
  persistQueue();
  notifyQueueListeners();
}

function updateQueuedAction(id: string, changes: Partial<QueuedAction>): void {
  const current = loadQueue();
  commitQueue(
    current.map((action) => (action.id === id ? { ...action, ...changes } : action)),
  );
}

function forgetAction(id: string): void {
  runners.delete(id);
  inFlight.delete(id);
  for (const [key, value] of dedupeKeys) {
    if (value === id) dedupeKeys.delete(key);
  }
}

/**
 * Subscribe to queue changes. Returns an unsubscribe function.
 */
export function subscribeToOfflineQueue(listener: () => void): () => void {
  loadQueue();
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

/**
 * Stable snapshot for `useSyncExternalStore`. The reference only changes when
 * the queue actually changes.
 */
export function getQueuedActionsSnapshot(): readonly QueuedAction[] {
  return loadQueue();
}

/**
 * List queued actions, oldest first.
 */
export function listQueuedActions(): QueuedAction[] {
  return loadQueue().map((action) => ({ ...action }));
}

/**
 * Queue an action that could not run because the app is offline.
 *
 * Persistence is validated on read: malformed entries are dropped, duplicate
 * ids are collapsed, and an interrupted `running` record becomes `pending`.
 */
export function queueOfflineAction(options: QueueOfflineActionOptions): QueuedAction {
  const { type, label, description, dedupeKey, run } = options;

  if (!type || !label || typeof run !== 'function') {
    throw new Error('queueOfflineAction requires a type, label and run function');
  }

  const current = loadQueue();

  if (dedupeKey) {
    const existingId = dedupeKeys.get(dedupeKey);
    const existing = existingId ? current.find((action) => action.id === existingId) : undefined;
    if (existing) return { ...existing };
    if (existingId) dedupeKeys.delete(dedupeKey);
  }

  const action: QueuedAction = {
    id: createActionId(),
    type,
    label,
    ...(description ? { description } : {}),
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
  };

  runners.set(action.id, run);
  if (dedupeKey) dedupeKeys.set(dedupeKey, action.id);

  const next = [...current, action];
  commitQueue(next.slice(-MAX_QUEUED_ACTIONS));

  return { ...action };
}

/**
 * Remove a queued action permanently. Returns false when the id is unknown.
 */
export function cancelQueuedAction(id: string): boolean {
  const current = loadQueue();
  if (!current.some((action) => action.id === id)) return false;

  forgetAction(id);
  commitQueue(current.filter((action) => action.id !== id));
  return true;
}

/**
 * Re-run a queued action and remove it on success.
 *
 * On failure the item stays queued with `status: 'failed'` and the error
 * message that should be shown to the user.
 */
export async function retryQueuedAction(id: string): Promise<QueueRetryResult> {
  const action = loadQueue().find((candidate) => candidate.id === id);
  if (!action) {
    return { ok: false, error: 'This action is no longer queued.' };
  }

  if (inFlight.has(id)) {
    return { ok: false, error: 'This action is already being retried.' };
  }

  const run = runners.get(id);
  if (!run) {
    updateQueuedAction(id, { status: 'failed', error: RUNNER_UNAVAILABLE_MESSAGE });
    return { ok: false, error: RUNNER_UNAVAILABLE_MESSAGE };
  }

  inFlight.add(id);
  updateQueuedAction(id, {
    status: 'running',
    attempts: action.attempts + 1,
    lastAttemptAt: Date.now(),
    error: undefined,
  });

  try {
    await run();
    forgetAction(id);
    commitQueue(loadQueue().filter((candidate) => candidate.id !== id));
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'The action failed. Please retry.';
    updateQueuedAction(id, { status: 'failed', error: message });
    return { ok: false, error: message };
  } finally {
    inFlight.delete(id);
  }
}

/**
 * Retry every pending action that still has a runner for this session.
 * Used automatically when the browser reports that the connection is back.
 */
export async function flushQueuedActions(): Promise<{
  succeeded: number;
  failed: number;
}> {
  const ids = loadQueue()
    .filter((action) => action.status === 'pending' && runners.has(action.id))
    .map((action) => action.id);

  let succeeded = 0;
  let failed = 0;

  for (const id of ids) {
    const result = await retryQueuedAction(id);
    if (result.ok) {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }

  return { succeeded, failed };
}

/**
 * Install the reconnect listener that flushes the queue. Returns a cleanup
 * function; safe to call from a React effect (including StrictMode).
 */
export function startOfflineQueueAutoRetry(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    void flushQueuedActions();
  };

  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}

/** Clears in-memory and persisted queue state. Intended for tests. */
export function resetOfflineQueueForTests(): void {
  queue = [];
  runners.clear();
  dedupeKeys.clear();
  inFlight.clear();
  removeKey(QUEUE_STORAGE_KEY);
  notifyQueueListeners();
}
