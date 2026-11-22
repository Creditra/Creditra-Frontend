import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NetworkMismatchBanner } from './NetworkMismatchBanner';
import { useWallet } from '../../context/WalletContext';
import { isSwitchSupported, switchNetwork } from '../../utils/wallet';

vi.mock('../../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../../utils/wallet', () => ({
  EXPECTED_NETWORK: 'TESTNET',
  isSwitchSupported: vi.fn(),
  switchNetwork: vi.fn(),
}));

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

  it('can be dismissed for the session', () => {
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
    expect(sessionStorage.getItem('networkMismatchDismissed')).toBe('true');
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
});
