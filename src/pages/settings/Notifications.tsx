/**
 * Notifications.tsx — Settings › Notification Preferences
 *
 * Lets users toggle in-app notifications by functional category:
 *   • Transactions    — payment confirmations, transfers, and account activity
 *   • Credit Lines    — limit adjustments, drawdowns, repayment reminders, and status alerts
 *   • Risk Score      — health factor changes, risk level shifts, and watchlist updates
 *   • Rate Changes    — interest rate movements, yield shifts, and market index updates
 *   • System          — platform maintenance, security alerts, and feature announcements
 *
 * Integrated with `NotificationContext` (`useNotifications()`) and persisted to
 * `localStorage` under `creditra_notification_prefs`.
 *
 * @accessibility
 *   - `<main aria-labelledby>` for landmark region.
 *   - Category groups use `<fieldset>` / `<legend>` semantics.
 *   - Switch toggles use `<button role="switch" aria-checked>`.
 *   - Status & error feedback banners use `role="status"` / `role="alert"` with `aria-live="polite"`.
 *   - Minimum 44×44 px touch targets for touch devices (WCAG 2.5.5).
 *   - High contrast & keyboard focus indicators (`:focus-visible`).
 *
 * @darkmode Uses CSS custom properties from `src/index.css`.
 *
 * Route: /settings/notifications
 */

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Receipt,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { PendingButton } from '../../components/PendingButton';
import { useNotifications } from '../../context/NotificationContext';
import type { NotificationCategory, NotificationPreferences } from '../../types/notification';
import './Notifications.css';

// ─── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: NotificationPreferences = {
  transaction: true,
  credit_line: true,
  risk_score: true,
  rate_change: true,
  system: true,
};

const CATEGORIES: NotificationCategory[] = [
  'transaction',
  'credit_line',
  'risk_score',
  'rate_change',
  'system',
];

