/**
 * ProgressBar
 *
 * A reusable progress bar that meets WCAG 2.1 AA contrast (3:1 minimum
 * between fill and track). All colours reference semantic tokens so the
 * bar adapts to dark mode and `[data-contrast="high"]` automatically.
 *
 * API
 * ───
 *   variant   – semantic colour: 'accent' | 'success' | 'warning' | 'danger'
 *   value     – 0–100 percentage
 *   label     – accessible label (defaults to "{value}%")
 *   size      – 'sm' (4 px) | 'md' (8 px) | 'lg' (12 px)
 *   showValue – render the numeric percentage beside the bar
 *
 * Accessibility
 * ─────────────
 *   - role="progressbar" with valuenow / valuemin / valuemax
 *   - aria-label set via the `label` prop
 *   - Motion is suppressed when prefers-reduced-motion is active
 */

import './ProgressBar.css';

export type ProgressBarVariant = 'accent' | 'success' | 'warning' | 'danger';

export interface ProgressBarProps {
  /** Current progress 0–100. Values outside this range are clamped. */
  value: number;
  /** Colour variant – maps to --accent, --success, --warning, --error. */
  variant?: ProgressBarVariant;
  /** aria-label on the progressbar element. Defaults to "{value}%". */
  label?: string;
  /** Bar height. 'sm' = 4 px, 'md' = 8 px, 'lg' = 12 px. */
  size?: 'sm' | 'md' | 'lg';
  /** When true, shows the numeric percentage next to the bar. */
  showValue?: boolean;
}

const CLAMP = (n: number) => Math.min(100, Math.max(0, n));

export function ProgressBar({
  value,
  variant = 'accent',
  label,
  size = 'md',
  showValue = false,
}: ProgressBarProps) {
  const clamped = CLAMP(value);
  const ariaLabel = label ?? `${clamped}%`;

  return (
    <div className={`progress-bar-wrapper progress-bar--${variant} progress-bar--${size}`}>
      <div
        className="progress-bar-track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue && (
        <span className="progress-bar-value" aria-hidden="true">
          {clamped}%
        </span>
      )}
    </div>
  );
}
