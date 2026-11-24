import { describe, expect, it } from 'vitest';
import type { Notification } from '../../types/notification';
import { filterNotifications } from './filterNotifications';

const SAMPLE: Notification[] = [
  {
    id: '1',
    type: 'success',
    category: 'transaction',
    title: 'Payment received',
    message: 'Your payment of $100.00 was settled',
    timestamp: '2026-01-01T10:00:00.000Z',
    read: false,
  },
  {
    id: '2',
    type: 'warning',
    category: 'credit_line',
    title: 'Línea de crédito actualizada',
    message: 'Tu límite de crédito fue incrementado',
    timestamp: '2026-01-01T11:00:00.000Z',
    read: false,
  },
  {
    id: '3',
    type: 'error',
    category: 'transaction',
    title: 'Transfer failed [ERR-42]',
    message: 'Could not process (wire) transfer',
    timestamp: '2026-01-01T12:00:00.000Z',
    read: true,
  },
  {
    id: '4',
    type: 'danger',
    category: 'risk_score',
    title: 'Margin call alert',
    message: 'Collateral ratio dropped below threshold',
    timestamp: '2026-01-01T13:00:00.000Z',
    read: false,
  },
  {
    id: '5',
    type: 'info',
    category: 'system',
    title: 'Scheduled maintenance',
    message: 'System upgrade at 02:00 UTC',
    timestamp: '2026-01-01T14:00:00.000Z',
    read: true,
  },
];

describe('filterNotifications', () => {
  it('returns all notifications when no filters are active', () => {
    expect(filterNotifications(SAMPLE)).toHaveLength(5);
    expect(filterNotifications(SAMPLE, { category: 'all', type: 'all', query: '' })).toHaveLength(5);
  });

  it('filters by category', () => {
    const result = filterNotifications(SAMPLE, { category: 'transaction' });
    expect(result.map((n) => n.id)).toEqual(['1', '3']);
  });

  it('filters by severity type', () => {
    const result = filterNotifications(SAMPLE, { type: 'danger' });
    expect(result.map((n) => n.id)).toEqual(['4']);
  });

  it('matches query against title and message case-insensitively', () => {
    expect(filterNotifications(SAMPLE, { query: 'PAYMENT' }).map((n) => n.id)).toEqual(['1']);
    expect(filterNotifications(SAMPLE, { query: 'collateral' }).map((n) => n.id)).toEqual(['4']);
  });

  it('matches query accent-insensitively', () => {
    expect(filterNotifications(SAMPLE, { query: 'linea de credito' }).map((n) => n.id)).toEqual(['2']);
    expect(filterNotifications(SAMPLE, { query: 'límite' }).map((n) => n.id)).toEqual(['2']);
    expect(filterNotifications(SAMPLE, { query: 'limite' }).map((n) => n.id)).toEqual(['2']);
  });

  it('handles regex special characters in query safely', () => {
    expect(filterNotifications(SAMPLE, { query: '$100.00' }).map((n) => n.id)).toEqual(['1']);
    expect(filterNotifications(SAMPLE, { query: '[ERR-42]' }).map((n) => n.id)).toEqual(['3']);
    expect(filterNotifications(SAMPLE, { query: '(wire)' }).map((n) => n.id)).toEqual(['3']);
    expect(filterNotifications(SAMPLE, { query: 'a.*b^$' })).toEqual([]);
  });

  it('combines category, severity type, and query', () => {
    const result = filterNotifications(SAMPLE, {
      category: 'transaction',
      type: 'error',
      query: 'transfer',
    });
    expect(result.map((n) => n.id)).toEqual(['3']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterNotifications(SAMPLE, { query: 'nonexistent-xyz' })).toEqual([]);
    expect(
      filterNotifications(SAMPLE, { category: 'system', type: 'error' }),
    ).toEqual([]);
  });

  it('treats whitespace-only queries as empty', () => {
    expect(filterNotifications(SAMPLE, { query: '   \t\n  ' })).toHaveLength(5);
  });
});
