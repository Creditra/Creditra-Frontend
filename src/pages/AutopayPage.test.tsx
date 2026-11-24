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
