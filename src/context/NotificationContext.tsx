import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  BannerAlert,
  Notification,
  NotificationCategory,
  NotificationPreferences,
  NotificationType,
  Toast,
  NotificationAction,
  NotificationActionDescriptor,
} from '../types/notification';
import { mergeNotifications } from './notificationMerge';
import {
  parseInbox,
  parsePreferences,
  serializeInbox,
  serializePreferences,
} from './notificationStorage';
import { writeJson } from '../utils/storage';
import { scopedKey, migrateLegacyStorage } from '../utils/scoped-storage';
import { useWallet } from './WalletContext';

// ─── Types ────────────────────────────────────────────────────────────────

export interface AddToastOptions {
  type: NotificationType;
  category?: NotificationCategory;
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  /** Action for transient toasts (non‑persisted) */
  action?: NotificationAction;
  /** Action descriptor for persisted notifications */
  actionDescriptor?: NotificationActionDescriptor;
  /** If true, also saves to notification history */
  saveToHistory?: boolean;
  /**
   * If true, bypasses user category mute preferences so the toast is always displayed.
   * Reserved for undo toasts and critical messages that must never be suppressed.
   */
  bypassPreferences?: boolean;
}

interface NotificationContextValue {
  // Toasts
  toasts: Toast[];
  addToast: (opts: AddToastOptions) => string;
  dismissToast: (id: string) => void;

  // Banners
  banners: BannerAlert[];
  addBanner: (banner: Omit<BannerAlert, 'id'>) => string;
  dismissBanner: (id: string) => void;

  // Notification center
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  undoRead: (ids: string[]) => void;
  clearAll: () => void;
  restoreNotifications: (notifications: Notification[]) => void;
  filterByCategory: (category: NotificationCategory | 'all') => Notification[];

  // Preferences
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;

  // Panel
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: NotificationPreferences = {
  transaction: true,
  credit_line: true,
  risk_score: true,
  rate_change: true,
  auction: true,
  system: true,
};

const BASE_STORAGE_KEY = scopedKey('creditra_notifications');
const BASE_PREFS_KEY = scopedKey('creditra_notification_prefs');

// ─── Context ──────────────────────────────────────────────────────────────────

/** Exported so NotificationBell can optionally consume without throwing. */
export const NotificationContext = createContext<NotificationContextValue | null>(null);

// Validate deserialized action descriptors.
const validateAction = (action: any): NotificationActionDescriptor | undefined => {
  if (!action || typeof action !== 'object' || typeof action.label !== 'string') return undefined;
  if (action.kind === 'route') {
    if (typeof action.to !== 'string') return undefined;
    if (!action.to.startsWith('/') || action.to.includes('://')) return undefined;
    return { label: action.label, kind: 'route', to: action.to } as NotificationActionDescriptor;
  }
  if (action.kind === 'command') {
    const valid = ['open-wallet', 'open-kyc', 'retry-sync'];
    if (valid.includes(action.id)) {
      return { label: action.label, kind: 'command', id: action.id } as NotificationActionDescriptor;
    }
  }
  return undefined;
};

function readInboxFromStorage(key: string): { parsed: Notification[]; needsRewrite: boolean } {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { parsed: [], needsRewrite: false };
    }
    const stored = localStorage.getItem(key);
    if (stored) {
      const raw = JSON.parse(stored);
      const parsed = parseInbox(raw);
      const validated = parsed.map(n => ({
        ...n,
        action: n.action ? validateAction(n.action) : undefined,
      }));
      const serialized = serializeInbox(validated);
      return { parsed: validated, needsRewrite: stored !== JSON.stringify(serialized) };
    }
  } catch {
    /* swallow parse errors */
  }
  return { parsed: [], needsRewrite: false };
}

function readPreferencesFromStorage(key: string): { parsed: NotificationPreferences; needsRewrite: boolean } {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { parsed: DEFAULT_PREFS, needsRewrite: false };
    }
    const stored = localStorage.getItem(key);
    if (stored) {
      const raw = JSON.parse(stored);
      const parsed = parsePreferences(raw);
      const serialized = serializePreferences(parsed);
      return { parsed, needsRewrite: stored !== JSON.stringify(serialized) };
    }
  } catch {
    /* swallow parse errors */
  }
  return { parsed: DEFAULT_PREFS, needsRewrite: false };
}

