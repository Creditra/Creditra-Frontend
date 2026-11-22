/**
 * Payment-due classification for a credit line.
 *
 * Compares a line's `nextPaymentDate` against a reference "now" using whole
 * calendar days, so a date-only string (e.g. "2025-03-01") is read in the
 * user's local timezone rather than as UTC midnight. This mirrors the
 * day-bucketing used by `src/lib/delinquency.ts`.
 */

import type { CreditLine } from "../types/creditLine";

export type PaymentDueKind = "overdue" | "due_today" | "upcoming" | "none";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Convert a date or ISO timestamp to a whole-day number (UTC epoch days),
 * anchored to the local calendar day. Returns `null` for unparseable input.
 *
 * A bare `YYYY-MM-DD` string is split into its numeric parts so it is not
 * shifted by the timezone when parsed as UTC midnight.
 */
function toLocalDayNumber(value: string): number | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly) {
    return (
      Date.UTC(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      ) / DAY_IN_MS
    );
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return (
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) /
    DAY_IN_MS
  );
}

/**
 * Classify how a credit line's next payment relates to `now`:
 *
 *   - `overdue`   — the due day is before today
 *   - `due_today` — the due day is today
 *   - `upcoming`  — the due day is after today
 *   - `none`      — no scheduled payment (or an unparseable date)
 */
export function getPaymentDueState(
  line: Pick<CreditLine, "nextPaymentDate">,
  now: Date = new Date(),
): PaymentDueKind {
  if (!line.nextPaymentDate) return "none";
  if (Number.isNaN(now.getTime())) return "none";

  const dueDay = toLocalDayNumber(line.nextPaymentDate);
  if (dueDay === null) return "none";

  const today = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ) / DAY_IN_MS;

  if (dueDay < today) return "overdue";
  if (dueDay === today) return "due_today";
  return "upcoming";
}
