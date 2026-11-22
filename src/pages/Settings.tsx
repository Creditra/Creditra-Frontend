/**
 * Settings page
 *
 * Houses accessibility and display preferences.
 * High-contrast toggle uses ContrastContext; future light/dark theme toggle
 * will use ThemeContext.
 *
 * Route: /settings  (add to App.tsx router when ready)
 */

import { Settings as SettingsIcon, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HighContrastToggle } from '../components/HighContrastToggle';
import { ReducedMotionToggle } from '../components/ReducedMotionToggle';
import { CopyToClipboard } from '../components/CopyToClipboard';
import { ConfigError, getCreditNetworkConfig } from '../config/creditNetwork';
import { shortenAddress } from '../utils/format-address';

type DiagnosticsState =
  | { ok: true; network: string; creditContractId: string }
  | { ok: false; problemCount: number | null };

function readDiagnostics(): DiagnosticsState {
  try {
    const config = getCreditNetworkConfig();
    return {
      ok: true,
      network: config.network,
      creditContractId: config.creditContractId,
    };
  } catch (error) {
    if (error instanceof ConfigError) {
      return { ok: false, problemCount: error.problems.length };
    }
    return { ok: false, problemCount: null };
  }
}

export function Settings() {
  const diagnostics = readDiagnostics();

  return (
    <div className="card card-large">
      <h2>
        <SettingsIcon className="icon" aria-hidden="true" />
        Settings
      </h2>
      <p>Customize your experience with accessibility and notification options.</p>

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
        <ReducedMotionToggle />
      </section>

      {/* ── Notifications section ─────────────────────────────────────── */}
      <section
        aria-labelledby="settings-notif-heading"
        style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}
      >
        <h3
          id="settings-notif-heading"
          style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}
        >
          Notifications
        </h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
          Manage your in-app category notifications and delivery channels.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/settings/notifications" className="inline-flex items-center gap-2 min-h-11 rounded-lg border border-accent bg-accent px-4 text-sm font-semibold text-background no-underline hover:brightness-110">
            <Bell size={16} aria-hidden="true" />
            Category Preferences
          </Link>
          <Link to="/notification-preferences" className="inline-flex items-center gap-2 min-h-11 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground no-underline hover:border-accent">
            Delivery Channels
          </Link>
        </div>
      </section>

      {/* ── Diagnostics footer ────────────────────────────────────────── */}
      <section
        aria-labelledby="settings-diagnostics-heading"
        style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <h3
          id="settings-diagnostics-heading"
          style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}
        >
          Diagnostics
        </h3>

        {diagnostics.ok ? (
          <dl
            style={{
              margin: 0,
              display: 'grid',
              gap: '0.5rem',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <dt style={{ color: 'var(--muted)', fontWeight: 600 }}>Network</dt>
              <dd style={{ margin: 0, fontFamily: 'monospace' }}>{diagnostics.network}</dd>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <dt style={{ color: 'var(--muted)', fontWeight: 600 }}>Credit Contract ID</dt>
              <dd style={{ margin: 0 }}>
                {diagnostics.creditContractId ? (
                  <CopyToClipboard
                    value={diagnostics.creditContractId}
                    displayValue={
                      <span title={diagnostics.creditContractId}>
                        {shortenAddress(diagnostics.creditContractId)}
                      </span>
                    }
                    ariaLabel="Copy credit contract id"
                    variant="surface"
                  />
                ) : (
                  <span style={{ color: 'var(--muted)' }}>Not configured</span>
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <p
            role="alert"
            style={{ margin: 0, fontSize: '0.875rem', color: 'var(--error, #ef4444)' }}
          >
            Configuration error
            {diagnostics.problemCount !== null
              ? ` (${diagnostics.problemCount} ${diagnostics.problemCount === 1 ? 'problem' : 'problems'})`
              : ''}
          </p>
        )}
      </section>
    </div>
  );
}
