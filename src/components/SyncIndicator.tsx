import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from 'react';
import { formatRelative } from '../utils/dates';
import './SyncIndicator.css';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SyncIndicatorProps {
  /** Date/timestamp of the last successful data sync. */
  lastSyncedAt: Date | string | number;
  /**
   * Called when the user triggers a manual refresh. The component enters
   * a spinning state while the promise is in flight and announces
   * completion to screen readers when it resolves.
   */
  onRefresh: () => Promise<void> | void;
  /** Optional CSS class forwarded to the root element. */
  className?: string;
}

// ─── Ticker — keeps the relative label fresh every 30 s ─────────────────────

/** Forces a re-render on a fixed interval. Returns the current tick count. */
function useTicker(intervalMs = 30_000): number {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(bump, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SyncIndicator — inline "Last synced X ago" row with a manual-refresh button.
 *
 * Accessibility (WCAG 2.1 AA):
 * - Refresh button has an explicit `aria-label`; minimum 44 × 44 px target.
 * - `aria-live="polite"` region announces sync completion without visual noise.
 * - Tooltip on the timestamp uses `role="tooltip"` + `aria-describedby`; it is
 *   shown on both hover and focus so keyboard users can access it.
 * - The spinning icon is `aria-hidden`; the button's label changes to
 *   "Refreshing…" during flight so screen readers hear a state change.
 * - All CSS transitions/animations are gated behind
 *   `prefers-reduced-motion: no-preference` — they are fully suppressed for
 *   users who prefer reduced motion (not just slowed down).
 */
export function SyncIndicator({
  lastSyncedAt,
  onRefresh,
  className = '',
}: SyncIndicatorProps) {
  const [spinning, setSpinning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipId = useId();
  const timestampRef = useRef<HTMLTimeElement>(null);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-derive relative label every 30 s
  useTicker(30_000);

  const tsDate =
    lastSyncedAt instanceof Date ? lastSyncedAt : new Date(lastSyncedAt);
  const isValid = !isNaN(tsDate.getTime());

  const relativeLabel = isValid ? formatRelative(tsDate) : '—';

  /** Native locale string shown in the tooltip. */
  const exactLabel = isValid
    ? tsDate.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    : 'Unknown';

  /** ISO string for the <time> element's `dateTime` attribute. */
  const isoString = isValid ? tsDate.toISOString() : '';

  const handleRefresh = useCallback(async () => {
    if (spinning) return;
    setSpinning(true);
    setAnnouncement('');
    try {
      await onRefresh();
      setHasError(false);
      setAnnouncement('Data refreshed successfully.');
    } catch {
      setHasError(true);
      setAnnouncement("Couldn't refresh — showing data from " + relativeLabel + ". Please try again.");
    } finally {
      setSpinning(false);
      // Clear announcement after screen reader has had time to read it
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
      announcementTimerRef.current = setTimeout(() => setAnnouncement(''), 5000);
    }
  }, [spinning, onRefresh, relativeLabel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    };
  }, []);

  const showTooltip = () => setTooltipVisible(true);
  const hideTooltip = () => setTooltipVisible(false);

  return (
    <div className={`sync-indicator ${className}`}>
      {hasError ? (
        <span className="sync-indicator__error-row" role="status">
          <span className="sync-indicator__text">
            Couldn't refresh — showing data from{' '}
            <span className="sync-indicator__ts-wrapper">
              <time
                ref={timestampRef}
                dateTime={isoString}
                className="sync-indicator__ts"
                aria-describedby={tooltipId}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                tabIndex={0}
              >
                {relativeLabel}
              </time>

              <span
                id={tooltipId}
                role="tooltip"
                className={`sync-indicator__tooltip${tooltipVisible ? ' sync-indicator__tooltip--visible' : ''}`}
                aria-hidden={!tooltipVisible}
              >
                {exactLabel}
              </span>
            </span>
          </span>
          <button
            type="button"
            className="sync-indicator__retry-btn"
            onClick={handleRefresh}
            disabled={spinning}
            aria-busy={spinning}
          >
            Retry
          </button>
        </span>
      ) : (
        <>
          {/* Timestamp + tooltip */}
          <span className="sync-indicator__text">
            Last synced{' '}
            <span className="sync-indicator__ts-wrapper">
              <time
                ref={timestampRef}
                dateTime={isoString}
                className="sync-indicator__ts"
                aria-describedby={tooltipId}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                tabIndex={0}
              >
                {relativeLabel}
              </time>

              {/* Tooltip — visible on hover/focus of the timestamp */}
              <span
                id={tooltipId}
                role="tooltip"
                className={`sync-indicator__tooltip${tooltipVisible ? ' sync-indicator__tooltip--visible' : ''}`}
                aria-hidden={!tooltipVisible}
              >
                {exactLabel}
              </span>
            </span>
          </span>

          {/* Manual refresh button — 44 × 44 px minimum target */}
          <button
            type="button"
            className="sync-indicator__btn"
            onClick={handleRefresh}
            disabled={spinning}
            aria-label={spinning ? 'Refreshing…' : 'Refresh data'}
            aria-disabled={spinning}
            aria-busy={spinning}
          >
            <svg
              className={`sync-indicator__icon${spinning ? ' sync-indicator__icon--spinning' : ''}`}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              focusable="false"
              width="14"
              height="14"
            >
              <path
                d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.05-3.41L9 7h6V1l-1.35 1.35z"
                fill="currentColor"
              />
            </svg>
          </button>
        </>
      )}

      {/* aria-live region — announces sync result without visual noise */}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sync-indicator__announce sr-only"
      >
        {announcement}
      </span>
    </div>
  );
}
