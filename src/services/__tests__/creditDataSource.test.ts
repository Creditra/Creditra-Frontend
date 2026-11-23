import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  creditDataSource,
  readTransactions,
  saveMockRepaymentTransaction,
  type RepaymentTransaction,
} from '../creditDataSource';

const STORAGE_KEY = 'creditra.repayment-transactions';

const validTransaction: RepaymentTransaction = {
  id: 'TXN-VALID',
  owner: 'GTESTWALLET',
  status: 'Completed',
  creditLineId: 'CL-2024-001',
  creditLineName: 'Primary Business Line',
  amount: 3200,
  remainingDebt: 184300,
  limit: 500000,
  apr: 8.5,
  nextPaymentAmount: 3200,
  timestamp: '2025-07-25T14:30:00.000Z',
};

describe('creditDataSource transaction storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps valid rows and drops a row with a missing field', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
      validTransaction,
      { ...validTransaction, creditLineName: undefined },
    ]));

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(readTransactions()).toEqual([validTransaction]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('drops rows with wrong status strings and wrong owners', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
      validTransaction,
      { ...validTransaction, id: 'TXN-BAD-STATUS', status: 'Unknown' },
      { ...validTransaction, id: 'TXN-BAD-OWNER', owner: 123 },
    ]));

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(readTransactions()).toEqual([validTransaction]);
    expect(await creditDataSource.getTransaction('GTESTWALLET', 'TXN-VALID')).toEqual(validTransaction);
  });

  it('returns no transactions for invalid JSON or a non-array value', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    window.localStorage.setItem(STORAGE_KEY, '{not-json');
    expect(readTransactions()).toEqual([]);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'TXN-1' }));
    expect(readTransactions()).toEqual([]);
  });

  it('returns null from getTransaction for invalid JSON', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      creditDataSource.getTransaction('GTESTWALLET', 'TXN-VALID'),
    ).resolves.toBeNull();
  });

  it('save succeeds after corruption and persists only valid rows', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'CORRUPT', status: 'Unknown' },
      validTransaction,
    ]));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const nextTransaction = { ...validTransaction, id: 'TXN-NEW', amount: 500 };
    expect(() => saveMockRepaymentTransaction(nextTransaction)).not.toThrow();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown[];
    expect(stored).toEqual([validTransaction, nextTransaction]);
  });

  it('returns an empty array for an empty array', () => {
    window.localStorage.setItem(STORAGE_KEY, '[]');
    expect(readTransactions()).toEqual([]);
  });

  it('returns null when the transaction belongs to another owner', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([validTransaction]));
    await expect(
      creditDataSource.getTransaction('GOTHERWALLET', 'TXN-VALID'),
    ).resolves.toBeNull();
  });

  it('survives localStorage access throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    expect(readTransactions()).toEqual([]);
  });
});
