import { describe, expect, it } from 'vitest';
import type { CreditLine } from '../types/creditLine';
import {
  computeDueReminders,
  makeReminderKey,
  pruneExpiredReminderKeys,
  resolveReminderMilestone,
} from './payment-reminders';

function makeLine(overrides: Partial<CreditLine> = {}): CreditLine {
  return {
    id: 'CL-001',
    name: 'Builder Credit Line',
    status: 'Active',
    limit: 50000,
    utilized: 10000,
    apr: 12,
    riskScore: 720,
    openedAt: '2024-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    transactions: [],
    statusHistory: [],
    nextPaymentDate: '2026-10-20',
    nextPaymentAmount: 500,
    ...overrides,
  };
}

describe('computeDueReminders', () => {
  it('jumps 7 -> 1 -> 0 -> -3 days and emits each milestone once', () => {
    const line = makeLine({ id: 'CL-JUMP', nextPaymentDate: '2026-10-20' });
    const sent = new Set<string>();

    // 7 days before (Oct 13)
    const r7 = computeDueReminders([line], new Date(2026, 9, 13, 10, 0, 0), sent);
    expect(r7).toHaveLength(1);
    expect(r7[0].milestone).toBe('7d');
    expect(r7[0].key).toBe('CL-JUMP:2026-10-20:7d');
    expect(r7[0].type).toBe('info');
    expect(r7[0].ctaTo).toBe('/repay?line=CL-JUMP');
    sent.add(r7[0].key);

    // Re-evaluating on day 7 or day 5 does not re-emit 7d
    expect(computeDueReminders([line], new Date(2026, 9, 13, 18, 0, 0), sent)).toHaveLength(0);
    expect(computeDueReminders([line], new Date(2026, 9, 15, 10, 0, 0), sent)).toHaveLength(0);

    // 1 day before (Oct 19)
    const r1 = computeDueReminders([line], new Date(2026, 9, 19, 9, 0, 0), sent);
    expect(r1).toHaveLength(1);
    expect(r1[0].milestone).toBe('1d');
    expect(r1[0].key).toBe('CL-JUMP:2026-10-20:1d');
    expect(r1[0].type).toBe('warning');
    sent.add(r1[0].key);

    // Due today (Oct 20)
    const r0 = computeDueReminders([line], new Date(2026, 9, 20, 8, 0, 0), sent);
    expect(r0).toHaveLength(1);
    expect(r0[0].milestone).toBe('due_today');
    expect(r0[0].key).toBe('CL-JUMP:2026-10-20:due_today');
    expect(r0[0].type).toBe('warning');
    sent.add(r0[0].key);

    // 3 days overdue (Oct 23)
    const rMinus3 = computeDueReminders([line], new Date(2026, 9, 23, 12, 0, 0), sent);
    expect(rMinus3).toHaveLength(1);
    expect(rMinus3[0].milestone).toBe('overdue_3d');
    expect(rMinus3[0].key).toBe('CL-JUMP:2026-10-20:overdue_3d');
    expect(rMinus3[0].type).toBe('danger');
    sent.add(rMinus3[0].key);

    // Duplicate evaluation on same overdue day does not re-emit
    expect(computeDueReminders([line], new Date(2026, 9, 23, 20, 0, 0), sent)).toHaveLength(0);
  });

  it('caps overdue escalation to daily for days 1-7 and weekly thereafter', () => {
    expect(resolveReminderMilestone({ kind: 'overdue', days: 1 })).toBe('overdue');
    expect(resolveReminderMilestone({ kind: 'overdue', days: 2 })).toBe('overdue_2d');
    expect(resolveReminderMilestone({ kind: 'overdue', days: 7 })).toBe('overdue_7d');
    expect(resolveReminderMilestone({ kind: 'overdue', days: 8 })).toBe('overdue_7d');
    expect(resolveReminderMilestone({ kind: 'overdue', days: 13 })).toBe('overdue_7d');
    expect(resolveReminderMilestone({ kind: 'overdue', days: 14 })).toBe('overdue_14d');
    expect(resolveReminderMilestone({ kind: 'overdue', days: 21 })).toBe('overdue_21d');
    expect(resolveReminderMilestone({ kind: 'overdue', days: 120 })).toBe('overdue_84d');
  });

  it('allows reminders again when nextPaymentDate advances to the next cycle', () => {
    const sent = new Set<string>([makeReminderKey('CL-001', '2026-10-20', 'due_today')]);
    const nextCycleLine = makeLine({ id: 'CL-001', nextPaymentDate: '2026-11-20' });

    const reminders = computeDueReminders([nextCycleLine], new Date(2026, 10, 20, 9, 0, 0), sent);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].key).toBe('CL-001:2026-11-20:due_today');
  });

  it('never notifies for Closed, Frozen, Defaulted, or lines without nextPaymentDate', () => {
    const now = new Date(2026, 9, 20, 12, 0, 0);
    const lines = [
      makeLine({ id: 'CL-CLOSED', status: 'Closed', nextPaymentDate: '2026-10-20' }),
      makeLine({ id: 'CL-FROZEN', status: 'Frozen', nextPaymentDate: '2026-10-20' }),
      makeLine({ id: 'CL-DEFAULTED', status: 'Defaulted', nextPaymentDate: '2026-10-20' }),
      makeLine({ id: 'CL-NODATE', status: 'Active', nextPaymentDate: undefined }),
      makeLine({ id: 'CL-FAR', status: 'Active', nextPaymentDate: '2026-11-15' }),
    ];

    expect(computeDueReminders(lines, now)).toEqual([]);
  });

  it('handles DST boundary dates accurately using local calendar days', () => {
    // US spring-forward DST date: 2026-03-08; due date 2026-03-09
    const line = makeLine({ id: 'CL-DST', nextPaymentDate: '2026-03-09' });
    const springForwardMorning = new Date(2026, 2, 8, 9, 0, 0);
    const reminders = computeDueReminders([line], springForwardMorning);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].milestone).toBe('1d');
  });
});

describe('pruneExpiredReminderKeys', () => {
  it('prunes keys older than the retention window and keeps recent ones', () => {
    const now = new Date(2026, 9, 20, 12, 0, 0);
    const keys = [
      'CL-1:2026-01-01:overdue', // > 90 days old -> pruned
      'CL-1:2026-10-19:1d', // 1 day old -> kept
      'CL-1:2026-10-27:7d', // future -> kept
      'malformed-key', // invalid -> pruned
    ];

    expect(pruneExpiredReminderKeys(keys, now, 90)).toEqual([
      'CL-1:2026-10-19:1d',
      'CL-1:2026-10-27:7d',
    ]);
  });
});
