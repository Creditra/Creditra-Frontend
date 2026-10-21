/**
 * @fileoverview Tests for src/state/repayDraft.ts
 *
 * Covers: save, load, clear, staleness expiry, shape validation, and
 * the hasFreshRepayDraft helper.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveRepayDraft,
  loadRepayDraft,
  clearRepayDraft,
  hasFreshRepayDraft,
  MAX_AGE_MS,
  type RepayDraftState,
} from './repayDraft';

const STORAGE_KEY = 'creditra_repay_draft';

const OWNER = 'stellar:GAOWNER:TESTNET';

function makeDraft(overrides: Partial<Omit<RepayDraftState, 'savedAt'>> = {}) {
  return {
    step: 'input' as const,
    creditLineId: 'CL-2024-001',
    amountStr: '500.00',
    confirmAmountStr: '',
    isAutoSchedule: false,
    owner: OWNER,
    transactionId: undefined,
    ...overrides,
  };
}

/** Overwrite the stored draft's state directly (simulates tampering / legacy data). */
function seedRawState(state: Record<string, unknown>) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state, timestamp: Date.now() }),
  );
}

describe('repayDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  // ── saveRepayDraft ────────────────────────────────────────────────────

  describe('saveRepayDraft', () => {
    it('should persist a valid draft to localStorage', () => {
      saveRepayDraft(makeDraft());

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      expect(parsed.state.creditLineId).toBe('CL-2024-001');
      expect(parsed.state.amountStr).toBe('500.00');
      expect(parsed.state.savedAt).toBe('2025-06-15T12:00:00.000Z');
      expect(parsed.timestamp).toBe(Date.now());
    });

    it('should overwrite an existing draft', () => {
      saveRepayDraft(makeDraft({ amountStr: '100' }));
      saveRepayDraft(makeDraft({ amountStr: '200' }));

      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(parsed.state.amountStr).toBe('200');
    });
  });

  // ── loadRepayDraft ────────────────────────────────────────────────────

  describe('loadRepayDraft', () => {
    it('should return null when no draft exists', () => {
      expect(loadRepayDraft()).toBeNull();
    });

    it('should load a fresh draft', () => {
      saveRepayDraft(makeDraft());

      const loaded = loadRepayDraft();
      expect(loaded).not.toBeNull();
      expect(loaded!.step).toBe('input');
      expect(loaded!.creditLineId).toBe('CL-2024-001');
      expect(loaded!.amountStr).toBe('500.00');
    });

    it('should return null for a draft older than MAX_AGE_MS', () => {
      saveRepayDraft(makeDraft());

      // Advance time past the expiry
      vi.setSystemTime(Date.now() + MAX_AGE_MS + 1);

      const loaded = loadRepayDraft();
      expect(loaded).toBeNull();
      // Stale draft should be cleaned up
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should return null for malformed data', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ garbage: true }));

      const loaded = loadRepayDraft();
      expect(loaded).toBeNull();
    });

    it('should return null when state object is missing required fields', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          state: { step: 'input' }, // missing creditLineId, amountStr, savedAt
          timestamp: Date.now(),
        }),
      );

      const loaded = loadRepayDraft();
      expect(loaded).toBeNull();
    });

    it('should load a draft with review step', () => {
      saveRepayDraft(
        makeDraft({
          step: 'review',
          confirmAmountStr: '500.00',
        }),
      );

      const loaded = loadRepayDraft();
      expect(loaded!.step).toBe('review');
      expect(loaded!.confirmAmountStr).toBe('500.00');
    });

    it('should preserve transactionId if set', () => {
      saveRepayDraft(
        makeDraft({ transactionId: 'TXN-1234567890' }),
      );

      const loaded = loadRepayDraft();
      expect(loaded!.transactionId).toBe('TXN-1234567890');
    });

    it('should preserve isAutoSchedule flag', () => {
      saveRepayDraft(makeDraft({ isAutoSchedule: true }));

      const loaded = loadRepayDraft();
      expect(loaded!.isAutoSchedule).toBe(true);
    });
  });

  // ── clearRepayDraft ───────────────────────────────────────────────────

  describe('clearRepayDraft', () => {
    it('should remove the draft from localStorage', () => {
      saveRepayDraft(makeDraft());
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      clearRepayDraft();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should be safe to call when no draft exists', () => {
      expect(() => clearRepayDraft()).not.toThrow();
    });
  });

  // ── hasFreshRepayDraft ────────────────────────────────────────────────

  describe('hasFreshRepayDraft', () => {
    it('should return false when no draft exists', () => {
      expect(hasFreshRepayDraft()).toBe(false);
    });

    it('should return true for a fresh draft', () => {
      saveRepayDraft(makeDraft());
      expect(hasFreshRepayDraft()).toBe(true);
    });

    it('should return false for an expired draft', () => {
      saveRepayDraft(makeDraft());
      vi.setSystemTime(Date.now() + MAX_AGE_MS + 1);
      expect(hasFreshRepayDraft()).toBe(false);
    });
  });

  // ── Hardening: owner scoping (issue #1188) ─────────────────────────────

  describe('owner scoping (issue #1188)', () => {
    it('should persist and round-trip the owner field', () => {
      saveRepayDraft(makeDraft({ owner: 'stellar:GOTHER:TESTNET' }));

      const loaded = loadRepayDraft();
      expect(loaded!.owner).toBe('stellar:GOTHER:TESTNET');
    });

    it('should discard a draft with no owner field (legacy drafts)', () => {
      const { owner: _omitted, ...withoutOwner } = makeDraft();
      seedRawState({ ...withoutOwner, savedAt: new Date().toISOString() });

      expect(loadRepayDraft()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should discard a draft with an empty owner', () => {
      saveRepayDraft(makeDraft({ owner: '' }));

      // saveRepayDraft persists it, but load must refuse it.
      expect(loadRepayDraft()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  // ── Hardening: strict step / amountStr validation (issue #1188) ────────

  describe('strict step and amountStr validation (issue #1188)', () => {
    const validState = () => ({
      ...makeDraft(),
      savedAt: new Date().toISOString(),
    });

    it.each(['success', 'confirm', 'Input', ''])(
      'should discard a draft with step %j',
      (step) => {
        seedRawState({ ...validState(), step });
        expect(loadRepayDraft()).toBeNull();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      },
    );

    it.each(['1e3', '0x10', '-5', '5000.123', '', ' 5000', '5000.', '1,000'])(
      'should discard a draft with amountStr %j',
      (amountStr) => {
        seedRawState({ ...validState(), amountStr });
        expect(loadRepayDraft()).toBeNull();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      },
    );

    it.each(['5000', '5000.5', '5000.50', '0'])(
      'should accept amountStr %j',
      (amountStr) => {
        seedRawState({ ...validState(), amountStr });
        expect(loadRepayDraft()).not.toBeNull();
      },
    );

    it('should still accept both review and input steps', () => {
      seedRawState({ ...validState(), step: 'review' });
      expect(loadRepayDraft()!.step).toBe('review');
      seedRawState({ ...validState(), step: 'input' });
      expect(loadRepayDraft()!.step).toBe('input');
    });
  });
});
