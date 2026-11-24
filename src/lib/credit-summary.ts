import type { CreditLine } from "../types/creditLine";
import {
  type Money,
  parseMoney,
  add,
  sub,
  toDisplayNumber,
  roundMoneyToCents,
} from "../utils/money";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All credit-line amounts are USD with 2 decimal places. */
const ASSET = "USD";
const DECIMALS = 2;

/** Zero sentinel in USD cents. */
const ZERO: Money = { units: 0n, decimals: DECIMALS, asset: ASSET };

// ---------------------------------------------------------------------------
// lineMoney — convert a CreditLine numeric field to exact Money
// ---------------------------------------------------------------------------

/**
 * Convert a `CreditLine` numeric dollar value to an exact `Money` value.
 *
 * Policy: values are stored as plain JS numbers (dollars with up to 2 decimal
 * places) and converted via `parseMoney` on a fixed-precision string.  This
 * avoids float-addition drift when summing many lines.
 *
 * Values above `Number.MAX_SAFE_INTEGER` are extremely unlikely in practice
 * (they would represent credit limits over ~$9 quadrillion) but are still
 * handled correctly because `parseMoney` works on the string representation.
 */
export function lineMoney(value: number): Money {
  if (!Number.isFinite(value) || value < 0) {
    return ZERO;
  }
  // toFixed(2) gives us a stable 2-decimal string with no exponent notation.
  return parseMoney(value.toFixed(DECIMALS), DECIMALS, ASSET);
}

// ---------------------------------------------------------------------------
// BorrowerRiskScore
// ---------------------------------------------------------------------------

export type BorrowerRiskScore = {
  score: number | null;
  basis: "borrower" | "limit_weighted" | "none";
};

export function getBorrowerRiskScore(
  lines: readonly CreditLine[],
): BorrowerRiskScore {
  const scoreLines = lines.filter((line) => line.status !== "Closed");
  if (scoreLines.length === 0) {
    return { score: null, basis: "none" };
  }

  const borrowerScore = scoreLines[0].riskScore;
  if (scoreLines.every((line) => line.riskScore === borrowerScore)) {
    return { score: borrowerScore, basis: "borrower" };
  }

  const totalLimit = scoreLines.reduce((total, line) => total + line.limit, 0);
  if (totalLimit <= 0) {
    return { score: null, basis: "none" };
  }

  const weightedScore =
    scoreLines.reduce(
      (total, line) => total + line.riskScore * line.limit,
      0,
    ) / totalLimit;

  return { score: Math.round(weightedScore), basis: "limit_weighted" };
}

// ---------------------------------------------------------------------------
// CreditSummary — number-based API (preserved for existing callers)
// ---------------------------------------------------------------------------

export interface CreditSummary {
  drawableLimit: number;
  availableToDraw: number;
  totalOutstanding: number;
  delinquentOutstanding: number;
}

// ---------------------------------------------------------------------------
// CreditSummaryMoney — exact Money variant
// ---------------------------------------------------------------------------

export interface CreditSummaryMoney {
  drawableLimit: Money;
  availableToDraw: Money;
  totalOutstanding: Money;
  delinquentOutstanding: Money;
}

// ---------------------------------------------------------------------------
// Utilisation in basis points (exact, no float division)
// ---------------------------------------------------------------------------

/**
 * Compute utilisation as integer basis points (1 bps = 0.01 %) from two
 * `Money` values, avoiding floating-point division drift.
 *
 * Returns 0 when `limit.units` is zero or negative.
 */
export function utilisationBps(utilized: Money, limit: Money): number {
  if (limit.units <= 0n) return 0;
  // bps = round(utilized / limit * 10_000)
  const numerator = utilized.units * 10_000n;
  const quotient = numerator / limit.units;
  const remainder = numerator % limit.units;
  // half-up rounding
  const rounded =
    remainder * 2n >= limit.units ? quotient + 1n : quotient;
  return Number(rounded);
}

/**
 * Compute utilisation percentage (0–100+) from basis points.
 * Equivalent to `bps / 100`, rounded to the nearest integer.
 */
export function bpsToPercent(bps: number): number {
  return Math.round(bps / 100);
}

// ---------------------------------------------------------------------------
// summarizeCreditLinesExact — exact Money arithmetic
// ---------------------------------------------------------------------------

/**
 * Exact variant of `summarizeCreditLines`. Performs all additions with
 * `Money` bigint arithmetic; no `Number` additions of monetary amounts.
 */
export function summarizeCreditLinesExact(
  lines: CreditLine[],
): CreditSummaryMoney {
  const active = lines.filter((line) => line.status === "Active");
  const outstanding = lines.filter(
    (line) => line.status !== "Closed" && line.utilized > 0,
  );
  const delinquent = outstanding.filter(
    (line) => line.status === "Suspended" || line.status === "Defaulted",
  );

  const activeUtilized = active.reduce(
    (sum, line) => add(sum, lineMoney(line.utilized)),
    ZERO,
  );
  const drawableLimit = active.reduce(
    (sum, line) => add(sum, lineMoney(line.limit)),
    ZERO,
  );
  const totalOutstanding = outstanding.reduce(
    (sum, line) => add(sum, lineMoney(line.utilized)),
    ZERO,
  );
  const delinquentOutstanding = delinquent.reduce(
    (sum, line) => add(sum, lineMoney(line.utilized)),
    ZERO,
  );

  const availableToDraw =
    drawableLimit.units >= activeUtilized.units
      ? sub(drawableLimit, activeUtilized)
      : ZERO;

  return {
    drawableLimit,
    availableToDraw,
    totalOutstanding,
    delinquentOutstanding,
  };
}

// ---------------------------------------------------------------------------
// summarizeCreditLines — number-based public API (unchanged signature)
// ---------------------------------------------------------------------------

/**
 * Returns the credit summary as plain numbers, preserving the existing API
 * contract for all current callers. Internally delegates to
 * `summarizeCreditLinesExact` and converts via `toDisplayNumber` so that
 * the exact arithmetic is used without float-addition drift.
 */
export function summarizeCreditLines(lines: CreditLine[]): CreditSummary {
  const exact = summarizeCreditLinesExact(lines);
  return {
    drawableLimit: toDisplayNumber(roundMoneyToCents(exact.drawableLimit)),
    availableToDraw: toDisplayNumber(
      roundMoneyToCents(exact.availableToDraw),
    ),
    totalOutstanding: toDisplayNumber(
      roundMoneyToCents(exact.totalOutstanding),
    ),
    delinquentOutstanding: toDisplayNumber(
      roundMoneyToCents(exact.delinquentOutstanding),
    ),
  };
}
