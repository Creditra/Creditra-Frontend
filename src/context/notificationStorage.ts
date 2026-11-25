import type {
  NotificationActionDescriptor,
  Notification,
  NotificationCategory,
  NotificationCommandId,
  NotificationPreferences,
  NotificationType,
} from '../types/notification';
import { NOTIFICATION_COMMAND_IDS } from '../types/notification';

const VALID_TYPES: NotificationType[] = ['success', 'error', 'warning', 'info', 'danger'];
const VALID_CATEGORIES: NotificationCategory[] = [
  'transaction',
  'credit_line',
  'risk_score',
  'rate_change',
  'auction',
  'system',
];

const STORAGE_VERSION = 1;
export const MAX_INBOX_SIZE = 100;
/** Retention window for persisted notifications (30 days). */
export const MAX_INBOX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const VALID_COMMAND_IDS: ReadonlySet<string> = new Set(NOTIFICATION_COMMAND_IDS);

const DEFAULT_PREFS: NotificationPreferences = {
  transaction: true,
  credit_line: true,
  risk_score: true,
  rate_change: true,
  auction: true,
  system: true,
};

interface StorageEnvelope {
  v: number;
  items: Notification[];
}

function isValidNotificationType(type: unknown): type is NotificationType {
  return typeof type === 'string' && VALID_TYPES.includes(type as NotificationType);
}

function isValidNotificationCategory(category: unknown): category is NotificationCategory {
  return typeof category === 'string' && VALID_CATEGORIES.includes(category as NotificationCategory);
}

function isValidISO8601Timestamp(timestamp: unknown): boolean {
  if (typeof timestamp !== 'string') return false;
  const date = new Date(timestamp);
  return !Number.isNaN(date.getTime()) && timestamp === date.toISOString();
}

function isValidNotification(notification: unknown): notification is Notification {
  if (!notification || typeof notification !== 'object') return false;

  const n = notification as Record<string, unknown>;

  return (
    typeof n.id === 'string' &&
    n.id.length > 0 &&
    isValidNotificationType(n.type) &&
    isValidNotificationCategory(n.category) &&
    typeof n.title === 'string' &&
    n.title.length > 0 &&
    typeof n.message === 'string' &&
    isValidISO8601Timestamp(n.timestamp) &&
    typeof n.read === 'boolean'
  );
}

function parseActionDescriptor(
  action: unknown,
): NotificationActionDescriptor | undefined {
  if (!action || typeof action !== 'object') return undefined;
  const descriptor = action as Record<string, unknown>;
  if (typeof descriptor.label !== 'string' || typeof descriptor.kind !== 'string') {
    return undefined;
  }
  if (
    descriptor.kind === 'route' &&
    typeof descriptor.to === 'string' &&
    descriptor.to.startsWith('/') &&
    !descriptor.to.includes('://')
  ) {
    return { label: descriptor.label, kind: 'route', to: descriptor.to };
  }
  if (
    descriptor.kind === 'command' &&
    typeof descriptor.id === 'string' &&
    VALID_COMMAND_IDS.has(descriptor.id)
  ) {
    return {
      label: descriptor.label,
      kind: 'command',
      id: descriptor.id as NotificationCommandId,
    };
  }
  return undefined;
}

function parseEnvelope(raw: unknown): Notification[] | null {
  if (!raw || typeof raw !== 'object') return null;

  const envelope = raw as Record<string, unknown>;

  if (envelope.v !== STORAGE_VERSION) return null;
  if (!Array.isArray(envelope.items)) return null;

  return envelope.items;
}

function isWithinRetentionWindow(timestamp: string, now: number): boolean {
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts)) return false;
  return ts >= now - MAX_INBOX_AGE_MS;
}

/**
 * Parse and validate persisted inbox data (versioned envelope or legacy bare array).
 *
 * Pruning rules:
 * 1. Drop invalid entries and duplicate IDs (keeping the first occurrence).
 * 2. Drop entries older than `MAX_INBOX_AGE_MS` relative to `now` (entries exactly at
 *    the cutoff or future-dated are retained).
 * 3. Cap at `MAX_INBOX_SIZE` entries (all severities, including unread `danger`/`error`,
 *    follow the same FIFO count cap).
 */
export function parseInbox(raw: unknown, now: number = Date.now()): Notification[] {
  let notifications: Notification[] = [];

  // Try to parse as versioned envelope first
  const envelopeItems = parseEnvelope(raw);
  if (envelopeItems !== null) {
    notifications = envelopeItems;
  } else if (Array.isArray(raw)) {
    // Legacy bare-array format
    notifications = raw;
  } else {
    // Invalid format (null, object, string, number, etc.)
    return [];
  }

  // Filter valid, in-window notifications, preserve order, deduplicate by id
  const seen = new Set<string>();
  const valid: Notification[] = [];

  for (const n of notifications) {
    if (isValidNotification(n) && !seen.has(n.id) && isWithinRetentionWindow(n.timestamp, now)) {
      seen.add(n.id);
      valid.push({
        ...n,
        action: n.action === undefined ? undefined : parseActionDescriptor(n.action),
      });
    }
  }

  // Cap at MAX_INBOX_SIZE
  return valid.slice(0, MAX_INBOX_SIZE);
}

export function parsePreferences(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_PREFS;
  }

  const input = raw as Record<string, unknown>;
  const result: Partial<NotificationPreferences> = {};

  for (const category of VALID_CATEGORIES) {
    const value = input[category];
    if (typeof value === 'boolean') {
      result[category] = value;
    }
  }

  // Fill in defaults for any missing categories
  return {
    transaction: result.transaction ?? DEFAULT_PREFS.transaction,
    credit_line: result.credit_line ?? DEFAULT_PREFS.credit_line,
    risk_score: result.risk_score ?? DEFAULT_PREFS.risk_score,
    rate_change: result.rate_change ?? DEFAULT_PREFS.rate_change,
    auction: result.auction ?? DEFAULT_PREFS.auction,
    system: result.system ?? DEFAULT_PREFS.system,
  };
}

/**
 * Serialize inbox into a versioned storage envelope.
 * Applies age pruning first, then caps at `MAX_INBOX_SIZE` (all severities follow the same FIFO cap).
 */
export function serializeInbox(
  notifications: Notification[],
  now: number = Date.now()
): StorageEnvelope {
  const fresh = notifications.filter((n) => isWithinRetentionWindow(n.timestamp, now));
  return {
    v: STORAGE_VERSION,
    items: fresh.slice(0, MAX_INBOX_SIZE),
  };
}

export function serializePreferences(preferences: NotificationPreferences): NotificationPreferences {
  return preferences;
}