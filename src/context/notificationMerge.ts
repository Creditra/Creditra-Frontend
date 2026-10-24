import type { Notification } from '../types/notification';

export const MAX_NOTIFICATIONS = 100;

/**
 * Pure function to merge a cleared snapshot of notifications with any notifications
 * that arrived or were updated while the undo window was open.
 *
 * - Deduplicates by notification id (items in `current` take precedence over `snapshot`).
 * - Sorts items descending by timestamp (newest first).
 * - Enforces the notification inbox cap (default 100 items), keeping the newest items.
 * - Does not mutate input arrays.
 *
 * @param snapshot - The snapshot of notifications taken before clear-all
 * @param current - The notifications currently in state (e.g. arrived after clear-all)
 * @param cap - Maximum number of notifications to retain (defaults to 100)
 */
export function mergeNotifications(
  snapshot: Notification[],
  current: Notification[],
  cap: number = MAX_NOTIFICATIONS,
): Notification[] {
  const map = new Map<string, Notification>();

  // Add snapshot notifications first
  for (const n of snapshot) {
    if (n && n.id) {
      map.set(n.id, n);
    }
  }

  // Current notifications take precedence if the same id exists
  for (const n of current) {
    if (n && n.id) {
      map.set(n.id, n);
    }
  }

  const merged = Array.from(map.values());

  merged.sort((a, b) => {
    const timeA = a.timestamp ? Date.parse(a.timestamp) : 0;
    const timeB = b.timestamp ? Date.parse(b.timestamp) : 0;
    const validA = Number.isNaN(timeA) ? 0 : timeA;
    const validB = Number.isNaN(timeB) ? 0 : timeB;

    if (validB !== validA) {
      return validB - validA;
    }
    return (b.id ?? '').localeCompare(a.id ?? '');
  });

  return merged.slice(0, cap);
}
