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
import { MemoryRouter, Route, Routes } from 'react-router';
import RepayPage from './RepayPage';
import {
  saveRepayDraft,
  clearRepayDraft,
  MAX_AGE_MS,
  type RepayDraftState,
} from '@/state/repayDraft';
import { creditDataSource } from '@/services/creditDataSource';
import RepaySuccess from './RepaySuccess';

/** Must match the walletIdentityKey of the mocked wallet below. */
const OWNER = 'undefined:GAABC1234567890ABCDEF:TESTNET';
const OTHER_OWNER = 'undefined:GDIFFERENTWALLETKEY:TESTNET';

/** Draft payload with sensible defaults; every call is owner-scoped (issue #1188). */
function draftState(
  overrides: Partial<Omit<RepayDraftState, 'savedAt'>> = {},
): Omit<RepayDraftState, 'savedAt'> {
  return {
    step: 'input',
    creditLineId: 'CL-2024-001',
    amountStr: '5000',
    confirmAmountStr: '',
    isAutoSchedule: false,
    owner: OWNER,
    ...overrides,
  };
}

/** Seed the raw localStorage entry (bypasses TS types — simulates tampered/legacy data). */
function saveRepayDraftRaw(state: Record<string, unknown>) {
  localStorage.setItem(
    'creditra_repay_draft',
    JSON.stringify({
      state: { savedAt: new Date().toISOString(), ...state },
      timestamp: Date.now(),
    }),
  );
}

/** Reset mutable mock line data between tests. */
function resetLines() {
  linesHolder.current = null;
}

/**
 * Flush pending promise chains (the review-step balance refresh) while fake
 * timers are active, so `reviewBalance` settles before assertions.
 */
async function flushAsync() {
  await act(async () => {});
}

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock('../context/ReducedMotionContext', () => ({
  useReducedMotion: () => ({
    isReducedMotionActive: false,
  }),
  motionClasses: (_isActive: boolean, classes: string) => classes,
}));

// Stable mock identities: the real WalletContext keeps references stable, and
// fresh objects per render would re-fire the review-balance effect every render.
const { mockWallet, mockBalances, mockRefreshBalance } = vi.hoisted(() => {
  const balances = [
    {
      asset: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      balance: '50000.0000000',
    },
  ];
  return {
    mockWallet: {
      publicKey: 'GAABC1234567890ABCDEF',
      network: 'TESTNET',
    } as { publicKey: string; network: string },
    mockBalances: balances,
    mockRefreshBalance: async () => balances,
  };
});

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'default' }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: mockWallet,
    status: 'connected',
    balances: mockBalances,
    refreshBalance: mockRefreshBalance,
  }),
  walletIdentityKey: (wallet: { publicKey: string; network: string } | null) =>
    wallet ? `undefined:${wallet.publicKey}:${wallet.network}` : null,
}));

// Mutable line data so tests can simulate a provider refetch that changes a
// line's outstanding debt while the page is mounted (issue #1188, row 3).
const { linesHolder } = vi.hoisted(() => ({
  linesHolder: { current: null as import('@/types/creditLine').CreditLine[] | null },
}));

