import { render, screen, act } from '@testing-library/react';
import { WalletBalance } from './WalletBalance';
import { useWallet } from '../context/WalletContext';
import { vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

describe('WalletBalance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders null when not connected', () => {
    vi.mocked(useWallet).mockReturnValue({
      status: 'disconnected',
      wallet: null,
      balances: null,
      streamStatus: 'live',
      refreshBalance: vi.fn(),
    } as any);

    const { container } = render(<WalletBalance />);
    expect(container.firstChild).toBeNull();
  });

  it('renders balance and live indicator when connected', () => {
    vi.mocked(useWallet).mockReturnValue({
      status: 'connected',
      wallet: { publicKey: 'G123' },
      balances: [{ asset: 'XLM', balance: '100.50' }],
      streamStatus: 'live',
      refreshBalance: vi.fn(),
    } as any);

    render(<WalletBalance />);
    expect(screen.getByText('100.50 XLM')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Balance stream: Live');
  });

  it('does not poll on a 15s interval (relies on WalletContext stream)', () => {
    const refreshBalanceMock = vi.fn();
    vi.mocked(useWallet).mockReturnValue({
      status: 'connected',
      wallet: { publicKey: 'G123' },
      balances: [{ asset: 'XLM', balance: '100.50' }],
      streamStatus: 'live',
      refreshBalance: refreshBalanceMock,
    } as any);

    render(<WalletBalance />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(refreshBalanceMock).not.toHaveBeenCalled();
  });

  it('triggers a one-time initial fetch when connected without balances', () => {
    const refreshBalanceMock = vi.fn();
    vi.mocked(useWallet).mockReturnValue({
      status: 'connected',
      wallet: { publicKey: 'G123' },
      balances: null,
      streamStatus: 'live',
      refreshBalance: refreshBalanceMock,
    } as any);

    render(<WalletBalance />);
    expect(refreshBalanceMock).toHaveBeenCalledTimes(1);
  });

  it('reflects reconnecting and polling stream statuses', () => {
    vi.mocked(useWallet).mockReturnValue({
      status: 'connected',
      wallet: { publicKey: 'G123' },
      balances: [{ asset: 'XLM', balance: '100.50' }],
      streamStatus: 'reconnecting',
      refreshBalance: vi.fn(),
    } as any);

    const { rerender } = render(<WalletBalance />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Balance stream: Reconnecting…',
    );

    vi.mocked(useWallet).mockReturnValue({
      status: 'connected',
      wallet: { publicKey: 'G123' },
      balances: [{ asset: 'XLM', balance: '100.50' }],
      streamStatus: 'polling',
      refreshBalance: vi.fn(),
    } as any);

    rerender(<WalletBalance />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Balance stream: Polling');
  });
});
