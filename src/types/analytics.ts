/**
 * Analytics preference types.
 *
 * Used by the Settings › Analytics page to model per-user, per-category
 * opt-in analytics controls.  All categories default to **off** (opt-in).
 */

/** The four granular analytics categories a user can opt in to. */
export type AnalyticsCategory =
  | 'usage'
  | 'performance'
  | 'crash_reports'
  | 'feature_flags';

/** Per-category boolean map — `true` means the user has opted in. */
export type AnalyticsPreferences = Record<AnalyticsCategory, boolean>;

/** All categories OFF by default (opt-in model). */
export const DEFAULT_ANALYTICS_PREFS: AnalyticsPreferences = {
  usage: false,
  performance: false,
  crash_reports: false,
  feature_flags: false,
};

/** Ordered list of all analytics categories (used for iteration). */
export const ANALYTICS_CATEGORIES: AnalyticsCategory[] = [
  'usage',
  'performance',
  'crash_reports',
  'feature_flags',
];
