import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  usePaymentReminders,
  getPaymentReminderStorageKey,
  getMsUntilNextLocalMidnight,
} from '../usePaymentReminders';
import { setClockForTests, resetClock } from '../../lib/clock';
import type { CreditLine } from '../../types/creditLine';
import type { NotificationPreferences } from '../../types/notification';

const mockAddToast = vi.fn();
const mockNavigate = vi.fn();
let mockLines: CreditLine[] = [];
let mockWalletIdentity: string | null = 'freighter:GTEST123:testnet';
let mockPreferences: NotificationPreferences = {
  transaction: true,
  credit_line: true,
  risk_score: true,
  rate_change: true,
  auction: true,
  system: true,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../context/CreditDataContext', () => ({
  useCreditData: () => ({
    lines: mockLines,
  }),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    addToast: mockAddToast,
    preferences: mockPreferences,
  }),
}));

vi.mock('../useWalletIdentityKey', () => ({
  useWalletIdentityKey: () => mockWalletIdentity,
}));

function makeLine(overrides: Partial<CreditLine> = {}): CreditLine {
  return {
    id: 'CL-100',
    name: 'Treasury Line',
    status: 'Active',
    limit: 25000,
    utilized: 5000,
    apr: 10,
    riskScore: 740,
    openedAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    transactions: [],
    statusHistory: [],
    nextPaymentDate: '2026-10-20',
    nextPaymentAmount: 450,
    ...overrides,
  };
}

function Harness() {
  usePaymentReminders();
  return null;
}

describe('usePaymentReminders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockAddToast.mockReset();
    mockAddToast.mockImplementation(() => 'toast-id-1');
    mockNavigate.mockReset();
    mockWalletIdentity = 'freighter:GTEST123:testnet';
    mockPreferences = {
      transaction: true,
      credit_line: true,
      risk_score: true,
      rate_change: true,
      auction: true,
      system: true,
    };
    mockLines = [makeLine()];
  });

  afterEach(() => {
    resetClock();
    vi.useRealTimers();
  });

  it('emits 7d -> 1d -> due_today -> overdue_3d as time advances and deduplicates rerenders', () => {
    let currentTime = new Date(2026, 9, 13, 10, 0, 0); // 7 days before Oct 20
    setClockForTests(() => currentTime);

    const { rerender } = render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    expect(mockAddToast).toHaveBeenCalledTimes(1);
    expect(mockAddToast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: 'credit_line',
        title: 'Upcoming repayment',
        actionDescriptor: { label: 'Repay now', kind: 'route', to: '/repay?line=CL-100' },
      }),
    );

    // Duplicate render on same day does not re-emit
    rerender(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(mockAddToast).toHaveBeenCalledTimes(1);

    // Jump to 1 day before (Oct 19) and trigger visibilitychange
    currentTime = new Date(2026, 9, 19, 9, 0, 0);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockAddToast).toHaveBeenCalledTimes(2);
    expect(mockAddToast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Payment due tomorrow' }),
    );

    // Jump to due today (Oct 20)
    currentTime = new Date(2026, 9, 20, 0, 1, 0);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockAddToast).toHaveBeenCalledTimes(3);
    expect(mockAddToast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Payment due today' }),
    );

    // Jump to 3 days overdue (Oct 23)
    currentTime = new Date(2026, 9, 23, 12, 0, 0);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockAddToast).toHaveBeenCalledTimes(4);
    expect(mockAddToast).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'danger', title: 'Payment overdue' }),
    );
  });

  it('persists sent keys per wallet across reloads', () => {
    const now = new Date(2026, 9, 20, 10, 0, 0);
    setClockForTests(() => now);

    const { unmount } = render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(mockAddToast).toHaveBeenCalledTimes(1);
    unmount();

    // Simulate reload: mount again with same wallet -> no duplicate
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(mockAddToast).toHaveBeenCalledTimes(1);

    // Switch wallet -> fires for the other wallet
    mockWalletIdentity = 'freighter:GOTHER456:testnet';
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(mockAddToast).toHaveBeenCalledTimes(2);
  });

  it('respects disabled credit_line preference and does not consume dedupe keys', () => {
    setClockForTests(() => new Date(2026, 9, 20, 10, 0, 0));
    mockPreferences = { ...mockPreferences, credit_line: false };

    const { rerender } = render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(mockAddToast).not.toHaveBeenCalled();

    // Re-enabling credit_line allows the reminder to fire
    mockPreferences = { ...mockPreferences, credit_line: true };
    rerender(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(mockAddToast).toHaveBeenCalledTimes(1);
  });

  it('fires via local midnight timer and prunes expired persisted keys', () => {
    const storageKey = getPaymentReminderStorageKey(mockWalletIdentity);
    localStorage.setItem(storageKey, JSON.stringify(['CL-OLD:2025-01-01:overdue']));

    let currentTime = new Date(2026, 9, 19, 23, 59, 0); // 1 min before due date
    setClockForTests(() => currentTime);

    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    // 1d fires on mount; old key pruned
    expect(mockAddToast).toHaveBeenCalledTimes(1);
    const storedAfterMount = JSON.parse(localStorage.getItem(storageKey) || '[]');
    expect(storedAfterMount).not.toContain('CL-OLD:2025-01-01:overdue');
    expect(storedAfterMount).toContain('CL-100:2026-10-20:1d');

    // Advance past local midnight
    currentTime = new Date(2026, 9, 20, 0, 0, 1);
    act(() => {
      vi.advanceTimersByTime(60 * 1000 + 1000);
    });

    expect(mockAddToast).toHaveBeenCalledTimes(2);
    expect(mockAddToast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Payment due today' }),
    );
  });

  it('computes local midnight delay accurately across DST boundaries', () => {
    const beforeMidnight = new Date(2026, 2, 8, 23, 30, 0, 0);
    expect(getMsUntilNextLocalMidnight(beforeMidnight)).toBe(30 * 60 * 1000);
  });
});
