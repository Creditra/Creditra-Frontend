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
import {
  parseInbox,
  parsePreferences,
  serializeInbox,
  serializePreferences,
} from './notificationStorage';
import { writeJson } from '../utils/storage';

// ─── Types ────────────────────────────────────────────────────────────────

interface AddToastOptions {
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

const STORAGE_KEY = 'creditra_notifications';
const PREFS_KEY = 'creditra_notification_prefs';

// ─── Context ──────────────────────────────────────────────────────────────────

/** Exported so NotificationBell can optionally consume without throwing. */
export const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * App-wide notification provider.
 *
 * Owns three queues:
 * - `toasts` — transient, auto-dismissed after `duration` ms unless
 *   `persistent` is set
 * - `banners` — page-level alerts that persist until dismissed
 * - `notifications` — durable inbox, persisted to `localStorage` and
 *   capped at 100 entries to bound storage growth
 *
 * Per-category mute preferences are also persisted; a muted category
 * causes `addToast` to return early with an empty id so callers can
 * fire-and-forget without conditionals.
 *
 * Mount this once, after `WalletProvider`, near the top of the tree.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [banners, setBanners] = useState<BannerAlert[]>([]);

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

  // Parse notifications and detect if rewrite is needed
  const notificationsInit = useRef<{ parsed: Notification[]; needsRewrite: boolean }>({ parsed: [], needsRewrite: false });
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const raw = JSON.parse(stored);
      const parsed = parseInbox(raw);
      // Apply action validation to parsed notifications
      const validated = parsed.map(n => ({
        ...n,
        action: n.action ? validateAction(n.action) : undefined,
      }));
      const serialized = serializeInbox(validated);
      notificationsInit.current = { parsed: validated, needsRewrite: stored !== serialized };
    }
  } catch {
    notificationsInit.current = { parsed: [], needsRewrite: false };
  }
  const [notifications, setNotifications] = useState<Notification[]>(notificationsInit.current.parsed);

  // Parse preferences and detect if rewrite is needed
  const preferencesInit = useRef<{ parsed: NotificationPreferences; needsRewrite: boolean }>({ parsed: DEFAULT_PREFS, needsRewrite: false });
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      const raw = JSON.parse(stored);
      const parsed = parsePreferences(raw);
      const serialized = serializePreferences(parsed);
      preferencesInit.current = { parsed, needsRewrite: stored !== serialized };
    }
  } catch {
    preferencesInit.current = { parsed: DEFAULT_PREFS, needsRewrite: false };
  }
  const [preferences, setPreferences] = useState<NotificationPreferences>(preferencesInit.current.parsed);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const hasHydratedRef = useRef(false);

  // Rewrite storage on mount if data was cleaned/migrated (synchronous during render)
  if (!hasHydratedRef.current) {
    hasHydratedRef.current = true;
    if (notificationsInit.current.needsRewrite) {
      writeJson(STORAGE_KEY, serializeInbox(notifications));
    }
    if (preferencesInit.current.needsRewrite) {
      writeJson(PREFS_KEY, serializePreferences(preferences));
    }
  }

  // Persist notifications on changes
  useEffect(() => {
    writeJson(STORAGE_KEY, serializeInbox(notifications));
  }, [notifications]);

  // Persist preferences on changes
  useEffect(() => {
    writeJson(PREFS_KEY, serializePreferences(preferences));
  }, [preferences]);

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
    if (!preferences[category]) return '';

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

    if (opts.saveToHistory !== false) {
      const notification: Notification = {
        id,
        type: opts.type,
        category,
        title: opts.title,
        message: opts.message,
        timestamp: new Date().toISOString(),
        read: false,
        // Persist descriptor only
        action: opts.actionDescriptor,
      };
      setNotifications(prev => [notification, ...prev].slice(0, 100));
    }

    return id;
  }, [preferences, dismissToast]);

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
    setNotifications(toRestore);
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
 * Read the notification context inside a `NotificationProvider`
 * subtree.
 *
 * Throws on misuse rather than returning a possibly-undefined value, so
 * a misplaced consumer surfaces at the call site instead of leaking a
 * confusing "cannot read property of undefined" downstream.
 */
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
