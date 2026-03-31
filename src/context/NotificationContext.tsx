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
} from '../types/notification';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddToastOptions {
  type: NotificationType;
  category?: NotificationCategory;
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  action?: { label: string; onClick: () => void };
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
  clearAll: () => void;
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
  system: true,
};

const STORAGE_KEY = 'creditra_notifications';
const PREFS_KEY = 'creditra_notification_prefs';

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [banners, setBanners] = useState<BannerAlert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Persist notifications
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 100)));
  }, [notifications]);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  }, [preferences]);

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

    setToasts(prev => [toast, ...prev].slice(0, 5)); // max 5 stacked

    if (!toast.persistent) {
      const timer = setTimeout(() => dismissToast(id), toast.duration);
      timersRef.current.set(id, timer);
    }

    if (opts.saveToHistory !== false) {
      const notification: Notification = {
        id,
        type: opts.type,
        category,
        title: opts.title,
        message: opts.message,
        timestamp: new Date().toISOString(),
        read: false,
        action: opts.action,
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

  const clearAll = useCallback(() => {
    setNotifications([]);
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
        clearAll,
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

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
