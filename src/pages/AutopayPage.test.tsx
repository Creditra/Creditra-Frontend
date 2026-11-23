import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AutopayPage from './AutopayPage';

vi.mock('../hooks/useCreditLines', () => ({
  useCreditLines: () => ({ lines: [] }),
}));

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({ balances: null }),
}));

describe('AutopayPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces cancel and clears the announcement after 4000ms', () => {
    vi.useFakeTimers();
    render(<AutopayPage />);

    const cancelButton = screen.getByRole('button', { name: /cancel autopay/i });
    fireEvent.click(cancelButton);

    expect(screen.getByText('Autopay schedule cleared.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Autopay schedule cleared.')).not.toBeInTheDocument();
  });

  it('clears the cancel-announcement timer on unmount without warnings', () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<AutopayPage />);

    const cancelButton = screen.getByRole('button', { name: /cancel autopay/i });
    fireEvent.click(cancelButton);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('clears the previous timer when cancel is clicked repeatedly', () => {
    vi.useFakeTimers();
    render(<AutopayPage />);

    const cancelButton = screen.getByRole('button', { name: /cancel autopay/i });
    fireEvent.click(cancelButton);

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    fireEvent.click(cancelButton);
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Still visible because the timer was reset on the second click
    expect(screen.getByText('Autopay schedule cleared.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByText('Autopay schedule cleared.')).not.toBeInTheDocument();
  });
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseCreditLines = vi.fn();
const mockUseWallet = vi.fn();
const mockUseWalletIdentityKey = vi.fn();

  useCreditLines: () => mockUseCreditLines(),

  useWallet: () => mockUseWallet(),

vi.mock('../hooks/useWalletIdentityKey', () => ({
  useWalletIdentityKey: () => mockUseWalletIdentityKey(),

const MOCK_LINES = [
  {
    id: 'cl-1',
    name: 'Prime Working Capital',
    status: 'Active',
    limit: 5000,
    utilized: 1200,
    apr: 8,
    riskScore: 750,
    openedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    transactions: [],
    statusHistory: [],
  },
  {
    id: 'cl-2',
    name: 'Growth Credit Line',
    status: 'Active',
    limit: 10000,
    utilized: 3000,
    apr: 10,
    riskScore: 720,
    openedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    transactions: [],
    statusHistory: [],
  },
];

  beforeEach(() => {
    localStorage.clear();
    mockUseCreditLines.mockReturnValue({ lines: MOCK_LINES });
    mockUseWallet.mockReturnValue({ balances: null });
    mockUseWalletIdentityKey.mockReturnValue('freighter:GAAA:TESTNET');
  });

  it('creates a schedule, persists it across remount, edits in place, and cancels via ConfirmDialog', async () => {

    // Create a schedule
    fireEvent.change(screen.getByLabelText(/Credit Line/i), {
      target: { value: 'cl-1' },
    });
    fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
      target: { value: '250' },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2027-01-15' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Activate Autopay/i }));

    expect(screen.getByText(/Autopay activated\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit autopay schedule for Prime Working Capital/i })).toBeInTheDocument();

    // Simulate page reload by unmounting and remounting

    expect(screen.getByText(/\$250 · Monthly · Starts 2027-01-15/i)).toBeInTheDocument();
    expect(screen.getByText(/Next scheduled payment:/i)).toBeInTheDocument();

    // Edit in place
    fireEvent.click(
      screen.getByRole('button', { name: /Edit autopay schedule for Prime Working Capital/i }),
    );
    fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
      target: { value: '375' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(screen.getByText(/Autopay updated\./i)).toBeInTheDocument();
    expect(screen.getByText(/\$375 · Monthly · Starts 2027-01-15/i)).toBeInTheDocument();

    // Cancel via ConfirmDialog
    fireEvent.click(
      screen.getByRole('button', { name: /Cancel autopay schedule for Prime Working Capital/i }),
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Cancel Schedule$/i }));

    expect(
      await screen.findByText(/No active autopay schedules saved for this wallet yet/i),
    ).toBeInTheDocument();
  });

  it('scopes persisted schedules per wallet', async () => {

    fireEvent.change(screen.getByLabelText(/Credit Line/i), {
      target: { value: 'cl-1' },
    });
    fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
      target: { value: '150' },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2027-02-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Activate Autopay/i }));

    expect(screen.getByText(/\$150 · Monthly · Starts 2027-02-01/i)).toBeInTheDocument();

    // Switch to another wallet
    mockUseWalletIdentityKey.mockReturnValue('freighter:GBBB:TESTNET');

    expect(
      await screen.findByText(/No active autopay schedules saved for this wallet yet/i),
    ).toBeInTheDocument();
  });
});
