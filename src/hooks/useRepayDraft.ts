import { useCallback, useEffect, useRef, useState } from 'react';
import { useDraftSaveStatus, type UseDraftSaveStatusResult } from '@/hooks/useDraftSaveStatus';
import { getAccruedInterest } from '@/lib/interest';
import { isRepayable } from '@/lib/repay-eligibility';
import type { CreditLine } from '@/types/creditLine';
import {
  clearRepayDraft,
  loadRepayDraft,
  saveRepayDraft,
  type RepayDraftState,
} from '@/state/repayDraft';
import {
  DRAFT_DISCARD_MESSAGE,
  type DraftDiscardReason,
} from '@/components/repay/DraftRecoveryPrompt';
import { formatMoney, getRepayAmountValidation } from '@/utils/amountValidation';
import { roundToCents } from '@/utils/currency';

export type RepayDraftStep = 'input' | 'review';

/** Values the flow must apply when the user resumes a saved draft. */
export interface RestoredDraft {
  creditLineId: string;
  amountStr: string;
  isAutoSchedule: boolean;
  /** Whether the draft can safely return to the review step. */
  toReview: boolean;
}

interface UseRepayDraftOptions {
  preselectedId: string | null;
  allLines: CreditLine[];
  creditStatus: 'idle' | 'loading' | 'success' | 'error';
  /** Wallet-scoped identity the draft is bound to. */
  identityKey: string | null;
  walletBalance: number;
  step: RepayDraftStep;
  selectedId: string;
  amountStr: string;
  confirmAmountStr: string;
  isAutoSchedule: boolean;
  announce: (message: string) => void;
  applyRestoredDraft: (draft: RestoredDraft) => void;
}

export interface RepayDraftControls {
  draftSave: UseDraftSaveStatusResult;
  recoveredDraft: RepayDraftState | null;
  showRecoveryPrompt: boolean;
  discardReason: DraftDiscardReason | null;
  restoreDraft: () => void;
  dismissDraft: () => void;
  /** Clears the persisted draft and stops further saves (submit / cancel). */
  discardPersistedDraft: () => void;
}

/**
 * localStorage draft persistence and recovery for the repayment flow.
 *
 * Drafts are owner-scoped (issue #1188): a draft saved under one wallet is
 * discarded when a different wallet loads the page, and a draft is only
 * restored to the review step when its amount is still valid against current
 * debt and wallet balance.
 */
