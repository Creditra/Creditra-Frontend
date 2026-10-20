/**
 * Lightweight credit-line shape used by the draw-credit flow.
 *
 * This is intentionally a narrower projection of the canonical
 * `CreditLine` defined in `creditLine.ts` — the wizard only needs the
 * fields required to choose a line and validate the requested amount.
 *
 * Invariant (issue #931): `utilization` is the authoritative source of
 * truth and mirrors the backend indexer. `available` is a *derived
 * projection* of `limit` + `utilization` — it must always equal
 * `getDrawAvailability(limit, utilization)` (see
 * `src/lib/credit-line-availability.ts`). Author lines through the
 * `createCreditLine` factory in `src/lib/draw-credit-mock-data.ts` (or
 * normalize via `normalizeCreditLineAvailability`) so the two can never
 * drift out of sync.
 */
export type DrawPricingRiskBand = "Prime" | "Standard" | "Watch";

export interface CreditLine {
  id: string;
  name: string;
  limit: number;
  /**
   * Drawable balance, derived deterministically from `limit` and the
   * authoritative `utilization`. Read-only: recompute it through
   * `getDrawAvailability` rather than hand-authoring a value.
   */
  readonly available: number;
  /** Authoritative utilization percentage (0–100) from the backend indexer. */
  utilization: number;
  /** Mock pricing band used to explain APR until backend quotes are available. */
  riskBand: DrawPricingRiskBand;
  /** Mock term used to explain APR until backend quotes are available. */
  termMonths: number;
}

export interface Transaction {
  id: string;
  creditLineId: string;
  amount: number;
  status: "pending" | "success" | "error";
  message?: string;
  timestamp?: Date;
}

/**
 * Linear step machine for the draw-credit wizard. The UI advances through
 * these in order and never branches.
 */
export type DrawStep = "select" | "amount" | "confirm" | "status";
