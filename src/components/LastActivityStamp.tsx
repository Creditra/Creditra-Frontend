import { useId } from 'react';
import { formatRelative, formatAbsolute } from '../utils/dates';
import './LastActivityStamp.css';

interface LastActivityStampProps {
  /**
   * ISO 8601 timestamp (or `Date`) of the most recent activity.
   * Typically `CreditLine.lastActivityAt ?? CreditLine.updatedAt`.
   */
  timestamp: string | Date;
  /**
   * Optional fixed "now" reference, useful in tests to produce
   * deterministic output without faking the clock.
   */
  now?: Date;
  /** Optional additional class names for the root element. */
  className?: string;
}

/**
 * Displays the last-activity time for a credit line card.
 *
 * Visual output: `"Last activity: 3 minutes ago"` with a tooltip that
 * surfaces the precise absolute datetime on hover / keyboard focus.
 *
 * Accessibility:
 * - The root `<time>` element carries a machine-readable `dateTime`
 *   attribute (ISO 8601) so assistive tech and parsers always have the
 *   exact value.
 * - `aria-label` on the trigger reads the relative label in full for
 *   screen readers so the "i" icon is never the sole signal.
 * - The tooltip is wired via `aria-describedby` so the absolute string
 *   is announced as the element's accessible description.
 * - The tooltip trigger meets the 44×44 px touch-target guideline via
 *   the `last-activity-stamp__trigger` CSS class (see `LastActivityStamp.css`).
 * - Color is never the sole differentiator — the clock icon provides a
 *   non-color visual cue.
 */
export function LastActivityStamp({
  timestamp,
  now = new Date(),
  className = '',
}: LastActivityStampProps) {
  const tooltipId = useId();
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const isoString = date.toISOString();
  const relativeLabel = formatRelative(date, now);
  const absoluteLabel = formatAbsolute(date);

  const classes = ['last-activity-stamp', className].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {/* Screen readers get the full relative phrase via aria-label on the <time> */}
      <time dateTime={isoString} aria-label={`Last activity: ${relativeLabel}`}>
        <span aria-hidden="true" className="last-activity-stamp__icon">
          {/* Clock SVG inline to avoid a bundler dependency on lucide-react here */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <span className="last-activity-stamp__text">
          Last activity: <span className="last-activity-stamp__relative">{relativeLabel}</span>
        </span>
      </time>

      {/* Tooltip trigger — "i" affordance that shows the absolute datetime */}
      <span className="last-activity-stamp__tooltip-host">
        <span
          tabIndex={0}
          role="button"
          className="last-activity-stamp__trigger"
          aria-label="Show exact date and time of last activity"
          aria-describedby={tooltipId}
        >
          <span aria-hidden="true">i</span>
        </span>
        <span
          id={tooltipId}
          role="tooltip"
          className="last-activity-stamp__tooltip"
        >
          {absoluteLabel}
        </span>
      </span>
    </span>
  );
}
