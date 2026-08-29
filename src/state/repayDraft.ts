/**
 * repayDraft — localStorage persistence for interrupted repayment flows.
 *
 * When a user starts a repayment (selects a credit line, enters an amount,
 * progresses to the review step) and then navigates away, closes the tab,
 * or loses connectivity, the flow state is preserved here so it can be
 * restored on return.
 *
 * Design invariants:
 *   - Drafts older than `MAX_AGE_MS` (30 minutes) are treated as stale
 *     and silently discarded on load.
 *   - A `transactionId` field is persisted so the same confirmation
 *     cannot be submitted twice (idempotency guard).
 *   - `clearDraft()` must be called on successful completion or explicit
 *     cancel to avoid stale recovery prompts.
 *   - All localStorage access is wrapped in try/catch to handle private
 *     browsing, quota errors, and SSR environments.
 */

import { readJson, writeJson, removeKey } from '@/utils/storage';

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'creditra_repay_draft';

/** Drafts older than this are considered stale (30 minutes). */
export const MAX_AGE_MS = 30 * 60 * 1000;

// ── Types ───────────────────────────────────────────────────────────────────

export type RepayDraftStep = 'input' | 'review';

export interface RepayDraftState {
  /** Which step of the repayment flow the user was on when interrupted. */
  step: RepayDraftStep;
  /** ID of the selected credit line. */
  creditLineId: string;
  /** The repayment amount as a string (preserves user input exactly). */
  amountStr: string;
  /** The typed confirmation amount (for large repayments that require it). */
  confirmAmountStr: string;
  /** Whether auto-schedule was toggled on. */
  isAutoSchedule: boolean;
  /** ISO timestamp of when the draft was last saved. */
  savedAt: string;
  /** Optional transaction ID for idempotency (set at confirm time). */
  transactionId?: string;
}

interface StoredRepayDraft {
  state: RepayDraftState;
  /** Epoch ms when the draft was saved — used for staleness check. */
  timestamp: number;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Persist the current repayment flow state.
 *
 * Silently no-ops if localStorage is unavailable or full.
 */
export function saveRepayDraft(state: Omit<RepayDraftState, 'savedAt'>): void {
  const draft: StoredRepayDraft = {
    state: {
      ...state,
      savedAt: new Date().toISOString(),
    },
    timestamp: Date.now(),
  };
  writeJson(STORAGE_KEY, draft);
}

/**
 * Load a previously saved repayment draft.
 *
 * Returns `null` when:
 *   - No draft exists
 *   - The draft is older than `MAX_AGE_MS`
 *   - The stored data is malformed
 *   - localStorage is unavailable
 */
export function loadRepayDraft(): RepayDraftState | null {
  const stored = readJson<StoredRepayDraft | null>(STORAGE_KEY, null);
  if (!stored) return null;

  // Staleness check
  if (Date.now() - stored.timestamp > MAX_AGE_MS) {
    clearRepayDraft();
    return null;
  }

  // Shape validation
  const s = stored.state;
  if (
    !s ||
    typeof s !== 'object' ||
    typeof s.step !== 'string' ||
    typeof s.creditLineId !== 'string' ||
    typeof s.amountStr !== 'string' ||
    typeof s.savedAt !== 'string'
  ) {
    clearRepayDraft();
    return null;
  }

  return s;
}

/**
 * Remove the persisted repayment draft.
 *
 * Must be called after:
 *   - Successful repayment completion
 *   - Explicit user cancellation
 *   - Stale draft detection
 */
export function clearRepayDraft(): void {
  removeKey(STORAGE_KEY);
}

/**
 * Check whether a draft exists and is still fresh (not expired).
 *
 * Useful for showing/hiding the recovery prompt without fully loading
 * the draft.
 */
export function hasFreshRepayDraft(): boolean {
  const stored = readJson<StoredRepayDraft | null>(STORAGE_KEY, null);
  if (!stored) return false;
  return Date.now() - stored.timestamp <= MAX_AGE_MS;
}
