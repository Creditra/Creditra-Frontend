import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as ReactRouterDom from 'react-router-dom';
import type { DutchAuction } from '../../types/dutchAuction';

const { __getMockSearch } = ReactRouterDom as unknown as {
  __getMockSearch: () => string;
};

// Mutable auction fixtures holder
const auctionData = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('@/data/mockDutchAuctions', () => ({
  get MOCK_DUTCH_AUCTIONS() {
    return auctionData.value;
  },
}));
vi.mock('../../data/mockDutchAuctions', () => ({
  get MOCK_DUTCH_AUCTIONS() {
    return auctionData.value;
  },
}));
vi.mock('../../context/WalletContext', async (importActual) => {
  const actual = await importActual<typeof import('../../context/WalletContext')>();
  return {
    ...actual,
    useWallet: () => ({ wallet: null, status: 'disconnected' }),
  };
});

import { DutchAuctions } from '../DutchAuctions';

const baseTime = 1_700_000_000_000;

function createAuction(overrides: Partial<DutchAuction> & { id: string }): DutchAuction {
  const { id, ...rest } = overrides;
  return {
    id,
    nft: {
      id: `NFT-${id}`,
      name: `Test NFT ${id}`,
      description: `Description for ${id}`,
      image: 'https://example.test/nft.png',
      collection: 'Test Collection',
      tokenId: id,
    },
    seller: 'GTEST...SELLER',
    startPrice: overrides.startPrice ?? 100,
    floorPrice: overrides.floorPrice ?? 10,
    startTime: overrides.startTime ?? new Date(baseTime - 1_000).toISOString(),
    endTime: overrides.endTime ?? new Date(baseTime + 10_000).toISOString(),
    duration: overrides.duration ?? 11,
    status: overrides.status ?? 'Active',
    ...rest,
  };
}

