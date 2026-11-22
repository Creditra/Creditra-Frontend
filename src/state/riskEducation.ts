
/**
 * Per-wallet, versioned default-risk education state.
 *
 * Two distinct events are recorded separately:
 *   - acknowledged: the borrower completed the 3-step education modal for a
 *     specific content version.
 *   - dismissed: the borrower snoozed the inline banner. Dismissal is never
 *     treated as acknowledgement.
 *
 * Storage is scoped per wallet identity key so a new borrower on the same
 * browser is not inheriting another wallet's acknowledgement. Only the identity
 * key hash is used as the storage suffix — no PII is persisted.
 */

import {
  DEFAULT_RISK_ACK_KEY,
  GRANTFOX_RISK_EDUCATION_ACK_KEY,
  DEFAULT_RISK_BANNER_DISMISSED_KEY,
  riskEducationStorageKey,
} from '../constants/storageKeys';
import {
  hasKey,
  readVersioned,
  removeKey,
  writeVersioned,
} from '../utils/storage';

/**
 * Version of the risk-education content borrowers acknowledge. Bump this
 * whenever the education content (`STEPS` in `DefaultRiskModal`) changes
 * materially so that every wallet is asked to re-acknowledge.
 */
export const RISK_EDUCATION_VERSION = 1;

/** How long a banner dismissal snoozes the banner. */
export const RISK_EDUCATION_DISMISS_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export interface RiskEducationState {
  /** The content version the borrower acknowledged, applicable to this wallet. */
  acknowledgedVersion?: number;
  /** ISO timestamp of the last banner dismissal for this wallet. */
  dismissedAt?: string;
}

const RISK_EDUCATION_STORAGE_VERSION = 1;

function parseRiskEducationObject(value: unknown): RiskEducationState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const obj = value as Record<string, unknown>;
  const state: RiskEducationState = {};

  if (typeof obj.acknowledgedVersion === 'number') {
    state.acknowledgedVersion = obj.acknowledgedVersion;
  }

  if (typeof obj.dismissedAt === 'string') {
    state.dismissedAt = obj.dismissedAt;
  }

  return state;
}

function isRiskEducationState(value: unknown): value is RiskEducationState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (obj.acknowledgedVersion !== undefined && typeof obj.acknowledgedVersion !== 'number') {
    return false;
  }
  if (obj.dismissedAt !== undefined && typeof obj.dismissedAt !== 'string') {
    return false;
  }
  return true;
}

function migrateRiskEducationState(
  raw: unknown,
  fromVersion: number,
): RiskEducationState | undefined {
  if (fromVersion === 0) {
    return parseRiskEducationObject(raw);
  }
  return undefined;
}

/**
 * Migrate the legacy global keys once.
 *
 * The old flags conflated "dismissed" and "acknowledged" into a single boolean.
 * We cannot know which one the borrower actually did, so we migrate them as
 * dismissed (never as acknowledged) and delete the legacy keys. This is
 * conservative: at worst the banner re-appears after the snooze window.
 */
function migrateLegacyKeys(owner: string): RiskEducationState | null {
  const legacyKeys = [
    DEFAULT_RISK_ACK_KEY,
    GRANTFOX_RISK_EDUCATION_ACK_KEY,
    DEFAULT_RISK_BANNER_DISMISSED_KEY,
  ];

  let legacyPresent = false;

  for (const key of legacyKeys) {
    if (hasKey(key)) {
      legacyPresent = true;
    }
  }

  if (!legacyPresent) return null;

  const migrated: RiskEducationState = {
    dismissedAt: new Date().toISOString(),
  };

  // Persist the migrated state for this wallet, then remove the global keys.
  writeVersioned(riskEducationStorageKey(owner), migrated, {
    version: RISK_EDUCATION_STORAGE_VERSION,
  });

  for (const key of legacyKeys) {
    removeKey(key);
  }

  return migrated;
}

/**
 * Read the risk-education state for a wallet identity key.
 *
 * Returns an empty object when the wallet has no recorded state. Legacy
 * global keys are migrated once as dismissed and removed.
 */
export function getRiskEducationState(owner: string): RiskEducationState {
  if (!owner) return {};

  const key = riskEducationStorageKey(owner);
  const existing = readVersioned<RiskEducationState | null>(key, {
    version: RISK_EDUCATION_STORAGE_VERSION,
    fallback: null,
    migrate: migrateRiskEducationState,
    validate: isRiskEducationState,
  });

  if (existing) return existing;

  const migrated = migrateLegacyKeys(owner);

  return migrated ?? {};
}

/** Persist the full state for a wallet. */
export function setRiskEducationState(
  owner: string,
  state: RiskEducationState,
): void {
  if (!owner) return;

  writeVersioned(riskEducationStorageKey(owner), state, {
    version: RISK_EDUCATION_STORAGE_VERSION,
  });
}

/** Record that the borrower acknowledged a specific content version. */
export function acknowledgeRiskEducation(
  owner: string,
  version: number,
): void {
  if (!owner) return;

  const current = getRiskEducationState(owner);

  setRiskEducationState(owner, {
    ...current,
    acknowledgedVersion: version,
  });
}

/** Record a banner dismissal. Never touches acknowledgement. */
export function dismissRiskBanner(owner: string): void {
  if (!owner) return;

  const current = getRiskEducationState(owner);

  setRiskEducationState(owner, {
    ...current,
    dismissedAt: new Date().toISOString(),
  });
}

/**
 * Whether the banner should be visible for this wallet and content version.
 *
 * Shown unless the current version has been acknowledged, and not within
 * the snooze window of a prior dismissal.
 */
export function shouldShowRiskBanner(
  owner: string,
  currentVersion: number,
  now: number = Date.now(),
): boolean {
  if (!owner) return true;

  const state = getRiskEducationState(owner);

  if (state.acknowledgedVersion === currentVersion) return false;

  if (state.dismissedAt) {
    const dismissedAt = Date.parse(state.dismissedAt);

    if (
      !Number.isNaN(dismissedAt) &&
      now - dismissedAt < RISK_EDUCATION_DISMISS_SNOOZE_MS
    ) {
      return false;
    }
  }

  return true;
}

/** Whether the confirm-step nudge should be shown for this wallet. */
export function needsRiskEducationNudge(
  owner: string,
  currentVersion: number,
): boolean {
  if (!owner) return false;

  const state = getRiskEducationState(owner);

  return state.acknowledgedVersion !== currentVersion;
}
