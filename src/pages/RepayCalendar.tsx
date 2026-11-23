import type { ReactNode } from 'react';
import { COLOR } from '../utils/tokens';
import { parseLocalDate } from '../utils/dates';
import { formatCurrency } from '../utils/currency';

function formatEventDate(dateStr: string): string {
  const parsed = parseLocalDate(dateStr);
  if (!parsed) return dateStr;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Repayment status for a single calendar event. */
export type RepayEventStatus = 'upcoming' | 'due-soon' | 'paid' | 'overdue';

export interface RepayCalendarEvent {
  date: string;
  amount: number;
  label: string;
  /** Optional repayment status; renders a status chip when provided. */
  status?: RepayEventStatus;
}

/**
 * Colors for each repayment status chip. Same tint convention as
 * `TransactionHistory`'s `STATUS_COLORS`.
 */
const STATUS_COLORS: Record<RepayEventStatus, { bg: string; color: string }> = {
  paid: { bg: 'rgba(63,185,80,0.15)', color: COLOR.success },
  upcoming: { bg: 'rgba(88,166,255,0.15)', color: COLOR.accent },
  'due-soon': { bg: 'rgba(210,153,34,0.15)', color: COLOR.warning },
  overdue: { bg: 'rgba(248,81,73,0.15)', color: COLOR.danger },
};

/** Human-readable label shown inside the chip. */
const STATUS_LABELS: Record<RepayEventStatus, string> = {
  paid: 'Paid',
  upcoming: 'Upcoming',
  'due-soon': 'Due soon',
  overdue: 'Overdue',
};

/**
 * CSS pattern classes for each repayment status (defined in
 * `src/styles/patterns.css`), so the four statuses are distinguishable
 * without relying on color alone (WCAG 2.1 SC 1.4.1).
 */
const STATUS_PATTERNS: Record<RepayEventStatus, string> = {
  paid: 'repay-status-pattern--paid',
  upcoming: 'repay-status-pattern--upcoming',
  'due-soon': 'repay-status-pattern--due-soon',
  overdue: 'repay-status-pattern--overdue',
};

export interface RepayCalendarProps {
  /** Ordered list of upcoming repayment events. */
  events: RepayCalendarEvent[];
  /** Additional CSS class names. */
  className?: string;
  /** Optional children rendered below the calendar. */
  children?: ReactNode;
}

/**
 * RepayCalendar — repayment schedule calendar.
 *
 * Renders an ordered list of upcoming repayment events with accessible
 * date labels and two-decimal currency amounts. Announces schedule count
 * changes via a visually hidden `role="status"` element instead of making
 * the entire list a live region.
 *
 * WCAG 2.1 AA:
 * - A concise, visually hidden `role="status"` region announces schedule
 *   count updates without re-reading every list item.
 * - Each event row uses semantic markup for date and amount.
 * - All numeric values use `font-variant-numeric: tabular-nums`.
 */
export function RepayCalendar({
  events,
  className = '',
  children,
}: RepayCalendarProps) {
  const classes = ['card', 'repay-calendar', className]
    .filter(Boolean)
    .join(' ');

  const statusMessage =
    events.length === 0
      ? 'No upcoming repayments'
      : `${events.length} upcoming ${events.length === 1 ? 'repayment' : 'repayments'}`;

  return (
    <section
      className={classes}
      aria-label="Repayment calendar"
    >
      <h2 className="repay-calendar__title">Upcoming Payments</h2>

      <div className="sr-only" role="status">
        {statusMessage}
      </div>

      {events.length === 0 ? (
        <p className="repay-calendar__empty">No upcoming payments.</p>
      ) : (
        <ol className="repay-calendar__list">
          {events.map((event, idx) => (
            <li key={`${event.date}-${idx}`} className="repay-calendar__event">
              <time
                dateTime={event.date}
                className="repay-calendar__date num-tabular"
              >
                {formatEventDate(event.date)}
              </time>
              <span className="repay-calendar__label">{event.label}</span>
              {event.status && (
                <span
                  className={`repay-calendar__status-chip ${STATUS_PATTERNS[event.status]}`}
                  style={{
                    background: STATUS_COLORS[event.status].bg,
                    color: STATUS_COLORS[event.status].color,
                  }}
                >
                  {STATUS_LABELS[event.status]}
                </span>
              )}
              <span className="repay-calendar__amount num-tabular">
                {formatCurrency(event.amount)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {children}
    </section>
  );
}

export default RepayCalendar;
