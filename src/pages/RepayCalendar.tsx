import type { ReactNode } from 'react';
import { COLOR } from '../utils/tokens';

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
 * RepayCalendar — repayment schedule calendar with a live region.
 *
 * Renders an ordered list of upcoming repayment events with accessible
 * date labels and amounts. Uses `aria-live="polite"` so assistive
 * technology announces changes to the schedule.
 *
 * WCAG 2.1 AA:
 * - Live region announces schedule updates to screen readers.
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

  return (
    <section
      className={classes}
      aria-label="Repayment calendar"
      aria-live="polite"
      aria-atomic="true"
    >
      <h2 className="repay-calendar__title">Upcoming Payments</h2>

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
                {new Date(event.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
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
                ${event.amount.toLocaleString()}
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
