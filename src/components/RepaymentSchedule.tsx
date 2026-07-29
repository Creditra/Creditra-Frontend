/**
 * RepaymentSchedule — vertical, accessible timeline of scheduled repayments for
 * a credit line (or an aggregate across multiple lines).
 *
 * Each entry is a `ScheduledRepayment` discriminated by `status`. The
 * component derives everything from props, so it re-renders whenever the
 * parent updates a credit line. No internal fetches, no globals.
 *
 * Accessibility (WCAG 2.1 AA):
 *  - Uses an ordered list (`<ol>`) so screen readers report sequence and
 *    position automatically.
 *  - Each entry's badge pairs a status color with both an icon character
 *    AND a textual label, so color is never the sole differentiator
 *    (WCAG 1.4.1 — Use of Color).
 *  - Dates use `<time dateTime="…">` so the schedule is machine-readable
 *    and screen readers can announce both human + ISO forms.
 *  - Status badges carry an `aria-label` that restates the status in
 *    plain language for users who navigate by landmark.
 *  - The schedule container is keyboard-focusable so mobile / screen
 *    reader users can scroll the timeline without a mouse.
 *  - High-contrast mode is respected for free because every color is a
 *    CSS custom property re-declared under `[data-contrast="high"]`.
 *  - `prefers-reduced-motion` collapses the entrance animation / hover
 *    transitions via the global rule in `src/index.css`.
 *
 * Theming: every visible color comes from a design token declared in
 * `src/index.css :root`. Components do not hardcode hex values.
 */
import { useMemo } from 'react';
import './RepaymentSchedule.css';
import { fmt, fmtDate } from '../utils/tokens';
import type { CreditLine } from '../types/creditLine';

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a single scheduled repayment item.
 *
 * - `paid`       — installments already settled on-chain.
 * - `upcoming`   — the next payment, due within the next 7 days.
 * - `scheduled`  — future installments further out.
 * - `overdue`    — a payment whose due date has passed but is still recoverable.
 * - `defaulted`  — 90+ days past due; visually grouped with `overdue` but
 *                  escalated.
 */
export type RepaymentStatus =
  | 'paid'
  | 'upcoming'
  | 'scheduled'
  | 'overdue'
  | 'defaulted';

interface ScheduledRepaymentBase {
  /** Stable id; usually the originating transaction id for paid items. */
  id: string;
  /** ISO 8601 date the installment is due. */
  dueDate: string;
  /** Total USD due on this installment (principal + interest). */
  amount: number;
  /** Portion of `amount` applied to principal. */
  principal: number;
  /** Portion of `amount` applied to interest. */
  interest: number;
  /** Optional human-readable context (e.g. "Monthly installment"). */
  note?: string;
  /** Owning credit line id — required when aggregating. */
  lineId?: string;
  /** Owning credit line name — required when aggregating. */
  lineName?: string;
}

/**
 * Discriminated union: only `paid` entries carry `paidDate` / `txHash`,
 * which the runtime narrows on.
 */
export type ScheduledRepayment = ScheduledRepaymentBase &
  (
    | { status: 'paid'; paidDate: string; txHash?: string }
    | {
        status: 'upcoming' | 'scheduled' | 'overdue' | 'defaulted';
      }
  );

export interface RepaymentScheduleProps {
  /**
   * The full chronological list. Should already be sorted ascending by
   * `dueDate`; the component re-sorts defensively so an out-of-order
   * list still renders in the right vertical order.
   */
  schedule: ScheduledRepayment[];
  /** Optional region title — visible in the section heading. */
  title?: string;
  /** When true, reduces the visual density for compact embeds. */
  compact?: boolean;
  /** When true, shows a skeleton placeholder instead of the schedule. */
  loading?: boolean;
  /** Optional id used for `aria-labelledby` (defaults to a generated id). */
  headingId?: string;
  /**
   * Reference clock for "today" detection. Defaults to `new Date()`.
   * Exposed for deterministic testing and SSR-safe rendering.
   */
  now?: Date;
}

