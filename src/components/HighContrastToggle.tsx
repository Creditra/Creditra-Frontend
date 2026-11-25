/**
 * HighContrastToggle
 *
 * A self-contained toggle that reads/writes the contrast mode from
 * ContrastContext. Designed to live in the Settings page alongside the theme
 * toggle.
 *
 * Accessibility:
 *  - Uses a native <button role="switch"> so screen readers announce the
 *    on/off state without extra ARIA scaffolding.
 *  - Meets 44 × 44 px minimum touch target (WCAG 2.5.5).
 *  - Focus ring uses the semantic --accent token, never hardcoded hex.
 *  - Motion is suppressed when prefers-reduced-motion is active.
 */

import { useContrast } from '../context/ContrastContext';
import './HighContrastToggle.css';

interface HighContrastToggleProps {
  /** Render a compact version without the label / description block. */
  compact?: boolean;
}

export function HighContrastToggle({ compact = false }: HighContrastToggleProps) {
  const { contrastMode, source, toggleContrast } = useContrast();
  const isOn = contrastMode === 'high';

  return (
    <div className={`hc-toggle-row${compact ? ' hc-toggle-row--compact' : ''}`}>
      {!compact && (
        <div className="hc-toggle-label-group">
          <span className="hc-toggle-label" id="hc-toggle-label">
            High Contrast
          </span>
          <span className="hc-toggle-description" id="hc-toggle-desc">
            Boosts all semantic colour contrasts to WCAG AAA (≥7:1).{' '}
            {source === 'system'
              ? 'Following system setting.'
              : 'Persisted across sessions.'}
          </span>
        </div>
      )}

      {/*
        role="switch" + aria-checked is the correct pattern for a two-state
        toggle; aria-labelledby and aria-describedby wire it up without
        duplicating visible text.
      */}
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-labelledby={compact ? undefined : 'hc-toggle-label'}
        aria-label={compact ? 'Toggle high contrast mode' : undefined}
        aria-describedby={compact ? undefined : 'hc-toggle-desc'}
        className="hc-toggle-btn"
        onClick={toggleContrast}
        data-state={isOn ? 'on' : 'off'}
      >
        <span className="hc-toggle-track" aria-hidden="true">
          <span className="hc-toggle-thumb" />
        </span>
        <span className="sr-only">{isOn ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
