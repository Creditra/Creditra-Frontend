/**
 * Issue #1213 — `/dutch-auctions/:auctionId` detail page.
 *
 * Covered here:
 *  1. a known id renders the auction (heading, schedule, prices)
 *  2. an unknown id renders the in-page "Auction not found" state
 *  3. an id longer than 64 characters is rejected before any lookup
 *  4. a percent-encoded id is decoded before it is matched
 *  5. the price chart ships a five row text alternative
 *  6. the chart is not animated when the user prefers reduced motion
 *  7. the NFT name on a list card links to the detail route
 *  8. a completed auction shows its winner and final price, without a
 *     purchase action
 *  9. the route metadata contains a pattern for the detail route
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

const routerState = vi.hoisted(() => ({ auctionId: undefined as string | undefined }));
const auctionLookup = vi.hoisted(() => ({ getAuctionById: vi.fn() }));

// `useParams` is mocked per test; everything else comes from the router stub.
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ auctionId: routerState.auctionId }),
  };
});

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({ wallet: null, status: 'disconnected' }),
}));

// The lookup is spied on so the test can prove that an oversized id never
// reaches the data layer.
vi.mock('@/data/mockDutchAuctions', async (importActual) => {
  const actual = await importActual<typeof import('@/data/mockDutchAuctions')>();
  auctionLookup.getAuctionById.mockImplementation(actual.getAuctionById);
  return { ...actual, getAuctionById: auctionLookup.getAuctionById };
});

import { MemoryRouter, matchPath } from 'react-router-dom';
import { DutchAuctionDetail } from '../DutchAuctionDetail';
import { DutchAuctionCard } from '../../components/DutchAuctionCard';
import { ROUTE_METADATA } from '../../components/RouteAnnouncer';
import { MOCK_DUTCH_AUCTIONS } from '@/data/mockDutchAuctions';
import { fromStroops, priceAt } from '../../lib/dutch-auction-pricing';
import { fmt } from '../../utils/tokens';

const renderDetail = (initialEntry = '/dutch-auctions/DA-001') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DutchAuctionDetail />
    </MemoryRouter>,
  );

const stubMatchMedia = (matches: boolean) => {
  const original = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  return () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: original,
    });
  };
};

describe('DutchAuctionDetail (issue #1213)', { timeout: 15000 }, () => {
  beforeEach(() => {
    routerState.auctionId = undefined;
    auctionLookup.getAuctionById.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the existing card plus the full schedule of a known auction', () => {
    routerState.auctionId = 'DA-001';
    renderDetail();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cosmic Ape #1234' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Start time')).toBeInTheDocument();
    expect(screen.getByText('End time')).toBeInTheDocument();
    expect(screen.getByText('Start / Floor')).toBeInTheDocument();
    expect(screen.getByText('Current Price')).toBeInTheDocument();

    // Start and floor price are rendered together from the existing card.
    expect(screen.getByText('$1,000 / $200')).toBeInTheDocument();

    // The current price tracks the linear decay and is rendered next to its
    // label.
    const currentPrice = screen.getByText('Current Price').nextElementSibling;
    expect(currentPrice).toHaveTextContent(/^\$\d/);

    // The seller is shortened for display.
    expect(screen.getByText('Seller').nextElementSibling).toHaveTextContent('GABCDE…2345');
  });

  it('renders an in-page not-found state for an unknown id', () => {
    routerState.auctionId = 'DA-999';
    renderDetail('/dutch-auctions/DA-999');

    expect(
      screen.getByRole('heading', { name: 'Auction not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to auctions' })).toHaveAttribute(
      'href',
      '/dutch-auctions',
    );

    // The global 404 copy must not be used here.
    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument();
  });

  it('treats an id longer than 64 characters as not found without looking it up', () => {
    const oversizedId = 'A'.repeat(65);
    routerState.auctionId = oversizedId;
    renderDetail(`/dutch-auctions/${oversizedId}`);

    expect(
      screen.getByRole('heading', { name: 'Auction not found' }),
    ).toBeInTheDocument();
    expect(auctionLookup.getAuctionById).not.toHaveBeenCalled();
  });

  it('decodes a percent-encoded id before matching it', () => {
    routerState.auctionId = 'DA%2D001';
    renderDetail('/dutch-auctions/DA%2D001');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cosmic Ape #1234' }),
    ).toBeInTheDocument();
  });

  it('ships a five row canonical bigint price table as the chart text alternative', () => {
    routerState.auctionId = 'DA-001';
    renderDetail();

    const auction = MOCK_DUTCH_AUCTIONS.find((item) => item.id === 'DA-001')!;
    const startMs = new Date(auction.startTime).getTime();
    const endMs = new Date(auction.endTime).getTime();
    const expectedStroops = [0, 0.25, 0.5, 0.75, 1].map((progress) =>
      priceAt(auction, startMs + progress * (endMs - startMs)).toString(),
    );

    const table = screen.getByRole('table', { hidden: true });
    expect(table).toHaveClass('sr-only');

    const rows = within(table).getAllByRole('row', { hidden: true });
    expect(rows).toHaveLength(5);

    const prices = rows.map((row) =>
      Number((row.querySelector('td')?.textContent ?? '').replace(/[^0-9.]/g, '')),
    );
    expect(prices.every((price) => Number.isFinite(price))).toBe(true);

    // Every row is the canonical priceAt value, merely formatted for display.
    expect(rows.map((row) => row.querySelector('td')?.getAttribute('data-price-stroops'))).toEqual(
      expectedStroops,
    );

    // The price never increases as the auction progresses.
    prices.forEach((price, index) => {
      if (index === 0) return;
      expect(price).toBeLessThanOrEqual(prices[index - 1]);
    });
  });

  it('quotes the same canonical price in the card and the chart', () => {
    const fixedNow = Date.now();
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    try {
      routerState.auctionId = 'DA-001';
      const { container } = renderDetail();
      const auction = MOCK_DUTCH_AUCTIONS.find((item) => item.id === 'DA-001')!;
      const expectedStroops = priceAt(auction, fixedNow);

      const marker = container.querySelector('.dutch-auction-chart__now-dot');
      expect(marker?.getAttribute('data-price-stroops')).toBe(expectedStroops.toString());

      const cardPrice = screen.getByText('Current Price').nextElementSibling;
      expect(cardPrice).toHaveTextContent(fmt(fromStroops(expectedStroops)));
    } finally {
      dateSpy.mockRestore();
    }
  });

  it('does not animate the chart when the user prefers reduced motion', () => {
    const restore = stubMatchMedia(true);
    try {
      routerState.auctionId = 'DA-001';
      const { container } = renderDetail();

      const line = container.querySelector('.dutch-auction-chart__line');
      expect(line).not.toBeNull();
      expect(line?.classList.contains('dutch-auction-chart__line--animated')).toBe(false);
    } finally {
      restore();
    }
  });

  it('animates the chart when motion is allowed', () => {
    const restore = stubMatchMedia(false);
    try {
      routerState.auctionId = 'DA-001';
      const { container } = renderDetail();

      const line = container.querySelector('.dutch-auction-chart__line');
      expect(line?.classList.contains('dutch-auction-chart__line--animated')).toBe(true);
    } finally {
      restore();
    }
  });

  it('links the NFT name on a list card to the detail route', () => {
    const auction = MOCK_DUTCH_AUCTIONS[0];

    render(
      <MemoryRouter initialEntries={['/dutch-auctions']}>
        <DutchAuctionCard auction={auction} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Cosmic Ape #1234' })).toHaveAttribute(
      'href',
      '/dutch-auctions/DA-001',
    );
  });

  it('carries the list query string into the detail link for back navigation', () => {
    const auction = MOCK_DUTCH_AUCTIONS[0];

    render(
      <MemoryRouter initialEntries={['/dutch-auctions?status=active']}>
        <DutchAuctionCard auction={auction} listSearch="?status=active" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Cosmic Ape #1234' })).toHaveAttribute(
      'href',
      '/dutch-auctions/DA-001?from=%2Fdutch-auctions%3Fstatus%3Dactive',
    );
  });

  it('shows the winner and the final price of a completed auction without a purchase action', () => {
    routerState.auctionId = 'DA-003';
    renderDetail('/dutch-auctions/DA-003');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cyber Punk #890' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Winner')).toBeInTheDocument();
    expect(screen.getByText('JABCDE...8765')).toBeInTheDocument();

    const schedule = screen.getByRole('region', { name: 'Schedule' });
    expect(within(schedule).getByText('Final price')).toBeInTheDocument();
    expect(within(schedule).getByText('$225')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /purchase now/i }),
    ).not.toBeInTheDocument();
  });

  it('registers a route pattern for the detail page', () => {
    const matched = ROUTE_METADATA.find((route) =>
      matchPath({ path: route.path, end: true }, '/dutch-auctions/DA-001'),
    );

    expect(matched).toBeDefined();
    expect(matched?.path).toBe('/dutch-auctions/:auctionId');
  });
});