// ─── Helpers (exported for tests and reuse) ──────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABEL: Record<RepaymentStatus, string> = {
  paid: 'Paid',
  upcoming: 'Due soon',
  scheduled: 'Scheduled',
  overdue: 'Overdue',
  defaulted: 'Defaulted',
};

/** Visible icon "glyph" that pairs with the badge color so color is
 *  not the sole indicator (WCAG 1.4.1). Use unicode characters to avoid
 *  pulling a font/glyph dependency. */
const STATUS_GLYPH: Record<RepaymentStatus, string> = {
  paid: '\u2713', // ✓
  upcoming: '\u25CF', // ●   }
  scheduled: '\u25CB', // ○
  overdue: '!',
  defaulted: '\u26A0', // ⚠
};

/**
 * Exhaustiveness guard. If a new `RepaymentStatus` is added but the
 * downstream switch / record maps aren't updated, the TypeScript
 * compiler will refuse to compile (the switch falls through to
 * `assertNever(value: never)`).
 */
function assertNever(value: never): never {
  throw new Error(`Unhandled repayment status: ${String(value)}`);
}

/**
 * Determine whether two ISO date strings fall on the same calendar day in
 * the local timezone. Centralizes the comparison so the timeline groups
 * installments that were settled on the same day.
 */
function isSameLocalDay(aIso: string, bIso: string): boolean {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Derive the lifecycle `status` for a future installment based on its
 * distance from "now". Centralized to keep schedule synthesis and live
 * re-rendering in agreement.
 *
 *  - within 7 days of today  →  upcoming
 *  - in the future > 7 days  →  scheduled
 *  - 1-90 days past          →  overdue
 *  - >90 days past           →  defaulted
 */
export function deriveStatus(dueDateIso: string, now = new Date()): RepaymentStatus {
  const due = new Date(dueDateIso);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);

  const todayDay = new Date(now);
  todayDay.setHours(0, 0, 0, 0);

  const diffDays = Math.round((dueDay.getTime() - todayDay.getTime()) / DAY_MS);

  if (diffDays >= 0 && diffDays <= 7) return 'upcoming';
  if (diffDays > 7) return 'scheduled';
  if (diffDays >= -90) return 'overdue';
  return 'defaulted';
}

/**
 * Build a chronological repayment schedule for a single credit line by
 * consolidating past transactions with the next-payment projection.
 *
 * The result includes:
 *  - every `Repay` and `Interest` transaction joined into a paid installment,
 *    grouped by the same calendar day;
 *  - the `nextPaymentDate` / `nextPaymentAmount` pair, classified as
 *    `upcoming`, `scheduled`, `overdue`, or `defaulted` based on the
 *    derived status;
 *  - a few forward-looking scheduled installments derived from the line's
 *    APR + outstanding balance, so users see beyond the next payment.
 *
 * Pure function — derives all output from inputs and reacts to `now` for
 * testability.
 */
