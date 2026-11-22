import { roundToCents } from './currency';

export interface Money {
  /** Amount in base units (e.g. stroops for 7-decimal assets). */
  readonly units: bigint;
  /** Number of fractional digits for the asset. */
  readonly decimals: number;
  /** Asset identifier (e.g. "USDC", "XLM"). */
  readonly asset: string;
}

export type MoneyErrorCode =
  | 'invalid_input'
  | 'empty_input'
  | 'exponent_notation'
  | 'sign_not_allowed'
  | 'too-many-decimals'
  | 'invalid_decimals'
  | 'invalid_base_units'
  | 'asset_mismatch'
  | 'decimals_mismatch';

export class MoneyError extends Error {
  readonly code: MoneyErrorCode;

  constructor(code: MoneyErrorCode, message: string) {
    super(message);
    this.name = 'MoneyError';
    this.code = code;
  }
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38) {
    throw new MoneyError(
      'invalid_decimals',
      `decimals must be an integer between 0 and 38, received ${decimals}`,
    );
  }
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function assertSameAsset(a: Money, b: Money): void {
  if (a.asset !== b.asset) {
    throw new MoneyError(
      'asset_mismatch',
      `Cannot combine ${a.asset} with ${b.asset}`,
    );
  }
  if (a.decimals !== b.decimals) {
    throw new MoneyError(
      'decimals_mismatch',
      `Cannot combine ${a.asset} with ${a.decimals} decimals and ${b.decimals} decimals`,
    );
  }
}

export function fromBaseUnits(
  i128: bigint | string,
  decimals: number,
  asset: string,
): Money {
  assertDecimals(decimals);
  let units: bigint;
  if (typeof i128 === 'bigint') {
    units = i128;
  } else {
    const trimmed = i128.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw new MoneyError(
        'invalid_base_units',
        `Base units must be an integer string, received "${i128}"`,
      );
    }
    units = BigInt(trimmed);
  }
  return { units, decimals, asset };
}

export function parseMoney(
  input: string,
  decimals: number,
  asset: string,
): Money {
  assertDecimals(decimals);

  if (typeof input !== 'string') {
    throw new MoneyError('invalid_input', 'Input must be a string');
  }

  const trimmed = input.trim();
  if (trimmed === '') {
    throw new MoneyError('empty_input', 'Input must not be empty');
  }

  if (/[eE]/.test(trimmed)) {
    throw new MoneyError(
      'exponent_notation',
      `Exponent notation is not allowed: "${input}"`,
    );
  }

  if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
    throw new MoneyError(
      'sign_not_allowed',
      `Sign is not allowed: "${input}"`,
    );
  }

  if (!/^[0-9]*(\.[0-9]*)?$/.test(trimmed)) {
    throw new MoneyError(
      'invalid_input',
      `Invalid money input: "${input}"`,
    );
  }

  const [dollarPart, fracPart = ''] = trimmed.split('.');

  if (fracPart.length > decimals) {
    throw new MoneyError(
      'too-many-decimals',
      `Too many decimal digits for ${decimals}-decimal asset: "${input}"`,
    );
  }

  const normalizedInteger = dollarPart === '' ? '0' : dollarPart;
  const paddedFrac = fracPart.padEnd(decimals, '0');
  const units = BigInt(normalizedInteger + paddedFrac);

  return { units, decimals, asset };
}

export function add(a: Money, b: Money): Money {
  assertSameAsset(a, b);
  return { units: a.units + b.units, decimals: a.decimals, asset: a.asset };
}

export function sub(a: Money, b: Money): Money {
  assertSameAsset(a, b);
  return { units: a.units - b.units, decimals: a.decimals, asset: a.asset };
}

export function cmp(a: Money, b: Money): -1 | 0 | 1 {
  assertSameAsset(a, b);
  if (a.units < b.units) return -1;
  if (a.units > b.units) return 1;
  return 0;
}

/**
 * Multiply a Money by a rate expressed in basis points (1 bps = 0.01%).
 *
 * Rounding mode: half-up away from zero (the common financial convention for
 * fees and interest). Exactly .5 rounds away from zero. This is documented and
 * pinned by tests at the .5 boundaries.
 */
export function mulRate(m: Money, bps: number): Money {
  if (!Number.isInteger(bps)) {
    throw new MoneyError(
      'invalid_input',
      `Rate in bps must be an integer, received ${bps}`,
    );
  }
  const bigsBps = BigInt(bps);
  const numerator = m.units * bigsBps;
  const denominator = 10000n;
  const negative = numerator < 0n;
  const absNum = negative ? -numerator : numerator;
  const quotient = absNum / denominator;
  const remainder = absNum % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  const units = negative ? -rounded : rounded;
  return { units: units, decimals: m.decimals, asset: m.asset };
}

/**
 * Convert Money to a JavaScript number for display only. Never use the
 * result in arithmetic; it loses precision above 2^53 base units.
 */
export function toDisplayNumber(m: Money): number {
  const divisor = pow10(m.decimals);
  const whole = m.units / divisor;
  const remainder = m.units % divisor;
  return Number(whole) + Number(remainder) / Number(divisor);
}

function formatUnitsUnsigned(units: bigint, decimals: number): string {
  const divisor = pow10(decimals);
  const whole = units / divisor;
  const remainder = units % divisor;
  if (decimals === 0) return whole.toString();
  const frac = remainder.toString().padStart(decimals, '0');
  return `${whole.toString()}.${frac}`;
}

/**
 * Format Money as a string. Uses the asset decimals and the optional locale.
 * The decimal separator follows the locale, but the digits are always exact
 * (base units are never converted through a float).
 */
export function formatMiney(m: Money, locale?: string): string {
  const negative = m.units < 0n ? '-' : '';
  const abs = m.units < 0n ? -m.units : m.units;
  const raw = formatUnitsUnsigned(abs, m.decimals);
  if (!locale) return `${negative}${raw}`;
  const [dollarPart, fracPart] = raw.split('.');
  const grouped = Number(dollarPart).toLocaleString(locale);
  if (fracPart === undefined) return `${negative}${grouped}`;
  const decimalSep = (11.5).toLocaleString(locale).replace(/\d/g, '');
  return `${negative}${grouped}${decimalSep}${fracPart}`;
}

/**
 * Legacy shim: convert Money to a number for components that have not yet
 * migrated. Display only.
 */
export function toLegacyNumber(m: Money): number {
  return toDisplayNumber(m);
}

/**
 * Round a Money to cents using half-up away from zero (matching the
 * documented mulRate mode). Returns a Money with two decimals.
 */
export function roundMoneyToCents(m: Money): Money {
  if (m.decimals <= 2) {
    const scale = pow10(2 - m.decimals);
    return { units: m.units * scale, decimals: 2, asset: m.asset };
  }
  const divisor = pow10(m.decimals - 2);
  const negative = m.units < 0n;
  const abs = negative ? -m.units : m.units;
  const quotient = abs / divisor;
  const remainder = abs % divisor;
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;
  return {
    units: negative ? -rounded : rounded,
    decimals: 2,
    asset: m.asset,
  };
}

/**
 * Display helper that rounds to cents for consistency with the existing
 * currency formatting surfaces. Uses the currency util's rounding on the
 * display number only after exact base-unit aggregation.
 */
export function formatMineyCents(m: Money, locale?: string): string {
  const cents = roundMoneyToCents(m);
  const display = toDisplayNumber(cents);
  const rounded = roundToCents(display);
  if (!locale) return rounded.toFixed(2);
  return rounded.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
