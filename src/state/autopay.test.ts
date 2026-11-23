import { describe, it, expect, beforeEach } from 'vitest';
import { autopaySchedulesStorageKey } from '@/constants/storageKeys';
import {
  cancelAutopaySchedule,
  createAutopaySchedule,
  getNextScheduledPayment,
  hasOverlappingActiveSchedule,
  listAutopaySchedules,
  updateAutopaySchedule,
} from './autopay';

const WALLET_A = 'freighter:GAAA:TESTNET';
const WALLET_B = 'freighter:GBBB:TESTNET';

describe('autopay state store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists schedules scoped by wallet key', () => {
    const created = createAutopaySchedule(WALLET_A, {
      creditLineId: 'cl-1',
      amount: 250,
      frequency: 'monthly',
      startDate: '2026-12-01',
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe('active');
    expect(listAutopaySchedules(WALLET_A)).toHaveLength(1);
    expect(listAutopaySchedules(WALLET_B)).toEqual([]);
    expect(listAutopaySchedules(null)).toEqual([]);
  });

  it('discards corrupt or tampered stored data safely', () => {
    const key = autopaySchedulesStorageKey(WALLET_A);

    // Non-JSON garbage
    localStorage.setItem(key, '{not-json');
    expect(listAutopaySchedules(WALLET_A)).toEqual([]);

    // Non-array JSON
    localStorage.setItem(key, JSON.stringify({ tampered: true }));
    expect(listAutopaySchedules(WALLET_A)).toEqual([]);
    expect(localStorage.getItem(key)).toBeNull();

    // Array containing invalid records mixed with one valid record
    localStorage.setItem(
      key,
      JSON.stringify([
        { id: 'bad-1', creditLineId: 'cl-1', amount: -50, frequency: 'monthly', startDate: '2026-12-01', status: 'active', createdAt: '2026-11-01T00:00:00.000Z' },
        { id: 'bad-2', creditLineId: 'cl-1', amount: 100, frequency: 'daily', startDate: '2026-12-01', status: 'active', createdAt: '2026-11-01T00:00:00.000Z' },
        { id: 'bad-3', creditLineId: 'cl-1', amount: 100, frequency: 'monthly', startDate: '2026-12-01', endDate: '2026-11-01', status: 'active', createdAt: '2026-11-01T00:00:00.000Z' },
        { id: 'good-1', creditLineId: 'cl-1', amount: 100, frequency: 'monthly', startDate: '2026-12-01', status: 'active', createdAt: '2026-11-01T00:00:00.000Z' },
      ]),
    );

    const loaded = listAutopaySchedules(WALLET_A);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('good-1');
  });

  it('prevents overlapping active schedules for the same credit line', () => {
    const first = createAutopaySchedule(WALLET_A, {
      creditLineId: 'cl-1',
      amount: 100,
      frequency: 'monthly',
      startDate: '2026-12-01',
      endDate: '2027-03-01',
    });

    // Overlapping range on same line -> throws
    expect(() =>
      createAutopaySchedule(WALLET_A, {
        creditLineId: 'cl-1',
        amount: 200,
        frequency: 'weekly',
        startDate: '2027-02-01',
      }),
    ).toThrow(/overlaps/i);

    // Non-overlapping range on same line -> allowed
    const second = createAutopaySchedule(WALLET_A, {
      creditLineId: 'cl-1',
      amount: 200,
      frequency: 'weekly',
      startDate: '2027-03-02',
    });
    expect(second.id).not.toBe(first.id);

    // Same date range on a DIFFERENT credit line -> allowed
    const otherLine = createAutopaySchedule(WALLET_A, {
      creditLineId: 'cl-2',
      amount: 150,
      frequency: 'monthly',
      startDate: '2026-12-01',
    });
    expect(otherLine.creditLineId).toBe('cl-2');

    // Cancelling the first allows creating a new schedule in that range
    cancelAutopaySchedule(WALLET_A, first.id);
    expect(
      hasOverlappingActiveSchedule(listAutopaySchedules(WALLET_A), {
        creditLineId: 'cl-1',
        startDate: '2026-12-15',
        endDate: '2027-01-15',
      }),
    ).toBe(false);
  });

  it('updates a schedule in place and cancels it cleanly', () => {
    const created = createAutopaySchedule(WALLET_A, {
      creditLineId: 'cl-1',
      amount: 100,
      frequency: 'monthly',
      startDate: '2026-12-01',
    });

    const updated = updateAutopaySchedule(WALLET_A, created.id, {
      amount: 325,
      frequency: 'biweekly',
    });
    expect(updated.id).toBe(created.id);
    expect(updated.amount).toBe(325);
    expect(updated.frequency).toBe('biweekly');

    const cancelled = cancelAutopaySchedule(WALLET_A, created.id);
    expect(cancelled.status).toBe('cancelled');
    expect(listAutopaySchedules(WALLET_A)[0].status).toBe('cancelled');
  });

  it('computes the earliest next scheduled payment across active schedules', () => {
    createAutopaySchedule(WALLET_A, {
      creditLineId: 'cl-1',
      amount: 200,
      frequency: 'monthly',
      startDate: '2026-12-15',
    });
    createAutopaySchedule(WALLET_A, {
      creditLineId: 'cl-2',
      amount: 75,
      frequency: 'weekly',
      startDate: '2026-12-05',
    });

    const next = getNextScheduledPayment(
      listAutopaySchedules(WALLET_A),
      undefined,
      new Date(2026, 11, 1),
    );
    expect(next).not.toBeNull();
    expect(next?.amount).toBe(75);
    expect(next?.date).toBe('2026-12-05');
  });
});
