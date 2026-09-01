import { describe, it, expect } from 'vitest';
import { computeEffectiveStatus } from '../dutchAuction';
import type { DutchAuction } from '../dutchAuction';

const now = Date.now();

function auction(overrides: Partial<DutchAuction> = {}): DutchAuction {
  return {
    id: 'DA-TEST',
    nft: {
      id: 'NFT-TEST',
      name: 'Test NFT',
      description: 'Test',
      image: 'https://test/img.png',
      collection: 'Test',
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

describe('computeEffectiveStatus', () => {
  it('returns Active when status is Active and endTime is in the future', () => {
    const a = auction({ status: 'Active', endTime: new Date(now + 3_600_000).toISOString() });
    expect(computeEffectiveStatus(a, now)).toBe('Active');
  });

  it('returns Completed when status is Active but endTime has passed', () => {
    const a = auction({ status: 'Active', endTime: new Date(now - 1_000).toISOString() });
    expect(computeEffectiveStatus(a, now)).toBe('Completed');
  });

  it('returns Completed exactly at endTime boundary', () => {
    const endTime = new Date(now).toISOString();
    const a = auction({ status: 'Active', endTime });
    expect(computeEffectiveStatus(a, now)).toBe('Completed');
  });

  it('returns Active one millisecond before endTime', () => {
    const a = auction({ status: 'Active', endTime: new Date(now + 1).toISOString() });
    expect(computeEffectiveStatus(a, now)).toBe('Active');
  });

  it('returns Completed as-is when stored status is already Completed', () => {
    const a = auction({ status: 'Completed', endTime: new Date(now + 3_600_000).toISOString() });
    expect(computeEffectiveStatus(a, now)).toBe('Completed');
  });

  it('returns Cancelled as-is when stored status is Cancelled', () => {
    const a = auction({ status: 'Cancelled', endTime: new Date(now + 3_600_000).toISOString() });
    expect(computeEffectiveStatus(a, now)).toBe('Cancelled');
  });

  it('treats an Active auction with a far-future endTime as still Active', () => {
    const a = auction({ status: 'Active', endTime: new Date(now + 86_400_000).toISOString() });
    expect(computeEffectiveStatus(a, now)).toBe('Active');
  });

  it('handles the race: Active status but endTime already passed', () => {
    const a = auction({ status: 'Active', endTime: new Date(now - 100).toISOString() });
    expect(computeEffectiveStatus(a, now)).toBe('Completed');
  });
});
