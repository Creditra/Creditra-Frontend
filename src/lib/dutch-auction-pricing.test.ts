import { describe, it, expect } from 'vitest';
import {
  toStroops,
  fromStroops,
  validateSchedule,
  priceAt,
  STROOPS_PER_UNIT,
} from './dutch-auction-pricing';

describe('dutch-auction-pricing', () => {
  describe('toStroops and fromStroops', () => {
    it('converts decimal amounts to integer stroops', () => {
      expect(toStroops(1)).toBe(10_000_000n);
      expect(toStroops(0.3)).toBe(3_000_000n);
      expect(toStroops(0.1)).toBe(1_000_000n);
      expect(toStroops(0.0000001)).toBe(1n);
      expect(toStroops(0)).toBe(0n);
    });

    it('converts stroops back to floating-point units', () => {
      expect(fromStroops(10_000_000n)).toBe(1);
      expect(fromStroops(3_000_000n)).toBe(0.3);
      expect(fromStroops(1_000_000n)).toBe(0.1);
      expect(fromStroops(1n)).toBe(0.0000001);
      expect(fromStroops(0n)).toBe(0);
    });

    it('rejects non-finite and negative numbers', () => {
      expect(() => toStroops(NaN)).toThrow(TypeError);
      expect(() => toStroops(Infinity)).toThrow(TypeError);
      expect(() => toStroops(-Infinity)).toThrow(TypeError);
      expect(() => toStroops(-1)).toThrow(TypeError);
      expect(() => toStroops(-0.0001)).toThrow(TypeError);
    });
  });

  describe('validateSchedule', () => {
    const validAuction = {
      startTime: '2026-10-20T00:00:00.000Z',
      endTime: '2026-10-20T02:00:00.000Z',
      startPrice: 100,
      floorPrice: 20,
    };

    it('accepts valid auction schedules', () => {
      expect(validateSchedule(validAuction)).toEqual({ ok: true });
    });

    // Scenario 4: startTime === endTime
    it('rejects schedules with zero or negative duration as non_positive_duration (Scenario 4)', () => {
      const zeroDuration = {
        ...validAuction,
        startTime: '2026-10-20T00:00:00.000Z',
        endTime: '2026-10-20T00:00:00.000Z',
      };
      expect(validateSchedule(zeroDuration)).toEqual({
        ok: false,
        reason: 'non_positive_duration',
      });

      const invertedTime = {
        ...validAuction,
        startTime: '2026-10-20T02:00:00.000Z',
        endTime: '2026-10-20T01:00:00.000Z',
      };
      expect(validateSchedule(invertedTime)).toEqual({
        ok: false,
        reason: 'non_positive_duration',
      });
    });

    // Scenario 5: Invalid ISO string in endTime
    it('rejects invalid ISO date strings as invalid_time (Scenario 5)', () => {
      const invalidEnd = {
        ...validAuction,
        endTime: 'not-a-valid-date',
      };
      expect(validateSchedule(invalidEnd)).toEqual({
        ok: false,
        reason: 'invalid_time',
      });

      const invalidStart = {
        ...validAuction,
        startTime: 'invalid-iso-string',
      };
      expect(validateSchedule(invalidStart)).toEqual({
        ok: false,
        reason: 'invalid_time',
      });
    });

    // Scenario 6: floorPrice > startPrice
    it('rejects floor price above start price as floor_above_start (Scenario 6)', () => {
      const invertedPrices = {
        ...validAuction,
        startPrice: 50,
        floorPrice: 100,
      };
      expect(validateSchedule(invertedPrices)).toEqual({
        ok: false,
        reason: 'floor_above_start',
      });
    });

    it('rejects negative or non-finite prices as negative_price', () => {
      expect(validateSchedule({ ...validAuction, startPrice: -10 })).toEqual({
        ok: false,
        reason: 'negative_price',
      });
      expect(validateSchedule({ ...validAuction, floorPrice: -5 })).toEqual({
        ok: false,
        reason: 'negative_price',
      });
      expect(validateSchedule({ ...validAuction, startPrice: NaN })).toEqual({
        ok: false,
        reason: 'negative_price',
      });
      expect(validateSchedule({ ...validAuction, floorPrice: Infinity })).toEqual({
        ok: false,
        reason: 'negative_price',
      });
    });
  });

  describe('priceAt', () => {
    const startMs = 1_700_000_000_000;
    const durationMs = 2 * 60 * 60 * 1000; // 2 hours
    const endMs = startMs + durationMs;
    const auction = {
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      startPrice: 100,
      floorPrice: 20,
    };

    // Scenario 1: now before startTime
    it('returns start price in stroops when now is before startTime (Scenario 1)', () => {
      const price = priceAt(auction, startMs - 1000);
      expect(price).toBe(100n * STROOPS_PER_UNIT);
    });

    // Scenario 2: now after endTime
    it('returns floor price in stroops when now is after endTime (Scenario 2)', () => {
      const price = priceAt(auction, endMs + 5000);
      expect(price).toBe(20n * STROOPS_PER_UNIT);
    });

    // Scenario 3: Exactly halfway
    it('returns (start + floor) / 2 rounded up to next stroop when exactly halfway (Scenario 3)', () => {
      // Case 1: Even sum in stroops
      const halfwayMs = startMs + durationMs / 2;
      const price = priceAt(auction, halfwayMs);
      expect(price).toBe(60n * STROOPS_PER_UNIT);

      // Case 2: Odd sum in stroops -> tests ceiling rounding up
      const oddAuction = {
        ...auction,
        startPrice: 1.0000001, // 10,000,001 stroops
        floorPrice: 1.0000000, // 10,000,000 stroops
      };
      // Halfway continuous is 10,000,000.5 stroops -> rounds UP to 10,000,001 stroops
      const oddPrice = priceAt(oddAuction, halfwayMs);
      expect(oddPrice).toBe(10_000_001n);
    });

    // Scenario 7: Float trap
    it('accurately computes float trap without precision loss (Scenario 7)', () => {
      const floatTrapAuction = {
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        startPrice: 0.3,
        floorPrice: 0.1,
      };
      const halfwayMs = startMs + durationMs / 2;
      const price = priceAt(floatTrapAuction, halfwayMs);
      expect(price).toBe(2_000_000n);
    });

    it('throws if called with an invalid schedule or non-finite nowMs', () => {
      const invalidAuction = {
        ...auction,
        startPrice: -10,
      };
      expect(() => priceAt(invalidAuction, startMs)).toThrow(
        /Cannot compute price for invalid auction schedule: negative_price/,
      );
      expect(() => priceAt(auction, NaN)).toThrow(TypeError);
    });

    // Scenario 8: Property test (500 samples)
    it('maintains monotonicity and boundedness across 500 random valid schedules (Scenario 8)', () => {
      for (let i = 0; i < 500; i++) {
        const randStartPrice = Math.random() * 5000 + 0.1;
        const randFloorPrice = Math.random() * randStartPrice;
        const randStartMs = 1_700_000_000_000 + Math.floor(Math.random() * 1_000_000);
        const randDuration = Math.floor(Math.random() * 1_000_000) + 1_000;
        const randEndMs = randStartMs + randDuration;

        const testAuction = {
          startTime: new Date(randStartMs).toISOString(),
          endTime: new Date(randEndMs).toISOString(),
          startPrice: randStartPrice,
          floorPrice: randFloorPrice,
        };

        const startStroops = toStroops(randStartPrice);
        const floorStroops = toStroops(randFloorPrice);

        // Sample points before, during, and after
        const samplePoints = [
          randStartMs - 1000,
          randStartMs,
          randStartMs + Math.floor(randDuration * 0.1),
          randStartMs + Math.floor(randDuration * 0.25),
          randStartMs + Math.floor(randDuration * 0.5),
          randStartMs + Math.floor(randDuration * 0.75),
          randStartMs + Math.floor(randDuration * 0.9),
          randEndMs,
          randEndMs + 1000,
        ].sort((a, b) => a - b);

        let previousPrice: bigint | null = null;
        for (const t of samplePoints) {
          const currentPrice = priceAt(testAuction, t);

          // Boundedness
          expect(currentPrice).toBeGreaterThanOrEqual(floorStroops);
          expect(currentPrice).toBeLessThanOrEqual(startStroops);

          // Monotonicity: price never increases over time
          if (previousPrice !== null) {
            expect(currentPrice).toBeLessThanOrEqual(previousPrice);
          }
          previousPrice = currentPrice;
        }
      }
    });
  });
});
