/**
 * NotificationPreferences Page
 *
 * Lets users toggle delivery channels (Email, SMS, Push) for each
 * notification scenario group:
 *   • Repayment Due  — payment deadlines and overdue reminders
 *   • Default Risk   — risk-score drops and watchlist alerts
 *   • Attestation    — asset-attestation confirmations and expiry
 *
 * Persisted to localStorage under `creditra_channel_prefs` via the
 * project's `storage.ts` helpers so it survives across sessions and
 * never throws in private / quota-blocked contexts.
 *
 * Accessibility:
 *   • Every toggle is a <button role="switch" aria-checked> for correct
 *     screen-reader announcement.
 *   • Category groups use <fieldset>/<legend> semantics.
 *   • The save button uses PendingButton for in-flight feedback.
 *   • Success / error banners use role="status" aria-live="polite".
 *   • All interactive elements have visible focus rings via `:focus-visible`.
 *   • 44 × 44 px minimum touch targets (WCAG 2.5.5).
 *
 * Design tokens:
 *   All colours, radii, and spacing reference CSS custom properties
 *   declared in `src/index.css` so dark-mode and [data-contrast="high"]
 *   adapt automatically.
 *
 * Route: /notification-preferences
 */

import { useState, useCallback, useEffect } from 'react';
import { Bell, Mail, Smartphone, TabletSmartphone, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { PendingButton } from '../components/PendingButton';
import { useScopedStorage, scopedKey } from '../utils/scoped-storage';
import type {
  NotificationChannelPreferences,
  NotificationPreferenceCategory,
  NotificationChannel,
} from '../types/notification';
import './NotificationPreferences.css';

// ─── Constants ─────────────────────────────────────────────────────────────────

const BASE_STORAGE_KEY = scopedKey('creditra_channel_prefs');

/** Human-readable labels for each category group. */
const CATEGORY_META: Record<NotificationPreferenceCategory, {
  label: string;
  description: string;
}> = {
  repayment_due: {
    label: 'Repayment Due',
    description: 'Payment deadline reminders, upcoming due dates, and overdue alerts.',
  },
  default_risk: {
    label: 'Default Risk',
    description: 'Risk-score changes, watchlist additions, and credit-line health warnings.',
  },
  attestation: {
    label: 'Attestation',
    description: 'Asset-attestation confirmations, renewal reminders, and expiry notices.',
  },
};

/** Channels in display order with icons and labels. */
const CHANNELS: { key: NotificationChannel; label: string; Icon: typeof Mail }[] = [
  { key: 'email', label: 'Email', Icon: Mail },
  { key: 'sms', label: 'SMS', Icon: Smartphone },
  { key: 'push', label: 'Push', Icon: TabletSmartphone },
];

/** Default: all channels enabled for every category. */
const DEFAULT_PREFS: NotificationChannelPreferences = {
  repayment_due: { email: true, sms: true, push: true },
  default_risk: { email: true, sms: true, push: true },
  attestation: { email: true, sms: true, push: true },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Deep-equal two channel prefs objects. */
function prefsEqual(a: NotificationChannelPreferences, b: NotificationChannelPreferences): boolean {
  const cats: NotificationPreferenceCategory[] = ['repayment_due', 'default_risk', 'attestation'];
  for (const cat of cats) {
    for (const ch of ['email', 'sms', 'push'] as NotificationChannel[]) {
      if (a[cat][ch] !== b[cat][ch]) return false;
    }
  }
  return true;
}

// ─── Channel Toggle Sub-component ──────────────────────────────────────────────

interface ChannelToggleProps {
  channel: NotificationChannel;
  label: string;
  categoryLabel: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (channel: NotificationChannel, value: boolean) => void;
}

/** A single email / SMS / push toggle rendered as role="switch". */
function ChannelToggle({ channel, label, categoryLabel, icon, checked, onChange }: ChannelToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} notifications — ${categoryLabel}`}
      className={`np-channel-toggle${checked ? ' np-channel-toggle--on' : ''}`}
      onClick={() => onChange(channel, !checked)}
      data-state={checked ? 'on' : 'off'}
    >
      <span className="np-channel-toggle__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="np-channel-toggle__label">{label}</span>
      <span className="np-channel-toggle__track" aria-hidden="true">
        <span className="np-channel-toggle__thumb" />
      </span>
      <span className="sr-only">{checked ? 'On' : 'Off'}</span>
    </button>
  );
}

// ─── Category Group Sub-component ──────────────────────────────────────────────

interface CategoryGroupProps {
  category: NotificationPreferenceCategory;
  preferences: NotificationChannelPreferences;
  onChannelChange: (category: NotificationPreferenceCategory, channel: NotificationChannel, value: boolean) => void;
}

/** A fieldset wrapping a single category group's description and channel toggles. */
function CategoryGroup({ category, preferences, onChannelChange }: CategoryGroupProps) {
  const meta = CATEGORY_META[category];
  const legendId = `np-legend-${category}`;

  return (
    <fieldset className="np-category-group">
      <legend id={legendId} className="np-category-group__legend">
        {meta.label}
      </legend>
      <p className="np-category-group__description">{meta.description}</p>
      <div className="np-category-group__channels">
        {CHANNELS.map(({ key, label, Icon }) => (
          <ChannelToggle
            key={key}
            channel={key}
            label={label}
            categoryLabel={meta.label}
            icon={<Icon aria-hidden="true" size={18} />}
            checked={preferences[category][key]}
            onChange={(ch, val) => onChannelChange(category, ch, val)}
          />
        ))}
      </div>
    </fieldset>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────────

export function NotificationPreferences() {
  const [savedPrefs, setSavedPrefs] = useScopedStorage<NotificationChannelPreferences>(
    BASE_STORAGE_KEY,
    DEFAULT_PREFS,
  );
  const [prefs, setPrefs] = useState<NotificationChannelPreferences>(savedPrefs);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  // Sync state whenever saved preferences change (e.g. wallet switch or initial load)
  useEffect(() => {
    setPrefs(savedPrefs);
  }, [savedPrefs]);

  // Auto-dismiss success feedback after 5 s
  useEffect(() => {
    if (feedback !== 'success') return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const isDirty = !prefsEqual(prefs, savedPrefs);
  const hasAnyEnabled = Object.values(prefs).some(cat =>
    Object.values(cat).some(Boolean),
  );

  const handleChannelChange = useCallback(
    (category: NotificationPreferenceCategory, channel: NotificationChannel, value: boolean) => {
      setPrefs(prev => ({
        ...prev,
        [category]: { ...prev[category], [channel]: value },
      }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFeedback(null);
    // Simulate a short network round-trip so the pending state is perceivable
    await new Promise(resolve => setTimeout(resolve, 600));
    setSavedPrefs({ ...prefs });
    setFeedback('success');
    setSaving(false);
  }, [prefs, setSavedPrefs]);

  const handleReset = useCallback(() => {
    setPrefs({ ...DEFAULT_PREFS });
  }, []);

  const categories: NotificationPreferenceCategory[] = ['repayment_due', 'default_risk', 'attestation'];

  return (
    <div className="np-page">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="np-page__header">
        <div>
          <h1 className="np-page__title">
            <Bell className="icon" aria-hidden="true" />
            Notification Preferences
          </h1>
          <p className="np-page__subtitle">
            Choose how you want to receive notifications for each category.
            You can enable or disable email, SMS, and push delivery independently.
          </p>
        </div>
      </div>

      {/* ── Feedback banners ────────────────────────────────────────────── */}
      {feedback === 'success' && (
        <div className="np-banner np-banner--success" role="status" aria-live="polite">
          <CheckCircle className="np-banner__icon" aria-hidden="true" />
          <span>Preferences saved successfully.</span>
          <button
            type="button"
            className="np-banner__dismiss"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss success message"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {feedback === 'error' && (
        <div className="np-banner np-banner--error" role="alert">
          <AlertCircle className="np-banner__icon" aria-hidden="true" />
          <span>Failed to save preferences. Please try again.</span>
          <button
            type="button"
            className="np-banner__dismiss"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss error message"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* ── No channels warning ─────────────────────────────────────────── */}
      {!hasAnyEnabled && (
        <div className="np-banner np-banner--warning" role="alert">
          <AlertCircle className="np-banner__icon" aria-hidden="true" />
          <span>
            All delivery channels are disabled. You won&rsquo;t receive any notifications.
            Enable at least one channel per category to stay informed.
          </span>
        </div>
      )}

      {/* ── Category groups ─────────────────────────────────────────────── */}
      <div className="card card-large">
        <h2>
          <Bell className="icon" aria-hidden="true" />
          Notification Channels
        </h2>
        <p className="np-channels-desc">
          Toggle delivery channels for each notification scenario. Changes are not
          applied until you save.
        </p>

        {categories.map(cat => (
          <CategoryGroup
            key={cat}
            category={cat}
            preferences={prefs}
            onChannelChange={handleChannelChange}
          />
        ))}

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="np-actions">
          <PendingButton
            pending={saving}
            pendingLabel="Saving…"
            disabled={!isDirty || !hasAnyEnabled}
            className="btn-primary"
            onClick={handleSave}
          >
            Save Preferences
          </PendingButton>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleReset}
            disabled={prefsEqual(prefs, DEFAULT_PREFS)}
            aria-label="Reset all preferences to defaults"
          >
            <RotateCcw className="icon-sm" aria-hidden="true" />
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* ── Info note ──────────────────────────────────────────────────── */}
      <div className="np-info-note" role="note">
        <p>
          <strong>Note:</strong> These preferences control delivery channels only.
          To manage which types of in-app notifications you see, visit the{' '}
          <em>Notification Center</em> via the bell icon in the header.
        </p>
      </div>
    </div>
  );
}
