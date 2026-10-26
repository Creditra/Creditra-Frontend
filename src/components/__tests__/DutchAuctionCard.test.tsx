import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DutchAuctionCard } from '../DutchAuctionCard';
import type { DutchAuction } from '../../types/dutchAuction';
import { useWallet } from '../../context/WalletContext';
import { EXPECTED_NETWORK } from '../../utils/wallet';
import { priceAt, toStroops } from '../../lib/dutch-auction-pricing';
import { MOCK_DUTCH_AUCTIONS } from '../../data/mockDutchAuctions';

// Mock WalletContext
vi.mock('../../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

describe('DutchAuctionCard', () => {
  const fixedNow = 1_700_000_000_000;
  const mockUseWallet = vi.mocked(useWallet);

  const baseAuction: DutchAuction = {
    id: 'AUCTION-101',
    nft: {
      id: 'NFT-101',
      name: 'Soroban Collateral Pass',
      description: 'Exclusive collateral liquidation ticket',
      image: 'https://example.com/nft.png',
      collection: 'Stellar Artisans',
      tokenId: '101',
    },
    seller: 'GDSELLER1234567890',
    startPrice: 1000,
    floorPrice: 200,
    startTime: new Date(fixedNow - 60_000).toISOString(), // started 1 min ago
    endTime: new Date(fixedNow + 600_000).toISOString(), // ends in 10 min
    duration: 660,
    status: 'Active',
  };

  const connectedBuyer = {
    wallet: {
      publicKey: 'GDBUYER987654321',
      network: EXPECTED_NETWORK,
      type: 'freighter' as const,
    },
    status: 'connected' as const,
    connect: vi.fn(),
    disconnect: vi.fn(),
    balances: null,
    lastUpdated: null,
    refreshBalance: vi.fn(),
    setDropdownOpen: vi.fn(),
    forgetRememberedChoice: vi.fn(),
    isRemembered: false,
    hasNetworkMismatch: false,
    switchNetwork: vi.fn(),
    clearError: vi.fn(),
    dismissReconnectBanner: vi.fn(),
    retryReconnect: vi.fn(),
    reconnectTimedOut: false,
    error: null,
  };

  let dateSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    mockUseWallet.mockReturnValue(connectedBuyer as any);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('renders a valid active auction with correct information and purchase button', () => {
    render(<DutchAuctionCard auction={baseAuction} />);

    expect(screen.getByText('Soroban Collateral Pass')).toBeInTheDocument();
    expect(screen.getByText(/Stellar Artisans · Token #101/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Purchase Now for/i })).toBeInTheDocument();
    expect(screen.getByText(/\$1,000\s*\/\s*\$200/)).toBeInTheDocument();
  });

  // Scenario 4: startTime === endTime
  it('displays "Pricing unavailable" and omits the purchase button when startTime === endTime (Scenario 4)', () => {
    const degenerateAuction: DutchAuction = {
      ...baseAuction,
      startTime: '2026-10-20T10:00:00.000Z',
      endTime: '2026-10-20T10:00:00.000Z',
    };

    render(<DutchAuctionCard auction={degenerateAuction} />);

    expect(screen.getByText(/Pricing unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/\(non_positive_duration\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase/i })).not.toBeInTheDocument();
  });

  // Scenario 5: Invalid ISO string in endTime
  it('displays "Pricing unavailable" and renders no NaN when endTime is invalid (Scenario 5)', () => {
    const invalidDateAuction: DutchAuction = {
      ...baseAuction,
      endTime: 'invalid-iso-date-string',
    };

    const { container } = render(<DutchAuctionCard auction={invalidDateAuction} />);

    expect(screen.getByText(/Pricing unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/\(invalid_time\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase/i })).not.toBeInTheDocument();

    // Verify regression proof: no NaN anywhere in the rendered text content
    expect(container.textContent).not.toContain('NaN');
  });

  // Scenario 6: floorPrice > startPrice
  it('displays "Pricing unavailable" and omits the purchase button when floorPrice > startPrice (Scenario 6)', () => {
    const invertedPriceAuction: DutchAuction = {
      ...baseAuction,
      startPrice: 200,
      floorPrice: 500,
    };

    render(<DutchAuctionCard auction={invertedPriceAuction} />);

    expect(screen.getByText(/Pricing unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/\(floor_above_start\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase/i })).not.toBeInTheDocument();
  });

  it('displays "Pricing unavailable" when price is negative', () => {
    const negativePriceAuction: DutchAuction = {
      ...baseAuction,
      startPrice: -100,
    };

    render(<DutchAuctionCard auction={negativePriceAuction} />);

    expect(screen.getByText(/Pricing unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/\(negative_price\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase/i })).not.toBeInTheDocument();
  });

  // Scenario 9: Card purchase click passes bigint equal to priceAt at click time
  it('calls onPurchase with the exact bigint stroops price on button click (Scenario 9)', async () => {
    const onPurchaseMock = vi.fn().mockResolvedValue(undefined);
    render(<DutchAuctionCard auction={baseAuction} onPurchase={onPurchaseMock} />);

    const purchaseButton = screen.getByRole('button', { name: /Purchase Now for/i });
    expect(purchaseButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(purchaseButton);
    });

    expect(onPurchaseMock).toHaveBeenCalledTimes(1);
    const [calledAuctionId, calledPriceStroops] = onPurchaseMock.mock.calls[0];

    expect(calledAuctionId).toBe(baseAuction.id);
    expect(typeof calledPriceStroops).toBe('bigint');

    // Expected price calculated at fixedNow
    const expectedPriceAtClick = priceAt(baseAuction, fixedNow);
    expect(calledPriceStroops).toBeGreaterThanOrEqual(toStroops(baseAuction.floorPrice));
    expect(calledPriceStroops).toBeLessThanOrEqual(toStroops(baseAuction.startPrice));
    expect(calledPriceStroops).toBe(expectedPriceAtClick);

    // LiveRegion feedback
    expect(await screen.findByText(/Purchased auction AUCTION-101/i)).toBeInTheDocument();
  });

  it('blocks purchases on the wrong network and explains why', () => {
    const onPurchaseMock = vi.fn();
    mockUseWallet.mockReturnValue({
      ...connectedBuyer,
      wallet: {
        ...connectedBuyer.wallet,
        network: 'PUBLIC',
      },
    } as any);

    render(<DutchAuctionCard auction={baseAuction} onPurchase={onPurchaseMock} />);

    const button = screen.getByRole('button', { name: /Purchase Now for/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(`Switch to ${EXPECTED_NETWORK} to buy`)).toBeInTheDocument();

    fireEvent.click(button);
    expect(onPurchaseMock).not.toHaveBeenCalled();
  });

  it('blocks the seller from buying their own auction', () => {
    const onPurchaseMock = vi.fn();
    mockUseWallet.mockReturnValue({
      ...connectedBuyer,
      wallet: {
        ...connectedBuyer.wallet,
        publicKey: baseAuction.seller,
      },
    } as any);

    render(<DutchAuctionCard auction={baseAuction} onPurchase={onPurchaseMock} />);

    const button = screen.getByRole('button', { name: /Purchase Now for/i });
    expect(button).toBeDisabled();
    expect(screen.getByText('You are the seller')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onPurchaseMock).not.toHaveBeenCalled();
  });

  it('does not purchase without a connected wallet', () => {
    const onPurchaseMock = vi.fn();
    mockUseWallet.mockReturnValue({ wallet: null, status: 'disconnected' } as any);

    render(<DutchAuctionCard auction={baseAuction} onPurchase={onPurchaseMock} />);

    const button = screen.getByRole('button', { name: 'Connect wallet to buy' });
    fireEvent.click(button);

    expect(onPurchaseMock).not.toHaveBeenCalled();
  });
});

function renderCard() {
  return render(<DutchAuctionCard auction={MOCK_DUTCH_AUCTIONS[0]} />);
}

describe('DutchAuctionCard price alerts', () => {
  beforeEach(() => {
    vi.mocked(useWallet).mockReturnValue({ wallet: null, status: 'disconnected' } as any);
  });
  afterEach(() => localStorage.clear());

  it.each(['100', '900', '-5', '1e3', '1.12345678'])('rejects invalid target %s without storing it', value => {
    renderCard();
    fireEvent.change(screen.getByLabelText(/notify me at/i), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Target must be between');
    expect(localStorage.getItem('creditra_auction_alerts_v1')).toBeNull();
  });

  it('saves a target at the floor and offers removal', () => {
    renderCard();
    fireEvent.change(screen.getByLabelText(/notify me at/i), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Alert at $200.00')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('creditra_auction_alerts_v1') || '[]')[0].targetStroops).toBe(2_000_000_000);
  });
});
