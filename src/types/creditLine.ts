/**
 * Lifecycle states of a credit line. Drives badge color, available
 * actions in the UI, and any "view-only" guard rails on detail screens.
 */
export type CreditLineStatus = 'Active' | 'Suspended' | 'Defaulted' | 'Closed' | 'Frozen';

/**
 * Columns the credit-line list view can be sorted by. Kept narrow on
 * purpose — adding a field here is also a UX decision (does the new
 * column merit ranking?).
 */
export type SortField = 'status' | 'limit' | 'utilization' | 'updatedAt' | 'apr' | 'riskScore';

/** Direction discriminator paired with `SortField` in the table state. */
export type SortDirection = 'asc' | 'desc';
/**
 * Coarse bucket of how much of a credit line is currently drawn.
 * The numeric thresholds live in `src/utils/tokens.ts:getUtilizationLevel`.
 */
export type UtilizationLevel = 'low' | 'medium' | 'high';
/**
 * Kind of ledger entry. `StatusChange` is a sentinel used to render
 * lifecycle events (Active -> Suspended, etc.) inline with money
 * movements in the transaction history.
 */
export type TransactionType = 'Draw' | 'Repay' | 'Fee' | 'Interest' | 'StatusChange';

/** Settlement state of an on-chain transaction surfaced to the UI. */
export type TransactionStatus = 'Completed' | 'Pending' | 'Failed';

/**
 * Canonical ledger entry shape. Mirrors what the backend indexer returns;
 * the frontend never derives `txHash` itself — that is the chain's
 * identifier and is only present once submission succeeded.
 */
export interface Transaction {
  /** Stable identifier (UUID or backend-issued). */
  id: string;
  type: TransactionType;
  /** Always in USD (or the credit line's denomination); never normalised client-side. */
  amount: number;
  /** ISO 8601 timestamp. */
  date: string;
  /** Free-form note rendered alongside the entry. */
  note?: string;
  status: TransactionStatus;
  /** On-chain transaction hash. Absent for pending submissions. */
  txHash?: string;
}

/** A single point in a credit line's lifecycle history. */
export interface StatusHistoryEntry {
  status: CreditLineStatus;
  /** ISO 8601 timestamp of when the status was applied. */
  date: string;
  /** Optional reason / context from the backend. */
  note?: string;
}

/**
 * A single data point in a credit line's APR history.
 * Used by AprHistoryChart to render the 30/90/365-day sparkline.
 */
export interface AprHistoryEntry {
  /** ISO 8601 date string (YYYY-MM-DD or full timestamp). */
  date: string;
  /** Annual percentage rate recorded on this date. */
  apr: number;
}

/**
 * Canonical credit-line shape used by the dashboard and credit-lines
 * list view. Mirrors the backend payload. The lighter wizard projection
 * lives in `draw-credit.types.ts` and is constructed from this shape.
 */
export interface CreditLine {
  id: string;
  /** Human-readable line label, e.g. "Builder credit line". */
  name: string;
  status: CreditLineStatus;
  /** Maximum drawable amount in the line's denomination. */
  limit: number;
  /** Currently drawn balance. */
  utilized: number;
  /** Annual percentage rate applied to drawn balance. */
  apr: number;
  /** Backend-computed risk score for the line owner (0–850, FICO-like). */
  riskScore: number;
  /** Optional collateral note. Populated for legacy / opt-in collateralised lines only. */
  collateral?: string;
  /** ISO 8601 timestamp of when the line was opened. */
  openedAt: string;
  /** ISO 8601 timestamp of the most recent state change. */
  updatedAt: string;
  transactions: Transaction[];
  statusHistory: StatusHistoryEntry[];
  /**
   * Historical APR data points used by AprHistoryChart.
   * Entries should be sorted oldest→newest. The chart supports
   * 30 / 90 / 365-day window filtering on this array.
   */
  aprHistory?: AprHistoryEntry[];
  /** ISO 8601 timestamp of the next scheduled payment, if any. */
  nextPaymentDate?: string;
  /** Amount of the next scheduled payment, paired with `nextPaymentDate`. */
  nextPaymentAmount?: number;
  /** ISO 8601 timestamp when the next interest accrual is expected. */
  nextInterestAccrualDate?: string;
  /**
   * ISO 8601 timestamp of the most recent user-visible activity on this line
   * (draw, repay, status change, etc.).  When absent the UI falls back to
   * `updatedAt` so the field is always displayable.
   */
  lastActivityAt?: string;
}
