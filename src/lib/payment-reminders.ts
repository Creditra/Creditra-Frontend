/**
 * Repayment reminder engine.
 *
 * Converts `getPaymentDueState` classifications into deduplicated in-app
 * reminder descriptors across four milestones:
 *   - `7d`         — 2–7 calendar days before `nextPaymentDate`
 *   - `1d`         — 1 calendar day before `nextPaymentDate`
 *   - `due_today`  — on `nextPaymentDate` (0 calendar days)
 *   - `overdue`    — past `nextPaymentDate`, with daily escalation for days 1–7
 *                    (`overdue`, `overdue_2d`..`overdue_7d`) and weekly cadence
 *                    thereafter (`overdue_14d`, `overdue_21d`, ...), capped at
 *                    90 days past due.
 *
 * Each reminder carries a stable dedupe key `${lineId}:${nextPaymentDate}:${milestone}`
 * so a milestone fires at most once per line per billing cycle. Advancing or
 * clearing `nextPaymentDate` (after repayment) naturally unlocks reminders for
 * the next cycle.
 */

import type { CreditLine } from '../types/creditLine';
import type { NotificationType } from '../types/notification';
import { parseLocalDate } from '../utils/dates';
import { getPaymentDueState, type PaymentDueState } from './payment-due';

export type PaymentReminderMilestone =
  | '7d'
  | '1d'
  | 'due_today'
  | 'overdue'
  | `overdue_${number}d`;

export interface DueReminder {
  /** Stable dedupe key: `${lineId}:${nextPaymentDate}:${milestone}` */
  key: string;
  lineId: string;
  lineName: string;
  nextPaymentDate: string;
  nextPaymentAmount?: number;
  milestone: PaymentReminderMilestone;
  dueState: PaymentDueState;
  /** Notification severity mapped from milestone urgency */
  type: NotificationType;
  title: string;
  message: string;
  /** Route CTA for the repay flow */
  ctaTo: string;
  ctaLabel: string;
}

export type ReminderLineInput = Pick<
  CreditLine,
  'id' | 'name' | 'status' | 'nextPaymentDate' | 'nextPaymentAmount'
>;

/** Maximum days past due for which overdue reminders are emitted. */
export const MAX_OVERDUE_REMINDER_DAYS = 90;

/** Days past due after which persisted dedupe keys are eligible for pruning. */
export const REMINDER_KEY_RETENTION_DAYS = 90;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function formatAmount(amount?: number): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return '';
  }
  return ` ($${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })})`;
}

/**
 * Maps a `PaymentDueState` to its current reminder milestone, or `null` if no
 * reminder should fire for this state.
 */
export function resolveReminderMilestone(
  state: PaymentDueState,
): PaymentReminderMilestone | null {
  if (state.kind === 'none') {
    return null;
  }

  if (state.kind === 'upcoming') {
    if (state.days === 1) return '1d';
    if (state.days >= 2 && state.days <= 7) return '7d';
    return null;
  }

  if (state.kind === 'due_today') {
    return 'due_today';
  }

  // Overdue: daily for days 1..7, then weekly buckets (14, 21, ...) up to cap.
  const overdueDays = state.days;
  if (overdueDays <= 0) return null;
  if (overdueDays === 1) return 'overdue';
  if (overdueDays <= 7) return `overdue_${overdueDays}d`;

  const cappedDays = Math.min(overdueDays, MAX_OVERDUE_REMINDER_DAYS);
  const weeklyBucket = Math.floor(cappedDays / 7) * 7;
  return `overdue_${weeklyBucket}d`;
}

/**
 * Builds the stable deduplication key for a line, due date, and milestone.
 */
export function makeReminderKey(
  lineId: string,
  nextPaymentDate: string,
  milestone: PaymentReminderMilestone,
): string {
  return `${lineId}:${nextPaymentDate}:${milestone}`;
}

