import { lazy, type LazyExoticComponent, type ComponentType } from "react";

/** Default number of retries after the initial attempt. */
export const DEFAULT_RETRIES = 1;

/** Default delay between attempts, in milliseconds. */
export const DEFAULT_DELAY_MS = 500;

/** Threshold for the one-time reload guard. */
export const RELOAD_GUARD_WINDOW_MS = 10 * 60 * 1000;

/** sessionStorage key holding the reload guard. */
export const RELOAD_GUARD_KEY = "creditra:chunk-reload-guard";

export interface LazyWithRetryOptions {
  /** Number of retries after the initial attempt. Defaults to 1. */
  retries?: number;
  /** Delay between attempts, in milliseconds. Defaults to 500. */
  delayMs?: number;
}

export class ChunkLoadError extends Error {
  public readonly cause?: unknown;

  constructor(message = "Failed to load a code chunk.", cause?: unknown) {
    super(message);
    this.name = "ChunkLoadError";
    this.cause = cause;
    // Restore prototype chain for targets transpiled to ES5.
    Object.setPrototypeOf(this, ChunkLoadError.prototype);
  }
}

/** Returns true when `value` is a `ChunkLoadError`. */
export function isChunkLoadError(value: unknown): value is ChunkLoadError {
  return value instanceof ChunkLoadError;
}

/**
 * Message fragments used by browsers when a dynamic import fails.
 * Chrome: "Failed to fetch dynamically imported module"
 * Firefox: "error loading dynamically imported module"
 * Safari: "Importing a module script failed"
 */
const CHUNK_ERROR_MESSAGES = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
];

/**
 * Classifies an error as a chunk-load failure. Centralised here so every
 * call site agrees on the same rules. Only `TypeError` instances whose
 * message matches a known browser phrase are considered chunk errors.
 */
export function isChunkLoadErrorMessage(error: unknown): boolean {
  if (isChunkLoadError(error)) {
    return true;
  }
  if (!(error instanceof TypeError)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return CHUNK_ERROR_MESSAGES.some((fragment) => message.includes(fragment));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Wraps a dynamic import factory with a single retry and a chunk error
 * classification step. On a second failure the returned promise rejects
 * with a `ChunkLoadError` so route-level boundaries can recover.
 */
export async function retryImport<T>(
  factory: () => Promise<T>,
  options: LazyWithRetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(delayMs);
      }
    }
  }

  if (isChunkLoadErrorMessage(lastError)) {
    throw new ChunkLoadError(
      "Failed to load a code chunk after retry.",
      lastError,
    );
  }

  // Non-chunk failures are rethrown unchanged so existing handling is untouched.
  throw lastError;
}

/**
 * Drop-in replacement for `React.lazy` that retries the import once and
 * surfaces a `ChunkLoadError` when the chunk is still unavailable.
 */
export function lazyWithRetry<T extends ComponentType>(
  factory: () => Promise<{ default: T }>,
  options: LazyWithRetryOptions = {},
): LazyExoticComponent<T> {
  return lazy(() => retryImport(factory, options));
}

/** Payload stored in sessionStorage to guard the one-time reload. */
export interface ReloadGuard {
  /** The path that triggered the reload. */
  path: string;
  /** Epoch milliseconds when the reload was scheduled. */
  timestamp: number;
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Reads the reload guard, returning null when absent or corrupt. */
export function readReloadGuard(): ReloadGuard | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(RELOAD_GUARD_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as ReloadGuard).path === "string" &&
      typeof (parsed as ReloadGuard).timestamp === "number"
    ) {
      return parsed as ReloadGuard;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeReloadGuard(guard: ReloadGuard): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(RELOAD_GUARD_KEY, JSON.stringify(guard));
  } catch {
    // sessionStorage can throw in private mode / quota errors; ignore.
  }
}

/** Returns true when a reload is allowed for `path` at `now`. */
export function canReload(now: number = Date.now()): boolean {
  const guard = readReloadGuard();
  if (!guard) {
    return true;
  }
  return now - guard.timestamp > RELOAD_GUARD_WINDOW_MS;
}
