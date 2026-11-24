import { normalizeText } from '../../lib/faq-search';
import type {
  Notification,
  NotificationCategory,
  NotificationType,
} from '../../types/notification';

export interface NotificationFilterOptions {
  category?: NotificationCategory | 'all';
  type?: NotificationType | 'all';
  query?: string;
}

/**
 * Pure filter helper for the notification inbox.
 *
 * Combines category, severity type, and accent/case-insensitive substring
 * matching over `title` and `message`.
 */
export function filterNotifications(
  list: readonly Notification[],
  { category = 'all', type = 'all', query = '' }: NotificationFilterOptions = {},
): Notification[] {
  const normalizedQuery = normalizeText(query);

  return list.filter((item) => {
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    if (type !== 'all' && item.type !== type) {
      return false;
    }
    if (normalizedQuery) {
      const normalizedTitle = normalizeText(item.title);
      const normalizedMessage = normalizeText(item.message);
      if (
        !normalizedTitle.includes(normalizedQuery) &&
        !normalizedMessage.includes(normalizedQuery)
      ) {
        return false;
      }
    }
    return true;
  });
}
