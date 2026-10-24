import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletButton } from '../WalletButton';
import { WalletProvider } from '../../context/WalletContext';
import * as walletUtils from '../../utils/wallet';
import type { WalletInfo } from '../../types/wallet';

/**
 * Integration tests for WalletButton using the real WalletProvider.
 * These tests verify that the component handles connect/disconnect transitions
 * without violating the Rules of Hooks.
 */

// Mock the wallet utilities
vi.mock('../../utils/wallet', () => ({
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  saveWalletPreference: vi.fn(),
  getStoredWallet: vi.fn().mockReturnValue(null),
  recordRecentWallet: vi.fn(),
  isWalletRemembered: vi.fn().mockReturnValue(false),
  setWalletRemembered: vi.fn(),
  classifyWalletError: vi.fn(),
  EXPECTED_NETWORK: 'PUBLIC',
}));

// Mock other dependencies
vi.mock('../../hooks/useDetectedWallets', () => ({
  useDetectedWallets: () => ({ detectedWallets: [] }),
}));

vi.mock('../WalletConnectionModal', () => ({
  WalletConnectionModal: ({ isOpen, onConnect }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="wallet-connection-modal">
        <button
          onClick={() => onConnect('freighter', { remember: false })}
        >
          Connect Freighter
        </button>
      </div>
    );
  },
}));

vi.mock('../OnboardingFlow', () => ({
  OnboardingFlow: ({ isOpen }: any) => {
    if (!isOpen) return null;
    return <div data-testid="onboarding-flow">Onboarding</div>;
  },
}));

vi.mock('../../config/creditNetwork', () => ({
  getCreditNetworkConfig: () => ({ horizonUrl: 'https://horizon-testnet.stellar.org' }),
}));

describe('WalletButton transition tests (real provider)', () => {
  const mockWalletInfo: WalletInfo = {
    type: 'freighter',
    publicKey: 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234',
    network: 'PUBLIC',
  };

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock successful connection by default
    vi.mocked(walletUtils.connectWallet).mockResolvedValue(mockWalletInfo);
    vi.mocked(walletUtils.isWalletRemembered).mockReturnValue(false);
    vi.mocked(walletUtils.getStoredWallet).mockReturnValue(null);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders Connect Wallet button in disconnected state', () => {
    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('transitions from disconnected to connected without React errors', async () => {
    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    // Start disconnected
    const connectBtn = screen.getByRole('button', { name: /connect wallet/i });
    expect(connectBtn).toBeInTheDocument();

    // Open modal and connect
    fireEvent.click(connectBtn);
    
    await waitFor(() => {
      expect(screen.getByTestId('wallet-connection-modal')).toBeInTheDocument();
    });

    const freighterBtn = screen.getByText('Connect Freighter');
    fireEvent.click(freighterBtn);

    // Should transition to connected state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /wallet connected/i })).toBeInTheDocument();
    });

    // Verify no React hook errors
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/rendered more hooks/i),
      expect.anything()
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/rendered fewer hooks/i),
      expect.anything()
    );
  });

  it('transitions from connected to disconnected without errors', async () => {
    // Start with a connected wallet
    vi.mocked(walletUtils.getStoredWallet).mockReturnValue({ type: 'freighter' });
    vi.mocked(walletUtils.isWalletRemembered).mockReturnValue(true);

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    // Wait for auto-reconnect to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /wallet connected/i })).toBeInTheDocument();
    });

    // Open dropdown
    const addressBtn = screen.getByRole('button', { name: /wallet connected/i });
    fireEvent.click(addressBtn);

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Disconnect
    const disconnectBtn = screen.getByRole('menuitem', { name: /disconnect/i });
    fireEvent.click(disconnectBtn);

    // Should transition back to disconnected
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    });

    // Verify no React hook errors
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/rendered more hooks/i),
      expect.anything()
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/rendered fewer hooks/i),
      expect.anything()
    );
  });

  it('handles connect → disconnect → connect without errors', async () => {
    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    // First connection
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await waitFor(() => screen.getByTestId('wallet-connection-modal'));
    fireEvent.click(screen.getByText('Connect Freighter'));
    await waitFor(() => screen.getByRole('button', { name: /wallet connected/i }));

    // Disconnect
    fireEvent.click(screen.getByRole('button', { name: /wallet connected/i }));
    await waitFor(() => screen.getByRole('menu'));
    fireEvent.click(screen.getByRole('menuitem', { name: /disconnect/i }));
    await waitFor(() => screen.getByRole('button', { name: /connect wallet/i }));

    // Second connection
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await waitFor(() => screen.getByTestId('wallet-connection-modal'));
    fireEvent.click(screen.getByText('Connect Freighter'));
    await waitFor(() => screen.getByRole('button', { name: /wallet connected/i }));

    // Verify no React hook errors throughout the cycle
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/rendered more hooks/i),
      expect.anything()
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/rendered fewer hooks/i),
      expect.anything()
    );
  });

  it('handles connection failure without errors', async () => {
    // Mock connection failure
    const connectionError = new Error('User rejected connection');
    vi.mocked(walletUtils.connectWallet).mockRejectedValueOnce(connectionError);

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await waitFor(() => screen.getByTestId('wallet-connection-modal'));

    // Attempt connection
    fireEvent.click(screen.getByText('Connect Freighter'));

    // Should remain disconnected
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /wallet connected/i })).not.toBeInTheDocument();
    });

    // Verify no React hook errors
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/rendered more hooks/i),
      expect.anything()
    );
  });

  it('cleans up announcement timeout on unmount', async () => {
    vi.mocked(walletUtils.getStoredWallet).mockReturnValue({ type: 'freighter' });
    vi.mocked(walletUtils.isWalletRemembered).mockReturnValue(true);

    const { unmount } = render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    // Wait for connection
    await waitFor(() => screen.getByRole('button', { name: /wallet connected/i }));

    // Open dropdown and trigger refresh (which sets a 3s timeout)
    fireEvent.click(screen.getByRole('button', { name: /wallet connected/i }));
    await waitFor(() => screen.getByRole('menu'));

    // Mock the balance fetch to resolve immediately
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ balances: [{ asset_type: 'native', balance: '100' }] }),
    });

    const refreshBtn = screen.getByRole('button', { name: /refresh wallet balance/i });
    fireEvent.click(refreshBtn);

    // Unmount within 3 seconds (before timeout fires)
    await waitFor(() => screen.getByText(/balance refreshed/i));
    unmount();

    // No console errors about state updates after unmount
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/can't perform a React state update/i),
      expect.anything()
    );
  });
});