export function useRepayDraft({
  preselectedId,
  allLines,
  creditStatus,
  identityKey,
  walletBalance,
  step,
  selectedId,
  amountStr,
  confirmAmountStr,
  isAutoSchedule,
  announce,
  applyRestoredDraft,
}: UseRepayDraftOptions): RepayDraftControls {
  const draftSave = useDraftSaveStatus();
  const [recoveredDraft, setRecoveredDraft] = useState<RepayDraftState | null>(null);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [discardReason, setDiscardReason] = useState<DraftDiscardReason | null>(null);
  const draftLoadedRef = useRef(false);
  // Prevent the persist effect from re-saving a draft after confirmation.
  const draftClearedRef = useRef(false);
  // Tracks the previous wallet identity so a mid-session account/network
  // switch can clear another wallet's draft (issue #1188).
  const prevIdentityKeyRef = useRef<string | null>(null);

  const restoreDraft = useCallback(() => {
    if (!recoveredDraft) return;

    // Re-validate the draft against *current* data before trusting its saved
    // step: the stored amount may exceed the debt (or the wallet) now, the
    // line may have been closed, or the draft may belong to a different
    // wallet. Only a still-valid review draft returns to review.
    const draftLine = allLines.find((cl) => cl.id === recoveredDraft.creditLineId) ?? null;
    const ownerOk = identityKey !== null && recoveredDraft.owner === identityKey;
    const isAmountStillValid =
      draftLine !== null &&
      isRepayable(draftLine) &&
      getRepayAmountValidation(
        recoveredDraft.amountStr,
        roundToCents(draftLine.utilized + getAccruedInterest(draftLine, new Date())),
        walletBalance,
      ).isValid;
    const toReview = recoveredDraft.step === 'review' && ownerOk && isAmountStillValid;

    applyRestoredDraft({
      creditLineId: recoveredDraft.creditLineId,
      amountStr: recoveredDraft.amountStr,
      isAutoSchedule: recoveredDraft.isAutoSchedule,
      toReview,
    });
    setShowRecoveryPrompt(false);
    setRecoveredDraft(null);
    setDiscardReason(null);
    announce(
      toReview
        ? `Restored repayment draft: ${formatMoney(parseFloat(recoveredDraft.amountStr) || 0)} on ${recoveredDraft.creditLineId}.`
        : `Restored repayment draft on ${recoveredDraft.creditLineId}. Review the amount before continuing.`,
    );
  }, [recoveredDraft, allLines, identityKey, walletBalance, applyRestoredDraft, announce]);

  const dismissDraft = useCallback(() => {
    clearRepayDraft();
    draftSave.reset();
    setShowRecoveryPrompt(false);
    setRecoveredDraft(null);
    announce('Previous repayment draft discarded.');
  }, [draftSave.reset, announce]);

  const discardPersistedDraft = useCallback(() => {
    draftClearedRef.current = true;
    clearRepayDraft();
    draftSave.reset();
  }, [draftSave.reset]);

  // ── Initial draft recovery check ──────────────────────────────────────
  useEffect(() => {
    if (creditStatus !== 'success') return;
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;

    const draft = loadRepayDraft();
    // Only offer recovery when the user hasn't navigated with a specific
    // credit line preselected (which implies a fresh intent).
    if (!draft || preselectedId) return;

    const draftLine = allLines.find((cl) => cl.id === draft.creditLineId) ?? null;
    if (!draftLine || !isRepayable(draftLine)) {
      clearRepayDraft();
      setDiscardReason('line-unrepayable');
      announce(DRAFT_DISCARD_MESSAGE['line-unrepayable']);
      return;
    }
    // When the wallet identity is already known, a draft from another wallet
    // is discarded here. When it isn't (wallet still connecting), the owner
    // check in restoreDraft still refuses to trust the stored step.
    if (identityKey !== null && draft.owner !== identityKey) {
      clearRepayDraft();
      setDiscardReason('owner-mismatch');
      announce(DRAFT_DISCARD_MESSAGE['owner-mismatch']);
      return;
    }

    setRecoveredDraft(draft);
    setShowRecoveryPrompt(true);
  }, [preselectedId, identityKey, creditStatus, allLines, announce]);

  // ── Clear the draft when the wallet identity changes ──────────────────
  useEffect(() => {
    const prevIdentity = prevIdentityKeyRef.current;
    prevIdentityKeyRef.current = identityKey;
    if (identityKey === null || identityKey === prevIdentity) return;

    const draft = loadRepayDraft();
    if (draft && draft.owner !== identityKey) {
      clearRepayDraft();
      draftSave.reset();
      setShowRecoveryPrompt(false);
      setRecoveredDraft(null);
      setDiscardReason('owner-mismatch');
      announce(DRAFT_DISCARD_MESSAGE['owner-mismatch']);
    }
  }, [identityKey, draftSave.reset, announce]);

  // ── Persist draft on state changes ────────────────────────────────────
  useEffect(() => {
    // Don't persist if the draft was just intentionally cleared on confirmation.
    if (draftClearedRef.current) return;
    // Don't save during loading or after cancel.
    if (creditStatus !== 'success' || !selectedId) return;
    // Don't save without a known wallet identity (the draft is owner-scoped).
    if (!identityKey) return;
    // Don't save empty amounts on the input step.
    if (step === 'input' && !amountStr) return;

    const ok = saveRepayDraft({
      step,
      creditLineId: selectedId,
      amountStr,
      confirmAmountStr,
      isAutoSchedule,
      owner: identityKey,
    });
    if (ok) {
      draftSave.markSaved();
    } else {
      draftSave.markError();
    }
  }, [
    step,
    selectedId,
    amountStr,
    confirmAmountStr,
    isAutoSchedule,
    creditStatus,
    identityKey,
    draftSave.markSaved,
    draftSave.markError,
  ]);

  return {
    draftSave,
    recoveredDraft,
    showRecoveryPrompt,
    discardReason,
    restoreDraft,
    dismissDraft,
    discardPersistedDraft,
  };
}
