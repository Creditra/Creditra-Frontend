import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useRepayFlow } from '../useRepayFlow';
import { clearRepayDraft, loadRepayDraft, saveRepayDraft } from '@/state/repayDraft';
import { REPAY_TEST_CREDIT_LINES } from '@/test/fixtures/repayCreditLines';

const { balances, wallet, refreshBalance } = vi.hoisted(() => {
  const balances = [
    {
      asset: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      balance: '50000.0000000',
    },
  ];
  return {
    balances,
    wallet: { publicKey: 'GAABC1234567890ABCDEF', network: 'TESTNET' },
    refreshBalance: async () => balances,
  };
});

vi.mock('@/context/WalletContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/WalletContext')>();
  return {
    ...actual,
    useWallet: () => ({
      wallet,
      status: 'connected',
      balances,
      refreshBalance,
    }),
    walletIdentityKey: (wallet: { publicKey: string; network: string } | null) =>
      wallet ? `undefined:${wallet.publicKey}:${wallet.network}` : null,
  };
});

vi.mock('@/hooks/useCreditLines', async () => {
  const { REPAY_TEST_CREDIT_LINES } = await import('@/test/fixtures/repayCreditLines');
  const line = REPAY_TEST_CREDIT_LINES[0];
  const closedLine = { ...line, id: 'CL-CLOSED', name: 'Closed Line', status: 'Closed' };
  const lines = [line, closedLine];
  return {
    useCreditLine: (id: string) => {
      const match = lines.find((entry) => entry.id === id) ?? null;
      return { line: match, status: 'success', error: null };
    },
  };
});

const CLOSED_LINE = {
  ...REPAY_TEST_CREDIT_LINES[0],
  id: 'CL-CLOSED',
  name: 'Closed Line',
  status: 'Closed' as const,
};
const ALL_LINES = [REPAY_TEST_CREDIT_LINES[0], CLOSED_LINE];

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/repay']}>{children}</MemoryRouter>;
}

const LINE_ID = 'CL-2024-001';

function renderFlow(overrides: { preselectedId?: string | null } = {}) {
  return renderHook(
    () =>
      useRepayFlow({
        preselectedId:
          overrides.preselectedId === undefined ? LINE_ID : overrides.preselectedId,
        creditLines: [],
        allLines: ALL_LINES,
        creditStatus: 'success',
        navigate: vi.fn(),
      }),
    { wrapper },
  );
}

describe('useRepayFlow', () => {
  beforeEach(() => {
    localStorage.clear();
    clearRepayDraft();
  });

  it('starts on the input step with the preselected line and no amount', () => {
    const { result } = renderFlow();

    expect(result.current.step).toBe('input');
    expect(result.current.selectedLine?.id).toBe(LINE_ID);
    expect(result.current.amountStr).toBe('');
    expect(result.current.amount).toBe(0);
  });

  it('fills the amount from the percentage shortcut, capped by the wallet balance', () => {
    const { result } = renderFlow();

    act(() => {
      result.current.handlePercent(100);
    });

    // Total owed (85,000 utilized) is below the 50,000 USDC wallet balance,
    // so the maximum repayable amount wins.
    expect(Number(result.current.amountStr)).toBeGreaterThan(0);
    expect(Number(result.current.amountStr)).toBeLessThanOrEqual(50_000);
  });

  it('moves to review and back to input', () => {
    const { result } = renderFlow();

    act(() => {
      result.current.setAmountStr('100');
    });
    act(() => {
      result.current.handleReview();
    });
    expect(result.current.step).toBe('review');

    act(() => {
      result.current.handleBack();
    });
    expect(result.current.step).toBe('input');
  });

  it('persists an owner-scoped draft while the flow has an amount', async () => {
    const { result } = renderFlow();

    act(() => {
      result.current.setAmountStr('250.50');
    });

    await waitFor(() => {
      expect(loadRepayDraft()).toMatchObject({
        creditLineId: LINE_ID,
        amountStr: '250.50',
        step: 'input',
        owner: 'undefined:GAABC1234567890ABCDEF:TESTNET',
      });
    });
  });

  it('offers to restore a saved draft and revalidates it into the review step', async () => {
    saveRepayDraft({
      step: 'review',
      creditLineId: LINE_ID,
      amountStr: '100.00',
      confirmAmountStr: '',
      isAutoSchedule: true,
      owner: 'undefined:GAABC1234567890ABCDEF:TESTNET',
    });

    const { result } = renderFlow({ preselectedId: null });

    await waitFor(() => {
      expect(result.current.showRecoveryPrompt).toBe(true);
    });

    act(() => {
      result.current.restoreDraft();
    });

    expect(result.current.showRecoveryPrompt).toBe(false);
    expect(result.current.selectedId).toBe(LINE_ID);
    expect(result.current.amountStr).toBe('100.00');
    expect(result.current.isAutoSchedule).toBe(true);
    expect(result.current.step).toBe('review');
  });

  it('discards a draft whose credit line is no longer repayable', async () => {
    saveRepayDraft({
      step: 'review',
      creditLineId: 'CL-CLOSED',
      amountStr: '100.00',
      confirmAmountStr: '',
      isAutoSchedule: false,
      owner: 'undefined:GAABC1234567890ABCDEF:TESTNET',
    });

    const { result } = renderFlow({ preselectedId: null });

    await waitFor(() => {
      expect(result.current.draftDiscardReason).toBe('line-unrepayable');
    });
    expect(result.current.showRecoveryPrompt).toBe(false);
    expect(loadRepayDraft()).toBeNull();
  });

  it('queues confirmation and blocks it while offline', async () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result } = renderFlow();

    act(() => {
      result.current.setAmountStr('100');
    });
    act(() => {
      result.current.handleReview();
    });
    await waitFor(() => {
      expect(result.current.reviewBalance).not.toBeNull();
    });

    act(() => {
      void result.current.handleConfirm();
    });

    expect(result.current.isOfflineBlocked).toBe(true);
    expect(result.current.step).toBe('review');
    onlineSpy.mockRestore();
  });
});
