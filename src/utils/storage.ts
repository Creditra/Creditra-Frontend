/**
 * Safe wrappers around `localStorage` with schema versioning and migrations.
 * Safe wrappers around browser storage.
 *
 * Storage can throw in private browsing modes, in iframes with strict
 * cookie policies, and when the quota is exceeded. These helpers return
 * sensible fallbacks instead of letting the exception bubble up and
 * crash the React render.
 */

export interface VersionedEnvelope<T> {
  v: number;
  data: T;
}

/**
 * Migrates a stored value from `fromVersion` to the target schema version.
 * `fromVersion === 0` indicates an unversioned legacy value (either parsed JSON
 * or a raw non-JSON string).
 *
 * Return `undefined` to signal that the stored value is corrupt/unusable and
 * the caller should fall back to its default value.
 */
export type StorageMigration<T = unknown> = (
  raw: unknown,
  fromVersion: number,
) => T | undefined;

export interface ReadVersionedOptions<T> {
  /** Target schema version (>= 1). */
  version: number;
  /** Value returned when the key is missing, corrupt, or from a future version. */
  fallback: T;
  /** Optional migration function (falls back to the migration registry if omitted). */
  migrate?: StorageMigration<T>;
  /** Optional runtime guard for validating the payload at the current version. */
  validate?: (data: unknown) => data is T;
}

export interface WriteVersionedOptions {
  /** Target schema version (>= 1). */
  version: number;
}

export interface StorageMigrationRegistration<T = unknown> {
  version: number;
  migrate: StorageMigration<T>;
}

const migrationRegistry = new Map<string, StorageMigrationRegistration<unknown>>();

/**
 * Register a migration handler for a storage key in the global registry.
 */
export function registerStorageMigration<T>(
  key: string,
  registration: StorageMigrationRegistration<T>,
): void {
  migrationRegistry.set(key, registration as StorageMigrationRegistration<unknown>);
}

/**
 * Look up a registered migration handler for a storage key.
 */
export function getStorageMigration(
  key: string,
): StorageMigrationRegistration<unknown> | undefined {
  return migrationRegistry.get(key);
}

/**
 * Clear all registered migrations. Intended for tests.
 */
export function clearStorageMigrations(): void {
  migrationRegistry.clear();
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isVersionedEnvelope(value: unknown): value is VersionedEnvelope<unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.v === 'number' &&
    Number.isInteger(record.v) &&
    record.v >= 1 &&
    'data' in record
  );
}

/**
 * Check whether a key exists in localStorage. Returns `false` if storage is
 * unavailable.
 */
export function hasKey(key: string): boolean {
  try {
    const storage = getLocalStorage();
    if (!storage) return false;
    return storage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Read and JSON-parse a value from localStorage.
 *
 * Returns `fallback` if the key is missing, parsing fails, or storage is
 * unavailable.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const storage = getLocalStorage();
    if (!storage) return fallback;
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * JSON-serialize a value and write it to localStorage.
 *
 * Returns `true` when the write succeeds and `false` if storage is
 * unavailable or throws (e.g. quota exceeded, private browsing).
 */
export function writeJson<T>(key: string, value: T): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const storage = getLocalStorage();
    if (!storage) return;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    /* swallow — quota or private-mode write failure */
    return false;
  }
}

/** Read and JSON-parse a value from sessionStorage, falling back on failure.
*/
export function readSessionJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return fallback;
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** JSON-serialize a value and write it to sessionStorage, silently no-oping on failure. */
export function writeSessionJson<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* swallow — storage may be unavailable */
  }
}

/** Remove a key from localStorage. Silently no-ops on failure. */
export function removeKey(key: string): void {
  try {
    const storage = getLocalStorage();
    if (!storage) return;
    storage.removeItem(key);
  } catch {
    /* swallow */
  }
}

/**
 * Write a value wrapped in a versioned `{ v, data }` envelope to localStorage.
 */
export function writeVersioned<T>(
  key: string,
  data: T,
  options: WriteVersionedOptions | number,
): void {
  const version = typeof options === 'number' ? options : options.version;
  const envelope: VersionedEnvelope<T> = { v: version, data };
  writeJson(key, envelope);
}

/**
 * Read a versioned `{ v, data }` envelope from localStorage.
 *
 * - Missing key or unavailable storage -> returns `fallback`.
 * - Matching version -> validates (if `validate` provided) and returns `data`.
 * - Unknown future version (`v > version`) -> ignores safely and returns `fallback`
 *   without overwriting stored data.
 * - Older version (`v < version`) or legacy unversioned value (`fromVersion = 0`)
 *   -> runs `options.migrate` (or a registered migration for `key`). If migration
 *   succeeds and passes `validate`, rewrites the key in the new `{ v, data }`
 *   envelope and returns the migrated value.
 * - Corrupt JSON or failed migration/validation -> falls back safely to `fallback`.
 */
export function readVersioned<T>(
  key: string,
  options: ReadVersionedOptions<T>,
): T {
  const { version, fallback, validate } = options;
  const migrate =
    options.migrate ??
    (migrationRegistry.get(key)?.migrate as StorageMigration<T> | undefined);

  const storage = getLocalStorage();
  if (!storage) return fallback;

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return fallback;
  }

  if (raw === null) return fallback;

  let parsed: unknown;
  let isJson = true;
  try {
    parsed = JSON.parse(raw);
  } catch {
    isJson = false;
    parsed = raw;
  }

  if (isJson && isVersionedEnvelope(parsed)) {
    if (parsed.v === version) {
      if (validate && !validate(parsed.data)) {
        return fallback;
      }
      return parsed.data as T;
    }

    // Unknown future version: ignore safely without mutating storage.
    if (parsed.v > version) {
      return fallback;
    }

    // Older versioned envelope: attempt migration.
    if (!migrate) return fallback;
    try {
      const migrated = migrate(parsed.data, parsed.v);
      if (migrated === undefined) return fallback;
      if (validate && !validate(migrated)) return fallback;
      writeVersioned(key, migrated, { version });
      return migrated;
    } catch {
      return fallback;
    }
  }

  // Legacy unversioned value (either parsed JSON or a raw plain string).
  if (!migrate) return fallback;
  try {
    const migrated = migrate(parsed, 0);
    if (migrated === undefined) return fallback;
    if (validate && !validate(migrated)) return fallback;
    writeVersioned(key, migrated, { version });
    return migrated;
  } catch {
    return fallback;
  }
}
