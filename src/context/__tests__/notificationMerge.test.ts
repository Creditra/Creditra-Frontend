import { describe, expect, it } from 'vitest';
import { mergeNotifications } from '../notificationMerge';
import type { Notification } from '../../types/notification';

function makeNotification(
  id: string,
  timestamp: string,
  read: boolean = false,
  title: string = `Notification ${id}`
): Notification {
  return {
    id,
    type: 'info',
    category: 'system',
    title,
    message: `Message for ${id}`,
    timestamp,
    read,
  };
}

describe('mergeNotifications', () => {
  it('returns an empty array when both inputs are empty', () => {
    expect(mergeNotifications([], [])).toEqual([]);
  });

  it('returns the snapshot sorted by timestamp when current is empty', () => {
    const snapshot: Notification[] = [
      makeNotification('n1', '2026-10-20T00:00:00.000Z'),
      makeNotification('n2', '2026-10-20T00:05:00.000Z'),
    ];

    const result = mergeNotifications(snapshot, []);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('n2');
    expect(result[1].id).toBe('n1');
  });

  it('returns current sorted by timestamp when snapshot is empty', () => {
    const current: Notification[] = [
      makeNotification('c1', '2026-10-20T00:01:00.000Z'),
      makeNotification('c2', '2026-10-20T00:10:00.000Z'),
    ];

    const result = mergeNotifications([], current);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('c2');
    expect(result[1].id).toBe('c1');
  });

  it('scenario 2: merges 5 snapshot items with 1 newly arrived item', () => {
    const snapshot: Notification[] = [
      makeNotification('orig-1', '2026-10-20T01:00:00.000Z'),
      makeNotification('orig-2', '2026-10-20T01:01:00.000Z'),
      makeNotification('orig-3', '2026-10-20T01:02:00.000Z'),
      makeNotification('orig-4', '2026-10-20T01:03:00.000Z'),
      makeNotification('orig-5', '2026-10-20T01:04:00.000Z'),
    ];
    const current: Notification[] = [
      makeNotification('new-1', '2026-10-20T01:05:00.000Z'),
    ];

    const result = mergeNotifications(snapshot, current);
    expect(result).toHaveLength(6);
    expect(result.map(n => n.id)).toEqual([
      'new-1',
      'orig-5',
      'orig-4',
      'orig-3',
      'orig-2',
      'orig-1',
    ]);
  });

  it('deduplicates by notification id, giving current precedence', () => {
    const snapshot: Notification[] = [
      makeNotification('dup-1', '2026-10-20T01:00:00.000Z', false, 'Old Title'),
      makeNotification('other-1', '2026-10-20T01:01:00.000Z', false),
    ];
    const current: Notification[] = [
      makeNotification('dup-1', '2026-10-20T01:02:00.000Z', true, 'Updated Title'),
    ];

    const result = mergeNotifications(snapshot, current);
    expect(result).toHaveLength(2);
    const dup = result.find(n => n.id === 'dup-1');
    expect(dup).toBeDefined();
    expect(dup?.title).toBe('Updated Title');
    expect(dup?.read).toBe(true);
    expect(dup?.timestamp).toBe('2026-10-20T01:02:00.000Z');
  });

  it('scenario 8: caps at 100 items when combined total exceeds 100, retaining newest 100', () => {
    // 60 older snapshot notifications (timestamps 1 to 60)
    const snapshot: Notification[] = Array.from({ length: 60 }, (_, i) => {
      const pad = String(i + 1).padStart(3, '0');
      return makeNotification(`snap-${pad}`, new Date(1000000 + i * 1000).toISOString());
    });

    // 60 newer current notifications (timestamps 61 to 120)
    const current: Notification[] = Array.from({ length: 60 }, (_, i) => {
      const pad = String(i + 61).padStart(3, '0');
      return makeNotification(`curr-${pad}`, new Date(1000000 + (i + 60) * 1000).toISOString());
    });

    const result = mergeNotifications(snapshot, current);
    expect(result).toHaveLength(100);

    // Newest item should be curr-120
    expect(result[0].id).toBe('curr-120');

    // Oldest retained item should be snap-021 (the 21st item, leaving items 1-20 dropped)
    expect(result[99].id).toBe('snap-021');

    // Items snap-001 through snap-020 should be discarded
    expect(result.some(n => n.id === 'snap-001')).toBe(false);
    expect(result.some(n => n.id === 'snap-020')).toBe(false);
  });

  it('is idempotent: merging the snapshot into an already-merged state produces identical results', () => {
    const snapshot: Notification[] = [
      makeNotification('n1', '2026-10-20T01:00:00.000Z'),
      makeNotification('n2', '2026-10-20T01:02:00.000Z'),
    ];
    const current: Notification[] = [
      makeNotification('n3', '2026-10-20T01:01:00.000Z'),
    ];

    const once = mergeNotifications(snapshot, current);
    const twice = mergeNotifications(snapshot, once);

    expect(twice).toEqual(once);
  });

  it('is a pure function that does not mutate either input array', () => {
    const snapshot: Notification[] = [
      makeNotification('n1', '2026-10-20T01:00:00.000Z'),
    ];
    const current: Notification[] = [
      makeNotification('n2', '2026-10-20T01:01:00.000Z'),
    ];

    const snapshotCopy = JSON.parse(JSON.stringify(snapshot));
    const currentCopy = JSON.parse(JSON.stringify(current));

    mergeNotifications(snapshot, current);

    expect(snapshot).toEqual(snapshotCopy);
    expect(current).toEqual(currentCopy);
  });

  it('handles invalid or empty timestamps gracefully', () => {
    const snapshot: Notification[] = [
      makeNotification('n1', 'invalid-date'),
      makeNotification('n2', ''),
    ];
    const current: Notification[] = [
      makeNotification('n3', '2026-10-20T01:00:00.000Z'),
    ];

    const result = mergeNotifications(snapshot, current);
    expect(result).toHaveLength(3);
    // Valid timestamp should come first
    expect(result[0].id).toBe('n3');
  });
});