/**
 * App-wide notification provider.
 *
 * Owns three queues:
 * - `toasts` — transient, auto-dismissed after `duration` ms unless
 *   `persistent` is set
 * - `banners` — page-level alerts that persist until dismissed
 * - `notifications` — durable inbox, persisted to `localStorage` under
 *   wallet scope and capped at 100 entries to bound storage growth
 *
 * Per-category mute preferences are also persisted under wallet scope.
 *
 * Mount this once, after `WalletProvider`, near the top of the tree.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  let walletPublicKey: string | null = null;
  let isInsideWalletProvider = false;

  try {
    const walletContext = useWallet();
    walletPublicKey = walletContext.wallet?.publicKey ?? null;
    isInsideWalletProvider = true;
  } catch {
    walletPublicKey = null;
    isInsideWalletProvider = false;
  }

  const isDisconnected = isInsideWalletProvider && !walletPublicKey;
  const storageKey = scopedKey(BASE_STORAGE_KEY, walletPublicKey);
  const prefsKey = scopedKey(BASE_PREFS_KEY, walletPublicKey);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [banners, setBanners] = useState<BannerAlert[]>([]);

  // Initial read for first render
  const initialInbox = useRef<{ parsed: Notification[]; needsRewrite: boolean } | null>(null);
  if (initialInbox.current === null) {
    if (walletPublicKey) {
      migrateLegacyStorage(walletPublicKey);
    }
    initialInbox.current = isDisconnected
      ? { parsed: [], needsRewrite: false }
      : readInboxFromStorage(storageKey);
  }

  const initialPreferences = useRef<{ parsed: NotificationPreferences; needsRewrite: boolean } | null>(null);
  if (initialPreferences.current === null) {
    initialPreferences.current = isDisconnected
      ? { parsed: DEFAULT_PREFS, needsRewrite: false }
      : readPreferencesFromStorage(prefsKey);
  }

  const [notifications, setNotifications] = useState<Notification[]>(initialInbox.current.parsed);
  const [preferences, setPreferences] = useState<NotificationPreferences>(initialPreferences.current.parsed);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Re-hydrate inbox and preferences whenever the wallet identity changes
  const prevWalletRef = useRef<string | null>(walletPublicKey);
  useEffect(() => {
    if (prevWalletRef.current === walletPublicKey) return;
    prevWalletRef.current = walletPublicKey;

    if (isDisconnected) {
      setNotifications([]);
      setPreferences(DEFAULT_PREFS);
      return;
    }

    if (walletPublicKey) {
      migrateLegacyStorage(walletPublicKey);
    }

    const nextInbox = readInboxFromStorage(storageKey);
    const nextPrefs = readPreferencesFromStorage(prefsKey);
    setNotifications(nextInbox.parsed);
    setPreferences(nextPrefs.parsed);

    if (nextInbox.needsRewrite) {
      writeJson(storageKey, serializeInbox(nextInbox.parsed));
    }
    if (nextPrefs.needsRewrite) {
      writeJson(prefsKey, serializePreferences(nextPrefs.parsed));
    }
  }, [walletPublicKey, isDisconnected, storageKey, prefsKey]);

  // Initial rewrite if unversioned data was loaded on mount
  useEffect(() => {
    if (isDisconnected) return;
    if (initialInbox.current?.needsRewrite) {
      writeJson(storageKey, serializeInbox(initialInbox.current.parsed));
      initialInbox.current.needsRewrite = false;
    }
    if (initialPreferences.current?.needsRewrite) {
      writeJson(prefsKey, serializePreferences(initialPreferences.current.parsed));
      initialPreferences.current.needsRewrite = false;
    }
  }, [storageKey, prefsKey, isDisconnected]);

  // Persist notifications on changes (suppressed while disconnected)
  useEffect(() => {
    if (isDisconnected) return;
    writeJson(storageKey, serializeInbox(notifications));
  }, [notifications, storageKey, isDisconnected]);

  // Persist preferences on changes (suppressed while disconnected)
  useEffect(() => {
    if (isDisconnected) return;
    writeJson(prefsKey, serializePreferences(preferences));
  }, [preferences, prefsKey, isDisconnected]);

  // Clear all pending toast timers on provider unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // ─── Toasts ────────────────────────────────────────────────────────────────

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback((opts: AddToastOptions): string => {
    const category = opts.category ?? 'system';
    if (!opts.bypassPreferences && !preferences[category]) return '';

    const id = genId();
    const toast: Toast = {
      id,
      type: opts.type,
      category,
      title: opts.title,
      message: opts.message,
      timestamp: new Date().toISOString(),
      duration: opts.duration ?? 5500,
      persistent: opts.persistent ?? false,
      action: opts.action,
    };

    if (!toast.persistent) {
      const timer = setTimeout(() => dismissToast(id), toast.duration);
      timersRef.current.set(id, timer);
    }

    setToasts(prev => {
      const next = [toast, ...prev];
      if (next.length > 5) {
        const evicted = next.slice(5);
        for (const t of evicted) {
          const timer = timersRef.current.get(t.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(t.id);
          }
        }
        return next.slice(0, 5);
      }
      return next;
    });

    // While disconnected, notifications inbox stays empty and is not written to storage
    if (opts.saveToHistory !== false && !isDisconnected) {
      const notification: Notification = {
        id,
        type: opts.type,
        category,
        title: opts.title,
        message: opts.message,
        timestamp: new Date().toISOString(),
        read: false,
        action: opts.actionDescriptor,
      };
      setNotifications(prev => [notification, ...prev].slice(0, 100));
    }

    return id;
  }, [preferences, dismissToast, isDisconnected]);

  // ─── Banners ───────────────────────────────────────────────────────────────

  const addBanner = useCallback((banner: Omit<BannerAlert, 'id'>): string => {
    const id = genId();
    setBanners(prev => [...prev, { ...banner, id }]);
    return id;
  }, []);

  const dismissBanner = useCallback((id: string) => {
    setBanners(prev => prev.filter(b => b.id !== id));
  }, []);

  // ─── Notification center ───────────────────────────────────────────────────

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const undoRead = useCallback((ids: string[]) => {
    setNotifications(prev =>
      prev.map(n => (ids.includes(n.id) ? { ...n, read: false } : n))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const restoreNotifications = useCallback((toRestore: Notification[]) => {
    setNotifications(prev => mergeNotifications(toRestore, prev));
  }, []);

  const filterByCategory = useCallback(
    (category: NotificationCategory | 'all') =>
      category === 'all'
        ? notifications
        : notifications.filter(n => n.category === category),
    [notifications]
  );

  const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    setPreferences(prev => ({ ...prev, ...prefs }));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        addToast,
        dismissToast,
        banners,
        addBanner,
        dismissBanner,
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        undoRead,
        clearAll,
        restoreNotifications,
        filterByCategory,
        preferences,
        updatePreferences,
        isPanelOpen,
        openPanel: () => setIsPanelOpen(true),
        closePanel: () => setIsPanelOpen(false),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Read the notification context inside a `NotificationProvider` subtree.
 */
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

export { mergeNotifications } from './notificationMerge';
