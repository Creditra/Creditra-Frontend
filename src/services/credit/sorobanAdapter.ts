import type { CreditLine, CreditLineTransaction } from '@/types/creditLine';
import {
  type Money,
  fromBaseUnits,
  add,
  sub,
  cmp,
  mulRate,
} from '@/utils/money';

/**
 * Soroban adapter boundary types.
 *
 * Soroban tokens use 7-decimal i128 base units (strops). All credit amounts
 * crossing this boundary are represented as `Money` (bigint base units + decimals
 * + asset). Conversion from raw i128 values happens here and never through
 * `Number`.
 */

export const SOROBAN_TOKEN_DECIMALS = 7 as const;

export interface SorobanCreditLineRaw {
  id: string;
  asset: string;
  // Raw i128 base units as decimal strings (Soroban JSON representation).
  limitI128: string;
  utilizedI128: string;
  nextPaymentAmountI28?: string;
  feeI128?: string;
  interestI128?: string;
  collateralI128?: string;
  status?: CreditLine['status'];
  openedAt?: string;
  dueAt?: string;
}

export interface SorobanTransactionRaw {
  id: string;
  asset: string;
  amountI128: string;
  type: CreditLineTransaction['type'];
  timestamp?: string;
}

export interface SorobanCreditLine {
  id: string;
  asset: string;
  limit: Money;
  utilized: Money;
  nextPaymentAmount?: Money;
  fee?: Money;
  interest?: Money;
  collateral?: Money;
  status?: CreditLine['status'];
  openedAt?: string;
  dueAt?: string;
}

export interface SorobanTransaction {
  id: string;
  asset: string;
  amount: Money;
  type: CreditLineTransaction['type'];
  timestamp?: string;
}

function requireDecimals(asset: string): number {
  // Soroban SEC-18 tokens in this app always use 7-decimal base units.
  // The asset is carried on the Money value so asset-mismatch checks can fire.
  if (!asset) {
    throw new Error('Soroban adapter: missing asset identifier');
  }
  return SOROBAN_TOKEN_DECIMALS;
}

export function toMoney(i128: string | bigint, asset: string): Money {
  return fromBaseUnits(i128, requireDecimals(asset), asset);
}

export function mapCreditLine(raw: SorobanCreditLineRaw): SorobanCreditLine {
  const decimals = requireDecimals(raw.asset);
  const out: SorobanCreditLine = {
    id: raw.id,
    asset: raw.asset,
    limit: fromBaseUnits(raw.limitI128, decimals, raw.asset),
    utilized: fromBaseUnits(raw.utilizedI128, decimals, raw.asset),
  };
  if (raw.nextPaymentAmountI128 !== undefined) {
    out.nextPaymentAmount = fromBaseUnits(raw.nextPaymentAmountI128, decimals, raw.asset);
  }
  if (raw.feeI128 !== undefined) {
    out.fee = fromBaseUnits(raw.feeI128, decimals, raw.asset);
  }
  if (raw.interestI128 !== undefined) {
    out.interest = fromBaseUnits(raw.interestI128, decimals, raw.asset);
  }
  if (raw.collateralI128 !== undefined) {
    out.collateral = fromBaseUnits(raw.collateralI128, decimals, raw.asset);
  }
  if (raw.status !== undefined) out.status = raw.status;
  if (raw.openedAt !== undefined) out.openedAt = raw.openedAt;
  if (raw.dueAt !== undefined) out.dueAt = raw.dueAt;
  return out;
}

export function mapTransaction(raw: SorobanTransactionRaw): SorobanTransaction {
  const decimals = requireDecimals(raw.asset);
  const out: SorobanTransaction = {
    id: raw.id,
    asset: raw.asset,
    amount: fromBaseUnits(raw.amountI128, decimals, raw.asset),
    type: raw.type,
  };
  if (raw.timestamp !== undefined) out.timestamp = raw.timestamp;
  return out;
}

/**
 * Aggregate helpers for Soroban-shaped credit lines. These exist so that
 * consumers of the adapter can sum and derive balances without floating through
 * `Number`. Asset mismatches throw via the Money helpers.
 */
export function sumLimits(lines: ReadonlyArray<SorobanCreditLine>): Money {
  if (lines.length === 0) {
    throw new Error('sumLimits: no credit lines to aggregate');
  }
  return lines.reduce((acc, line) => add(acc, line.limit), lines[0].limit);
}

export function sumUtilized(lines: ReadonlyArray<SorobanCreditLine>): Money {
  if (lines.length === 0) {
    throw new Error('sumUtilized: no credit lines to aggregate');
  }
  return lines.reduce((acc, line) => add(acc, line.utilized), lines[0].utilized);
}

export function totalAvailable(lines: ReadonlyArray<SorobanCreditLine>): Money {
  return sub(sumLimits(lines), sumUtilized(lines));
}

export function compareBalance(a: Money, b: Money): number {
  return cmp(a, b);
}

export function applyFeeRate(amount: Money, feeBps: number): Money {
  return mulRate(amount, feeBps);
}
