import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreditData } from '../context/CreditDataContext';
import { useNotifications } from '../context/NotificationContext';
import { useWalletIdentityKey } from './useWalletIdentityKey';
import { now as getNow } from '../lib/clock';
import {
  computeDueReminders,
  pruneExpiredReminderKeys,
} from '../lib/payment-reminders';
import { readJson, writeJson } from '../utils/storage';

const STORAGE_KEY_PREFIX = 'creditra_payment_reminders_sent_v1';

export function getPaymentReminderStorageKey(walletIdentity: string | null): string {
  return `${STORAGE_KEY_PREFIX}:${walletIdentity ?? 'default'}`;
}

/**
 * Computes milliseconds from `reference` until the next local midnight.
 * Using `new Date(y, m, d + 1, 0, 0, 0, 0)` naturally respects DST transitions
 * (23-hour spring-forward and 25-hour fall-back days).
 */
export function getMsUntilNextLocalMidnight(reference: Date): number {
  const nextMidnight = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1000, nextMidnight.getTime() - reference.getTime());
}

function readSentKeys(storageKey: string): string[] {
  const raw = readJson<unknown>(storageKey, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Watches the active wallet's credit lines and emits deduplicated in-app
 * repayment reminder notifications (7d, 1d, due today, overdue).
 *
 * Triggers:
 *  - on mount
 *  - whenever `lines`, wallet identity, or notification preferences change
 *  - when the tab becomes visible (`visibilitychange`)
 *  - at local midnight via a self-rescheduling timer
 */
export function usePaymentReminders(): void {
  const { lines } = useCreditData();
  const { addToast, preferences } = useNotifications();
  const walletIdentity = useWalletIdentityKey();
  const navigate = useNavigate();

  const evaluate = useCallback(() => {
    const currentNow = getNow();
    const storageKey = getPaymentReminderStorageKey(walletIdentity);

    // Read fresh from localStorage on every evaluation so multiple tabs share
    // the same deduplication state without emitting duplicate notifications.
    const storedKeys = readSentKeys(storageKey);
    const prunedKeys = pruneExpiredReminderKeys(storedKeys, currentNow);
    const prunedSet = new Set(prunedKeys);

    // Persist pruned list if expired keys were removed.
    if (prunedKeys.length !== storedKeys.length) {
      writeJson(storageKey, prunedKeys);
    }

    // Respect user notification preferences for the credit_line category.
    if (!preferences.credit_line) {
      return;
    }

    const dueReminders = computeDueReminders(lines, currentNow, prunedSet);
    if (dueReminders.length === 0) {
      return;
    }

    let didEmit = false;
    for (const reminder of dueReminders) {
      const id = addToast({
        type: reminder.type,
        category: 'credit_line',
        title: reminder.title,
        message: reminder.message,
        action: {
          label: reminder.ctaLabel,
          onClick: () => navigate(reminder.ctaTo),
        },
        actionDescriptor: {
          label: reminder.ctaLabel,
          kind: 'route',
          to: reminder.ctaTo,
        },
        saveToHistory: true,
      });

      if (id) {
        prunedSet.add(reminder.key);
        didEmit = true;
      }
    }

    if (didEmit) {
      writeJson(storageKey, Array.from(prunedSet));
    }
  }, [lines, walletIdentity, preferences.credit_line, addToast, navigate]);

  // Run on mount and whenever lines / wallet / preferences change.
  useEffect(() => {
    evaluate();
  }, [evaluate]);

  // Run when the document becomes visible again (e.g. returning to a background tab).
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        evaluate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [evaluate]);

  // Schedule a timer for the next local midnight, rescheduling after each fire.
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const scheduleNext = () => {
      const delay = getMsUntilNextLocalMidnight(getNow());
      timerId = setTimeout(() => {
        if (cancelled) return;
        evaluate();
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }, [evaluate]);
}
