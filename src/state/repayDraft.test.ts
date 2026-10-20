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
} from './repayDraft';

const STORAGE_KEY = 'creditra_repay_draft';

function makeDraft(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    step: 'input' as const,
    creditLineId: 'CL-2024-001',
    amountStr: '500.00',
    confirmAmountStr: '',
    isAutoSchedule: false,
    transactionId: undefined,
    ...overrides,
  };
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
});
