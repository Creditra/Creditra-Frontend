import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepaySuccessShareCard } from './RepaySuccessShareCard';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'default',
    setTheme: vi.fn(),
    fontMode: 'default',
    setFontMode: vi.fn(),
  }),
}));

const baseProps = {
  amount: 1250.5,
  creditLineName: 'Business Line',
  transactionId: 'TX-123456789',
  timestamp: new Date('2026-01-02T03:04:00Z'),
};

describe('RepaySuccessShareCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the repayment summary', () => {
    render(<RepaySuccessShareCard {...baseProps} />);

    expect(screen.getByText('Repayment Successful!')).toBeInTheDocument();
    expect(screen.getByText('Business Line')).toBeInTheDocument();
  });

  it('clears the copied-state timer on unmount', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<RepaySuccessShareCard {...baseProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /share repayment summary/i }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Copied!')).toBeInTheDocument();

    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
