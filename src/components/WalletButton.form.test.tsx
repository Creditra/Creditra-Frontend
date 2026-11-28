import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletButton } from './WalletButton';
import { useWallet } from '../context/WalletContext';

vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

describe('WalletButton inside a form', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockSetDropdownOpen = vi.fn();
  const mockRefreshBalance = vi.fn().mockResolvedValue(undefined);

  const mockWallet = (overrides: Record<string, unknown> = {}) => ({
    wallet: null,
    status: 'disconnected' as const,
    connect: mockConnect,
    disconnect: mockDisconnect,
    setDropdownOpen: mockSetDropdownOpen,
    forgetRememberedChoice: vi.fn(),
    isRemembered: false,
    balances: [
      { asset: 'XLM', balance: 100, issuer: null },
    ],
    lastUpdated: new Date().toISOString(),
    refreshBalance: mockRefreshBalance,
    clearError: vi.fn(),
    dismissReconnectBanner: vi.fn(),
    retryReconnect: vi.fn(),
    reconnectTimedOut: false,
    error: null,
    stayConnected: vi.fn(),
    refreshWalletIdentity: vi.fn(),
    sessionTimeoutWarning: false,
    accounts: ['GD6W5Z37V5XF3HPH...', 'GBXYZ1234567890...'],
    switchAccount: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not submit form when clicking Connect Wallet button', () => {
    (useWallet as any).mockReturnValue(mockWallet());
    const handleSubmit = vi.fn((e) => e.preventDefault());

    render(
      <form onSubmit={handleSubmit}>
        <WalletButton />
      </form>,
    );

    const button = screen.getByRole('button', { name: /connect wallet/i });
    expect(button).toHaveAttribute('type', 'button');

    fireEvent.click(button);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('does not submit form when clicking wallet address button', () => {
    (useWallet as any).mockReturnValue(
      mockWallet({
        wallet: {
          publicKey: 'GD6W5Z37V5XF3HPH...',
          type: 'freighter',
          network: 'PUBLIC',
        },
        status: 'connected',
      }),
    );
    const handleSubmit = vi.fn((e) => e.preventDefault());

    render(
      <form onSubmit={handleSubmit}>
        <WalletButton />
      </form>,
    );

    const addressBtn = screen.getByRole('button', { name: /wallet connected/i });
    expect(addressBtn).toHaveAttribute('type', 'button');

    fireEvent.click(addressBtn);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('does not submit form when clicking refresh button inside dropdown', () => {
    (useWallet as any).mockReturnValue(
      mockWallet({
        wallet: {
          publicKey: 'GD6W5Z37V5XF3HPH...',
          type: 'freighter',
          network: 'PUBLIC',
        },
        status: 'connected',
      }),
    );
    const handleSubmit = vi.fn((e) => e.preventDefault());

    render(
      <form onSubmit={handleSubmit}>
        <WalletButton />
      </form>,
    );

    // Open dropdown
    const addressBtn = screen.getByRole('button', { name: /wallet connected/i });
    fireEvent.click(addressBtn);

    const refreshBtn = screen.getByRole('button', { name: /refresh wallet balance/i });
    expect(refreshBtn).toHaveAttribute('type', 'button');

    fireEvent.click(refreshBtn);
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(mockRefreshBalance).toHaveBeenCalled();
  });
});
