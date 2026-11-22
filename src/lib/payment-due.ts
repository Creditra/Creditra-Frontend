import type { CreditLine } from "../types/creditLine";

export type PaymentDueKind = "overdue" | "due_today" | "upcoming" | "none";

export interface PaymentDueState {
  kind: PaymentDueKind;
  days: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(dateStr: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (dateOnly) {
    const d = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getLocalMidnightUtc(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Computes the payment due state for a credit line relative to `now`
 * using calendar days in local time.
 *
 * Rules:
 *  - Overdue: due date is in the past (calendar days diff < 0).
 *             returns { kind: 'overdue', days: positive number of days overdue }.
 *  - Due today: due date falls on the same calendar day (diff === 0).
 *             returns { kind: 'due_today', days: 0 }.
 *  - Upcoming: due date is within 1 to 7 calendar days in the future.
 *             returns { kind: 'upcoming', days: positive number of days until due }.
 *  - None: due date is > 7 calendar days in the future, missing, or line is neither Active nor Suspended.
 *             returns { kind: 'none', days: diff (or 0 if missing) }.
 */
export function getPaymentDueState(
  line: { nextPaymentDate?: string; status?: string } | CreditLine,
  now: Date = new Date(),
): PaymentDueState {
  if (!line || !line.nextPaymentDate) {
    return { kind: "none", days: 0 };
  }

  // If status is specified and is neither Active nor Suspended, payments are not active
  if (line.status && line.status !== "Active" && line.status !== "Suspended") {
    return { kind: "none", days: 0 };
  }

  const dueDate = parseLocalDate(line.nextPaymentDate);
  if (!dueDate || Number.isNaN(dueDate.getTime()) || Number.isNaN(now.getTime())) {
    return { kind: "none", days: 0 };
  }

  const dueMidnight = getLocalMidnightUtc(dueDate);
  const nowMidnight = getLocalMidnightUtc(now);
  const diffDays = Math.round((dueMidnight - nowMidnight) / DAY_IN_MS);

  if (diffDays < 0) {
    return { kind: "overdue", days: Math.abs(diffDays) };
  }
  if (diffDays === 0) {
    return { kind: "due_today", days: 0 };
  }
  if (diffDays <= 7) {
    return { kind: "upcoming", days: diffDays };
  }
  return { kind: "none", days: diffDays };
}
