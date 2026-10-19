/**
 * Tests for credit data decoders.
 *
 * Validates that decodeCreditLine and decodeTransaction enforce:
 * - Closed status and type unions
 * - Non-negative amounts with limit > 0 for non-Closed lines
 * - Valid ISO 8601 dates
 * - Non-empty IDs
 * - 64-character hex txHash format
 * - Over-limit flag when utilized > limit
 * - Performance: decoding 1,000 records takes < 10 ms
 */

import { describe, it, expect, vi } from 'vitest';
import {
  decodeCreditLine,
  decodeTransaction,
  decodeCreditLines,
  decodeTransactions,
  type DecodeIssue,
} from '../decode';
import { MOCK_CREDIT_LINES } from '../../../data/mockData';
import type { CreditLine, Transaction } from '../../../types/creditLine';

describe('decodeTransaction', () => {
  it('decodes a valid transaction successfully', () => {
    const validTx = {
      id: 'TX-001',
      type: 'Draw',
      amount: 1000,
      date: '2025-01-15T10:30:00Z',
      status: 'Completed',
      txHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      note: 'Test transaction',
    };

    const result = decodeTransaction(validTx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('TX-001');
      expect(result.value.type).toBe('Draw');
      expect(result.value.amount).toBe(1000);
      expect(result.value.status).toBe('Completed');
      expect(result.value.txHash).toBe(validTx.txHash);
      expect(result.value.note).toBe('Test transaction');
    }
  });

  it('rejects unknown transaction status', () => {
    const invalidTx = {
      id: 'TX-002',
      type: 'Draw',
      amount: 500,
      date: '2025-01-15T10:30:00Z',
      status: 'Liquidated', // Unknown status
    };

    const result = decodeTransaction(invalidTx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const statusIssue = result.issues.find((i) => i.path[0] === 'status');
      expect(statusIssue).toBeDefined();
      expect(statusIssue?.message).toContain('Completed, Pending, Failed');
    }
  });

  it('rejects unknown transaction type', () => {
    const invalidTx = {
      id: 'TX-003',
      type: 'Withdrawal', // Unknown type
      amount: 500,
      date: '2025-01-15T10:30:00Z',
      status: 'Completed',
    };

    const result = decodeTransaction(invalidTx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const typeIssue = result.issues.find((i) => i.path[0] === 'type');
      expect(typeIssue).toBeDefined();
      expect(typeIssue?.message).toContain('Draw, Repay, Fee, Interest');
    }
  });

  it('rejects negative amount', () => {
    const invalidTx = {
      id: 'TX-004',
      type: 'Draw',
      amount: -100,
      date: '2025-01-15T10:30:00Z',
      status: 'Completed',
    };

    const result = decodeTransaction(invalidTx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const amountIssue = result.issues.find((i) => i.path[0] === 'amount');
      expect(amountIssue).toBeDefined();
      expect(amountIssue?.message).toContain('non-negative');
    }
  });

  it('rejects NaN amount', () => {
    const invalidTx = {
      id: 'TX-005',
      type: 'Draw',
      amount: NaN,
      date: '2025-01-15T10:30:00Z',
      status: 'Completed',
    };

    const result = decodeTransaction(invalidTx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const amountIssue = result.issues.find((i) => i.path[0] === 'amount');
      expect(amountIssue).toBeDefined();
    }
  });

  it('rejects string amount', () => {
    const invalidTx = {
      id: 'TX-006',
      type: 'Draw',
      amount: '100', // String instead of number
      date: '2025-01-15T10:30:00Z',
      status: 'Completed',
    };

    const result = decodeTransaction(invalidTx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const amountIssue = result.issues.find((i) => i.path[0] === 'amount');
      expect(amountIssue).toBeDefined();
    }
  });

  it('rejects invalid date', () => {
    const invalidTx = {
      id: 'TX-007',
      type: 'Draw',
      amount: 100,
      date: '2025-13-40', // Invalid date
      status: 'Completed',
    };

    const result = decodeTransaction(invalidTx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const dateIssue = result.issues.find((i) => i.path[0] === 'date');
      expect(dateIssue).toBeDefined();
      expect(dateIssue?.message).toContain('ISO 8601');
    }
  });

  it('rejects txHash that is not 64 hex characters', () => {
    const invalidTx = {
      id: 'TX-008',
      type: 'Draw',
      amount: 100,
      date: '2025-01-15T10:30:00Z',
      status: 'Completed',
      txHash: 'abc', // Too short
    };

    const result = decodeTransaction(invalidTx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const hashIssue = result.issues.find((i) => i.path[0] === 'txHash');
      expect(hashIssue).toBeDefined();
      expect(hashIssue?.message).toContain('64-character hexadecimal');
    }
  });

  it('accepts valid 64-character hex txHash', () => {
    const validTx = {
      id: 'TX-009',
      type: 'Draw',
      amount: 100,
      date: '2025-01-15T10:30:00Z',
      status: 'Completed',
      txHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    };

    const result = decodeTransaction(validTx);

    expect(result.ok).toBe(true);
  });

  it('accepts transaction without txHash', () => {
    const validTx = {
      id: 'TX-010',
      type: 'Draw',
      amount: 100,
      date: '2025-01-15T10:30:00Z',
      status: 'Pending',
    };

    const result = decodeTransaction(validTx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.txHash).toBeUndefined();
    }
  });

  it('caps note field at 500 characters', () => {
    const longNote = 'a'.repeat(600);
    const validTx = {
      id: 'TX-011',
      type: 'Draw',
      amount: 100,
      date: '2025-01-15T10:30:00Z',
      status: 'Completed',
      note: longNote,
    };

    const result = decodeTransaction(validTx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.note).toBeDefined();
      expect(result.value.note!.length).toBe(500);
    }
  });

  it('rejects empty id', () => {
    const invalidTx = {
      id: '',
      type: 'Draw',
      amount: 100,
      date: '2025-01-15T10:30:00Z',
      status: 'Completed',
    };

    const result = decodeTransaction(invalidTx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const idIssue = result.issues.find((i) => i.path[0] === 'id');
      expect(idIssue).toBeDefined();
    }
  });
});

