/**
 * Tests for quoteDraw adapter function
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { quoteDraw } from '../adapter';
import { CreditDataError } from '../errors';
import * as mockData from '../../../data/mockData';

describe('quoteDraw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a quote with all required fields', async () => {
    const quote = await quoteDraw('mock-owner', 'CL-2024-001', 10000);

    expect(quote).toHaveProperty('quoteId');
    expect(quote).toHaveProperty('apr');
    expect(quote).toHaveProperty('fee');
    expect(quote).toHaveProperty('estimatedMonthlyInterest');
    expect(quote).toHaveProperty('riskBand');
    expect(quote).toHaveProperty('termMonths');
    expect(quote).toHaveProperty('adjustments');
    expect(quote).toHaveProperty('expiresAt');
  });

  it('generates a unique quoteId', async () => {
    const quote1 = await quoteDraw('mock-owner', 'CL-2024-001', 10000);
    const quote2 = await quoteDraw('mock-owner', 'CL-2024-001', 10000);

    expect(quote1.quoteId).not.toBe(quote2.quoteId);
    expect(quote1.quoteId).toMatch(/^QUOTE-/);
    expect(quote2.quoteId).toMatch(/^QUOTE-/);
  });

  it('computes expiry with default TTL of 60 seconds', async () => {
    const before = Date.now();
    const quote = await quoteDraw('mock-owner', 'CL-2024-001', 10000);
    const after = Date.now();

    const expiryTime = new Date(quote.expiresAt).getTime();
    const expectedMin = before + 59000; // 59s (allowing 1s for execution)
    const expectedMax = after + 61000; // 61s

    expect(expiryTime).toBeGreaterThanOrEqual(expectedMin);
    expect(expiryTime).toBeLessThanOrEqual(expectedMax);
  });

  it('computes expiry with custom TTL', async () => {
    const before = Date.now();
    const quote = await quoteDraw('mock-owner', 'CL-2024-001', 10000, 30);
    const after = Date.now();

    const expiryTime = new Date(quote.expiresAt).getTime();
    const expectedMin = before + 29000;
    const expectedMax = after + 31000;

    expect(expiryTime).toBeGreaterThanOrEqual(expectedMin);
    expect(expiryTime).toBeLessThanOrEqual(expectedMax);
  });

  it('includes adjustments array', async () => {
    const quote = await quoteDraw('mock-owner', 'CL-2024-001', 10000);

    expect(Array.isArray(quote.adjustments)).toBe(true);
    expect(quote.adjustments.length).toBeGreaterThan(0);
    
    quote.adjustments.forEach((adj) => {
      expect(adj).toHaveProperty('label');
      expect(adj).toHaveProperty('points');
      expect(typeof adj.label).toBe('string');
      expect(typeof adj.points).toBe('number');
    });
  });

  it('throws CreditDataError for non-existent credit line', async () => {
    await expect(
      quoteDraw('mock-owner', 'CL-NONEXISTENT', 10000)
    ).rejects.toThrow(CreditDataError);

    await expect(
      quoteDraw('mock-owner', 'CL-NONEXISTENT', 10000)
    ).rejects.toThrow('not found');
  });

  it('throws CreditDataError for zero amount', async () => {
    await expect(
      quoteDraw('mock-owner', 'CL-2024-001', 0)
    ).rejects.toThrow(CreditDataError);

    await expect(
      quoteDraw('mock-owner', 'CL-2024-001', 0)
    ).rejects.toThrow('must be positive');
  });

  it('throws CreditDataError for negative amount', async () => {
    await expect(
      quoteDraw('mock-owner', 'CL-2024-001', -100)
    ).rejects.toThrow(CreditDataError);
  });

  it('throws CreditDataError for non-finite amount', async () => {
    await expect(
      quoteDraw('mock-owner', 'CL-2024-001', NaN)
    ).rejects.toThrow(CreditDataError);

    await expect(
      quoteDraw('mock-owner', 'CL-2024-001', Infinity)
    ).rejects.toThrow(CreditDataError);
  });

  it('calculates fee as 1% of amount', async () => {
    const quote = await quoteDraw('mock-owner', 'CL-2024-001', 10000);

    expect(quote.fee).toBe(100); // 1% of 10000
  });

  it('returns valid ISO 8601 expiresAt timestamp', async () => {
    const quote = await quoteDraw('mock-owner', 'CL-2024-001', 10000);

    const date = new Date(quote.expiresAt);
    expect(date.toISOString()).toBe(quote.expiresAt);
    expect(!Number.isNaN(date.getTime())).toBe(true);
  });

  it('derives risk band from credit line riskScore', async () => {
    // Prime: >= 700
    const quotePrime = await quoteDraw('mock-owner', 'CL-2024-001', 10000);
    const line1 = mockData.MOCK_CREDIT_LINES.find(l => l.id === 'CL-2024-001');
    if (line1 && line1.riskScore >= 700) {
      expect(quotePrime.riskBand).toBe('Prime');
    }

    // Standard: >= 600
    const quoteStandard = await quoteDraw('mock-owner', 'CL-2024-002', 10000);
    const line2 = mockData.MOCK_CREDIT_LINES.find(l => l.id === 'CL-2024-002');
    if (line2 && line2.riskScore >= 600 && line2.riskScore < 700) {
      expect(quoteStandard.riskBand).toBe('Standard');
    }
  });
});
