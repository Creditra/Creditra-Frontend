import { CreditLine } from "@/types/draw-credit.types";

/**
 * Utilization percentage at or above which a credit line has no drawable
 * balance left. Also the ceiling every normalization clamps to, so a line
 * can never report a negative availability.
 */
const UTILIZATION_CEILING = 100;

/**
 * Derive the drawable ("available") balance of a credit line from its
 * authoritative utilization percentage and credit limit.
 *
 * `utilization` is the single source of truth — it mirrors the backend
 * indexer for the line. `available` is always *derived* from it (issue
 * #931) rather than authored alongside it, so the two cannot drift out
 * of sync over time, across reloads, or through persisted drafts.
 *
 * Deterministic for every input:
 * - `utilization >= 100` → `0` (fully drawn; nothing left to draw)
 * - `utilization <= 0`   → `Math.max(0, limit)` (nothing drawn)
 * - non-finite `limit`   → `0` (no line, nothing drawable)
 * - non-finite `utilization` → treated as `0` % (no authority, full
 *   limit). The amount step still caps draws at this value, so the UI
 *   never offers more than the derived balance.
 *
 * `available` is the limit minus the *rounded* whole-dollar utilized
 * balance, so `available + utilized === limit` always holds for display
 * and float noise in `limit * utilization / 100` cannot push the result
 * across a dollar boundary.
 */
export function getDrawAvailability(
  limit: number,
  utilization: number,
): number {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 0;
  const clampedUtilization = Number.isFinite(utilization)
    ? Math.min(Math.max(utilization, 0), UTILIZATION_CEILING)
    : 0;
  const utilized = Math.round(safeLimit * (clampedUtilization / 100));

  return Math.max(safeLimit - utilized, 0);
}

/**
 * Return a copy of `creditLine` whose `available` is re-derived from the
 * authoritative `utilization`.
 *
 * This is the invariant enforced at the wizard's data boundary. It guards
 * against stale or inconsistent `available` values coming from persisted
 * drafts, future backend payloads, or hand-authored fixtures, so the UI
 * only ever shows draw availability computed from utilization.
 *
 * The input object is never mutated.
 */
export function normalizeCreditLineAvailability(
  creditLine: CreditLine,
): CreditLine {
  return {
    ...creditLine,
    available: getDrawAvailability(creditLine.limit, creditLine.utilization),
  };
}