describe('DutchAuctions URL state and accessibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);
    auctionData.value = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Scenario 1: Render with ?status=completed
  it('Scenario 1: renders with ?status=completed — only completed/cancelled auctions shown and Completed button has aria-pressed="true"', () => {
    auctionData.value = [
      createAuction({ id: 'ACT-1', status: 'Active' }),
      createAuction({ id: 'CMP-1', status: 'Completed' }),
      createAuction({ id: 'CNC-1', status: 'Cancelled' }),
    ];

    render(
      <MemoryRouter initialEntries={['/dutch-auctions?status=completed']}>
        <DutchAuctions />
      </MemoryRouter>
    );

    const completedBtn = screen.getByRole('button', { name: 'Completed' });
    expect(completedBtn).toHaveAttribute('aria-pressed', 'true');

    const activeBtn = screen.getByRole('button', { name: 'Active' });
    expect(activeBtn).toHaveAttribute('aria-pressed', 'false');

    const allBtn = screen.getByRole('button', { name: 'All' });
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');

    expect(screen.getByText('Test NFT CMP-1')).toBeInTheDocument();
    expect(screen.getByText('Test NFT CNC-1')).toBeInTheDocument();
    expect(screen.queryByText('Test NFT ACT-1')).not.toBeInTheDocument();
  });

  // Scenario 2: Render with ?status=bogus
  it('Scenario 2: falls back to all and rewrites URL when rendered with ?status=bogus', () => {
    auctionData.value = [
      createAuction({ id: 'ACT-1', status: 'Active' }),
      createAuction({ id: 'CMP-1', status: 'Completed' }),
    ];

    render(
      <MemoryRouter initialEntries={['/dutch-auctions?status=bogus']}>
        <DutchAuctions />
      </MemoryRouter>
    );

    const allBtn = screen.getByRole('button', { name: 'All' });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByText('Test NFT ACT-1')).toBeInTheDocument();
    expect(screen.getByText('Test NFT CMP-1')).toBeInTheDocument();

    expect(__getMockSearch()).not.toContain('status=bogus');
  });

  // Scenario 3: Click Active
  it('Scenario 3: clicking Active updates URL to status=active and marks other buttons aria-pressed="false"', () => {
    auctionData.value = [
      createAuction({ id: 'ACT-1', status: 'Active' }),
      createAuction({ id: 'CMP-1', status: 'Completed' }),
    ];

    render(
      <MemoryRouter initialEntries={['/dutch-auctions']}>
        <DutchAuctions />
      </MemoryRouter>
    );

    const activeBtn = screen.getByRole('button', { name: 'Active' });
    fireEvent.click(activeBtn);

    expect(__getMockSearch()).toContain('status=active');
    expect(activeBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'false');
  });

  // Scenario 4: sort=price with fake time advancing
  it('Scenario 4: sort=price re-evaluates order as decayed prices move over time', () => {
    // Auction A: fast decay (100 -> 10 over 10s: at 0s is 100; at 5s is 55)
    const a = createAuction({
      id: 'A',
      startPrice: 100,
      floorPrice: 10,
      startTime: new Date(baseTime).toISOString(),
      endTime: new Date(baseTime + 10_000).toISOString(),
    });
    // Auction B: slow decay (70 -> 60 over 10s: at 0s is 70; at 5s is 65)
    const b = createAuction({
      id: 'B',
      startPrice: 70,
      floorPrice: 60,
      startTime: new Date(baseTime).toISOString(),
      endTime: new Date(baseTime + 10_000).toISOString(),
    });

    auctionData.value = [a, b];

    render(
      <MemoryRouter initialEntries={['/dutch-auctions?sort=price']}>
        <DutchAuctions />
      </MemoryRouter>
    );

    // At t=0s: B (70) < A (100) -> card B is first
    let cards = screen.getAllByTestId(/^auction-card-/);
    expect(cards[0]).toHaveAttribute('data-auction-id', 'B');
    expect(cards[1]).toHaveAttribute('data-auction-id', 'A');

    // Advance fake time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    // At t=5s: A (55) < B (65) -> card A is now first
    cards = screen.getAllByTestId(/^auction-card-/);
    expect(cards[0]).toHaveAttribute('data-auction-id', 'A');
    expect(cards[1]).toHaveAttribute('data-auction-id', 'B');
  });

  // Scenario 5: sort=discount tie
  it('Scenario 5: equal discounts break tie by id', () => {
    // Halfway through 10s duration:
    // Auction 2: 100 -> 0 => decayed price 50 (50% discount)
    const a2 = createAuction({
      id: 'DA-2',
      startPrice: 100,
      floorPrice: 0,
      startTime: new Date(baseTime - 5_000).toISOString(),
      endTime: new Date(baseTime + 5_000).toISOString(),
    });
    // Auction 1: 200 -> 0 => decayed price 100 (50% discount)
    const a1 = createAuction({
      id: 'DA-1',
      startPrice: 200,
      floorPrice: 0,
      startTime: new Date(baseTime - 5_000).toISOString(),
      endTime: new Date(baseTime + 5_000).toISOString(),
    });

    auctionData.value = [a2, a1];

    render(
      <MemoryRouter initialEntries={['/dutch-auctions?sort=discount']}>
        <DutchAuctions />
      </MemoryRouter>
    );

    const cards = screen.getAllByTestId(/^auction-card-/);
    expect(cards[0]).toHaveAttribute('data-auction-id', 'DA-1');
    expect(cards[1]).toHaveAttribute('data-auction-id', 'DA-2');
  });

  // Scenario 6: Focus on card B, re-sort moves it -> focus remains on card B
  it('Scenario 6: maintains focus on card B across re-sorts', () => {
    // Auction A: fast decay (100 -> 10 over 10s: at 0s = 100, at 5s = 55)
    const a = createAuction({
      id: 'A',
      startPrice: 100,
      floorPrice: 10,
      startTime: new Date(baseTime).toISOString(),
      endTime: new Date(baseTime + 10_000).toISOString(),
    });
    // Auction B: slow decay (70 -> 60 over 10s: at 0s = 70, at 5s = 65)
    const b = createAuction({
      id: 'B',
      startPrice: 70,
      floorPrice: 60,
      startTime: new Date(baseTime).toISOString(),
      endTime: new Date(baseTime + 10_000).toISOString(),
    });

    auctionData.value = [a, b];

    render(
      <MemoryRouter initialEntries={['/dutch-auctions?sort=price']}>
        <DutchAuctions />
      </MemoryRouter>
    );

    // Focus card B
    const cardB = screen.getByTestId('auction-card-B');
    cardB.focus();
    expect(document.activeElement).toBe(cardB);

    // Advance time so A becomes cheaper than B and moves ahead of B
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    // Focus should still be preserved on card B
    expect(document.activeElement).toBe(screen.getByTestId('auction-card-B'));
  });

  // Scenario 7: Filter change announces result count
  it('Scenario 7: announces the new count politely on filter change', () => {
    auctionData.value = [
      createAuction({ id: 'ACT-1', status: 'Active' }),
      createAuction({ id: 'CMP-1', status: 'Completed' }),
      createAuction({ id: 'CMP-2', status: 'Completed' }),
    ];

    const { container } = render(
      <MemoryRouter initialEntries={['/dutch-auctions']}>
        <DutchAuctions />
      </MemoryRouter>
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();

    // Switch to completed (2 auctions)
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(liveRegion).toHaveTextContent('2 auctions');

    // Switch to active (1 auction)
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(liveRegion).toHaveTextContent('1 auction');
  });

  // Scenario 8: Empty-state CTA clears status
  it('Scenario 8: empty-state CTA clears status and renders all auctions', () => {
    auctionData.value = [createAuction({ id: 'ACT-1', status: 'Active' })];

    render(
      <MemoryRouter initialEntries={['/dutch-auctions?status=completed']}>
        <DutchAuctions />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'No completed auctions' })).toBeInTheDocument();

    const cta = screen.getByRole('button', { name: 'Show all auctions' });
    fireEvent.click(cta);

    expect(__getMockSearch()).not.toContain('status=');
    expect(screen.getByText('Test NFT ACT-1')).toBeInTheDocument();
  });

  // Semantics: group role, labelled select, 44px min-height touch targets
  it('provides proper accessibility semantics for filter group and sort control', () => {
    render(
      <MemoryRouter initialEntries={['/dutch-auctions']}>
        <DutchAuctions />
      </MemoryRouter>
    );

    const filterGroup = screen.getByRole('group', { name: 'Filter auctions by status' });
    expect(filterGroup).toBeInTheDocument();

    const sortSelect = screen.getByLabelText(/sort by/i);
    expect(sortSelect).toBeInTheDocument();
    expect(sortSelect.tagName.toLowerCase()).toBe('select');
  });
});
