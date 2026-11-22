import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NetworkMismatchBanner } from './NetworkMismatchBanner';
import { useWallet } from '../../context/WalletContext';
import { isSwitchSupported, switchNetwork, WalletConnectError } from '../../utils/wallet';

vi.mock('../../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../../utils/wallet', async () => {
  const { WalletConnectError } = await import('../../types/wallet');
  return {
    EXPECTED_NETWORK: 'TESTNET',
    isSwitchSupported: vi.fn(),
    switchNetwork: vi.fn(),
    WalletConnectError,
  };
});

describe('NetworkMismatchBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders nothing if no wallet is connected', () => {
    vi.mocked(useWallet).mockReturnValue({
      wallet: null,
      status: 'disconnected',
      refreshWalletIdentity: vi.fn(),
    } as any);

    const { container } = render(<NetworkMismatchBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing if wallet network matches EXPECTED_NETWORK', () => {
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'TESTNET', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity: vi.fn(),
    } as any);

    const { container } = render(<NetworkMismatchBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders banner if wallet network does not match', () => {
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity: vi.fn(),
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(true);

    render(<NetworkMismatchBanner />);
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Network mismatch: App expects TESTNET but your wallet is on PUBLIC/)).toBeInTheDocument();
  });

  it('shows switch network button when supported', () => {
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity: vi.fn(),
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(true);

    render(<NetworkMismatchBanner />);
    
    const btn = screen.getByRole('button', { name: /switch network/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('shows fallback copy when switch is unsupported', () => {
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'albedo', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity: vi.fn(),
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(false);

    render(<NetworkMismatchBanner />);
    
    const btn = screen.getByRole('button', { name: /please switch to testnet in wallet/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('can be dismissed for the session for the current network', () => {
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity: vi.fn(),
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(true);

    render(<NetworkMismatchBanner />);
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
    
    const dismissBtn = screen.getByLabelText(/dismiss alert/i);
    fireEvent.click(dismissBtn);
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('networkMismatchDismissed:PUBLIC')).toBe('true');
  });

  it('reappears when wallet switches to a different mismatching network after dismissal', () => {
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity: vi.fn(),
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(true);

    const { rerender } = render(<NetworkMismatchBanner />);

    fireEvent.click(screen.getByLabelText(/dismiss alert/i));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'FUTURENET', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity: vi.fn(),
    } as any);

    rerender(<NetworkMismatchBanner />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/your wallet is on FUTURENET/)).toBeInTheDocument();
  });

  it('calls switchNetwork when switch button is clicked', async () => {
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity: vi.fn(),
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(true);
    vi.mocked(switchNetwork).mockResolvedValue(undefined);

    render(<NetworkMismatchBanner />);
    
    const btn = screen.getByRole('button', { name: /switch network/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    
    expect(switchNetwork).toHaveBeenCalledWith('freighter', 'TESTNET');
  });

  // #961 — after a successful network switch, the app must pull the wallet's
  // new identity into context (which is what actually invalidates any data,
  // like balances, cached against the old network). Before this fix the
  // banner called switchNetwork() and stopped, leaving wallet.network (and
  // anything derived from it) stale until some unrelated action happened to
  // refetch it.
  it('refreshes wallet identity after a successful network switch', async () => {
    const refreshWalletIdentity = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity,
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(true);
    vi.mocked(switchNetwork).mockResolvedValue(undefined);

    render(<NetworkMismatchBanner />);

    const btn = screen.getByRole('button', { name: /switch network/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(refreshWalletIdentity).toHaveBeenCalledTimes(1);
  });

  it('does not call refreshWalletIdentity when switchNetwork itself fails', async () => {
    const refreshWalletIdentity = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity,
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(true);
    vi.mocked(switchNetwork).mockRejectedValue(new Error('User rejected'));

    render(<NetworkMismatchBanner />);

    const btn = screen.getByRole('button', { name: /switch network/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(refreshWalletIdentity).not.toHaveBeenCalled();
  });

  it('shows inline WalletConnectError message, re-enables button, avoids console.error, and clears on retry', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refreshWalletIdentity = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity,
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(true);
    vi.mocked(switchNetwork)
      .mockRejectedValueOnce(new WalletConnectError('user_rejected', 'Request cancelled in wallet.'))
      .mockResolvedValueOnce(undefined);

    render(<NetworkMismatchBanner />);

    const btn = screen.getByRole('button', { name: /switch network/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    const errorEl = screen.getByText('Request cancelled in wallet.');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveAttribute('role', 'alert');
    expect(btn).not.toBeDisabled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(screen.queryByText('Request cancelled in wallet.')).not.toBeInTheDocument();
    expect(refreshWalletIdentity).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });

  it('shows generic inline error when switchNetwork rejects with a non-WalletConnectError', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(useWallet).mockReturnValue({
      wallet: { type: 'freighter', network: 'PUBLIC', publicKey: 'GXXX' },
      status: 'connected',
      refreshWalletIdentity: vi.fn(),
    } as any);
    vi.mocked(isSwitchSupported).mockReturnValue(true);
    vi.mocked(switchNetwork).mockRejectedValue(new Error('Unexpected failure'));

    render(<NetworkMismatchBanner />);

    const btn = screen.getByRole('button', { name: /switch network/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    const errorEl = screen.getByText(/failed to switch network/i);
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveAttribute('role', 'alert');
    expect(btn).not.toBeDisabled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
