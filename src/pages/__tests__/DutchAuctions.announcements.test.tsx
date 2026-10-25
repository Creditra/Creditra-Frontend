import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { DutchAuction } from '../../types/dutchAuction';

// Hoisted mock for auctions
const auctionData = vi.hoisted(() => ({ value: [] as DutchAuction[] }));
vi.mock('@/data/mockDutchAuctions', () => ({
  get MOCK_DUTCH_AUCTIONS() {
    return auctionData.value;
  },
}));

import { DutchAuctions } from '../DutchAuctions';

function createAuction(overrides: Partial<DutchAuction> = {}): DutchAuction {
  const now = Date.now();
  return {
    id: 'DA-1',
    nft: {
      id: 'NFT-1',
      name: 'Cosmic Ape #1234',
      description: 'A test ape',
      image: '/nft/cosmic-ape.svg',
      collection: 'Ape Universe',
      tokenId: '1234',
    },
    seller: 'GTEST...SELLER',
    startPrice: 1000,
    floorPrice: 200,
    startTime: new Date(now - 3600 * 1000).toISOString(),
    endTime: new Date(now + 10 * 60 * 1000).toISOString(), // 10 mins remaining
    duration: 7200,
    status: 'Active',
    ...overrides,
  };
}

describe('Dutch auctions announcement milestones and live region', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Scenario 5: countdown element has role="timer" and accessible name containing NFT name', () => {
    const now = 1000000;
    vi.setSystemTime(now);
    auctionData.value = [
      createAuction({
        endTime: new Date(now + 10 * 60 * 1000).toISOString(),
      }),
    ];

    render(<DutchAuctions />);

    const timer = screen.getByRole('timer', { name: /Time left for Cosmic Ape #1234/i });
    expect(timer).toBeInTheDocument();
    expect(timer).toHaveAttribute('aria-live', 'off');
  });

  it('Scenario 6: under 5 minutes displays "Ending soon" text visible', () => {
    const now = 1000000;
    vi.setSystemTime(now);
    // 4 minutes left
    auctionData.value = [
      createAuction({
        endTime: new Date(now + 4 * 60 * 1000).toISOString(),
      }),
    ];

    render(<DutchAuctions />);

    expect(screen.getByText(/Ending soon/i)).toBeInTheDocument();
  });

  it('Acceptance Criteria: asserts only one aria-live region exists on /dutch-auctions for auction announcements', () => {
    auctionData.value = [
      createAuction({ id: 'DA-1' }),
      createAuction({ id: 'DA-2', nft: { id: 'NFT-2', name: 'Second NFT', description: '', image: '', collection: 'Col', tokenId: '2' } }),
    ];

    const { container } = render(<DutchAuctions />);
    const liveRegions = container.querySelectorAll('#auction-announcer-live-region[role="status"]');
    expect(liveRegions.length).toBe(1);
    expect(liveRegions[0]).toHaveAttribute('aria-live', 'polite');
  });

  it('Scenario 1: Remaining crosses 5:00 -> 4:59 fires one "5 minutes left" message', () => {
    const startNow = 1000000;
    vi.setSystemTime(startNow);

    // End time set to 5 minutes + 500ms from startNow
    const endTime = new Date(startNow + 5 * 60 * 1000 + 500).toISOString();
    auctionData.value = [createAuction({ endTime })];

    render(<DutchAuctions />);

    const liveRegion = document.getElementById('auction-announcer-live-region');
    expect(liveRegion).toHaveTextContent('');

    // Advance by 1 second (5:00.5 -> 4:59.5, crossing 5:00)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(liveRegion).toHaveTextContent('Cosmic Ape #1234: 5 minutes left, current price');
  });

  it('Scenario 2: Tick from 6:00 straight to 0:30 (throttled tab) fires only the "1 minute left" message, once', () => {
    const startNow = 1000000;
    vi.setSystemTime(startNow);

    // End time is 6 minutes from now
    const endTime = new Date(startNow + 6 * 60 * 1000).toISOString();
    auctionData.value = [createAuction({ endTime })];

    render(<DutchAuctions />);
    const liveRegion = document.getElementById('auction-announcer-live-region');
    expect(liveRegion).toHaveTextContent('');

    // Simulate tab backgrounding / throttle skipping from 6:00 to 0:30 (skips 5.5 minutes = 330s)
    act(() => {
      vi.advanceTimersByTime(330 * 1000);
    });

    expect(liveRegion).toHaveTextContent('Cosmic Ape #1234: 1 minute left, current price');
    // Ensure it did not announce 5 minutes
    expect(liveRegion?.textContent).not.toContain('5 minutes left');
  });

  it('Scenario 3: Two auctions cross milestones in the same second are both announced, at least 3 s apart', () => {
    const startNow = 1000000;
    vi.setSystemTime(startNow);

    // Both auctions end at 5 min + 500 ms, so both cross 5 min on the first second
    auctionData.value = [
      createAuction({
        id: 'DA-1',
        endTime: new Date(startNow + 5 * 60 * 1000 + 500).toISOString(),
        nft: { id: 'N1', name: 'Ape #1', description: '', image: '', collection: '', tokenId: '1' },
      }),
      createAuction({
        id: 'DA-2',
        endTime: new Date(startNow + 5 * 60 * 1000 + 500).toISOString(),
        nft: { id: 'N2', name: 'Ape #2', description: '', image: '', collection: '', tokenId: '2' },
      }),
    ];

    render(<DutchAuctions />);
    const liveRegion = document.getElementById('auction-announcer-live-region');

    // Tick 1s
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // First auction announced immediately
    expect(liveRegion).toHaveTextContent('Ape #1: 5 minutes left');

    // Advance 2 seconds (less than 3 seconds)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Still first auction
    expect(liveRegion).toHaveTextContent('Ape #1: 5 minutes left');

    // Advance 1 more second (total 3 seconds since first announcement)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Second auction announced now
    expect(liveRegion).toHaveTextContent('Ape #2: 5 minutes left');
  });

  it('Scenario 4: Same auction crosses 1 min then ends within 3 s keeps only "ended" for that auction', () => {
    const startNow = 1000000;
    vi.setSystemTime(startNow);

    // Initial announcement fired for another auction to occupy the channel
    auctionData.value = [
      createAuction({
        id: 'DA-OTHER',
        endTime: new Date(startNow + 5 * 60 * 1000 + 500).toISOString(),
        nft: { id: 'N-OTHER', name: 'Other Ape', description: '', image: '', collection: '', tokenId: '99' },
      }),
      createAuction({
        id: 'DA-1',
        endTime: new Date(startNow + 60 * 1000 + 500).toISOString(),
        nft: { id: 'N1', name: 'Ape #1', description: '', image: '', collection: '', tokenId: '1' },
      }),
    ];

    render(<DutchAuctions />);
    const liveRegion = document.getElementById('auction-announcer-live-region');

    // Tick 1s: both cross a milestone (DA-OTHER crosses 5m, DA-1 crosses 1m)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // DA-OTHER gets announced first
    expect(liveRegion).toHaveTextContent('Other Ape: 5 minutes left');

    // Within next 2s (before DA-1 1m is announced due to 3s throttle), DA-1 ends
    act(() => {
      vi.advanceTimersByTime(61 * 1000);
    });

    // Wait until throttle allows next announcement
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // DA-1 ended replaced the 1 min left message in queue
    expect(liveRegion).toHaveTextContent('Ape #1 auction ended');
    expect(liveRegion?.textContent).not.toContain('1 minute left');
  });

  it('Scenario 7: Mute toggled on with a queued message clears queue; nothing announced and preference persisted', () => {
    const startNow = 1000000;
    vi.setSystemTime(startNow);

    auctionData.value = [
      createAuction({
        id: 'DA-1',
        endTime: new Date(startNow + 5 * 60 * 1000 + 500).toISOString(),
      }),
      createAuction({
        id: 'DA-2',
        endTime: new Date(startNow + 5 * 60 * 1000 + 500).toISOString(),
        nft: { id: 'N2', name: 'Ape #2', description: '', image: '', collection: '', tokenId: '2' },
      }),
    ];

    render(<DutchAuctions />);
    const liveRegion = document.getElementById('auction-announcer-live-region');

    // Cross milestones
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // DA-1 announced, DA-2 queued
    expect(liveRegion).toHaveTextContent('Cosmic Ape #1234: 5 minutes left');

    // Toggle mute
    const muteCheckbox = screen.getByRole('checkbox', { name: /Mute auction alerts/i });
    fireEvent.click(muteCheckbox);

    // Live region cleared immediately
    expect(liveRegion).toHaveTextContent('');

    // Advance time past throttle delay
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Nothing announced
    expect(liveRegion).toHaveTextContent('');
    expect(localStorage.getItem('creditra:auction-alerts-muted')).toBe('true');
  });

  it('Scenario 8: Remount after a milestone fired does not re-announce the same milestone', () => {
    const startNow = 1000000;
    vi.setSystemTime(startNow);

    // End time is 4 minutes from now (already past 5 min milestone)
    const endTime = new Date(startNow + 4 * 60 * 1000).toISOString();
    auctionData.value = [createAuction({ endTime })];

    const { unmount } = render(<DutchAuctions />);
    const liveRegion = document.getElementById('auction-announcer-live-region');

    // On mount and subsequent ticks, 5m milestone should not fire because it was already crossed prior to mount
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(liveRegion).toHaveTextContent('');

    unmount();

    // Remount
    render(<DutchAuctions />);
    const remountLiveRegion = document.getElementById('auction-announcer-live-region');
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(remountLiveRegion).toHaveTextContent('');
  });
});
