import { describe, it, expect } from 'vitest';
import type { DutchAuction } from '../types/dutchAuction';
import {
  sortAuctions,
} from './dutch-auction-sort';

function makeAuction(overrides: Partial<DutchAuction> & { id: string }): DutchAuction {
  const baseTime = 1_000_000;
  const { id, ...rest } = overrides;
  return {
    id,
    nft: {
      id: `NFT-${id}`,
      name: `NFT ${id}`,
      description: 'Test auction',
      image: 'https://example.com/nft.png',
      collection: 'Test Collection',
      tokenId: id,
    },
    seller: 'GSELLER123',
    startPrice: overrides.startPrice ?? 100,
    floorPrice: overrides.floorPrice ?? 10,
    startTime: overrides.startTime ?? new Date(baseTime).toISOString(),
    endTime: overrides.endTime ?? new Date(baseTime + 10_000).toISOString(),
    duration: overrides.duration ?? 10,
    status: overrides.status ?? 'Active',
    ...rest,
  };
}

describe('dutch-auction-sort', () => {
  const baseTime = 1_000_000;

  describe('compareEnding', () => {
    it('orders active auctions by time remaining ascending (ending soonest first)', () => {
      const nowMs = baseTime + 2_000;
      // a ends at +10s (8s remaining)
      const a = makeAuction({ id: 'A', endTime: new Date(baseTime + 10_000).toISOString() });
      // b ends at +5s (3s remaining)
      const b = makeAuction({ id: 'B', endTime: new Date(baseTime + 5_000).toISOString() });

      const sorted = sortAuctions([a, b], 'ending', nowMs);
      expect(sorted.map((x) => x.id)).toEqual(['B', 'A']);
    });

    it('places active auctions before non-active auctions', () => {
      const nowMs = baseTime + 2_000;
      // active
      const active = makeAuction({
        id: 'active',
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });
      // completed
      const completed = makeAuction({
        id: 'completed',
        status: 'Completed',
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 5_000).toISOString(),
      });
      // scheduled (in future)
      const scheduled = makeAuction({
        id: 'scheduled',
        startTime: new Date(baseTime + 5_000).toISOString(),
        endTime: new Date(baseTime + 15_000).toISOString(),
      });

      const sorted = sortAuctions([completed, scheduled, active], 'ending', nowMs);
      expect(sorted[0].id).toBe('active');
    });

    it('breaks ties by id ascending when time remaining is equal', () => {
      const nowMs = baseTime + 2_000;
      const a = makeAuction({ id: 'DA-2', endTime: new Date(baseTime + 10_000).toISOString() });
      const b = makeAuction({ id: 'DA-1', endTime: new Date(baseTime + 10_000).toISOString() });

      const sorted = sortAuctions([a, b], 'ending', nowMs);
      expect(sorted.map((x) => x.id)).toEqual(['DA-1', 'DA-2']);
    });
  });

  describe('comparePrice', () => {
    it('orders auctions by current decayed price ascending (lowest price first)', () => {
      const nowMs = baseTime + 5_000; // halfway through 10s duration
      // a: 100 -> 0 over 10s => at 5s, price = 50
      const a = makeAuction({
        id: 'A',
        startPrice: 100,
        floorPrice: 0,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });
      // b: 200 -> 100 over 10s => at 5s, price = 150
      const b = makeAuction({
        id: 'B',
        startPrice: 200,
        floorPrice: 100,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });
      // c: 40 -> 20 over 10s => at 5s, price = 30
      const c = makeAuction({
        id: 'C',
        startPrice: 40,
        floorPrice: 20,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });

      const sorted = sortAuctions([a, b, c], 'price', nowMs);
      expect(sorted.map((x) => x.id)).toEqual(['C', 'A', 'B']);
    });

    it('re-evaluates price order as time advances', () => {
      // Auction A: fast decay (100 -> 10 over 10s, decays 9/s)
      const a = makeAuction({
        id: 'A',
        startPrice: 100,
        floorPrice: 10,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });
      // Auction B: slow decay (70 -> 60 over 10s, decays 1/s)
      const b = makeAuction({
        id: 'B',
        startPrice: 70,
        floorPrice: 60,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });

      // At t = 0s: A is 100, B is 70 -> B is lower
      const atT0 = sortAuctions([a, b], 'price', baseTime);
      expect(atT0.map((x) => x.id)).toEqual(['B', 'A']);

      // At t = 5s: A is 55, B is 65 -> A is lower
      const atT5 = sortAuctions([a, b], 'price', baseTime + 5_000);
      expect(atT5.map((x) => x.id)).toEqual(['A', 'B']);
    });

    it('breaks ties by id ascending when prices are equal', () => {
      const nowMs = baseTime;
      const a = makeAuction({ id: 'DA-Z', startPrice: 50, floorPrice: 10 });
      const b = makeAuction({ id: 'DA-A', startPrice: 50, floorPrice: 10 });

      const sorted = sortAuctions([a, b], 'price', nowMs);
      expect(sorted.map((x) => x.id)).toEqual(['DA-A', 'DA-Z']);
    });
  });

  describe('compareDiscount', () => {
    it('orders auctions by discount = (start - current) / start descending (biggest discount first)', () => {
      const nowMs = baseTime + 5_000;
      // a: 100 -> 0 over 10s, current=50 -> discount = 50%
      const a = makeAuction({
        id: 'A',
        startPrice: 100,
        floorPrice: 0,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });
      // b: 100 -> 80 over 10s, current=90 -> discount = 10%
      const b = makeAuction({
        id: 'B',
        startPrice: 100,
        floorPrice: 80,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });
      // c: 100 -> 20 over 10s, current=60 -> discount = 40%
      const c = makeAuction({
        id: 'C',
        startPrice: 100,
        floorPrice: 20,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });

      const sorted = sortAuctions([b, a, c], 'discount', nowMs);
      expect(sorted.map((x) => x.id)).toEqual(['A', 'C', 'B']);
    });

    it('breaks ties by id ascending on equal discount', () => {
      const nowMs = baseTime + 5_000;
      // Both have 50% discount at halfway point
      const a = makeAuction({
        id: 'auction-2',
        startPrice: 100,
        floorPrice: 0,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });
      const b = makeAuction({
        id: 'auction-1',
        startPrice: 200,
        floorPrice: 0,
        startTime: new Date(baseTime).toISOString(),
        endTime: new Date(baseTime + 10_000).toISOString(),
      });

      const sorted = sortAuctions([a, b], 'discount', nowMs);
      expect(sorted.map((x) => x.id)).toEqual(['auction-1', 'auction-2']);
    });
  });

  describe('immutability', () => {
    it('never mutates the input array', () => {
      const a = makeAuction({ id: 'B', startPrice: 100 });
      const b = makeAuction({ id: 'A', startPrice: 50 });
      const original = [a, b];
      const frozen = Object.freeze([...original]);

      const sorted = sortAuctions(frozen, 'price', baseTime);
      expect(sorted).not.toBe(frozen);
      expect(sorted.map((x) => x.id)).toEqual(['A', 'B']);
      expect(frozen[0].id).toBe('B');
      expect(frozen[1].id).toBe('A');
    });
  });
});
