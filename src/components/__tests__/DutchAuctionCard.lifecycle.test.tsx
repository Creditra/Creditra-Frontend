import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DutchAuctionCard } from '../DutchAuctionCard';
import type { DutchAuction } from '../../types/dutchAuction';

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({ wallet: null, status: 'disconnected' }),
}));

vi.mock('../../services/dutchAuctions', () => ({
  purchaseAuction: vi.fn(),
}));

function createAuction(
  status: 'Active' | 'Completed' | 'Cancelled',
  startOffset: number,
  endOffset: number,
  overrides: Partial<DutchAuction> = {}
): DutchAuction {
  const now = Date.now();
  return {
    id: 'DA-TEST',
    nft: {
      id: 'NFT-TEST',
      name: 'Test NFT',
      description: 'Test auction',
      image: 'https://example.test/nft.png',
      collection: 'Test Collection',
      tokenId: '1',
    },
    seller: 'GTEST...SELLER',
    startPrice: 1000,
    floorPrice: 100,
    startTime: new Date(now + startOffset).toISOString(),
    endTime: new Date(now + endOffset).toISOString(),
    duration: (endOffset - startOffset) / 1000,
    status,
    ...overrides,
  };
}

describe('DutchAuctionCard lifecycle states', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('shows Scheduled state with "Starts in" countdown and no purchase button when now < startTime', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const auction = createAuction('Active', 3600000, 7200000); // starts in 1 hour
    render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Starts in')).toBeInTheDocument();
    expect(screen.getByText('01:00:00')).toBeInTheDocument();
    expect(screen.getByText('Opening Price')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase now/i })).not.toBeInTheDocument();
  });

  it('shows Active state with purchase button when inside the time window', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const auction = createAuction('Active', -1800000, 3600000); // started 30 min ago, ends in 1 hour
    render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Time Left')).toBeInTheDocument();
    expect(screen.getByText('Current Price')).toBeInTheDocument();
    expect(screen.getByText('Connect wallet to buy')).toBeInTheDocument();
  });

  it('shows Ended state with no purchase button when now >= endTime and payload is Active', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const auction = createAuction('Active', -7200000, -3600000); // ended 1 hour ago
    render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.getByText('Final Asking Price')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument(); // floor price
    expect(screen.getByText('Auction ended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase now/i })).not.toBeInTheDocument();
  });

  it('shows Completed state when payload is Completed even with future endTime', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const auction = createAuction('Completed', 3600000, 7200000, {
      winner: 'GWINNER...12345',
      finalPrice: 500,
    });
    render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Winner')).toBeInTheDocument();
    expect(screen.getByText('GWINNER...2345')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase now/i })).not.toBeInTheDocument();
  });

  it('shows Cancelled state when payload is Cancelled in any time range', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const auction = createAuction('Cancelled', -1800000, 1800000);
    render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase now/i })).not.toBeInTheDocument();
  });

  it('transitions from Scheduled to Active as fake time advances across startTime', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const auction = createAuction('Active', 5000, 10000); // starts in 5s, ends in 10s
    render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase now/i })).not.toBeInTheDocument();

    // Advance time to just before start
    vi.advanceTimersByTime(4000);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();

    // Advance time past start
    vi.advanceTimersByTime(1500);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Connect wallet to buy')).toBeInTheDocument();
  });

  it('transitions from Active to Ended as fake time advances across endTime', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const auction = createAuction('Active', -5000, 5000); // started 5s ago, ends in 5s
    render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Connect wallet to buy')).toBeInTheDocument();

    // Advance time to just before end
    vi.advanceTimersByTime(4000);
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Advance time past end
    vi.advanceTimersByTime(1500);
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.getByText('Auction ended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase now/i })).not.toBeInTheDocument();
  });

  it('stops the interval timer when reaching terminal state', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const auction = createAuction('Active', -5000, 2000); // ends in 2s
    const { unmount } = render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    const initialTimerCount = vi.getTimerCount();
    expect(initialTimerCount).toBeGreaterThan(0);

    // Advance past end time
    vi.advanceTimersByTime(3000);
    expect(screen.getByText('Ended')).toBeInTheDocument();

    // Wait a bit more to ensure timer is cleared
    vi.advanceTimersByTime(2000);

    // Timer count should be 0 for terminal states
    expect(vi.getTimerCount()).toBe(0);

    unmount();
  });

  it('cleans up interval on unmount', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const auction = createAuction('Active', -1000, 5000);
    const { unmount } = render(<DutchAuctionCard auction={auction} />);

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
