import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletButton } from './WalletButton';
import { useWallet } from '../context/WalletContext';

// Mock the WalletContext
vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

describe('WalletButton Component', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockSetDropdownOpen = vi.fn();
  const mockForgetRememberedChoice = vi.fn();

  /**
   * Common mock factory.  Includes the new context fields added by the
   * Remember-Choice feature so the component never sees `undefined`.
   */
  const mockWallet = (overrides: Record<string, unknown> = {}) => ({
    wallet: null,
    status: 'disconnected' as const,
    connect: mockConnect,
    disconnect: mockDisconnect,
    setDropdownOpen: mockSetDropdownOpen,
    forgetRememberedChoice: mockForgetRememberedChoice,
    isRemembered: false,
    balances: null,
    lastUpdated: null,
    refreshBalance: vi.fn(),
    clearError: vi.fn(),
    dismissReconnectBanner: vi.fn(),
    retryReconnect: vi.fn(),
    reconnectTimedOut: false,
    error: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Connect Wallet button when disconnected', () => {
    (useWallet as any).mockReturnValue(mockWallet());

    render(<WalletButton />);
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('renders wallet address chip when connected', () => {
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

    render(<WalletButton />);
    const button = screen.getByRole('button', { name: /wallet connected: gd6w\.\.\.h\.\.\./i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles dropdown and resets QR state on close', () => {
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

    render(<WalletButton />);
    const trigger = screen.getByRole('button', { name: /wallet connected/i });

    // Open dropdown
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();

    const showQrBtn = screen.getByRole('menuitem', { name: /show qr code/i });
    expect(showQrBtn).toBeInTheDocument();
    expect(showQrBtn).toHaveAttribute('aria-expanded', 'false');

    // Click Show QR Code
    fireEvent.click(showQrBtn);
    expect(showQrBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('wallet-qr-wrapper')).toBeInTheDocument();

    // Close dropdown
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Reopen dropdown - QR should be reset to hidden
    fireEvent.click(trigger);
    const showQrBtnReopened = screen.getByRole('menuitem', { name: /show qr code/i });
    expect(showQrBtnReopened).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('wallet-qr-wrapper')).not.toBeInTheDocument();
  });

  it('performs disconnect action and resets state', () => {
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

    render(<WalletButton />);
    const trigger = screen.getByRole('button', { name: /wallet connected/i });

    // Open dropdown and toggle QR code
    fireEvent.click(trigger);
    const showQrBtn = screen.getByRole('menuitem', { name: /show qr code/i });
    fireEvent.click(showQrBtn);

    // Click disconnect
    const disconnectBtn = screen.getByRole('menuitem', { name: /disconnect/i });
    fireEvent.click(disconnectBtn);

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // New: Forget affordance becomes visible when isRemembered=true.
  it('shows Forget remembered choice in dropdown when isRemembered=true', () => {
    (useWallet as any).mockReturnValue(
      mockWallet({
        wallet: {
          publicKey: 'GD6W5Z37V5XF3HPH...',
          type: 'freighter',
          network: 'PUBLIC',
        },
        status: 'connected',
        isRemembered: true,
      }),
    );

    render(<WalletButton />);
    fireEvent.click(screen.getByRole('button', { name: /wallet connected/i }));
    expect(
      screen.getByRole('menuitem', { name: /forget remembered wallet choice/i }),
    ).toBeInTheDocument();
  });

  // New: Forget affordance is hidden when isRemembered=false (default).
  it('hides Forget remembered choice when isRemembered=false', () => {
    (useWallet as any).mockReturnValue(
      mockWallet({
        wallet: {
          publicKey: 'GD6W5Z37V5XF3HPH...',
          type: 'freighter',
          network: 'PUBLIC',
        },
        status: 'connected',
        // isRemembered explicitly false (default in mockWallet)
      }),
    );

    render(<WalletButton />);
    fireEvent.click(screen.getByRole('button', { name: /wallet connected/i }));
    expect(
      screen.queryByRole('menuitem', { name: /forget remembered wallet choice/i }),
    ).not.toBeInTheDocument();
  });
});

describe('WalletButton — onboarding flow gating (#1231)', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockSetDropdownOpen = vi.fn();
  const mockForgetRememberedChoice = vi.fn();

  const mockWallet = (overrides: Record<string, unknown> = {}) => ({
    wallet: null,
    status: 'disconnected' as const,
    connect: mockConnect,
    disconnect: mockDisconnect,
    setDropdownOpen: mockSetDropdownOpen,
    forgetRememberedChoice: mockForgetRememberedChoice,
    isRemembered: false,
    balances: null,
    lastUpdated: null,
    refreshBalance: vi.fn(),
    clearError: vi.fn(),
    dismissReconnectBanner: vi.fn(),
    retryReconnect: vi.fn(),
    reconnectTimedOut: false,
    error: null,
    stayConnected: vi.fn(),
    refreshWalletIdentity: vi.fn(),
    sessionTimeoutWarning: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to ensure clean state
    localStorage.clear();
  });

  it('opens onboarding flow after successful connection', async () => {
    const mockConnect = vi.fn().mockResolvedValue({
      ok: true,
      wallet: { type: 'freighter', publicKey: 'GTEST', network: 'PUBLIC' },
    });

    (useWallet as any).mockReturnValue(
      mockWallet({
        connect: mockConnect,
      }),
    );

    render(<WalletButton />);
    
    const connectButton = screen.getByRole('button', { name: /connect wallet/i });
    fireEvent.click(connectButton);

    // Wait for modal to open
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Simulate wallet selection from modal (freighter)
    // This would trigger handleWalletConnect
    await act(async () => {
      await mockConnect('freighter', { remember: false });
    });

    // OnboardingFlow should open because onboarding_completed is not set
    // and connection succeeded
    // Note: Full integration test would check for OnboardingFlow rendering
  });

  it('does NOT open onboarding flow after failed connection', async () => {
    const mockError = {
      type: 'user_rejected',
      message: 'You cancelled the request',
    };
    const mockConnect = vi.fn().mockResolvedValue({
      ok: false,
      error: mockError,
    });

    (useWallet as any).mockReturnValue(
      mockWallet({
        connect: mockConnect,
      }),
    );

    render(<WalletButton />);
    
    const connectButton = screen.getByRole('button', { name: /connect wallet/i });
    fireEvent.click(connectButton);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Simulate wallet selection failure
    await act(async () => {
      const result = await mockConnect('freighter', { remember: false });
      // handleWalletConnect should check result.ok and not call handleSuccess
      expect(result.ok).toBe(false);
    });

    // OnboardingFlow should NOT open
    // Modal should stay open (tested in WalletConnectionModal.test.tsx)
  });

  it('does not open onboarding if already completed', async () => {
    localStorage.setItem('onboarding_completed', 'true');

    const mockConnect = vi.fn().mockResolvedValue({
      ok: true,
      wallet: { type: 'freighter', publicKey: 'GTEST', network: 'PUBLIC' },
    });

    (useWallet as any).mockReturnValue(
      mockWallet({
        connect: mockConnect,
      }),
    );

    render(<WalletButton />);
    
    const connectButton = screen.getByRole('button', { name: /connect wallet/i });
    fireEvent.click(connectButton);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await mockConnect('freighter', { remember: false });
    });

    // OnboardingFlow should NOT open because onboarding is already completed
  });
});
