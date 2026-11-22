import { describe, it, expect } from 'vitest';
import { getEffectiveStatus } from './dutch-auction-lifecycle';
import type { DutchAuction } from '../types/dutchAuction';

function createAuction(
  status: 'Active' | 'Completed' | 'Cancelled',
  startOffset: number,
  endOffset: number
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
  };
}

describe('getEffectiveStatus', () => {
  it('returns Scheduled when now < startTime and payload is Active', () => {
    const now = Date.now();
    const auction = createAuction('Active', 3600000, 7200000); // starts in 1 hour
    expect(getEffectiveStatus(auction, now)).toBe('Scheduled');
  });

  it('returns Active when inside the time window', () => {
    const now = Date.now();
    const auction = createAuction('Active', -1800000, 3600000); // started 30 min ago, ends in 1 hour
    expect(getEffectiveStatus(auction, now)).toBe('Active');
  });

  it('returns Ended when now >= endTime and payload is Active', () => {
    const now = Date.now();
    const auction = createAuction('Active', -7200000, -3600000); // ended 1 hour ago
    expect(getEffectiveStatus(auction, now)).toBe('Ended');
  });

  it('returns Completed when payload is Completed, regardless of time', () => {
    const now = Date.now();
    const auctionFuture = createAuction('Completed', 3600000, 7200000);
    expect(getEffectiveStatus(auctionFuture, now)).toBe('Completed');

    const auctionPast = createAuction('Completed', -7200000, -3600000);
    expect(getEffectiveStatus(auctionPast, now)).toBe('Completed');
  });

  it('returns Cancelled when payload is Cancelled, regardless of time', () => {
    const now = Date.now();
    const auctionFuture = createAuction('Cancelled', 3600000, 7200000);
    expect(getEffectiveStatus(auctionFuture, now)).toBe('Cancelled');

    const auctionScheduled = createAuction('Cancelled', 1800000, 5400000);
    expect(getEffectiveStatus(auctionScheduled, now)).toBe('Cancelled');

    const auctionActive = createAuction('Cancelled', -1800000, 1800000);
    expect(getEffectiveStatus(auctionActive, now)).toBe('Cancelled');
  });

  it('transitions from Scheduled to Active as time advances', () => {
    const auction = createAuction('Active', 1000, 5000); // starts in 1s, ends in 5s
    const now = Date.now();

    expect(getEffectiveStatus(auction, now)).toBe('Scheduled');
    expect(getEffectiveStatus(auction, now + 500)).toBe('Scheduled');
    expect(getEffectiveStatus(auction, now + 1000)).toBe('Active');
    expect(getEffectiveStatus(auction, now + 3000)).toBe('Active');
  });

  it('transitions from Active to Ended as time advances', () => {
    const auction = createAuction('Active', -2000, 2000); // started 2s ago, ends in 2s
    const now = Date.now();

    expect(getEffectiveStatus(auction, now)).toBe('Active');
    expect(getEffectiveStatus(auction, now + 1999)).toBe('Active');
    expect(getEffectiveStatus(auction, now + 2000)).toBe('Ended');
    expect(getEffectiveStatus(auction, now + 5000)).toBe('Ended');
  });

  it('handles boundary conditions at startTime', () => {
    const now = Date.now();
    const auction = createAuction('Active', 0, 3600000);

    expect(getEffectiveStatus(auction, now - 1)).toBe('Scheduled');
    expect(getEffectiveStatus(auction, now)).toBe('Active');
    expect(getEffectiveStatus(auction, now + 1)).toBe('Active');
  });

  it('handles boundary conditions at endTime', () => {
    const now = Date.now();
    const auction = createAuction('Active', -3600000, 0);

    expect(getEffectiveStatus(auction, now - 1)).toBe('Active');
    expect(getEffectiveStatus(auction, now)).toBe('Ended');
    expect(getEffectiveStatus(auction, now + 1)).toBe('Ended');
  });
});
