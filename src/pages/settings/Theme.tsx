/**
 * Theme settings page.
 *
 * Houses accessibility and display preferences, specifically the high-contrast
 * toggle.
 *
 * Route: /settings/theme
 */

import { Settings as SettingsIcon } from 'lucide-react';
import { HighContrastToggle } from '../../components/HighContrastToggle';

export function Theme() {
  return (
    <div className="card card-large">
      <h2>
        <SettingsIcon className="icon" aria-hidden="true" />
        Theme Settings
      </h2>
      <p>Customize your display preferences to suit your needs.</p>

      {/* ── Accessibility section ─────────────────────────────────────── */}
      <section
        aria-labelledby="settings-a11y-heading"
        style={{ marginTop: '2rem', display: 'grid', gap: '1.5rem' }}
      >
        <h3
          id="settings-a11y-heading"
          style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}
        >
          Accessibility
        </h3>

        <HighContrastToggle />
      </section>
    </div>
  );
}
