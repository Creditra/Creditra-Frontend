/**
 * Shared cache for `Intl.NumberFormat` and `Intl.DateTimeFormat` instances.
 *
 * Constructing `Intl.*Format` objects on every render or helper call is
 * expensive. This module caches formatter instances by locale and
 * key-order-insensitive options with a bounded size to prevent unbounded
 * memory growth.
 */

export const MAX_FORMATTER_CACHE_SIZE = 100;

const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

function normalizeLocaleKey(locale?: Intl.LocalesArgument): string {
  if (locale === undefined) {
    return '';
  }
  if (Array.isArray(locale)) {
    return locale.map(String).join(',');
  }
  return String(locale);
}

function serializeOptions(options?: Record<string, unknown>): string {
  if (!options) {
    return '{}';
  }
  const sortedKeys = Object.keys(options).sort();
  const normalized: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    const value = options[key];
    if (value !== undefined) {
      normalized[key] = value;
    }
  }
  return JSON.stringify(normalized);
}

function buildCacheKey(
  locale?: Intl.LocalesArgument,
  options?: Record<string, unknown>,
): string {
  return `${normalizeLocaleKey(locale)}|${serializeOptions(options)}`;
}

function setBounded<T>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.size >= MAX_FORMATTER_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, value);
}

/**
 * Returns a cached `Intl.NumberFormat` instance for the given locale and options.
 */
export function getNumberFormat(
  locale?: Intl.LocalesArgument,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = buildCacheKey(locale, options as Record<string, unknown> | undefined);
  const cached = numberFormatCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(locale, options);
  setBounded(numberFormatCache, key, formatter);
  return formatter;
}

/**
 * Returns a cached `Intl.DateTimeFormat` instance for the given locale and options.
 */
export function getDateTimeFormat(
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = buildCacheKey(locale, options as Record<string, unknown> | undefined);
  const cached = dateTimeFormatCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, options);
  setBounded(dateTimeFormatCache, key, formatter);
  return formatter;
}
