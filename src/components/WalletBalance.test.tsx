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
      refreshBalance: vi.fn(),
    } as any);

    const { container } = render(<WalletBalance />);
    expect(container.firstChild).toBeNull();
  });

  it('renders balance when connected', () => {
    vi.mocked(useWallet).mockReturnValue({
      status: 'connected',
      wallet: { publicKey: 'G123' },
      balances: [{ asset: 'XLM', balance: '100.50' }],
      refreshBalance: vi.fn(),
    } as any);

    render(<WalletBalance />);
    expect(screen.getByText('100.50 XLM')).toBeInTheDocument();
  });

  it('polls balance periodically', async () => {
    const refreshBalanceMock = vi.fn();
    vi.mocked(useWallet).mockReturnValue({
      status: 'connected',
      wallet: { publicKey: 'G123' },
      balances: [{ asset: 'XLM', balance: '100.50' }],
      refreshBalance: refreshBalanceMock,
    } as any);

    render(<WalletBalance />);
    
    expect(refreshBalanceMock).not.toHaveBeenCalled();

    // Advance timer by 15s
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(refreshBalanceMock).toHaveBeenCalledTimes(1);
  });

  it('clears the polling indicator timer on unmount', async () => {
    const refreshBalanceMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWallet).mockReturnValue({
      status: 'connected',
      wallet: { publicKey: 'G123' },
      balances: [{ asset: 'XLM', balance: '100.50' }],
      refreshBalance: refreshBalanceMock,
    } as any);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { unmount } = render(<WalletBalance />);

      await act(async () => {
        vi.advanceTimersByTime(15000);
        await Promise.resolve();
      });
      expect(refreshBalanceMock).toHaveBeenCalledTimes(1);

      unmount();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