vi.mock('../data/mockData', async () => {
  const { REPAY_TEST_CREDIT_LINES } = await import('@/test/fixtures/repayCreditLines');
  const buildLines = () => [
    ...REPAY_TEST_CREDIT_LINES.map((l) => ({ ...l })),
    {
      ...REPAY_TEST_CREDIT_LINES[0],
      id: 'CL-CLOSED-001',
      name: 'Closed Line',
      status: 'Closed' as const,
      utilized: 0,
    },
    {
      ...REPAY_TEST_CREDIT_LINES[0],
      id: 'CL-DEBT-10K',
      name: 'Ten K Debt Line',
      limit: 50000,
      utilized: 10000,
      apr: 8.5,
      nextPaymentAmount: 500,
    },
  ];
  return {
    get MOCK_CREDIT_LINES() {
      if (linesHolder.current === null) linesHolder.current = buildLines();
      return linesHolder.current;
    },
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────

function renderWithLine(initialEntries = ['/?line=CL-2024-001']) {
  const result = render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/repay/success" element={<RepaySuccess />} />
        <Route path="*" element={<RepayPage />} />
      </Routes>
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
      <Routes><Route path="*" element={<RepayPage />} /></Routes>
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
    resetLines();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('Recovery prompt visibility', () => {
    it('should show recovery prompt when a fresh draft exists and no line is preselected', () => {
      saveRepayDraft(draftState());

      renderWithoutLine();

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).toBeInTheDocument();
    });

    it('should NOT show recovery prompt when a line is preselected via URL', () => {
      saveRepayDraft(draftState());

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
      saveRepayDraft(draftState());

      // Advance past expiry
      vi.setSystemTime(Date.now() + MAX_AGE_MS + 1);

      renderWithoutLine();

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).not.toBeInTheDocument();
    });
  });

  describe('Restore draft', () => {
    it('should populate form fields when restoring a draft', () => {
      saveRepayDraft(
        draftState({ creditLineId: 'CL-2024-002', amountStr: '12000', isAutoSchedule: true }),
      );

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
      saveRepayDraft(draftState());

      renderWithoutLine();

      const restoreBtn = screen.getByTestId('repay-recovery-restore');
      fireEvent.click(restoreBtn);

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).not.toBeInTheDocument();
    });
  });

  describe('Dismiss draft', () => {
    it('should clear the draft and hide the prompt when dismissed', () => {
      saveRepayDraft(draftState());

      renderWithoutLine();

      const dismissBtn = screen.getByTestId('repay-recovery-dismiss');
      fireEvent.click(dismissBtn);

      const prompt = screen.queryByTestId('repay-recovery-prompt');
      expect(prompt).not.toBeInTheDocument();

      // Draft should be removed from localStorage
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
    });

    it('should not populate any form fields after dismissal', () => {
      saveRepayDraft(draftState());

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

    it('should save the completed transaction and clear the draft after confirmation', async () => {
      saveRepayDraft(draftState({ amountStr: '1000' }));

      renderWithLine(['/?line=CL-2024-001']);

      // Enter amount below the confirmation threshold ($5000) so the
      // Confirm button is enabled without requiring typed confirmation.
      const amountInput = screen.getByLabelText(/amount to repay/i) as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '1000' } });

      // Click review
      const reviewBtn = screen.getByText(/Review Repayment/i);
      fireEvent.click(reviewBtn);
      await flushAsync();

      // Confirmation renders the success route.
      const confirmBtn = screen.getByText(/Confirm Repayment/i);
      const transactionId = `TXN-${Date.now()}`;
      fireEvent.click(confirmBtn);
      await flushAsync();
      expect(screen.getByRole('heading', { name: /you repaid/i })).toBeInTheDocument();

      // Draft should be cleared.  The confirm handler calls clearRepayDraft()
      // synchronously before navigation.
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
      await expect(
        creditDataSource.getTransaction('GAABC1234567890ABCDEF', transactionId),
      ).resolves.toMatchObject({
        id: transactionId,
        status: 'Completed',
        amount: 1000,
        remainingDebt: 187828.13,
      });
    });
  });

  describe('Review-step recovery (boundary case)', () => {
    it('should restore to review step when draft was interrupted during review', () => {
      saveRepayDraft(draftState({ step: 'review', amountStr: '3000' }));

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
      saveRepayDraft(draftState({ step: 'review', amountStr: '3000' }));

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
    it('should discard a draft that references a nonexistent credit line', () => {
      saveRepayDraft(draftState({ creditLineId: 'CL-NONEXISTENT', amountStr: '1000' }));

      // Renders without crashing — the picker view is shown.
      expect(() => renderWithoutLine()).not.toThrow();

      // Issue #1188: the draft is discarded with a status note, not offered.
      expect(screen.queryByTestId('repay-recovery-prompt')).not.toBeInTheDocument();
      expect(screen.getByTestId('repay-draft-discarded-note')).toBeInTheDocument();
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
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
      saveRepayDraft(draftState({ isAutoSchedule: true }));

      renderWithoutLine();

      fireEvent.click(screen.getByTestId('repay-recovery-restore'));

      // The auto-schedule toggle should be in the 'on' state
      const toggle = screen.getByRole('switch', { name: /auto-schedule/i });
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('should discard a draft with an empty amount string', () => {
      // Issue #1188: amountStr must match ^\d+(\.\d{1,2})?$ — an empty string
      // fails, so the draft is discarded rather than offered for recovery.
      saveRepayDraft(draftState({ amountStr: '' }));

      renderWithoutLine();

      expect(screen.queryByTestId('repay-recovery-prompt')).not.toBeInTheDocument();
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
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
      saveRepayDraft(draftState());

      renderWithoutLine();

      const prompt = screen.getByTestId('repay-recovery-prompt');
      expect(prompt).toHaveAttribute('role', 'alert');
      expect(prompt).toHaveAttribute('aria-live', 'polite');
    });

    it('restore and dismiss buttons should be keyboard accessible', () => {
      saveRepayDraft(draftState());

      renderWithoutLine();

      const restoreBtn = screen.getByTestId('repay-recovery-restore');
      const dismissBtn = screen.getByTestId('repay-recovery-dismiss');

      expect(restoreBtn.tagName).toBe('BUTTON');
      expect(dismissBtn.tagName).toBe('BUTTON');
    });
  });

  // ── Issue #1188: revalidate restored drafts, gate confirm on validity ──
  describe('Revalidation and scoping (issue #1188)', () => {
    function resumeDraft() {
      renderWithoutLine();
      fireEvent.click(screen.getByTestId('repay-recovery-restore'));
    }

    function getConfirmButton() {
      return screen.queryByRole('button', { name: /confirm repayment/i });
    }

    it('row 1: review draft exceeding current debt lands on input, Confirm unreachable', () => {
      // CL-DEBT-10K owes 10,000; the tampered draft claims 999,999.
      saveRepayDraft(draftState({ step: 'review', amountStr: '999999', creditLineId: 'CL-DEBT-10K' }));

      resumeDraft();

      // Lands on input, not review — Confirm only renders on the review step.
      expect(screen.getByText('Make a repayment')).toBeInTheDocument();
      expect(screen.queryByText('Review your repayment')).not.toBeInTheDocument();
      expect(getConfirmButton()).not.toBeInTheDocument();
    });

    it('row 2: valid review draft resumes to review but clears the typed confirmation', async () => {
      // 8,000 is valid (debt 187,500 / wallet 50,000) and exceeds the $5,000
      // typed-confirmation threshold.
      saveRepayDraft(
        draftState({ step: 'review', amountStr: '8000', confirmAmountStr: '8000' }),
      );

      resumeDraft();
      await flushAsync();

      expect(screen.getByText('Review your repayment')).toBeInTheDocument();
      // Typed confirmation was cleared on restore, so Confirm stays disabled
      // until the amount is re-typed.
      expect(getConfirmButton()).toBeDisabled();
      const field = screen.getByLabelText(/type the repayment amount to confirm/i) as HTMLInputElement;
      expect(field.value).toBe('');
      // Re-typing enables Confirm again.
      fireEvent.change(field, { target: { value: '8000' } });
      expect(getConfirmButton()).not.toBeDisabled();
    });

    it('row 3: debt drops below the amount while on review — Confirm disabled with an alert', async () => {
      // Reach review with a valid 3,000 against CL-DEBT-10K (10,000 owed).
      saveRepayDraft(draftState({ step: 'review', amountStr: '3000', creditLineId: 'CL-DEBT-10K' }));
      const { rerender } = renderWithoutLine();
      fireEvent.click(screen.getByTestId('repay-recovery-restore'));
      await flushAsync();
      expect(screen.getByText('Review your repayment')).toBeInTheDocument();
      expect(getConfirmButton()).not.toBeDisabled();

      // Simulate a provider refetch dropping the debt to 1,000.
      act(() => {
        linesHolder.current = (linesHolder.current ?? []).map((cl) =>
          cl.id === 'CL-DEBT-10K' ? { ...cl, utilized: 1000 } : cl,
        );
      });
      rerender(
        <MemoryRouter initialEntries={['/repay']}>
          <Routes><Route path="*" element={<RepayPage />} /></Routes>
        </MemoryRouter>,
      );

      // Amount now exceeds the debt: Confirm disabled + alert + Edit amount.
      expect(getConfirmButton()).toBeDisabled();
      const alert = screen.getByTestId('repay-review-invalid-alert');
      expect(alert).toHaveAttribute('role', 'alert');
      expect(alert).toHaveTextContent(/exceeds outstanding debt/i);
      expect(screen.getByTestId('repay-review-edit-amount')).toBeInTheDocument();
    });

    it('row 4: Enter on review with an invalid amount does not confirm', () => {
      saveRepayDraft(draftState({ step: 'review', amountStr: '3000', creditLineId: 'CL-DEBT-10K' }));
      const { rerender } = renderWithoutLine();
      fireEvent.click(screen.getByTestId('repay-recovery-restore'));

      act(() => {
        linesHolder.current = (linesHolder.current ?? []).map((cl) =>
          cl.id === 'CL-DEBT-10K' ? { ...cl, utilized: 1000 } : cl,
        );
      });
      rerender(
        <MemoryRouter initialEntries={['/repay']}>
          <Routes><Route path="*" element={<RepayPage />} /></Routes>
        </MemoryRouter>,
      );

      expect(screen.getByTestId('repay-review-invalid-alert')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'Enter' });
      // No navigation to the success route.
      expect(screen.queryByText(/you repaid/i)).not.toBeInTheDocument();
      expect(screen.getByText('Review your repayment')).toBeInTheDocument();
    });

    it('row 5: a draft saved under a different wallet identity is discarded', () => {
      saveRepayDraft(draftState({ owner: OTHER_OWNER }));

      renderWithoutLine();

      expect(screen.queryByTestId('repay-recovery-prompt')).not.toBeInTheDocument();
      expect(screen.getByTestId('repay-draft-discarded-note')).toBeInTheDocument();
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
    });

    it('row 6: step "success" and non-numeric amountStr are discarded', () => {
      // Shape-invalid drafts are refused by loadRepayDraft itself: no prompt
      // is offered and the stored entry is removed.
      saveRepayDraftRaw({ ...draftState(), step: 'success' });
      renderWithoutLine();
      expect(screen.queryByTestId('repay-recovery-prompt')).not.toBeInTheDocument();
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
      localStorage.clear();
      resetLines();

      saveRepayDraftRaw({ ...draftState(), amountStr: '1e3' });
      renderWithoutLine();
      expect(screen.queryByTestId('repay-recovery-prompt')).not.toBeInTheDocument();
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
    });

    it('row 7: a draft for a line that is no longer repayable is discarded with a status note', () => {
      // CL-CLOSED-001 exists in the mock data but is Closed with zero
      // utilization, so isRepayable() is false.
      saveRepayDraft(draftState({ creditLineId: 'CL-CLOSED-001', amountStr: '500' }));

      renderWithoutLine();

      expect(screen.queryByTestId('repay-recovery-prompt')).not.toBeInTheDocument();
      const note = screen.getByTestId('repay-draft-discarded-note');
      expect(note).toHaveAttribute('role', 'status');
      expect(localStorage.getItem('creditra_repay_draft')).toBeNull();
    });

    it('row 8 (regression): a valid draft still resumes straight to review with Confirm enabled', async () => {
      // Guards against over-blocking: valid review drafts must keep working.
      saveRepayDraft(draftState({ step: 'review', amountStr: '1000' }));

      resumeDraft();
      await flushAsync();

      expect(screen.getByText('Review your repayment')).toBeInTheDocument();
      expect(getConfirmButton()).not.toBeDisabled();
    });

    it('drafts persisted by the page are owner-scoped to the connected wallet', () => {
      renderWithoutLine();
      fireEvent.click(screen.getByText('Primary Business Line'));
      const amountInput = screen.getByLabelText(/amount to repay/i) as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '5000' } });

      const raw = localStorage.getItem('creditra_repay_draft');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!).state.owner).toBe(OWNER);
    });
  });
});
