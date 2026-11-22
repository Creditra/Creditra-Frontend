/**
 * Storage keys used across the Creditra application for localStorage persistence.
 */

// ─── Risk education (legacy & per-wallet) ────────────────────────────────────

/**
 * Legacy global key indicating whether the user has acknowledged the default-
 * risk education gate (GrantFox campaign). Read once for migration and then deleted.
 */
export const DEFAULT_RISK_ACK_KEY = 'creditra.default_risk_ack';

/** Legacy alias key for GrantFox campaign default-risk education acknowledgment. Read once for migration and then deleted. */
export const GRANTFOX_RISK_EDUCATION_ACK_KEY = 'grantfox_risk_education_acknowledged';

/**
 * Legacy global key set when a first-time borrower dismisses the inline default-
 * risk primer banner on /draw-credit. Read once for migration and then deleted.
 */
export const DEFAULT_RISK_BANNER_DISMISSED_KEY = 'creditra.default_risk_banner_dismissed';

/** Per-wallet risk-education persistence key. */
export function riskEducationStorageKey(owner: string): string {
  return `creditra.risk_education.${owner}.v1`;
}

// ─── Migrated versioned keys ─────────────────────────────────────────────────

/** KYC step progress state (`KycContext`). */
export const KYC_STORAGE_KEY = 'creditra_kyc';

/** Accepted Terms of Service version (`TermsBanner`). */
export const TERMS_ACCEPTED_VERSION_KEY = 'creditra_terms_accepted_version';

/** Stable dashboard metric values from the previous visit (`WhatChanged`). */
export const DASHBOARD_VALUES_STABLE_KEY = 'creditra_dashboard_values_stable';

// ─── Other application keys ──────────────────────────────────────────────────

/** Whether the user has completed the dashboard tour (`DashboardTour`). */
export const DASHBOARD_TOUR_COMPLETED_KEY = 'dashboard_tour_completed';

/** Whether the user has completed onboarding (`OnboardingFlow`, `DashboardTour`, `WalletButton`). */
export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

/** Whether the user dismissed the risk explainer card (`RiskExplainerCard`). */
export const RISK_EXPLAINER_DISMISSED_KEY = 'risk-explainer-dismissed';

/** Auth token persisted on login (`LoginPage`). */
export const AUTH_TOKEN_KEY = 'auth_token';

/** Notification inbox items (`NotificationContext`). */
export const NOTIFICATIONS_STORAGE_KEY = 'creditra_notifications';

/** Notification preferences (`NotificationContext`). */
export const NOTIFICATION_PREFS_KEY = 'creditra_notification_prefs';

/** Cached repayment transactions (`creditDataSource`). */
export const CREDIT_TRANSACTIONS_STORAGE_KEY = 'creditra.repayment-transactions';

/**
 * Persisted list of most recently activated command palette item IDs.
 */
export const COMMAND_PALETTE_RECENTS_KEY = 'creditra.command_palette_recents';

/** Build wallet-scoped keys for WhatChanged dashboard visit values. */
export const dashboardValuesStableKey = (owner: string): string =>
  `creditra_dashboard_values_stable.${owner}`;

export const dashboardValuesLastVisitKey = (owner: string): string =>
  `creditra_dashboard_values_last_visit.${owner}`;

export const dashboardSessionActiveKey = (owner: string): string =>
  `creditra_dashboard_session_active.${owner}`;
