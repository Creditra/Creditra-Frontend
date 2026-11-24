import { act, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaleDataBanner, STALE_DATA_THRESHOLD_MS } from './StaleDataBanner';
import { renderWithCredit } from '../test/renderWithCredit';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import type { CreditDataSource } from '../services/credit/CreditDataSource';

describe('StaleDataBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders nothing while idle or loading on first load (no wallet / pending)', () => {
    const pendingSource: CreditDataSource = {
      listCreditLines: () => new Promise(() => {}),
      getCreditLine: () => new Promise(() => {}),
      listTransactions: () => new Promise(() => {}),
    };

    const { container } = renderWithCredit(<StaleDataBanner />, {
      source: pendingSource,
    });
    expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();

    const { container: idleContainer } = renderWithCredit(<StaleDataBanner />, {
      wallet: null,
    });
    expect(idleContainer.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('renders nothing when lastUpdatedAt is null and status is error', async () => {
    const failingSource: CreditDataSource = {
      listCreditLines: vi.fn().mockRejectedValue(new Error('Initial load failed')),
      getCreditLine: vi.fn(),
      listTransactions: vi.fn().mockResolvedValue({ items: [] }),
    };

    renderWithCredit(<StaleDataBanner />, { source: failingSource });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays hidden while data is fresh and appears after the threshold with polite status role', async () => {
    const source: CreditDataSource = {
      listCreditLines: vi.fn().mockResolvedValue(MOCK_CREDIT_LINES),
      getCreditLine: vi.fn(),
      listTransactions: vi.fn().mockResolvedValue({ items: [] }),
    };

    renderWithCredit(<StaleDataBanner />, { source });

    await act(async () => {
      await Promise.resolve();
    });

    // Fresh right after load
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Advance 4 minutes (still under 5 min threshold)
    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Advance past 5 min threshold
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });

    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(banner).toHaveTextContent(/Credit data may be stale/i);
    expect(banner).toHaveTextContent(/5 minutes ago/i);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('re-evaluates immediately on visibilitychange when returning to the tab', async () => {
    const source: CreditDataSource = {
      listCreditLines: vi.fn().mockResolvedValue(MOCK_CREDIT_LINES),
      getCreditLine: vi.fn(),
      listTransactions: vi.fn().mockResolvedValue({ items: [] }),
    };

    renderWithCredit(<StaleDataBanner pollIntervalMs={60 * 60 * 1000} />, {
      source,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Simulate system clock advancing while tab was hidden without interval firing
    vi.setSystemTime(new Date(Date.now() + STALE_DATA_THRESHOLD_MS + 1000));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('refreshes data on Refresh button click and hides banner on success', async () => {
    let resolveRefresh!: (lines: typeof MOCK_CREDIT_LINES) => void;
    const listCreditLines = vi
      .fn()
      .mockResolvedValueOnce(MOCK_CREDIT_LINES)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );

    const source: CreditDataSource = {
      listCreditLines,
      getCreditLine: vi.fn(),
      listTransactions: vi.fn().mockResolvedValue({ items: [] }),
    };

    renderWithCredit(<StaleDataBanner />, { source });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(STALE_DATA_THRESHOLD_MS);
    });

    const refreshBtn = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(refreshBtn);

    expect(listCreditLines).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();

    await act(async () => {
      resolveRefresh(MOCK_CREDIT_LINES);
      await Promise.resolve();
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the banner visible and shows an error when refresh fails', async () => {
    const listCreditLines = vi
      .fn()
      .mockResolvedValueOnce(MOCK_CREDIT_LINES)
      .mockRejectedValueOnce(new Error('Network timeout'));

    const source: CreditDataSource = {
      listCreditLines,
      getCreditLine: vi.fn(),
      listTransactions: vi.fn().mockResolvedValue({ items: [] }),
    };

    renderWithCredit(<StaleDataBanner />, { source });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(STALE_DATA_THRESHOLD_MS);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      await Promise.resolve();
    });

    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Refresh failed\. Please try again\./i);
    expect(screen.getByRole('button', { name: 'Refresh' })).not.toBeDisabled();
  });

  it('hides banner if system clock moves backward', async () => {
    const source: CreditDataSource = {
      listCreditLines: vi.fn().mockResolvedValue(MOCK_CREDIT_LINES),
      getCreditLine: vi.fn(),
      listTransactions: vi.fn().mockResolvedValue({ items: [] }),
    };

    renderWithCredit(<StaleDataBanner />, { source });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(STALE_DATA_THRESHOLD_MS);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Clock jumps backward before load time
    vi.setSystemTime(new Date('2026-01-15T11:55:00.000Z'));
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('hides banner when lastUpdatedAt resets to null (e.g. on wallet switch)', async () => {
    const source: CreditDataSource = {
      listCreditLines: vi.fn().mockResolvedValue(MOCK_CREDIT_LINES),
      getCreditLine: vi.fn(),
      listTransactions: vi.fn().mockResolvedValue({ items: [] }),
    };

    const { rerender } = renderWithCredit(<StaleDataBanner />, { source });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(STALE_DATA_THRESHOLD_MS);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Verify re-rendering while fresh/reset does not throw
    rerender(<StaleDataBanner thresholdMs={STALE_DATA_THRESHOLD_MS * 2} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
