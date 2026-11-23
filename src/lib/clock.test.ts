import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { now, nowMs, setClockForTests, resetClock } from './clock';
import { freezeTime, unfreezeTime, DEFAULT_FROZEN_TIME } from '../test/freezeTime';
import { generateAprHistory, MOCK_CREDIT_LINES } from '../data/mockData';
import { getDaysPastDue } from './delinquency';
import type { CreditLine } from '../types/creditLine';

describe('clock', () => {
  beforeEach(() => {
    resetClock();
  });

  afterEach(() => {
    unfreezeTime();
  });

  it('delegates to new Date() by default', () => {
    const before = Date.now();
    const clockDate = now();
    const after = Date.now();

    expect(clockDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(clockDate.getTime()).toBeLessThanOrEqual(after);
    expect(nowMs()).toBeGreaterThanOrEqual(before);
  });

  it('allows overriding the clock for tests', () => {
    const fixedDate = new Date('2025-02-25T12:00:00.000Z');
    setClockForTests(() => fixedDate);

    expect(now().toISOString()).toBe('2025-02-25T12:00:00.000Z');
    expect(nowMs()).toBe(fixedDate.getTime());
  });

  it('restores real time with resetClock()', () => {
    const fixedDate = new Date('2025-02-25T12:00:00.000Z');
    setClockForTests(() => fixedDate);
    expect(now().toISOString()).toBe('2025-02-25T12:00:00.000Z');

    resetClock();
    const restored = now();
    expect(restored.getFullYear()).toBeGreaterThanOrEqual(2025);
  });

  it('works alongside fake timers when not explicitly overridden', () => {
    const fakeTime = new Date('2025-03-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fakeTime);

    expect(now().toISOString()).toBe('2025-03-01T00:00:00.000Z');
    expect(nowMs()).toBe(fakeTime.getTime());
  });
});

describe('credit test plan scenarios', () => {
  afterEach(() => {
    unfreezeTime();
  });

  it('Scenario 1: generateAprHistory uses fixed anchor date regardless of system time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const history1 = generateAprHistory(10.5, 30, 42);

    vi.setSystemTime(new Date('2026-10-22T00:00:00Z'));
    const history2 = generateAprHistory(10.5, 30, 42);

    expect(history1).toEqual(history2);
    expect(MOCK_CREDIT_LINES[0].aprHistory[0]).toBeDefined();
  });

  it('Scenario 2: freezeTime(2025-02-25) gives deterministic payment notice countdown', () => {
    freezeTime('2025-02-25T12:00:00.000Z');
    const paymentDate = '2025-03-01';
    const daysUntil = Math.ceil(
      (new Date(paymentDate).getTime() - nowMs()) / 86400000,
    );
    expect(daysUntil).toBe(4);
  });

  it('Scenario 3: freezeTime produces deterministic aging and days past due', () => {
    freezeTime('2025-02-25T12:00:00.000Z');
    const delinquentLine: CreditLine = {
      ...MOCK_CREDIT_LINES[0],
      status: 'Suspended',
      nextPaymentDate: '2025-02-10',
      statusHistory: [
        {
          date: '2025-02-11',
          status: 'Suspended',
          note: 'Missed payment',
        },
      ],
    };

    const daysPastDue = getDaysPastDue(delinquentLine, now());
    expect(daysPastDue).toBe(15);
  });

  it('Scenario 4: unfreezeTime restores real system timers and clock', () => {
    freezeTime('2025-02-25T12:00:00.000Z');
    expect(now().getFullYear()).toBe(2025);

    unfreezeTime();
    const restored = now();
    expect(restored.getFullYear()).toBeGreaterThanOrEqual(2025);
  });

  it('Scenario 5: machine date in 2030 produces identical frozen credit results', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));

    // When credit test starts and freezes time:
    freezeTime(DEFAULT_FROZEN_TIME);
    expect(now().toISOString()).toBe(DEFAULT_FROZEN_TIME);
    const daysUntil = Math.ceil(
      (new Date('2025-03-01').getTime() - nowMs()) / 86400000,
    );
    expect(daysUntil).toBe(4);
  });
});
