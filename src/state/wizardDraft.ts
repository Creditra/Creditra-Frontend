/**
 * Draw-wizard draft persistence.
 *
 * The draft is a small, versioned record of where the user was in the draw
 * flow. It deliberately stores only the credit-line **id** (never the line
 * object, balance, limit or name) and is scoped to the wallet identity that
 * created it.
 *
 * Load-time invariants:
 *   - the stored version and shape must match this module;
 *   - the draft must be no older than `MAX_AGE_MS`;
 *   - the owner must match the current wallet identity;
 *   - the step may never be `confirm` or `status`;
 *   - `amountCents` must be a non-negative integer.
 *
 * Any failure returns `null` **and removes the stored draft**, so a malformed
 * or foreign draft cannot be retried on the next load.
 *
 * Legacy drafts written before this schema (which contained a full
 * `selectedCreditLine` object and no `v` field) fail the version check and are
 * discarded on first load. The storage key is unchanged, so no separate
 * migration read is required.
 */

import { readJson, writeJson, removeKey } from "@/utils/storage";

/** Storage key shared with legacy drafts; the payload is now versioned. */
export const DRAFT_KEY = "grantfox_draw_wizard_draft";

export const DRAFT_VERSION = 1;

/** Drafts older than 30 minutes are discarded. */
export const MAX_AGE_MS = 30 * 60 * 1000;

/** Steps that may be persisted. The wizard never restores onto confirm/status. */
export type WizardDraftStep = "select" | "amount";

export interface WizardDraftInput {
  step: WizardDraftStep;
  /** Credit-line id, or `null` before a line has been selected. */
  lineId: string | null;
  /** Amount in integer cents. */
  amountCents: number;
}

export interface WizardDraftState extends WizardDraftInput {
  v: typeof DRAFT_VERSION;
  /** Wallet identity key of the draft owner, or `null` when disconnected. */
  owner: string | null;
  /** Epoch milliseconds when the draft was written. */
  savedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function discard(): null {
  removeKey(DRAFT_KEY);
  return null;
}

/**
 * Persist the current wizard position for `owner`.
 *
 * Storage failures are swallowed by the safe wrapper in `utils/storage`, so a
 * private-mode or quota failure never interrupts the draw flow.
 */
export function saveDraft(
  state: WizardDraftInput,
  owner: string | null = null,
): void {
  const draft: WizardDraftState = {
    v: DRAFT_VERSION,
    owner: owner ?? null,
    savedAt: Date.now(),
    step: state.step,
    lineId: state.lineId,
    amountCents: state.amountCents,
  };

  writeJson(DRAFT_KEY, draft);
}

/**
 * Load and validate a draft for the current wallet identity.
 *
 * Returns `null` (and clears storage) for expired, foreign, malformed or
 * legacy drafts.
 */
export function loadDraft(owner: string | null = null): WizardDraftState | null {
  const stored = readJson<unknown>(DRAFT_KEY, null);

  // No draft, or malformed JSON (readJson returns its fallback). Clearing an
  // absent key is a no-op, so discard handles both cases uniformly.
  if (stored === null) return discard();
  if (!isRecord(stored)) return discard();

  if (stored.v !== DRAFT_VERSION) return discard();

  const step = stored.step;
  if (step !== "select" && step !== "amount") return discard();

  const lineId = stored.lineId;
  if (lineId !== null && typeof lineId !== "string") return discard();

  // An amount-step draft must point at a line; otherwise there is nothing to
  // re-resolve and the draft is not actionable.
  if (step === "amount" && (typeof lineId !== "string" || lineId.length === 0)) {
    return discard();
  }

  // `saveDraft` writes epoch milliseconds, but accept an ISO-8601 string too
  // so drafts written by an earlier implementation can still expire normally
  // instead of being treated as corrupt.
  const rawSavedAt = stored.savedAt;
  let savedAt: number;
  if (typeof rawSavedAt === "number" && Number.isFinite(rawSavedAt)) {
    savedAt = rawSavedAt;
  } else if (typeof rawSavedAt === "string") {
    const parsed = Date.parse(rawSavedAt);
    if (Number.isNaN(parsed)) return discard();
    savedAt = parsed;
  } else {
    return discard();
  }

  const amountCents = stored.amountCents;
  if (
    typeof amountCents !== "number" ||
    !Number.isInteger(amountCents) ||
    amountCents < 0
  ) {
    return discard();
  }

  const storedOwner = stored.owner;
  if (storedOwner !== null && typeof storedOwner !== "string") {
    return discard();
  }

  // Wallet scoping: a draft created by another identity (or anonymously)
  // must never be restored into this wallet's flow.
  if (storedOwner !== (owner ?? null)) return discard();

  // Staleness is measured from the write time, not a value supplied by the
  // caller, so a tampered `savedAt` cannot keep a draft alive indefinitely
  // beyond the clock-skew tolerance of a future timestamp.
  if (Date.now() - savedAt > MAX_AGE_MS) return discard();

  return {
    v: DRAFT_VERSION,
    owner: storedOwner,
    savedAt,
    step,
    lineId,
    amountCents,
  };
}

/** Remove the persisted draft. Safe to call when nothing is stored. */
export function clearDraft(): void {
  removeKey(DRAFT_KEY);
}
