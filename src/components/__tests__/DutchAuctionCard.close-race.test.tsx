import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DutchAuctionCard } from '../DutchAuctionCard';
import type { DutchAuction } from '../../types/dutchAuction';

const now = Date.now();

function makeAuction(overrides: Partial<DutchAuction> = {}): DutchAuction {
  return {
    id: 'DA-TEST',
    nft: {
      id: 'NFT-TEST',
      name: 'Test NFT',
      description: 'A test auction',
      image: 'https://test/img.png',
      collection: 'Test Collection',
      tokenId: '1',
    },
    seller: 'TEST...SELLER',
    startPrice: 1000,
    floorPrice: 100,
    startTime: new Date(now - 3_600_000).toISOString(),
    endTime: new Date(now + 3_600_000).toISOString(),
    duration: 7200,
    status: 'Active',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DutchAuctionCard — auction close race handling (issue #942)', () => {
  it('shows Active status and Purchase button when auction is live', () => {
    const auction = makeAuction();
    render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Purchase Now/ })).toBeInTheDocument();
  });

  it('clears the interval and removes Purchase button when auction ends mid-tick', () => {
    const auction = makeAuction({
      endTime: new Date(now + 2_000).toISOString(),
    });
    const onPurchase = vi.fn();

    render(<DutchAuctionCard auction={auction} onPurchase={onPurchase} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Purchase Now/ })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Purchase Now/ })).not.toBeInTheDocument();
  });

  it('shows "This auction has ended" notice when an Active auction expires', () => {
    const auction = makeAuction({
      status: 'Active',
      endTime: new Date(now + 1_000).toISOString(),
    });

    render(<DutchAuctionCard auction={auction} />);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(screen.getByText('This auction has ended.')).toBeInTheDocument();
  });

  it('does not show ended notice for auctions already Completed', () => {
    const auction = makeAuction({
      status: 'Completed',
      winner: 'JABCDEF...98765',
      finalPrice: 225,
      endTime: new Date(now - 3_600_000).toISOString(),
    });

    render(<DutchAuctionCard auction={auction} />);

    expect(screen.queryByText('This auction has ended.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Purchase Now/ })).not.toBeInTheDocument();
  });

  it('stops the interval after the auction ends — no leaked timers', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const auction = makeAuction({
      endTime: new Date(now + 1_500).toISOString(),
    });

    render(<DutchAuctionCard auction={auction} />);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('disables purchase during async operation and re-enables after', async () => {
    let resolvePurchase!: () => void;
    const onPurchase = vi.fn(
      () => new Promise<void>((r) => { resolvePurchase = r; }),
    );
    const auction = makeAuction();

    render(<DutchAuctionCard auction={auction} onPurchase={onPurchase} />);

    const button = screen.getByRole('button', { name: /Purchase Now/ });
    expect(button).toBeEnabled();

    act(() => {
      button.click();
    });

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Processing purchase…');

    await act(async () => {
      resolvePurchase();
    });

    expect(button).toBeEnabled();
    expect(button).toHaveTextContent(/Purchase Now/);
  });

  it('prevents double-click purchase when first is in-flight', async () => {
    let resolvePurchase!: () => void;
    const onPurchase = vi.fn(
      () => new Promise<void>((r) => { resolvePurchase = r; }),
    );
    const auction = makeAuction();

    render(<DutchAuctionCard auction={auction} onPurchase={onPurchase} />);

    const button = screen.getByRole('button', { name: /Purchase Now/ });

    act(() => {
      button.click();
    });
    act(() => {
      button.click();
    });

    expect(onPurchase).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePurchase();
    });
  });

  it('does not fire purchase when auction has ended', async () => {
    const onPurchase = vi.fn();
    const auction = makeAuction({
      endTime: new Date(now + 500).toISOString(),
    });

    render(<DutchAuctionCard auction={auction} onPurchase={onPurchase} />);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.queryByRole('button', { name: /Purchase Now/ })).not.toBeInTheDocument();
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('hides Time Left section after auction expires', () => {
    const auction = makeAuction({
      endTime: new Date(now + 1_000).toISOString(),
    });

    render(<DutchAuctionCard auction={auction} />);

    expect(screen.getByText('Time Left')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(screen.queryByText('Time Left')).not.toBeInTheDocument();
  });

  it('shows live countdown that decrements while auction is active', () => {
    const auction = makeAuction({
      endTime: new Date(now + 3_661_000).toISOString(), // 1h 1m 1s
    });

    render(<DutchAuctionCard auction={auction} />);

    const timeLeftEl = screen.getByText(/^\d{2}:\d{2}:\d{2}$/);
    const initialText = timeLeftEl.textContent;

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    const updatedText = screen.getByText(/^\d{2}:\d{2}:\d{2}$/).textContent;
    expect(updatedText).not.toBe(initialText);
  });
});
