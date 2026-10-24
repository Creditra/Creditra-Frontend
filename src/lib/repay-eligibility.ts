/**
 * repay-eligibility.ts
 *
 * Single source of truth for which credit lines are eligible for repayment.
 * All three entry points (RepayPage picker, RepayPage ?line= deep-link,
 * QuickRepayTrigger) must use `isRepayable` / `getRepayableLines` so the
 * eligibility rule never drifts.
 *
 * Rule:  a line is repayable when
 *   1. it has an outstanding balance (utilized > 0), AND
 *   2. its status is NOT 'Closed'  (Active | Suspended | Defaulted | Frozen)
 *
 * Ordering for the picker:
 *   Delinquent lines (Defaulted, Suspended) come first, sorted by most
 *   recently updated so the most urgent line is at the top.  Non-delinquent
 *   repayable lines follow, also sorted by updatedAt descending.
 */

import type { CreditLine, CreditLineStatus } from '../types/creditLine';

/** Statuses that are never eligible for repayment. */
const UNREPAYABLE_STATUSES: ReadonlySet<CreditLineStatus> = new Set(['Closed']);

/** Statuses that indicate delinquency — these sort to the top of the picker. */
const DELINQUENT_STATUSES: ReadonlySet<CreditLineStatus> = new Set([
  'Defaulted',
  'Suspended',
]);

/**
 * Returns true when `line` can appear in the repayment flow.
 *
 * A line is repayable when:
 * - `utilized > 0` (there is actually something to repay), AND
 * - `status` is not in the closed set (`Closed`)
 */
export function isRepayable(line: CreditLine): boolean {
  return line.utilized > 0 && !UNREPAYABLE_STATUSES.has(line.status);
}

/**
 * Returns true when `line` is delinquent (Defaulted or Suspended).
 * Used for sorting and badge emphasis in the picker.
 */
export function isDelinquentLine(line: CreditLine): boolean {
  return DELINQUENT_STATUSES.has(line.status);
}

/**
 * Filters `lines` to those that are repayable, then sorts them so that
 * delinquent lines (Defaulted → Suspended) come first, both groups ordered
 * by `updatedAt` descending (most recently active first).
 *
 * This is the canonical list for the RepayPage picker and QuickRepayTrigger.
 */
export function getRepayableLines(lines: readonly CreditLine[]): CreditLine[] {
  const repayable = lines.filter(isRepayable);

  return repayable.sort((a, b) => {
    const aDelinquent = isDelinquentLine(a);
    const bDelinquent = isDelinquentLine(b);

    // Delinquent lines sort before non-delinquent lines.
    if (aDelinquent !== bDelinquent) {
      return aDelinquent ? -1 : 1;
    }

    // Within each group, most-recently-updated first.
    return (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  });
}