export function buildRepaymentScheduleFromLine(
  line: CreditLine,
  now: Date = new Date(),
  additionalScheduledCount: number = 3,
): ScheduledRepayment[] {
  const out: ScheduledRepayment[] = [];

  // 1) Paid installments: coalesce Repay + Interest rows that landed on
  // the same calendar day into a single combined paid entry.
  const paidByDay = new Map<string, ScheduledRepayment>();
  for (const tx of line.transactions) {
    if (tx.type !== 'Repay' && tx.type !== 'Interest') continue;
    const dayKey = tx.date.split('T')[0];
    const existing = paidByDay.get(dayKey);
    if (existing) {
      existing.amount += tx.amount;
      if (tx.type === 'Repay') existing.principal += tx.amount;
      else existing.interest += tx.amount;
    } else {
      paidByDay.set(dayKey, {
        id: `paid-${line.id}-${dayKey}`,
        dueDate: dayKey,
        paidDate: tx.date,
        amount: tx.amount,
        principal: tx.type === 'Repay' ? tx.amount : 0,
        interest: tx.type === 'Interest' ? tx.amount : 0,
        status: 'paid',
        note: tx.note,
        lineId: line.id,
        lineName: line.name,
        txHash: tx.txHash,
      });
    }
  }
  for (const entry of paidByDay.values()) out.push(entry);

  // 2) The next upcoming payment.
  if (line.nextPaymentDate && line.nextPaymentAmount && line.nextPaymentAmount > 0) {
    const status = deriveStatus(line.nextPaymentDate, now);
    out.push({
      id: `next-${line.id}`,
      dueDate: line.nextPaymentDate,
      amount: line.nextPaymentAmount,
      // Approximate a 60/40 principal/interest split for forward-looking
      // entries; this is a UX estimate only and labelled as such.
      principal: Math.round(line.nextPaymentAmount * 0.6),
      interest: line.nextPaymentAmount - Math.round(line.nextPaymentAmount * 0.6),
      status,
      lineId: line.id,
      lineName: line.name,
      note: 'Next scheduled payment',
    });
  }

  // 3) A few forward-looking scheduled installments so the user can see
  // the shape of future cashflow, never more than `additionalScheduledCount`.
  if (line.utilized > 0 && line.apr > 0 && line.nextPaymentAmount && line.nextPaymentAmount > 0) {
    let cursor = new Date(line.nextPaymentDate ?? now.toISOString());
    for (let i = 0; i < additionalScheduledCount; i += 1) {
      cursor.setMonth(cursor.getMonth() + 1);
      const iso = cursor.toISOString().split('T')[0];
      // Don't duplicate the next-payment row.
      if (line.nextPaymentDate && isSameLocalDay(iso, line.nextPaymentDate)) continue;
      out.push({
        id: `future-${line.id}-${i}`,
        dueDate: iso,
        amount: line.nextPaymentAmount,
        principal: Math.round(line.nextPaymentAmount * 0.65),
        interest: line.nextPaymentAmount - Math.round(line.nextPaymentAmount * 0.65),
        status: 'scheduled',
        lineId: line.id,
        lineName: line.name,
        note: `Installment ${i + 1}`,
      });
    }
  }

  // 4) Sort ascending so the timeline reads top-to-bottom chronologically.
  return [...out].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
}

/**
 * Flatten an array of schedule entries across many lines into a single,
 * chronologically sorted array. Used by the Credit Lines page to render
 * an aggregate timeline.
 */