describe('decodeCreditLine', () => {
  it('decodes every line in MOCK_CREDIT_LINES successfully', () => {
    for (const line of MOCK_CREDIT_LINES) {
      const result = decodeCreditLine(line);
      
      if (!result.ok) {
        console.error('Failed to decode:', line.id, result.issues);
      }
      
      expect(result.ok).toBe(true);
    }
  });

  it('rejects unknown status Liquidated', () => {
    const invalidLine = {
      id: 'CL-TEST-001',
      name: 'Test Line',
      status: 'Liquidated', // Unknown status
      limit: 10000,
      utilized: 5000,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    const result = decodeCreditLine(invalidLine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const statusIssue = result.issues.find((i) => i.path[0] === 'status');
      expect(statusIssue).toBeDefined();
      expect(statusIssue?.message).toContain('Active, Suspended, Defaulted, Closed, Frozen');
    }
  });

  it('rejects limit: 0 on an Active line', () => {
    const invalidLine = {
      id: 'CL-TEST-002',
      name: 'Test Line',
      status: 'Active',
      limit: 0, // Zero limit not allowed for Active lines
      utilized: 0,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    const result = decodeCreditLine(invalidLine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const limitIssue = result.issues.find((i) => i.path[0] === 'limit');
      expect(limitIssue).toBeDefined();
      expect(limitIssue?.message).toContain('positive');
    }
  });

  it('rejects negative limit', () => {
    const invalidLine = {
      id: 'CL-TEST-003',
      name: 'Test Line',
      status: 'Active',
      limit: -5, // Negative limit
      utilized: 0,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    const result = decodeCreditLine(invalidLine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const limitIssue = result.issues.find((i) => i.path[0] === 'limit');
      expect(limitIssue).toBeDefined();
    }
  });

  it('rejects NaN limit', () => {
    const invalidLine = {
      id: 'CL-TEST-004',
      name: 'Test Line',
      status: 'Active',
      limit: NaN,
      utilized: 0,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    const result = decodeCreditLine(invalidLine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const limitIssue = result.issues.find((i) => i.path[0] === 'limit');
      expect(limitIssue).toBeDefined();
    }
  });

  it('rejects string limit', () => {
    const invalidLine = {
      id: 'CL-TEST-005',
      name: 'Test Line',
      status: 'Active',
      limit: '100', // String instead of number
      utilized: 0,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    const result = decodeCreditLine(invalidLine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const limitIssue = result.issues.find((i) => i.path[0] === 'limit');
      expect(limitIssue).toBeDefined();
    }
  });

  it('allows limit: 0 on a Closed line', () => {
    const validLine = {
      id: 'CL-TEST-006',
      name: 'Test Line',
      status: 'Closed',
      limit: 0,
      utilized: 0,
      apr: 0,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    const result = decodeCreditLine(validLine);

    expect(result.ok).toBe(true);
  });

  it('decodes utilized > limit with over_limit flag', () => {
    const overLimitLine = {
      id: 'CL-TEST-007',
      name: 'Test Line',
      status: 'Active',
      limit: 10000,
      utilized: 12000, // Over limit due to interest
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    const result = decodeCreditLine(overLimitLine);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flags).toBeDefined();
      expect(result.value.flags).toContain('over_limit');
    }
  });

  it('rejects invalid date in openedAt', () => {
    const invalidLine = {
      id: 'CL-TEST-008',
      name: 'Test Line',
      status: 'Active',
      limit: 10000,
      utilized: 5000,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-13-40', // Invalid date
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    const result = decodeCreditLine(invalidLine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const dateIssue = result.issues.find((i) => i.path[0] === 'openedAt');
      expect(dateIssue).toBeDefined();
    }
  });

  it('rejects invalid transaction in transactions array', () => {
    const invalidLine = {
      id: 'CL-TEST-009',
      name: 'Test Line',
      status: 'Active',
      limit: 10000,
      utilized: 5000,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [
        {
          id: 'TX-001',
          type: 'InvalidType', // Invalid transaction type
          amount: 100,
          date: '2025-01-10',
          status: 'Completed',
        },
      ],
      statusHistory: [],
    };

    const result = decodeCreditLine(invalidLine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const txIssue = result.issues.find((i) => i.path[0] === 'transactions');
      expect(txIssue).toBeDefined();
    }
  });

  it('rejects empty name', () => {
    const invalidLine = {
      id: 'CL-TEST-010',
      name: '',
      status: 'Active',
      limit: 10000,
      utilized: 5000,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    };

    const result = decodeCreditLine(invalidLine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const nameIssue = result.issues.find((i) => i.path[0] === 'name');
      expect(nameIssue).toBeDefined();
    }
  });
});

describe('decodeCreditLines (batch)', () => {
  it('returns valid lines and skips invalid ones', () => {
    const mixedData = [
      {
        id: 'CL-VALID-001',
        name: 'Valid Line 1',
        status: 'Active',
        limit: 10000,
        utilized: 5000,
        apr: 8.5,
        riskScore: 720,
        openedAt: '2025-01-01',
        updatedAt: '2025-01-15T10:30:00Z',
        transactions: [],
        statusHistory: [],
      },
      {
        id: 'CL-INVALID-001',
        name: 'Invalid Line',
        status: 'Liquidated', // Invalid status
        limit: 10000,
        utilized: 5000,
        apr: 8.5,
        riskScore: 720,
        openedAt: '2025-01-01',
        updatedAt: '2025-01-15T10:30:00Z',
        transactions: [],
        statusHistory: [],
      },
      {
        id: 'CL-VALID-002',
        name: 'Valid Line 2',
        status: 'Suspended',
        limit: 20000,
        utilized: 10000,
        apr: 9.0,
        riskScore: 680,
        openedAt: '2025-01-01',
        updatedAt: '2025-01-15T10:30:00Z',
        transactions: [],
        statusHistory: [],
      },
      {
        id: 'CL-INVALID-002',
        name: 'Invalid Line 2',
        status: 'Active',
        limit: -5, // Invalid limit
        utilized: 0,
        apr: 8.5,
        riskScore: 720,
        openedAt: '2025-01-01',
        updatedAt: '2025-01-15T10:30:00Z',
        transactions: [],
        statusHistory: [],
      },
    ];

    const result = decodeCreditLines(mixedData);

    expect(result.creditLines).toHaveLength(2);
    expect(result.skipped).toBe(2);
    expect(result.creditLines[0].id).toBe('CL-VALID-001');
    expect(result.creditLines[1].id).toBe('CL-VALID-002');
  });

  it('logs warnings for invalid records', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const invalidData = [
      {
        id: 'CL-INVALID-003',
        name: 'Invalid',
        status: 'Unknown',
        limit: 10000,
        utilized: 5000,
        apr: 8.5,
        riskScore: 720,
        openedAt: '2025-01-01',
        updatedAt: '2025-01-15T10:30:00Z',
        transactions: [],
        statusHistory: [],
      },
    ];

    decodeCreditLines(invalidData);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Invalid credit line record:',
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: 'status',
            message: expect.stringContaining('Active, Suspended'),
          }),
        ]),
      }),
    );

    consoleWarnSpy.mockRestore();
  });
});