/** Category metadata with human-readable titles, descriptions, and icons. */
const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; description: string; Icon: typeof Bell }
> = {
  transaction: {
    label: 'Transactions',
    description: 'Payment confirmations, transfers, and real-time transaction activity.',
    Icon: Receipt,
  },
  credit_line: {
    label: 'Credit Lines',
    description: 'Limit adjustments, drawdown confirmations, repayment deadlines, and status updates.',
    Icon: CreditCard,
  },
  risk_score: {
    label: 'Risk Score',
    description: 'Health factor updates, risk level shifts, watchlist additions, and collateral alerts.',
    Icon: AlertTriangle,
  },
  rate_change: {
    label: 'Rate Changes',
    description: 'Interest rate movements, yield shifts, and market index recalculations.',
    Icon: TrendingUp,
  },
  system: {
    label: 'System Notifications',
    description: 'Platform announcements, scheduled maintenance windows, and security notices.',
    Icon: Bell,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Deep-equal two preference objects. */
function prefsEqual(a: NotificationPreferences, b: NotificationPreferences): boolean {
  for (const cat of CATEGORIES) {
    if (a[cat] !== b[cat]) return false;
  }
  return true;
}

// ─── Toggle Switch Component ───────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}

function ToggleSwitch({ checked, label, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`notif-toggle${checked ? ' notif-toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
      data-state={checked ? 'on' : 'off'}
    >
      <span className="notif-toggle__track" aria-hidden="true" />
      <span className="notif-toggle__thumb" aria-hidden="true" />
      <span className="sr-only">{checked ? 'On' : 'Off'}</span>
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function NotificationSettings() {
  const { preferences, updatePreferences } = useNotifications();

  const [prefs, setPrefs] = useState<NotificationPreferences>(() => ({
    ...DEFAULT_PREFS,
    ...preferences,
  }));
  const [savedPrefs, setSavedPrefs] = useState<NotificationPreferences>(() => ({
    ...DEFAULT_PREFS,
    ...preferences,
  }));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  // Synchronize with context preferences on mount / change if needed
  useEffect(() => {
    setPrefs(prev => (prefsEqual(prev, preferences) ? prev : { ...preferences }));
    setSavedPrefs(prev => (prefsEqual(prev, preferences) ? prev : { ...preferences }));
  }, [preferences]);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (feedback !== 'success') return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const isDirty = !prefsEqual(prefs, savedPrefs);
  const allEnabled = CATEGORIES.every(cat => prefs[cat]);
  const hasAnyEnabled = CATEGORIES.some(cat => prefs[cat]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCategoryChange = useCallback((category: NotificationCategory, value: boolean) => {
    setPrefs(prev => ({ ...prev, [category]: value }));
  }, []);

  const handleMasterToggle = useCallback(() => {
    const newValue = !allEnabled;
    setPrefs(() => {
      const next = { ...DEFAULT_PREFS };
      for (const cat of CATEGORIES) {
        next[cat] = newValue;
      }
      return next;
    });
  }, [allEnabled]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFeedback(null);
    try {
      // Short delay for perceivable UI transition
      await new Promise(resolve => setTimeout(resolve, 500));
      updatePreferences(prefs);
      setSavedPrefs({ ...prefs });
      setFeedback('success');
    } catch {
      setFeedback('error');
    } finally {
      setSaving(false);
    }
  }, [prefs, updatePreferences]);

  const handleReset = useCallback(() => {
    setPrefs({ ...DEFAULT_PREFS });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="notifications-settings-page" aria-labelledby="notifications-page-title">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 id="notifications-page-title" className="notifications-settings-page__title">
          <Bell className="icon" aria-hidden="true" />
          Notification Preferences
        </h1>
        <p className="notifications-settings-page__subtitle">
          Manage which in-app notification categories you receive. Disabling a category suppresses
          toasts and prevents items from being saved to your notification center.
        </p>
      </div>

      {/* ── Feedback Banners ────────────────────────────────────────────── */}
      <div
        className="notifications-settings-page__status-region"
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback === 'success' && (
          <div className="notifications-banner notifications-banner--success" role="status">
            <CheckCircle className="notifications-banner__icon" aria-hidden="true" size={18} />
            <span>Notification preferences saved successfully.</span>
            <button
              type="button"
              className="notifications-banner__dismiss"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss success message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        {feedback === 'error' && (
          <div className="notifications-banner notifications-banner--error" role="alert">
            <AlertCircle className="notifications-banner__icon" aria-hidden="true" size={18} />
            <span>Failed to save notification preferences. Please try again.</span>
            <button
              type="button"
              className="notifications-banner__dismiss"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss error message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Warning Banner (All Disabled) ───────────────────────────────── */}
      {!hasAnyEnabled && (
        <div className="notifications-banner notifications-banner--warning" role="alert">
          <AlertCircle className="notifications-banner__icon" aria-hidden="true" size={18} />
          <span>
            All notification categories are disabled. You will not receive any in-app alerts or
            toasts until at least one category is re-enabled.
          </span>
        </div>
      )}

      {/* ── Category Controls Card ──────────────────────────────────────── */}
      <section
        aria-labelledby="notifications-controls-title"
        className="notifications-settings-page__section"
      >
        <h2 id="notifications-controls-title" className="notifications-settings-page__section-title">
          <Sliders className="icon" aria-hidden="true" size={20} />
          Category Toggles
        </h2>
        <p className="notifications-settings-page__section-description">
          Toggle individual categories on or off. Click &ldquo;Save Preferences&rdquo; to apply your changes.
        </p>

        {/* Master Toggle */}
        <div className="notifications-master-toggle">
          <div className="notifications-master-toggle__label">
            <span className="notifications-master-toggle__title">
              Enable All Notification Categories
            </span>
            <span className="notifications-master-toggle__hint">
              Master switch to turn all in-app category notifications on or off at once
            </span>
          </div>
          <ToggleSwitch
            checked={allEnabled}
            label="Enable all notification categories"
            onChange={handleMasterToggle}
          />
        </div>

        {/* Category Toggles */}
        {CATEGORIES.map(cat => {
          const meta = CATEGORY_META[cat];
          const { Icon } = meta;
          return (
            <fieldset key={cat} className="notifications-category">
              <legend className="notifications-category__legend">{meta.label}</legend>
              <div className="notifications-category__row">
                <div className="notifications-category__info">
                  <Icon className="notifications-category__icon" aria-hidden="true" size={20} />
                  <div className="notifications-category__text">
                    <span className="notifications-category__name">{meta.label}</span>
                    <span className="notifications-category__desc">{meta.description}</span>
                  </div>
                </div>
                <ToggleSwitch
                  checked={prefs[cat]}
                  label={`${meta.label} notifications`}
                  onChange={val => handleCategoryChange(cat, val)}
                />
              </div>
            </fieldset>
          );
        })}

        {/* Action Buttons */}
        <div className="notifications-actions">
          <PendingButton
            pending={saving}
            pendingLabel="Saving…"
            disabled={!isDirty}
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
            aria-label="Reset all notification preferences to defaults"
          >
            <RotateCcw className="icon-sm" aria-hidden="true" />
            Reset to Defaults
          </button>
        </div>
      </section>

      {/* ── Info Note ──────────────────────────────────────────────────── */}
      <div className="notifications-info-note" role="note">
        <p>
          <strong>Looking for delivery channels?</strong> In-app category preferences control
          alerts within Creditra. To configure Email, SMS, or Push delivery channels, visit{' '}
          <Link to="/notification-preferences" className="notifications-info-link">
            Notification Channel Preferences
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

export default NotificationSettings;
