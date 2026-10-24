/**
 * Machine-readable transaction CSV export (schema v1).
 *
 * The export is intentionally a pure function so the column contract can be
 * tested without a DOM, a locale, or a timezone. Every value is emitted in a
 * stable, accounting-friendly form:
 *
 *   - `timestamp_utc` is ISO-8601 UTC (`...Z`).
 *   - `direction` is the accounting sign: `debit` for debt-increasing rows,
 *     `credit` for repayments and `none` for non-monetary events.
 *   - `amount` is unsigned and always carries a fixed number of decimals
 *     (2 for fiat, 7 for on-chain assets).
 *   - `signed_amount` applies the direction to the amount.
 *
 * The first line is the header only — no preamble, comment, or metadata row —
 * because spreadsheet importers expect the first row to be the schema. The
 * schema version lives in the filename instead.
 */

import { toCsv, type CsvCell } from "@/utils/csv";

export const TRANSACTION_CSV_VERSION = "v1";

export const TRANSACTION_CSV_HEADERS = [
  "timestamp_utc",
  "type",
  "direction",
  "amount",
  "signed_amount",
  "asset",
  "status",
  "line_id",
  "line_name",
  "note",
  "tx_hash",
] as const;

export type TransactionCsvDirection = "debit" | "credit" | "none";

/**
 * Fiscal assets that use the conventional 2-decimal amount representation.
 * Every other asset is treated as on-chain and emitted with 7 decimals, the
 * precision used by Stellar/Stellar-issued assets.
 */
const FIAT_ASSETS: ReadonlySet<string> = new Set([
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "CHF",
  "JPY",
  "NGN",
  "KES",
  "BRL",
  "INR",
  "ZAR",
]);

export const DEFAULT_TRANSACTION_CSV_ASSET = "USD";

/** Fields the transaction history page supplies per exported row. */
export interface TransactionCsvRow {
  /** Raw transaction type from the data model (`Draw`, `Repay`, …). */
  type: string;
  /** Unsigned amount in the exported asset's major unit. */
  amount: number;
  /** ISO-8601 timestamp (or anything `Date` can parse). */
  date: string;
  status: string;
  lineId: string;
  lineName: string;
  note?: string;
  txHash?: string;
}

export interface TransactionCsvOptions {
  /** Asset code written to the `asset` column. Defaults to USD. */
  asset?: string;
  /**
   * Decimal places for `amount` / `signed_amount`. When omitted, fiat assets
   * use 2 and on-chain assets use 7.
   */
  decimals?: number;
}

/** Debt-increasing event types. */
const DEBIT_TYPES: ReadonlySet<string> = new Set(["Draw", "Fee", "Interest"]);

/** Repayment event types (reduce debt). */
const CREDIT_TYPES: ReadonlySet<string> = new Set(["Repay"]);

/** Resolve the decimal convention for an asset. */
export function getTransactionCsvDecimals(asset: string): number {
  return FIAT_ASSETS.has(asset.trim().toUpperCase()) ? 2 : 7;
}

/** Map a transaction type to its accounting direction. */
export function getTransactionCsvDirection(
  type: string,
): TransactionCsvDirection {
  if (CREDIT_TYPES.has(type)) return "credit";
  if (DEBIT_TYPES.has(type)) return "debit";
  return "none";
}

/**
 * Format a numeric amount with a fixed decimal count.
 *
 * The value is rounded to the target precision *before* `toFixed`, so binary
 * float artefacts (e.g. `0.1 + 0.2`) never leak into the export.
 */
export function formatTransactionCsvAmount(
  value: number,
  decimals: number,
): string {
  const safeDecimals = Math.min(Math.max(Math.trunc(decimals), 0), 7);
  const safeValue = Number.isFinite(value) ? value : 0;
  const factor = 10 ** safeDecimals;
  const roundedMagnitude =
    Math.round((Math.abs(safeValue) + Number.EPSILON) * factor) / factor;
  const rounded = safeValue < 0 ? -roundedMagnitude : roundedMagnitude;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toFixed(safeDecimals);
}

/** Convert a date value to an ISO-8601 UTC timestamp. */
function toUtcTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

/** Convert a date value to a UTC `YYYY-MM-DD` filename segment. */
function toUtcDateSegment(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Build the versioned filename for an export.
 *
 * Both filename dates are UTC, matching `timestamp_utc` in the rows, so a file
 * exported around local midnight cannot claim a different day than its
 * contents.
 */
export function buildTransactionCsvFilename(
  rows: readonly TransactionCsvRow[],
): string {
  const dates = rows
    .map((row) => toUtcDateSegment(row.date))
    .filter((date): date is string => date !== null)
    .sort();

  const start = dates[0] ?? "all";
  const end = dates[dates.length - 1] ?? "all";

  return `creditra-transactions-${TRANSACTION_CSV_VERSION}-${start}-${end}.csv`;
}

/**
 * Build the schema-v1 CSV for the supplied rows.
 *
 * Deterministic for the same input: no locale lookups, no local-time
 * formatting, and no `Date` display strings. Quoting is delegated to the
 * shared RFC 4180 helper in `src/utils/csv.ts`.
 */
export function buildTransactionCsv(
  rows: readonly TransactionCsvRow[],
  options: TransactionCsvOptions = {},
): string {
  const asset = options.asset ?? DEFAULT_TRANSACTION_CSV_ASSET;
  const decimals = options.decimals ?? getTransactionCsvDecimals(asset);

  const csvRows: CsvCell[][] = rows.map((row) => {
    const direction = getTransactionCsvDirection(row.type);
    const magnitude = Math.abs(Number.isFinite(row.amount) ? row.amount : 0);
    const signedMagnitude =
      direction === "debit" ? magnitude : direction === "credit" ? -magnitude : 0;

    return [
      toUtcTimestamp(row.date),
      row.type,
      direction,
      formatTransactionCsvAmount(magnitude, decimals),
      formatTransactionCsvAmount(signedMagnitude, decimals),
      asset,
      row.status,
      row.lineId,
      row.lineName,
      row.note ?? "",
      row.txHash ?? "",
    ];
  });

  return toCsv(TRANSACTION_CSV_HEADERS, csvRows);
}