describe('decodeTransactions (batch)', () => {
  it('returns valid transactions and skips invalid ones', () => {
    const mixedData = [
      {
        id: 'TX-VALID-001',
        type: 'Draw',
        amount: 1000,
        date: '2025-01-15T10:30:00Z',
        status: 'Completed',
      },
      {
        id: 'TX-INVALID-001',
        type: 'InvalidType', // Invalid type
        amount: 500,
        date: '2025-01-15T10:30:00Z',
        status: 'Completed',
      },
      {
        id: 'TX-VALID-002',
        type: 'Repay',
        amount: 500,
        date: '2025-01-16T10:30:00Z',
        status: 'Pending',
      },
    ];

    const result = decodeTransactions(mixedData);

    expect(result.transactions).toHaveLength(2);
    expect(result.skipped).toBe(1);
    expect(result.transactions[0].id).toBe('TX-VALID-001');
    expect(result.transactions[1].id).toBe('TX-VALID-002');
  });
});

describe('Performance', () => {
  it('decodes 1,000 credit line records in under 10 ms', () => {
    // Generate 1,000 credit line records
    const records = Array.from({ length: 1000 }, (_, i) => ({
      id: `CL-PERF-${String(i).padStart(4, '0')}`,
      name: `Performance Test Line ${i}`,
      status: 'Active' as const,
      limit: 10000 + i * 100,
      utilized: 5000 + i * 50,
      apr: 8.5 + (i % 10) * 0.1,
      riskScore: 700 + (i % 150),
      openedAt: '2025-01-01',
      updatedAt: '2025-01-15T10:30:00Z',
      transactions: [],
      statusHistory: [],
    }));

    const start = performance.now();
    const result = decodeCreditLines(records);
    const end = performance.now();
    const elapsed = end - start;

    expect(result.creditLines).toHaveLength(1000);
    expect(result.skipped).toBe(0);
    expect(elapsed).toBeLessThan(10);
  });

  it('decodes 1,000 transaction records in under 10 ms', () => {
    // Generate 1,000 transaction records
    const records = Array.from({ length: 1000 }, (_, i) => ({
      id: `TX-PERF-${String(i).padStart(4, '0')}`,
      type: (['Draw', 'Repay', 'Fee', 'Interest'] as const)[i % 4],
      amount: 100 + i * 10,
      date: '2025-01-15T10:30:00Z',
      status: (['Completed', 'Pending', 'Failed'] as const)[i % 3],
    }));

    const start = performance.now();
    const result = decodeTransactions(records);
    const end = performance.now();
    const elapsed = end - start;

    expect(result.transactions).toHaveLength(1000);
    expect(result.skipped).toBe(0);
    expect(elapsed).toBeLessThan(10);
  });
});
