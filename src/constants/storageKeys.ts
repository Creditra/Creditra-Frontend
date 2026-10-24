/**
 * Storage keys used across the Creditra application for localstorage persistence.
 */

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
