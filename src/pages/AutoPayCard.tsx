import { useMemo, useState } from 'react';
import { AutopaySchedule, type AutopayFrequency } from '../components/AutopaySchedule';
import {
  getNextScheduledPayment,
  useAutopaySchedulesForWallet,
} from '../state/autopay';
import { fmt } from '../utils/tokens';
import './AutopayPage.css';

interface AutoPayCardProps {
  hasValidPreview: boolean;
  parsedAmount: number;
  frequency: AutopayFrequency;
  startDate: string;
  endDate?: string;
  onPreviewRowChange?: (index: number | null) => void;
  creditLineName?: string;
  creditLineBalance?: number;
  walletKey?: string | null;
  creditLineId?: string;
}

/**
 * AutoPayCard — autopay preview card with hover-preview and keyboard alt.
 *
 * When a valid preview is available, the card shows the `AutopaySchedule`.
 * When hovered/focused, a summary tooltip appears with the schedule overview.
 *
 * Keyboard accessibility:
 * - The entire card is focusable (`tabIndex={0}`) so keyboard users can
 *   trigger the hover-preview state.
 * - `onKeyDown` supports Enter/Space to toggle the preview details.
 *
 * WCAG 2.1 AA:
 * - Has `role="region"` with an `aria-label`.
 * - Preview states work on both hover AND focus (keyboard).
 * - Focus rings via `:focus-visible` in index.css.
 */
export function AutoPayCard({
  hasValidPreview,
  parsedAmount,
  frequency,
  startDate,
  endDate,
  onPreviewRowChange,
  creditLineName,
  creditLineBalance,
  walletKey = null,
  creditLineId,
}: AutoPayCardProps) {
  const [focused, setFocused] = useState(false);
  const { activeSchedules } = useAutopaySchedulesForWallet(walletKey);
  const nextScheduled = useMemo(
    () => getNextScheduledPayment(activeSchedules, creditLineId),
    [activeSchedules, creditLineId],
  );

  const containerClasses = [
    'card',
    'autopay-page__preview-card',
    focused ? 'autopay-page__preview-card--focused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClasses}
      role="region"
      aria-label="Autopay schedule preview"
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => setFocused(true)}
      onMouseLeave={() => setFocused(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setFocused((prev) => !prev);
        }
      }}
      style={{
        padding: 'var(--space-8)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        cursor: 'pointer',
      }}
    >
      {nextScheduled && (
        <div
          className="autopay-page__next-scheduled"
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--accent-tint)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <strong>Next scheduled payment:</strong> {fmt(nextScheduled.amount)} on{' '}
          <time dateTime={nextScheduled.date}>
            {new Date(`${nextScheduled.date}T00:00:00`).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
        </div>
      )}
      {hasValidPreview ? (
        <>
          <AutopaySchedule
            amount={parsedAmount}
            frequency={frequency}
            startDate={startDate}
            endDate={endDate}
            maxRows={8}
            onPreviewRowChange={onPreviewRowChange}
            creditLineName={creditLineName}
            creditLineBalance={creditLineBalance}
          />
          {focused && (
            <div
              className="autopay-page__preview-overlay"
              aria-label={`Schedule preview: $${parsedAmount.toLocaleString()} ${frequency} from ${startDate}`}
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3)',
                background: 'var(--accent-tint)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                color: 'var(--muted)',
              }}
            >
              Preview active — press Enter or Space to toggle details
            </div>
          )}
        </>
      ) : (
        <div
          className="autopay-page__preview-placeholder"
          aria-live="polite"
          style={{
            padding: 'var(--space-10) var(--space-8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          <span
            className="autopay-page__preview-placeholder-icon"
            aria-hidden="true"
            role="img"
            aria-label="Calendar"
            style={{ fontSize: 'var(--text-3xl)', color: 'var(--muted)' }}
          >
            📅
          </span>
          <p
            className="autopay-page__preview-placeholder-text"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--muted)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            Fill in an amount and start date to see your upcoming payment
            schedule.
          </p>
        </div>
      )}
    </div>
  );
}
