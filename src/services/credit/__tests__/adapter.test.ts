/**
 * Tests for credit data adapters.
 *
 * Validates that adapters correctly apply decoders and handle errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCreditLines,
  fetchCreditLineById,
  fetchAllTransactions,
  fetchTransactionsByCreditLine,
  fetchTransactionById,
} from '../adapter';
import { CreditDataError } from '../errors';
import * as mockData from '../../../data/mockData';

describe('fetchCreditLines', () => {
  it('returns all valid credit lines', async () => {
    const result = await fetchCreditLines();

    expect(result.creditLines).toBeDefined();
    expect(Array.isArray(result.creditLines)).toBe(true);
    expect(result.skipped).toBe(0);
    expect(result.creditLines.length).toBeGreaterThan(0);
  });

  it('skips invalid credit lines', async () => {
    // Mock MOCK_CREDIT_LINES with one invalid record
    const originalLines = [...mockData.MOCK_CREDIT_LINES];
    const invalidLine = {
      id: 'CL-INVALID',
      name: 'Invalid',
      status: 'UnknownStatus', // Invalid
      limit: 10000,
      utilized: 5000,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    vi.spyOn(mockData, 'MOCK_CREDIT_LINES', 'get').mockReturnValue([
      ...originalLines,
      invalidLine as any,
    ]);

    const result = await fetchCreditLines();

    expect(result.skipped).toBe(1);
    expect(result.creditLines).toHaveLength(originalLines.length);

    vi.restoreAllMocks();
  });
});

describe('fetchCreditLineById', () => {
  it('returns a valid credit line by ID', async () => {
    const result = await fetchCreditLineById('CL-2024-001');

    expect(result).toBeDefined();
    expect(result.id).toBe('CL-2024-001');
  });

  it('throws CreditDataError for not found', async () => {
    await expect(fetchCreditLineById('CL-NONEXISTENT')).rejects.toThrow(
      CreditDataError,
    );
    await expect(fetchCreditLineById('CL-NONEXISTENT')).rejects.toThrow(
      'not found',
    );
  });

  it('throws CreditDataError for invalid data', async () => {
    const originalLines = [...mockData.MOCK_CREDIT_LINES];
    const invalidLine = {
      id: 'CL-INVALID-SINGLE',
      name: 'Invalid',
      status: 'BadStatus', // Invalid
      limit: 10000,
      utilized: 5000,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    vi.spyOn(mockData, 'MOCK_CREDIT_LINES', 'get').mockReturnValue([
      ...originalLines,
      invalidLine as any,
    ]);

    await expect(fetchCreditLineById('CL-INVALID-SINGLE')).rejects.toThrow(
      CreditDataError,
    );
    await expect(fetchCreditLineById('CL-INVALID-SINGLE')).rejects.toThrow(
      'failed validation',
    );

    vi.restoreAllMocks();
  });
});

describe('fetchAllTransactions', () => {
  it('returns all valid transactions', async () => {
    const result = await fetchAllTransactions();

    expect(result.transactions).toBeDefined();
    expect(Array.isArray(result.transactions)).toBe(true);
    expect(result.skipped).toBe(0);
    expect(result.transactions.length).toBeGreaterThan(0);
  });
});

describe('fetchTransactionsByCreditLine', () => {
  it('returns transactions for a specific credit line', async () => {
    const result = await fetchTransactionsByCreditLine('CL-2024-001');

    expect(result.transactions).toBeDefined();
    expect(Array.isArray(result.transactions)).toBe(true);
  });

  it('returns empty array for non-existent credit line', async () => {
    const result = await fetchTransactionsByCreditLine('CL-NONEXISTENT');

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toBe(0);
  });
});

describe('fetchTransactionById', () => {
  it('throws CreditDataError for not found', async () => {
    await expect(fetchTransactionById('TX-NONEXISTENT')).rejects.toThrow(
      CreditDataError,
    );
    await expect(fetchTransactionById('TX-NONEXISTENT')).rejects.toThrow(
      'not found',
    );
  });
});
