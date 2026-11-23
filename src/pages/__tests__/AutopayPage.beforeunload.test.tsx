/**
 * Tests that AutopayPage guards the beforeunload event while the form has
 * unsaved input, using the useUnsavedChangesGuard hook.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AutopayPage from '../AutopayPage';
import type { CreditLine } from '../../types/creditLine';
import { SETTLEMENT_ASSET } from '../../lib/repayable-balance';

const { state } = vi.hoisted(() => ({
  state: {
    lines: [] as CreditLine[],
    balances: [] as Array<{ asset: string; balance: string; issuer?: string }>,
  },
}));

vi.mock('../../hooks/useCreditLines', () => ({
  useCreditLines: () => ({
    status: 'success',
    lines: state.lines,
    error: null,
    refetch: vi.fn(),
    lastUpdatedAt: null,
    owner: 'GTEST',
    wallet: null,
    setLines: vi.fn(),
  }),
}));

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: { publicKey: 'GTEST', network: 'TESTNET' },
    status: 'connected',
    balances: state.balances,
  }),
}));

function creditLine(overrides: Partial<CreditLine> & { id: string }): CreditLine {
  const { id, ...rest } = overrides;
  return {
    id,
    name: `Line ${id}`,
    status: 'Active',
    limit: 50_000,
    utilized: 1_000,
    apr: 8,
    riskScore: 700,
    openedAt: '2024-01-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    transactions: [],
    statusHistory: [],
    ...rest,
  };
}

const activeLine = creditLine({ id: 'cl-active', name: 'Active Line', utilized: 1_000 });

const usdcBalance = (balance: string) => ({
  asset: SETTLEMENT_ASSET.code,
  issuer: SETTLEMENT_ASSET.issuer,
  balance,
});

function dispatchBeforeUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  Object.defineProperty(event, 'returnValue', { writable: true, value: undefined });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('AutopayPage — beforeunload guard', () => {
  beforeEach(() => {
    state.lines = [activeLine];
    state.balances = [usdcBalance('5000.0000000')];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not block beforeunload when the form is pristine', () => {
    render(<AutopayPage />);

    const prevented = dispatchBeforeUnload();

    expect(prevented).toBe(false);
  });

  it('blocks beforeunload after typing an amount', () => {
    render(<AutopayPage />);

    fireEvent.change(screen.getByLabelText(/payment amount/i), {
      target: { value: '100' },
    });

    const prevented = dispatchBeforeUnload();

    expect(prevented).toBe(true);
  });

  it('blocks beforeunload after filling a start date', () => {
    render(<AutopayPage />);

    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-12-01' },
    });

    const prevented = dispatchBeforeUnload();

    expect(prevented).toBe(true);
  });

  it('does not block beforeunload after successful submission', async () => {
    render(<AutopayPage />);

    fireEvent.change(screen.getByLabelText(/credit line/i), {
      target: { value: 'cl-active' },
    });
    fireEvent.change(screen.getByLabelText(/payment amount/i), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-12-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /activate autopay/i }));

    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByText(/autopay activated/i)).toBeInTheDocument();

    const prevented = dispatchBeforeUnload();

    expect(prevented).toBe(false);
  });

  it('does not block beforeunload after cancelling the form', () => {
    render(<AutopayPage />);

    fireEvent.change(screen.getByLabelText(/payment amount/i), {
      target: { value: '100' },
    });
    fireEvent.click(screen.getByRole('button', { name: /cancel autopay/i }));

    const prevented = dispatchBeforeUnload();

    expect(prevented).toBe(false);
  });
});
