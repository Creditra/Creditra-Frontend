import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DutchAuction } from '../../types/dutchAuction';

// Mock the mock data source using hoisted mock
const auctionData = vi.hoisted(() => ({ value: [] as DutchAuction[] }));
vi.mock('../../data/mockDutchAuctions', () => ({
  get MOCK_DUTCH_AUCTIONS() {
    return auctionData.value;
  },
}));

// Mock wallet context
vi.mock('../../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));
import { useWallet } from '../../context/WalletContext';

// Mock purchase service
vi.mock('../../services/dutchAuctions', () => ({
  purchaseAuction: vi.fn(() => Promise.resolve()),
}));
import { purchaseAuction } from '../../services/dutchAuctions';

import { DutchAuctions } from '../DutchAuctions';

describe('DutchAuctions purchase flow', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockWallet = (overrides = {}) => ({
    wallet: {
      publicKey: 'GDTESTBUYER',
      network: 'TESTNET',
      type: 'freighter',
    },
    status: 'connected' as const,
    connect: mockConnect,
    disconnect: mockDisconnect,
    setDropdownOpen: vi.fn(),
    forgetRememberedChoice: vi.fn(),
    isRemembered: false,
    hasNetworkMismatch: false,
    switchNetwork: vi.fn(),
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

  const activeAuction: DutchAuction = {
    id: 'AUCTION-1',
    seller: 'GDSSELLER',
    startPrice: 1000,
    floorPrice: 500,
    startTime: new Date(Date.now() - 60_000).toISOString(), // started 1 min ago
    endTime: new Date(Date.now() + 600_000).toISOString(), // ends in 10 min
    nft: {
      id: 'NFT-1',
      image: 'https://example.com/nft.png',
      name: 'Test NFT',
      collection: 'Test Collection',
      tokenId: '1',
      description: 'Test description',
    },
    duration: 660,
    status: 'Active',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auctionData.value = [activeAuction];
  });

  it('purchases successfully and shows success feedback', async () => {
    vi.mocked(useWallet).mockReturnValue(mockWallet() as any);

    render(<DutchAuctions />);

    const button = screen.getByRole('button', { name: /Purchase Now/i });
    expect(button).toBeInTheDocument();

    // Click once – should trigger purchase
    await act(async () => {
      fireEvent.click(button);
    });

    expect(purchaseAuction).toHaveBeenCalledTimes(1);
    expect(purchaseAuction).toHaveBeenCalledWith('AUCTION-1', expect.any(BigInt));

    // Success message should be announced via LiveRegion
    const feedback = await screen.findByText(/Purchased auction AUCTION-1/i);
    expect(feedback).toBeInTheDocument();
  });

  it('ignores a second click while pending', async () => {
    vi.mocked(useWallet).mockReturnValue(mockWallet() as any);

    render(<DutchAuctions />);

    const button = screen.getByRole('button', { name: /Purchase Now/i });
    // Simulate rapid double click
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    // Should still be called only once due to pending guard
    expect(purchaseAuction).toHaveBeenCalledTimes(1);
  });

  it('does not call purchase when no wallet is connected', () => {
    vi.mocked(useWallet).mockReturnValue({
      wallet: null,
      status: 'disconnected',
    } as any);

    render(<DutchAuctions />);

    const button = screen.getByRole('button', { name: /Connect wallet to buy/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);

    expect(purchaseAuction).not.toHaveBeenCalled();
  });

  it('never shows window.alert', async () => {
    const alertSpy = vi.spyOn(window, 'alert');
    vi.mocked(useWallet).mockReturnValue(mockWallet() as any);
    render(<DutchAuctions />);
    const button = screen.getByRole('button', { name: /Purchase Now/i });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
