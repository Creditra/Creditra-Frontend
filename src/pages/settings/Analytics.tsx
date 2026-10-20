/**
 * Analytics.tsx — Settings › Analytics
 *
 * Opt-in analytics page with granular per-category controls.
 * Every category defaults to **off**; the user must explicitly enable each
 * one.  A master toggle is provided for convenience.
 *
 * Preferences are persisted to `localStorage` under
 * `creditra_analytics_prefs` via the project's `storage.ts` helpers so
 * they survive across sessions and never throw in private / quota-blocked
 * contexts.
 *
 * @accessibility
 *   - `<main aria-labelledby>` for page landmark.
 *   - Every toggle is `<button role="switch" aria-checked>` for correct
 *     screen-reader announcement.
 *   - Category groups use `<fieldset>` / `<legend>` semantics (legend is
 *     visually hidden but accessible).
 *   - Success / error banners use `role="status"` / `role="alert"` with
 *     `aria-live="polite"`.
 *   - All interactive elements meet the 44×44 px touch target minimum
 *     (WCAG 2.5.5).
 *   - `:focus-visible` outlines on every interactive element.
 *
 * @darkmode All colours reference `var(--*)` tokens from `src/index.css`.
 *
 * Route: /settings/analytics
 */

import { useState, useCallback, useEffect } from 'react';
import {
  BarChart3,
  Activity,
  Bug,
  FlaskConical,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { PendingButton } from '../../components/PendingButton';
import { readJson, writeJson } from '../../utils/storage';
import type { AnalyticsCategory, AnalyticsPreferences } from '../../types/analytics';
import {
  DEFAULT_ANALYTICS_PREFS,
  ANALYTICS_CATEGORIES,
} from '../../types/analytics';
import './Analytics.css';

// ─── Constants ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'creditra_analytics_prefs';

/** Human-readable metadata for each analytics category. */
const CATEGORY_META: Record<
  AnalyticsCategory,
  { label: string; description: string; Icon: typeof BarChart3 }
> = {
  usage: {
    label: 'Usage Analytics',
    description:
      'Page views, feature usage patterns, and navigation flows to help us improve the product experience.',
    Icon: BarChart3,
  },
  performance: {
    label: 'Performance',
    description:
      'Page load times, API response latencies, and rendering metrics to help us keep Creditra fast.',
    Icon: Activity,
  },
  crash_reports: {
    label: 'Crash Reports',
    description:
      'Automatic error and crash report submission so we can fix issues faster.',
    Icon: Bug,
  },
  feature_flags: {
    label: 'Feature Flags',
    description:
      'Anonymous participation in A/B tests and feature experiments to shape upcoming features.',
    Icon: FlaskConical,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Load saved preferences or return defaults. */
function loadPreferences(): AnalyticsPreferences {
  return readJson<AnalyticsPreferences>(STORAGE_KEY, DEFAULT_ANALYTICS_PREFS);
}

/** Deep-equal two analytics pref objects. */
function prefsEqual(a: AnalyticsPreferences, b: AnalyticsPreferences): boolean {
  for (const cat of ANALYTICS_CATEGORIES) {
    if (a[cat] !== b[cat]) return false;
  }
  return true;
}

// ─── Toggle Sub-component ───────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}

/** Accessible toggle switch rendered as `role="switch"`. */
function ToggleSwitch({ checked, label, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="analytics-toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="analytics-toggle__track" aria-hidden="true" />
      <span className="analytics-toggle__thumb" aria-hidden="true" />
    </button>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────────

export default function AnalyticsSettings() {
  const [prefs, setPrefs] = useState<AnalyticsPreferences>(loadPreferences);
  const [savedPrefs, setSavedPrefs] = useState<AnalyticsPreferences>(loadPreferences);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  // Auto-dismiss success feedback after 5 s
  useEffect(() => {
    if (feedback !== 'success') return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const isDirty = !prefsEqual(prefs, savedPrefs);
  const allEnabled = ANALYTICS_CATEGORIES.every((cat) => prefs[cat]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCategoryChange = useCallback(
    (category: AnalyticsCategory, value: boolean) => {
      setPrefs((prev) => ({ ...prev, [category]: value }));
    },
    [],
  );

  const handleMasterToggle = useCallback(() => {
    const newValue = !allEnabled;
    setPrefs(() => {
      const next: AnalyticsPreferences = { ...DEFAULT_ANALYTICS_PREFS };
      for (const cat of ANALYTICS_CATEGORIES) {
        next[cat] = newValue;
      }
      return next;
    });
  }, [allEnabled]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFeedback(null);
    // Simulate a short network round-trip so the pending state is perceivable
    await new Promise((resolve) => setTimeout(resolve, 600));
    writeJson(STORAGE_KEY, prefs);
    setSavedPrefs({ ...prefs });
    setFeedback('success');
    setSaving(false);
  }, [prefs]);

  const handleReset = useCallback(() => {
    setPrefs({ ...DEFAULT_ANALYTICS_PREFS });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="analytics-page" aria-labelledby="analytics-page-title">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 id="analytics-page-title" className="analytics-page__title">
          <ShieldCheck className="icon" aria-hidden="true" />
          Analytics
        </h1>
        <p className="analytics-page__subtitle">
          Control which analytics data Creditra may collect. All categories are
          disabled by default&nbsp;&mdash; enable only what you&rsquo;re
          comfortable sharing.
        </p>
      </div>

      {/* ── Feedback banners ────────────────────────────────────────────── */}
      <div
        className="analytics-page__status-region"
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback === 'success' && (
          <div className="analytics-banner analytics-banner--success" role="status">
            <CheckCircle className="analytics-banner__icon" aria-hidden="true" size={18} />
            <span>Analytics preferences saved successfully.</span>
            <button
              type="button"
              className="analytics-banner__dismiss"
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
          <div className="analytics-banner analytics-banner--error" role="alert">
            <AlertCircle className="analytics-banner__icon" aria-hidden="true" size={18} />
            <span>Failed to save preferences. Please try again.</span>
            <button
              type="button"
              className="analytics-banner__dismiss"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss error message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Main card ───────────────────────────────────────────────────── */}
      <section
        aria-labelledby="analytics-controls-title"
        className="analytics-page__section"
      >
        <h2 id="analytics-controls-title" className="analytics-page__section-title">
          <BarChart3 className="icon" aria-hidden="true" size={20} />
          Analytics Controls
        </h2>
        <p className="analytics-page__section-description">
          Toggle individual categories on or off. Changes are not applied until
          you save.
        </p>

        {/* Master toggle */}
        <div className="analytics-master-toggle">
          <div className="analytics-master-toggle__label">
            <span className="analytics-master-toggle__title">
              Enable All Analytics
            </span>
            <span className="analytics-master-toggle__hint">
              Quick toggle for all categories below
            </span>
          </div>
          <ToggleSwitch
            checked={allEnabled}
            label="Enable all analytics categories"
            onChange={handleMasterToggle}
          />
        </div>

        {/* Per-category toggles */}
        {ANALYTICS_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const { Icon } = meta;
          return (
            <fieldset key={cat} className="analytics-category">
              <legend className="analytics-category__legend">
                {meta.label}
              </legend>
              <div className="analytics-category__row">
                <div className="analytics-category__info">
                  <Icon
                    className="analytics-category__icon"
                    aria-hidden="true"
                    size={20}
                  />
                  <div className="analytics-category__text">
                    <span className="analytics-category__name">
                      {meta.label}
                    </span>
                    <span className="analytics-category__desc">
                      {meta.description}
                    </span>
                  </div>
                </div>
                <ToggleSwitch
                  checked={prefs[cat]}
                  label={`${meta.label} analytics`}
                  onChange={(val) => handleCategoryChange(cat, val)}
                />
              </div>
            </fieldset>
          );
        })}

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="analytics-actions">
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
            disabled={prefsEqual(prefs, DEFAULT_ANALYTICS_PREFS)}
            aria-label="Reset all analytics preferences to defaults"
          >
            <RotateCcw className="icon-sm" aria-hidden="true" />
            Reset to Defaults
          </button>
        </div>
      </section>

      {/* ── Info note ──────────────────────────────────────────────────── */}
      <div className="analytics-info-note" role="note">
        <p>
          <strong>Your privacy matters.</strong> All analytics data is
          anonymized before transmission. You can change these preferences at
          any time. Disabling all categories means no analytics data will be
          collected.
        </p>
      </div>
    </main>
  );
}
