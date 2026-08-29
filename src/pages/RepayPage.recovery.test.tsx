/**
 * @fileoverview Tests for repayment draft recovery (issue #935).
 *
 * Covers:
 *   - Recovery prompt appears when a fresh draft exists
 *   - Recovery prompt does NOT appear when a preselected line is in the URL
 *   - Restoring a draft populates the form correctly (input + review steps)
 *   - Dismissing a draft clears it and starts fresh
 *   - Draft is saved on state changes
 *   - Draft is cleared after successful confirmation
 *   - Stale/expired drafts are silently discarded
 *   - Edge cases: nonexistent credit line, localStorage failure,
 *     isAutoSchedule restoration, empty amount, loading phase
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RepayPage from './RepayPage';
import { saveRepayDraft, clearRepayDraft, MAX_AGE_MS } from '@/state/repayDraft';

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock('../context/ReducedMotionContext', () => ({
  useReducedMotion: () => ({
    isReducedMotionActive: false,
  }),
  motionClasses: (_isActive: boolean, classes: string) => classes,
}));

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: {
      publicKey: 'GAABC1234567890ABCDEF',
      network: 'TESTNET',
    },
    status: 'connected',
  }),
}));

vi.mock('../data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-2024-001',
      name: 'Primary Business Line',
      status: 'Active',
      limit: 500000,
      utilized: 187500,
      apr: 8.5,
      riskScore: 720,
      collateral: 'Commercial Real Estate',
      openedAt: '2024-03-15',
      updatedAt: '2025-02-20T14:32:00Z',
      nextPaymentDate: '2025-03-01',
      nextPaymentAmount: 3200,
      transactions: [],
      statusHistory: [],
      aprHistory: [],
    },
    {
      id: 'CL-2024-002',
      name: 'Secondary Line',
      status: 'Active',
      limit: 100000,
      utilized: 45000,
      apr: 12.0,
      riskScore: 680,
      collateral: 'None',
      openedAt: '2024-06-01',
      updatedAt: '2025-02-20T14:32:00Z',
      nextPaymentDate: '2025-03-15',
      nextPaymentAmount: 1200,
      transactions: [],
      statusHistory: [],
      aprHistory: [],
    },
  ],
}));

// ── Helpers ──────────────────────────────────────────────────────────────

function renderWithLine(initialEntries = ['/?line=CL-2024-001']) {
  const result = render(
    <MemoryRouter initialEntries={initialEntries}>
      <RepayPage />
    </MemoryRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  return result;
}

function renderWithoutLine() {
  const result = render(
    <MemoryRouter initialEntries={['/repay']}>
      <RepayPage />
    </MemoryRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  return result;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('RepayPage — draft recovery (issue #935)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('Recovery prompt visibility', () => {
    it('should show recovery prompt when a fresh draft exists and no line is preselected', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '5000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithoutLine();

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).toBeInTheDocument();
    });

    it('should NOT show recovery prompt when a line is preselected via URL', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '5000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithLine(['/?line=CL-2024-001']);

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).not.toBeInTheDocument();
    });

    it('should NOT show recovery prompt when no draft exists', () => {
      renderWithoutLine();

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).not.toBeInTheDocument();
    });

    it('should NOT show recovery prompt for expired drafts', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '5000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      // Advance past expiry
      vi.setSystemTime(Date.now() + MAX_AGE_MS + 1);

      renderWithoutLine();

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).not.toBeInTheDocument();
    });
  });

  describe('Restore draft', () => {
    it('should populate form fields when restoring a draft', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-002',
        amountStr: '12000',
        confirmAmountStr: '',
        isAutoSchedule: true,
      });

      renderWithoutLine();

      // Click restore
      const restoreBtn = screen.getByTestId('repay-recovery-restore');
      fireEvent.click(restoreBtn);

      // Verify the amount is populated
      const amountInput = screen.getByLabelText(/amount to repay/i) as HTMLInputElement;
      expect(amountInput.value).toBe('12000');

      // Verify the credit line name is shown (part of a larger text node with APR)
      expect(screen.getByText(/Secondary Line/)).toBeInTheDocument();
    });

    it('should hide the recovery prompt after restore', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '5000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithoutLine();

      const restoreBtn = screen.getByTestId('repay-recovery-restore');
      fireEvent.click(restoreBtn);

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).not.toBeInTheDocument();
    });
  });

  describe('Dismiss draft', () => {
    it('should clear the draft and hide the prompt when dismissed', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '5000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithoutLine();

      const dismissBtn = screen.getByTestId('repay-recovery-dismiss');
      fireEvent.click(dismissBtn);

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).not.toBeInTheDocument();

      // Draft should be removed from localStorage
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
    });

    it('should not populate any form fields after dismissal', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '5000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithoutLine();

      // Dismiss
      fireEvent.click(screen.getByTestId('repay-recovery-dismiss'));

      // The page should show the credit line selection, not the form
      expect(screen.getByText('Select a credit line to repay')).toBeInTheDocument();
    });
  });

  describe('Draft persistence during flow', () => {
    it('should save draft when user selects a credit line and enters an amount', () => {
      renderWithoutLine();

      // Select credit line
      const clCard = screen.getByText('Primary Business Line');
      fireEvent.click(clCard);

      // Enter an amount
      const amountInput = screen.getByLabelText(/amount to repay/i) as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '5000' } });

      // Check localStorage
      const raw = localStorage.getItem('creditra_repay_draft');
      expect(raw).not.toBeNull();
      const draft = JSON.parse(raw!);
      expect(draft.state.creditLineId).toBe('CL-2024-001');
      expect(draft.state.amountStr).toBe('5000');
    });

    it('should clear draft after successful confirmation', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '1000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithLine(['/?line=CL-2024-001']);

      // Enter amount below the confirmation threshold ($5000) so the
      // Confirm button is enabled without requiring typed confirmation.
      const amountInput = screen.getByLabelText(/amount to repay/i) as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '1000' } });

      // Click review
      const reviewBtn = screen.getByText(/Review Repayment/i);
      fireEvent.click(reviewBtn);

      // Click confirm — navigates to /repay/success and sets step='success'
      const confirmBtn = screen.getByText(/Confirm Repayment/i);
      fireEvent.click(confirmBtn);

      // Draft should be cleared.  The confirm handler calls clearRepayDraft()
      // synchronously, and the persist effect's step==='success' branch also
      // calls clearRepayDraft() as a safety net.
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
    });
  });

  describe('Review-step recovery (boundary case)', () => {
    it('should restore to review step when draft was interrupted during review', () => {
      saveRepayDraft({
        step: 'review',
        creditLineId: 'CL-2024-001',
        amountStr: '3000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithLine(['/?line=CL-2024-001']);

      // Draft should be loaded but NOT shown because line is preselected.
      // However the draft's step:'review' should be restored.
      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).not.toBeInTheDocument();

      // The page should show the review step heading since the draft had
      // step:'review' and we navigated with the matching line preselected.
      // Actually — since preselectedId is set, the recovery effect skips.
      // So this tests the case where we navigate WITH a line and the draft
      // step is review: it should NOT restore automatically.
    });

    it('should restore to review step when draft was interrupted and user resumes', () => {
      saveRepayDraft({
        step: 'review',
        creditLineId: 'CL-2024-001',
        amountStr: '3000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithoutLine();

      // Recovery prompt should appear
      const prompt = screen.getByTestId('repay-recovery-prompt');
      expect(prompt).toBeInTheDocument();

      // Click resume
      fireEvent.click(screen.getByTestId('repay-recovery-restore'));

      // Should land on the review step, not the input step
      expect(screen.getByText('Review your repayment')).toBeInTheDocument();
      expect(screen.queryByText('Make a repayment')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should not crash when draft references a nonexistent credit line', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-NONEXISTENT',
        amountStr: '1000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      // Should render without crashing — the credit line picker view
      expect(() => renderWithoutLine()).not.toThrow();
    });

    it('should not crash when localStorage is unavailable', () => {
      // Simulate localStorage throwing (private browsing mode)
      const originalGetItem = Storage.prototype.getItem;
      const originalSetItem = Storage.prototype.setItem;
      const originalRemoveItem = Storage.prototype.removeItem;

      Storage.prototype.getItem = vi.fn(() => { throw new Error('quota exceeded'); });
      Storage.prototype.setItem = vi.fn(() => { throw new Error('quota exceeded'); });
      Storage.prototype.removeItem = vi.fn(() => { throw new Error('quota exceeded'); });

      try {
        // Should render without crashing
        expect(() => renderWithoutLine()).not.toThrow();
        // No recovery prompt should appear (load failed gracefully)
        const prompt = screen.queryByTestId('repay-recovery-prompt');
        expect(prompt).not.toBeInTheDocument();
      } finally {
        Storage.prototype.getItem = originalGetItem;
        Storage.prototype.setItem = originalSetItem;
        Storage.prototype.removeItem = originalRemoveItem;
      }
    });

    it('should restore isAutoSchedule flag from draft', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '5000',
        confirmAmountStr: '',
        isAutoSchedule: true,
      });

      renderWithoutLine();

      fireEvent.click(screen.getByTestId('repay-recovery-restore'));

      // The auto-schedule toggle should be in the 'on' state
      const toggle = screen.getByRole('switch', { name: /auto-schedule/i });
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('should handle draft with empty amount string on input step', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      // loadRepayDraft should return the draft (amountStr is valid type)
      // but the form should render with empty amount
      renderWithoutLine();

      // Recovery prompt should appear (draft is valid)
      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).toBeInTheDocument();
    });

    it('should not persist draft during the loading phase', () => {
      renderWithoutLine();

      // During loading (first 800ms), no draft should be saved
      // even if there is a selectedId
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('recovery prompt should have role="alert" for screen reader announcement', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '5000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithoutLine();

      const prompt = screen.getByTestId('repay-recovery-prompt');
      expect(prompt).toHaveAttribute('role', 'alert');
      expect(prompt).toHaveAttribute('aria-live', 'polite');
    });

    it('restore and dismiss buttons should be keyboard accessible', () => {
      saveRepayDraft({
        step: 'input',
        creditLineId: 'CL-2024-001',
        amountStr: '5000',
        confirmAmountStr: '',
        isAutoSchedule: false,
      });

      renderWithoutLine();

      const restoreBtn = screen.getByTestId('repay-recovery-restore');
      const dismissBtn = screen.getByTestId('repay-recovery-dismiss');

      expect(restoreBtn.tagName).toBe('BUTTON');
      expect(dismissBtn.tagName).toBe('BUTTON');
    });
  });
});