function buildReminderCopy(
  line: ReminderLineInput,
  milestone: PaymentReminderMilestone,
  dueState: PaymentDueState,
): { type: NotificationType; title: string; message: string } {
  const amountSuffix = formatAmount(line.nextPaymentAmount);
  const label = line.name || line.id;

  if (milestone === '7d') {
    const dayWord = dueState.days === 1 ? 'day' : 'days';
    return {
      type: 'info',
      title: 'Upcoming repayment',
      message: `${label} has a payment${amountSuffix} due in ${dueState.days} ${dayWord}.`,
    };
  }

  if (milestone === '1d') {
    return {
      type: 'warning',
      title: 'Payment due tomorrow',
      message: `${label} has a payment${amountSuffix} due tomorrow.`,
    };
  }

  if (milestone === 'due_today') {
    return {
      type: 'warning',
      title: 'Payment due today',
      message: `${label} has a payment${amountSuffix} due today.`,
    };
  }

  // Overdue
  const dayWord = dueState.days === 1 ? 'day' : 'days';
  return {
    type: 'danger',
    title: 'Payment overdue',
    message: `${label} is ${dueState.days} ${dayWord} overdue${amountSuffix}.`,
  };
}

/**
 * Computes all due repayment reminders that have not yet been sent.
 *
 * Lines that are Closed, Frozen, Defaulted, or missing a valid `nextPaymentDate`
 * are ignored by `getPaymentDueState` and never produce reminders.
 */
export function computeDueReminders(
  lines: readonly ReminderLineInput[],
  now: Date = new Date(),
  alreadySent: Set<string> | readonly string[] = new Set(),
): DueReminder[] {
  const sentSet = alreadySent instanceof Set ? alreadySent : new Set(alreadySent);
  const reminders: DueReminder[] = [];

  for (const line of lines) {
    if (!line || !line.id || !line.nextPaymentDate) continue;

    const dueState = getPaymentDueState(line, now);
    const milestone = resolveReminderMilestone(dueState);
    if (!milestone) continue;

    const key = makeReminderKey(line.id, line.nextPaymentDate, milestone);
    if (sentSet.has(key)) continue;

    const { type, title, message } = buildReminderCopy(line, milestone, dueState);

    reminders.push({
      key,
      lineId: line.id,
      lineName: line.name || line.id,
      nextPaymentDate: line.nextPaymentDate,
      nextPaymentAmount: line.nextPaymentAmount,
      milestone,
      dueState,
      type,
      title,
      message,
      ctaTo: `/repay?line=${encodeURIComponent(line.id)}`,
      ctaLabel: 'Repay now',
    });
  }

  return reminders;
}

/**
 * Prunes persisted reminder keys whose due date is older than the retention
 * window relative to `now` (default: 90 days past due). Malformed keys are
 * dropped as well.
 */
export function pruneExpiredReminderKeys(
  keys: Iterable<string>,
  now: Date = new Date(),
  retentionDays: number = REMINDER_KEY_RETENTION_DAYS,
): string[] {
  if (Number.isNaN(now.getTime())) {
    return Array.from(keys);
  }

  const nowMidnightUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const kept: string[] = [];

  for (const key of keys) {
    if (typeof key !== 'string') continue;
    const firstColon = key.indexOf(':');
    const lastColon = key.lastIndexOf(':');
    if (firstColon <= 0 || lastColon <= firstColon + 1) continue;

    const datePart = key.slice(firstColon + 1, lastColon);
    const parsedDue = parseLocalDate(datePart);
    if (!parsedDue || Number.isNaN(parsedDue.getTime())) continue;

    const dueMidnightUtc = Date.UTC(
      parsedDue.getFullYear(),
      parsedDue.getMonth(),
      parsedDue.getDate(),
    );
    const ageDays = Math.round((nowMidnightUtc - dueMidnightUtc) / DAY_IN_MS);

    if (ageDays <= retentionDays) {
      kept.push(key);
    }
  }

  return kept;
}
