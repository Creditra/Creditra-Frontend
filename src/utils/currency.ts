import { getAccruedInterest, type InterestBearingLine } from '../lib/interest';

/**
 * Lightweight currency formatting helpers.
 *
 * These are kept separate from `tokens.ts` so that non-UI modules can pull
 * formatting helpers without dragging in design-token CSS values.
 */

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';

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
 */
export function formatAmountInputValue(amount: number): string {
  return roundToCents(amount).toFixed(2);
}

/**
 * Format a number as a localized currency string.
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
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number as a compact currency string (e.g. `$1.2K`, `$3.4M`).
 *
 * Useful for chart axis labels and dashboard summary tiles where space is
 * constrained.
 */
export function formatCompactCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}
