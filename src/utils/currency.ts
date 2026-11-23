import { getAccruedInterest, type InterestBearingLine } from '../lib/interest';
import { getNumberFormat } from './formatters';

/**
 * Lightweight currency formatting helpers.
 *
 * These are kept separate from `tokens.ts` so that non-UI modules can pull
 * formatting helpers without dragging in design-token CSS values.
 */

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';
const INVALID_AMOUNT_PLACEHOLDER = '—';
const ISO_CURRENCY_RE = /^[A-Za-z]{3}$/;

const usdFormatterCache = new Map<number, Intl.NumberFormat>();

function getUsdFormatter(decimals: number): Intl.NumberFormat {
  const cached = usdFormatterCache.get(decimals);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
    maximumFractionDigits: decimals,
  });
  usdFormatterCache.set(decimals, formatter);
  return formatter;
}

/**
 * Format a numeric amount as en-US USD currency using a cached
 * `Intl.NumberFormat` instance.
 *
 * @param amount   - Numeric amount to format.
 * @param options  - `{ decimals }` controls `maximumFractionDigits` (default `2`).
 */
export function formatUsd(
  amount: number,
  options?: { decimals?: number },
): string {
  if (!Number.isFinite(amount)) {
    return INVALID_AMOUNT_PLACEHOLDER;
  }
  const decimals = options?.decimals ?? 2;
  return getUsdFormatter(decimals).format(amount);
}

/**
 * Normalize and validate a BCP 47 locale tag for `Intl.NumberFormat`,
 * falling back to `DEFAULT_LOCALE` when missing, malformed, or unsupported.
 */
function resolveNumberLocale(locale: unknown): string {
  if (typeof locale !== 'string') {
    return DEFAULT_LOCALE;
  }
  const normalized = locale.trim().replace(/_/g, '-');
  if (!normalized) {
    return DEFAULT_LOCALE;
  }
  try {
    const supported = Intl.NumberFormat.supportedLocalesOf(normalized);
    return supported.length > 0 ? supported[0] : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Validate and normalize an ISO 4217 currency code, falling back to
 * `DEFAULT_CURRENCY` when missing or malformed.
 */
function resolveCurrencyCode(currency: unknown): string {
  if (typeof currency !== 'string') {
    return DEFAULT_CURRENCY;
  }
  const trimmed = currency.trim();
  if (!ISO_CURRENCY_RE.test(trimmed)) {
    return DEFAULT_CURRENCY;
  }
  return trimmed.toUpperCase();
}

/**
 * Safely construct an `Intl.NumberFormat` for currency formatting.
 * Retries with `DEFAULT_LOCALE` on locale failure and with `DEFAULT_CURRENCY`
 * on currency failure; returns `null` only if all fallbacks fail.
 */
function createCurrencyFormatter(
  currency: unknown,
  locale: unknown,
  options: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>,
): Intl.NumberFormat | null {
  const safeLocale = resolveNumberLocale(locale);
  const safeCurrency = resolveCurrencyCode(currency);

  try {
    return getNumberFormat(safeLocale, {
      ...options,
      style: 'currency',
      currency: safeCurrency,
    });
  } catch {
    // Retry with DEFAULT_LOCALE first, then DEFAULT_CURRENCY.
    try {
      return getNumberFormat(DEFAULT_LOCALE, {
        ...options,
        style: 'currency',
        currency: safeCurrency,
      });
    } catch {
      try {
        return getNumberFormat(DEFAULT_LOCALE, {
          ...options,
          style: 'currency',
          currency: DEFAULT_CURRENCY,
        });
      } catch {
        return null;
      }
    }
  }
}

/**
 * Round a dollar amount to the nearest cent using standard half-up rounding.
 */
export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Estimated monthly interest for projection copy and payment estimates.
 *
 * Uses the same formula as the repay modal's payoff preview:
 * `(principal × APR) / 12`, rounded to cents.
 */
export function computeMonthlyAccruedInterest(
  principal: number,
  aprPercent: number,
): number {
  if (principal <= 0 || aprPercent <= 0) {
    return 0;
  }
  return roundToCents((principal * (aprPercent / 100)) / 12);
}

/**
 * Full payoff for a credit line: principal plus day-count accrued interest.
 */
export function computeFullPayoffAmount(
  line: InterestBearingLine,
  now: Date,
): number {
  if (line.utilized <= 0) {
    return 0;
  }
  return roundToCents(line.utilized + getAccruedInterest(line, now));
}

/**
 * Format a numeric amount as a fixed two-decimal string for controlled inputs.
 *
 * Fallback behaviour: returns `'—'` when `amount` is not a finite number.
 */
export function formatAmountInputValue(amount: number): string {
  if (!Number.isFinite(amount)) {
    return INVALID_AMOUNT_PLACEHOLDER;
  }
  return roundToCents(amount).toFixed(2);
}

/**
 * Format a number as a localized currency string.
 *
 * Fallback behaviour:
 * - Returns `'—'` when `amount` is not a finite number (`NaN`, `±Infinity`, etc.).
 * - Invalid, empty, or unsupported `locale` values (including underscore forms
 *   normalized via `_` → `-` when valid, or `null`/`undefined`) fall back to `'en-US'`.
 * - Invalid or empty `currency` codes (not matching `/^[A-Za-z]{3}$/`) fall back
 *   to `'USD'`. Lower-case valid codes (e.g. `'usd'`) are upper-cased.
 * - Never throws `RangeError`; if formatter construction still fails, renders
 *   `${amount.toFixed(2)} USD`.
 *
 * @param amount   - The numeric amount to format.
 * @param currency - ISO 4217 currency code. Defaults to USD.
 * @param locale   - BCP 47 locale string. Defaults to en-US.
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!Number.isFinite(amount)) {
    return INVALID_AMOUNT_PLACEHOLDER;
  }
  const formatter = createCurrencyFormatter(currency, locale, {
    maximumFractionDigits: 2,
  });
  if (!formatter) {
    return `${amount.toFixed(2)} ${DEFAULT_CURRENCY}`;
  }
  return formatter.format(amount);
}

/**
 * Format a number as a compact currency string (e.g. `$1.2K`, `$3.4M`).
 *
 * Useful for chart axis labels and dashboard summary tiles where space is
 * constrained.
 *
 * Fallback behaviour:
 * - Returns `'—'` when `amount` is not a finite number (`NaN`, `±Infinity`, etc.).
 * - Invalid, empty, or unsupported `locale` values (including `null`/`undefined`)
 *   fall back to `'en-US'`.
 * - Invalid or empty `currency` codes (not matching `/^[A-Za-z]{3}$/`) fall back
 *   to `'USD'`. Lower-case valid codes (e.g. `'usd'`) are upper-cased.
 * - Never throws `RangeError`; if formatter construction still fails, renders
 *   `${amount.toFixed(2)} USD`.
 *
 * @param amount   - The numeric amount to format.
 * @param currency - ISO 4217 currency code. Defaults to USD.
 * @param locale   - BCP 47 locale string. Defaults to en-US.
 */
export function formatCompactCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!Number.isFinite(amount)) {
    return INVALID_AMOUNT_PLACEHOLDER;
  }
  const formatter = createCurrencyFormatter(currency, locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  if (!formatter) {
    return `${amount.toFixed(2)} ${DEFAULT_CURRENCY}`;
  }
  return formatter.format(amount);
}