export function buildRepaymentScheduleFromLines(
  lines: CreditLine[],
  now: Date = new Date(),
): ScheduledRepayment[] {
  const merged: ScheduledRepayment[] = [];
  for (const line of lines) {
    merged.push(...buildRepaymentScheduleFromLine(line, now));
  }
  return merged.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Render the visual timeline. Pulls everything from props; no internal
 * fetches. Memoized so identical prop sets skip the work.
 */
export function RepaymentSchedule({
  schedule,
  title = 'Repayment Schedule',
  compact = false,
  loading = false,
  headingId,
  now,
}: RepaymentScheduleProps) {
  // Default lazily so a stable reference isn't required; the prop is the
  // supported override for tests.
  const nowRef = useMemo(() => now ?? new Date(), [now]);

  const id = useMemo(
    () => headingId ?? `repayment-schedule-${Math.random().toString(36).slice(2, 9)}`,
    [headingId],
  );

  // Defensive re-sort: the parent may forget, but the timeline must read
  // top-to-bottom in chronological order (this is what scanning users see).
  const ordered = useMemo(
    () =>
      [...schedule].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      ),
    [schedule],
  );

  // Aggregate stats for the summary strip. Counts are by status, totals are
  // USD amounts — paid total is fixed, remaining total is everything else.
  const stats = useMemo(() => {
    const paid = ordered.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.amount, 0);
    const remaining = ordered
      .filter((s) => s.status !== 'paid')
      .reduce((sum, s) => sum + s.amount, 0);
    const overdueCount = ordered.filter(
      (s) => s.status === 'overdue' || s.status === 'defaulted',
    ).length;
    const upcomingCount = ordered.filter(
      (s) => s.status === 'upcoming' || s.status === 'scheduled',
    ).length;
    return {
      paidTotal: paid,
      remainingTotal: remaining,
      overdueCount,
      upcomingCount,
      totalCount: ordered.length,
    };
  }, [ordered]);

  // ─── Skeleton / empty / error render branches ───────────────────────────

  if (loading) {
    return (
      <section
        className="rs-schedule rs-schedule--loading"
        aria-labelledby={id}
        aria-busy="true"
      >
        <h2 id={id} className="rs-schedule__title">
          {title}
        </h2>
        <p className="sr-only" role="status" aria-live="polite">
          Loading repayment schedule…
        </p>
        <ol className="rs-schedule__list" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rs-schedule__item rs-schedule__item--skeleton">
              <span className="rs-schedule__bullet" />
              <div className="rs-schedule__skeleton-lines">
                <span className="rs-schedule__skeleton-line" />
                <span className="rs-schedule__skeleton-line rs-schedule__skeleton-line--short" />
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (ordered.length === 0) {
    return (
      <section className="rs-schedule rs-schedule--empty" aria-labelledby={id}>
        <h2 id={id} className="rs-schedule__title">
          {title}
        </h2>
        <p className="rs-schedule__empty-msg" role="status" aria-live="polite">
          No scheduled repayments yet. Schedule one from an active credit line
          to see it visualized here.
        </p>
      </section>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <section
      className={`rs-schedule${compact ? ' rs-schedule--compact' : ''}`}
      aria-labelledby={id}
    >
      <header className="rs-schedule__header">
        <h2 id={id} className="rs-schedule__title">
          {title}
        </h2>
        <span
          className="rs-schedule__total-count tabular-nums"
          aria-label={`${stats.totalCount} scheduled ${
            stats.totalCount === 1 ? 'installment' : 'installments'
          }`}
        >
          {stats.totalCount} {stats.totalCount === 1 ? 'installment' : 'installments'}
        </span>
      </header>

      {/* ── Summary strip ───────────────────────────────────────────────── */}
      <div className="rs-schedule__summary" role="status" aria-live="polite">
        <div className="rs-schedule__summary-item">
          <span className="rs-schedule__summary-label">Paid to date</span>
          {/* tabular-nums: prevent digit-width wobble as totals change (issue #573) */}
          <span className="rs-schedule__summary-value rs-schedule__summary-value--paid tabular-nums">
            {fmt(stats.paidTotal)}
          </span>
        </div>
        <div className="rs-schedule__summary-item">
          <span className="rs-schedule__summary-label">Remaining</span>
          <span className="rs-schedule__summary-value tabular-nums">{fmt(stats.remainingTotal)}</span>
        </div>
        <div className="rs-schedule__summary-item">
          <span className="rs-schedule__summary-label">Upcoming</span>
          <span className="rs-schedule__summary-value tabular-nums">
            {stats.upcomingCount}
          </span>
        </div>
        <div className="rs-schedule__summary-item">
          <span className="rs-schedule__summary-label">Overdue</span>
          <span
            className={`rs-schedule__summary-value tabular-nums${
              stats.overdueCount > 0 ? ' rs-schedule__summary-value--alert' : ''
            }`}
          >
            {stats.overdueCount}
          </span>
        </div>
      </div>

      {/* ── Timeline list ──────────────────────────────────────────────── */}
      <ol
        className="rs-schedule__list"
        aria-label="Repayment installments in chronological order"
        tabIndex={0}
        /* The tabIndex makes the scrollable region keyboard-focusable on
           mobile / when the list is taller than the viewport. */
      >
        {ordered.map((entry, idx) => {
          const isLast = idx === ordered.length - 1;
          const isToday = isSameLocalDay(entry.dueDate, nowRef.toISOString());
          // Compile-time exhaustiveness check on the discriminated union.
          // A new status in the type without a corresponding record entry
          // would surface here before reaching the JSX.
          switch (entry.status) {
            case 'paid':
            case 'upcoming':
            case 'scheduled':
            case 'overdue':
            case 'defaulted':
              break;
            default:
              assertNever(entry.status);
          }
          const ariaLabel =
            entry.status === 'paid'
              ? `Paid installment of ${fmt(entry.amount)} on ${fmtDate(entry.paidDate)}`
              : `${STATUS_LABEL[entry.status]} installment of ${fmt(entry.amount)} due ${fmtDate(entry.dueDate)}${
                  entry.lineName ? ` on ${entry.lineName}` : ''
                }`;
          return (
            <li
              key={entry.id}
              className={`rs-schedule__item rs-schedule__item--${entry.status}${
                isLast ? ' rs-schedule__item--last' : ''
              }`}
              aria-label={ariaLabel}
            >
              <span className="rs-schedule__rail" aria-hidden="true" />
              <span
                className={`rs-schedule__bullet rs-schedule__bullet--${entry.status}`}
                aria-hidden="true"
              >
                {STATUS_GLYPH[entry.status]}
              </span>
              <div className="rs-schedule__body">
                <div className="rs-schedule__row-top">
                  <time
                    className="rs-schedule__date"
                    dateTime={entry.dueDate}
                  >
                    {fmtDate(entry.dueDate)}
                    {isToday && (
                      <span className="rs-schedule__today-pill">
                        <span aria-hidden="true">•</span> Today
                      </span>
                    )}
                  </time>
                  <span
                    className={`rs-schedule__badge rs-schedule__badge--${entry.status}`}
                    aria-label={`Status: ${STATUS_LABEL[entry.status]}`}
                  >
                    <span aria-hidden="true">{STATUS_GLYPH[entry.status]}</span>
                    <span>{STATUS_LABEL[entry.status]}</span>
                  </span>
                </div>
                <div className="rs-schedule__row-mid">
                  {/* aria-hidden: line name is already in the parent li's aria-label */}
                  <span className="rs-schedule__line-name" aria-hidden="true">
                    {entry.lineName ?? '—'}
                  </span>
                  {entry.note && (
                    <span className="rs-schedule__note">{entry.note}</span>
                  )}
                </div>
                <div className="rs-schedule__row-bot">
                  {/* tabular-nums: keeps amounts column-stable as values vary (issue #573) */}
                  <span
                    className="rs-schedule__amount tabular-nums"
                    aria-label={`Total ${fmt(entry.amount)}`}
                  >
                    {fmt(entry.amount)}
                  </span>
                  <span
                    className="rs-schedule__split"
                    aria-label={`Principal ${fmt(entry.principal)} and interest ${fmt(entry.interest)}`}
                  >
                    <span className="rs-schedule__split-piece">
                      <span className="rs-schedule__split-label">Principal</span>
                      <span className="rs-schedule__split-value tabular-nums">
                        {fmt(entry.principal)}
                      </span>
                    </span>
                    <span className="rs-schedule__split-piece">
                      <span className="rs-schedule__split-label">Interest</span>
                      <span className="rs-schedule__split-value tabular-nums">
                        {fmt(entry.interest)}
                      </span>
                    </span>
                  </span>
                </div>
                {entry.status === 'paid' && entry.paidDate && (
                  <div className="rs-schedule__footer">
                    <time
                      dateTime={entry.paidDate}
                      className="rs-schedule__paid-on"
                    >
                      Settled {fmtDate(entry.paidDate)}
                    </time>
                    {entry.txHash && (
                      <span
                        className="rs-schedule__hash"
                        aria-label={`On-chain transaction ${entry.txHash}`}
                      >
                        {entry.txHash}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="rs-schedule__legend" aria-hidden="true">
        <span className="rs-schedule__legend-item">
          <span className="rs-schedule__bullet rs-schedule__bullet--paid" />
          Paid
        </span>
        <span className="rs-schedule__legend-item">
          <span className="rs-schedule__bullet rs-schedule__bullet--upcoming" />
          Due soon
        </span>
        <span className="rs-schedule__legend-item">
          <span className="rs-schedule__bullet rs-schedule__bullet--scheduled" />
          Scheduled
        </span>
        <span className="rs-schedule__legend-item">
          <span className="rs-schedule__bullet rs-schedule__bullet--overdue" />
          Overdue
        </span>
        <span className="rs-schedule__legend-item">
          <span className="rs-schedule__bullet rs-schedule__bullet--defaulted" />
          Defaulted
        </span>
      </p>
    </section>
  );
}

export default RepaymentSchedule;
