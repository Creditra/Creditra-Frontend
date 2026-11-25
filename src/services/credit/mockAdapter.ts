import type { CreditLine, CreditLineTransaction } from '@/types/creditLine';
import { fromBaseUnits, parseMoney, MoneyError, type Money } from '@/utils/money';

export interface CreditLineMoney extends Omit<CreditLine, 'limit' | 'utilized'> {
  limit: Money;
  utilized: Money;
  nextPaymentAmount?: Money;
}

export interface CreditLineTransactionMoney extends Omit<CreditLineTransaction, 'amount'> {
  amount: Money;
}

export interface CreditLineView {
  id: string;
  limit: Money;
  utilized: Money;
  nextPaymentAmount?: Money;
}

const USDC_DECIMALS = 7;
const USDC_ASSET = 'USDC';

/**
 * Convert a dollar amount to integer base units (e.g. stroops for a 7-decimal
 * asset) without drifting through float multiplication.
 *
 * The previous implementation did `Math.round(dollars * Number(scale))`, which
 * loses precision for fractional values such as `0.1 + 0.2` and for amounts near
 * or beyond 2^53. Instead the value is formatted as an exact decimal string and
 * parsed with {@link parseMoney}, which works in integer arithmetic only.
 * Rounding is half-up at the last digit (Number.prototype.toFixed rounds ties
 * toward the larger value). NaN and +/-Infinity are rejected with a clear
 * error instead of letting `BigInt(NaN)` throw an opaque RangeError.
 */
export function toBaseUnits(dollars: number, decimals: number): bigint {
  if (!Number.isFinite(dollars)) {
    throw new MoneyError(
      'invalid_input',
      `Cannot convert non-finite value to base units: ${dollars}`,
    );
  }

  const negative = dollars < 0;
  const plain = toPlainDecimal(Math.abs(dollars), decimals);
  const { units } = parseMoney(plain, decimals, '');
  return negative ? -units : units;
}

/**
 * Render `value` as a plain decimal string with exactly `decimals` fractional
 * digits and no exponent notation. `toFixed` already does this for |value| <
 * 1e21; for |value| >= 1e21 it falls back to exponential notation (e.g.
 * "1e+21"), which we expand so the result can be parsed as an exact integer.
 */
function toPlainDecimal(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  if (/[eE]/.test(fixed)) {
    return expandExponential(fixed, decimals);
  }
  return fixed;
}

/**
 * Expand exponential notation such as "1e+21" into a plain decimal string with
 * exactly `decimals` fractional digits. Callers only ever pass the non-negative
 * output of `toFixed`, so the mantissa carries no sign.
 */
function expandExponential(expForm: string, decimals: number): string {
  const match = /^(\d*\.?\d+)[eE]([+-]?\d+)$/.exec(expForm);
  if (!match) {
    throw new MoneyError('invalid_input', `Unexpected number format: ${expForm}`);
  }
  const mantissa = match[1];
  const exp = Number(match[2]);
  const dot = mantissa.indexOf('.');
  const intDigits = dot === -1 ? mantissa : mantissa.slice(0, dot);
  const fracDigits = dot === -1 ? '' : mantissa.slice(dot + 1);
  const digits = intDigits + fracDigits;
  const exp10 = exp - fracDigits.length;

  if (exp10 >= 0) {
    // The value is an integer multiple of 10^exp10; no rounding is needed.
    const integer = digits + '0'.repeat(exp10);
    return decimals > 0 ? `${integer}.${'0'.repeat(decimals)}` : integer;
  }

  // exp10 < 0: the value has a fractional part. Round half-up to `decimals`
  // fractional digits with integer arithmetic so a carry into the units
  // (e.g. 0.9999 -> 1.00) is handled exactly.
  const scaled = roundHalfUp(BigInt(digits || '0'), exp10 + decimals);
  return formatScaled(scaled, decimals);
}

function roundHalfUp(value: bigint, shift: number): bigint {
  if (shift >= 0) {
    return value * 10n ** BigInt(shift);
  }
  const divisor = 10n ** BigInt(-shift);
  const quotient = value / divisor;
  const remainder = value % divisor;
  return remainder * 2n >= divisor ? quotient + 1n : quotient;
}

function formatScaled(scaled: bigint, decimals: number): string {
  const digits = scaled.toString();
  if (decimals === 0) {
    return digits;
  }
  const padded = digits.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, padded.length - decimals);
  const fractionPart = padded.slice(padded.length - decimals);
  return `${integerPart}.${fractionPart}`;
}

function toMoney(dollars: number, asset: string, decimals: number): Money {
  return fromBaseUnits(toBaseUnits(dollars, decimals), decimals, asset);
}

export function toLegacyNumber(m: Money): number {
  const scale = 10n ** BigInt(m.decimals);
  return Number(m.units) / Number(scale);
}

export function mapCreditLineToView(line: CreditLine): CreditLineView {
  return {
    id: line.id,
    limit: toMoney(line.limit, USDC_ASSET, USDC_DECIMALS),
    utilized: toMoney(line.utilized, USDC_ASSET, USDC_DECIMALS),
    nextPaymentAmount:
      line.nextPaymentAmount != null
        ? toMoney(line.nextPaymentAmount, USDC_ASSET, USDC_DECIMALS)
        : undefined,
  };
}

export function mapTransactionToMoney(tx: CreditLineTransaction): CreditLineTransactionMoney {
  return {
    ...tx,
    amount: toMoney(tx.amount, USDC_ASSET, USDC_DECIMALS),
  };
}

export function mapCreditLinesToViews(lines: CreditLine[]): CreditLineView[] {
  return lines.map(mapCreditLineToView);
}

export function mapTransactionsToMoney(txs: CreditLineTransaction[]): CreditLineTransactionMoney[] {
  return txs.map(mapTransactionToMoney);
}

export const USDC_MONEY_DECIMALS = USDC_DECIMALS;
export const USDC_MONEY_ASSET = USDC_ASSET;
