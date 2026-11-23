/**
 * KbdHint
 *
 * Renders styled keyboard shortcut hints (<kbd> tags) with screen reader
 * support, dark mode / high contrast token consistency, and responsive
 * layouts.
 *
 * Key design choices:
 *   - `separator` prop controls the glyph displayed between keys:
 *       '/'  (default) — for alternate keys, e.g. "← / →"
 *       '+'            — for chord combinations, e.g. "Ctrl + K"
 *   - An `.sr-only` span carries the full text alternative so screen readers
 *     never read the visual separator or repeat key labels redundantly.
 *   - All colours reference CSS custom properties from `src/index.css`; no
 *     one-off hex values.
 *
 * WCAG 2.1 AA Conformance:
 *   - Screen reader fallback via .sr-only element explaining the shortcut.
 *   - Uses design tokens for colors, borders, and dark/high-contrast mode
 *     support.
 *   - Visual separator (`aria-hidden="true"`) keeps reading order clean.
 */

import React from 'react';
import './KbdHint.css';

export interface KbdHintProps {
  /** Key or sequence of keys to display (e.g. "Esc", ["←", "→"], ["Ctrl", "K"]) */
  keys: string | string[];
  /** Optional descriptive label shown next to the shortcut keys */
  label?: string;
  /** Optional detailed description for screen readers */
  description?: string;
  /**
   * Glyph displayed between multiple keys.
   *   '/' (default) — for alternate keys: ← / →
   *   '+'           — for chord combos:   Ctrl + K
   */
  separator?: '/' | '+';
  /** Visual variant: 'inline' (default) or 'badge' (boxed container) */
  variant?: 'inline' | 'badge';
  /** Additional CSS class names */
  className?: string;
  /** Optional override for root container aria-label */
  'aria-label'?: string;
}

export function KbdHint({
  keys,
  label,
  description,
  separator = '/',
  variant = 'inline',
  className = '',
  'aria-label': ariaLabel,
}: KbdHintProps) {
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const keyList = (Array.isArray(keys) ? keys : [keys]).map(key => {
    if (key.toLowerCase() === 'cmd' || key.toLowerCase() === 'ctrl' || key.toLowerCase() === 'cmd/ctrl') {
      return isMac ? '⌘' : 'Ctrl';
    }
    return key;
  });

  // Bail out early for an empty key list — nothing to render
  if (keyList.length === 0) return null;

  const keysText = keyList.join(' ');
  const srText =
    description ?? (label ? `${label} (${keysText})` : `Keyboard shortcut: ${keysText}`);

  const containerClasses = [
    'kbd-hint-container',
    variant === 'badge' ? 'kbd-hint-badge' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={containerClasses}
      aria-label={ariaLabel ?? srText}
      role="group"
    >
      {/* Full text alternative for screen readers */}
      <span className="sr-only">{srText}</span>

      {/* Visual key chips — hidden from the AT reading order since the
          aria-label on the container already conveys the same meaning */}
      <span className="kbd-hint-group" aria-hidden="true">
        {keyList.map((key, index) => (
          <React.Fragment key={`${key}-${index}`}>
            {index > 0 && (
              <span className="kbd-hint-separator">{separator}</span>
            )}
            <kbd className="kbd-hint-key">{key}</kbd>
          </React.Fragment>
        ))}
      </span>

      {label && (
        <span className="kbd-hint-label" aria-hidden="true">
          {label}
        </span>
      )}
    </span>
  );
}

export default KbdHint;
