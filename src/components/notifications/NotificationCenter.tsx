/**
 * NotificationCenter
 *
 * Desktop: right-side slide-in panel (380 px wide).
 * Mobile (≤ 640px): full-height bottom sheet with drag handle and
 * keyboard-accessible expand/collapse controls that snap between a
 * "half" (50vh) and "full" (90vh) height.
 *
 * 6-second undo toast support for mark-all-read, clear-all, and
 * individual mark-as-read actions.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useInertBackdrop } from '../../hooks/useInertBackdrop';
import type { Notification, NotificationCategory } from '../../types/notification';
import { CATEGORY_ICON, TYPE_COLOR, TYPE_ICON } from './notificationIcons';
import { KbdHint } from '../KbdHint';
import './NotificationCenter.css';

const PANEL_ID = 'notification-center';

/** Viewport width (px) below which the panel becomes a bottom sheet. */
export const NOTIFICATION_CENTER_MD_BREAKPOINT = 640;

/** Fraction of viewport height for each mobile sheet snap point. */
export const SHEET_SNAP_RATIOS = {
  half: 0.5,
  full: 0.9,
} as const;

export type SheetSnapPoint = keyof typeof SHEET_SNAP_RATIOS;
type SheetSnapResult = SheetSnapPoint | 'dismiss';

/**
 * Resolve a drag/height ratio (0–1 of viewport height) to a target
 * mobile sheet snap point. Ratios below the lower threshold dismiss
 * the sheet entirely; the remaining range splits between the two
 * snap points.
 */
export function resolveSheetSnapFromRatio(ratio: number): SheetSnapResult {
  if (ratio < 0.35) return 'dismiss';
  if (ratio < 0.7) return 'half';
  return 'full';
}

/** True when the viewport is narrow enough to use the bottom-sheet layout. */
function useMobileSheetActive(): boolean {
  const query = `(max-width: ${NOTIFICATION_CENTER_MD_BREAKPOINT - 1}px)`;
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

const CATEGORIES: { value: NotificationCategory | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'transaction', label: 'Transactions' },
  { value: 'credit_line', label: 'Credit Lines' },
  { value: 'risk_score',  label: 'Risk Score' },
  { value: 'rate_change', label: 'Rates' },
  { value: 'system',      label: 'System' },
];

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

interface NotificationCenterProps {
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function NotificationCenter({ triggerRef }: NotificationCenterProps = {}) {
  const {
    isPanelOpen,
    closePanel,
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
    addToast,
    dismissToast,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<NotificationCategory | 'all'>('all');
  const [showPrefs, setShowPrefs] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMobileSheet = useMobileSheetActive();
  const [snapPoint, setSnapPoint] = useState<SheetSnapPoint>('half');

  const panelRef = useFocusTrap({
    isActive: isPanelOpen,
    triggerRef,
    onEscape: closePanel,
  });

  useBodyScrollLock({ isLocked: isPanelOpen });
  useInertBackdrop({ isInert: isPanelOpen, modalId: PANEL_ID });

  // Reset to the half snap point every time the sheet is (re)opened.
  useEffect(() => {
    if (isPanelOpen) setSnapPoint('half');
  }, [isPanelOpen]);

  // Clear the pending announcement-clear timer on unmount.
  useEffect(() => {
    return () => {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    };
  }, []);

  const filtered = filterByCategory(activeFilter);
  const dragStartY = useRef<number | null>(null);
  const panelElRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    if (delta < 0) return;
    if (panelElRef.current) {
      panelElRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;
    if (panelElRef.current) {
      panelElRef.current.style.transform = '';
    }

    if (isMobileSheet) {
      const startRatio = SHEET_SNAP_RATIOS[snapPoint];
      const newRatio = startRatio - delta / window.innerHeight;
      const resolved = resolveSheetSnapFromRatio(newRatio);
      if (resolved === 'dismiss') {
        closePanel();
      } else {
        setSnapPoint(resolved);
      }
      return;
    }

    if (delta > 80) {
      closePanel();
    }
  };

  const setRefs = (el: HTMLDivElement | null) => {
    panelElRef.current = el;
    (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  const announce = useCallback((count: number) => {
    setAnnouncement(`${count} notification${count !== 1 ? 's' : ''} marked as read`);
    if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    announcementTimerRef.current = setTimeout(() => setAnnouncement(''), 3000);
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    const prior = [...notifications];
    const count = unreadCount;
    const toastId = addToast({
      type: 'success',
      title: 'Marked all as read',
      message: `${unreadCount} notification${unreadCount !== 1 ? 's' : ''}`,
      action: {
        label: 'Undo',
        onClick: () => {
          undoRead(prior.map(n => n.id));
          dismissToast(toastId);
        },
      },
      duration: 6000,
      saveToHistory: false,
    });
    markAllAsRead();
    announce(count);
  }, [notifications, unreadCount, addToast, dismissToast, undoRead, markAllAsRead, announce]);

  // Keyboard shortcut: Shift+R to mark all as read when panel is open.
  // Declared after handleMarkAllAsRead so the dependency array below can
  // reference it without hitting the temporal-dead-zone ReferenceError
  // (the callback is a const useCallback, so it must be initialized before
  // this effect's deps are evaluated during render).
  useEffect(() => {
    if (!isPanelOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift+R produces e.key === 'R' (uppercase) — normalise so the
      // shortcut works regardless of caps-lock / shift-modifier casing.
      if (e.shiftKey && e.key.toLowerCase() === 'r' && unreadCount > 0) {
        e.preventDefault();
        handleMarkAllAsRead();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, unreadCount, handleMarkAllAsRead]);

  const handleClearAll = useCallback(() => {
    const prior = [...notifications];
    const toastId = addToast({
      type: 'success',
      title: 'Cleared all notifications',
      message: `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`,
      action: {
        label: 'Undo',
        onClick: () => {
          restoreNotifications(prior);
          dismissToast(toastId);
        },
      },
      duration: 6000,
      saveToHistory: false,
    });
    clearAll();
  }, [notifications, addToast, dismissToast, restoreNotifications, clearAll]);

  const handleItemClick = useCallback((notification: Notification) => {
    if (notification.read) {
      markAsRead(notification.id);
      return;
    }

    markAsRead(notification.id);
    const toastId = addToast({
      type: 'success',
      title: 'Marked as read',
      message: notification.title,
      action: {
        label: 'Undo',
        onClick: () => {
          undoRead([notification.id]);
          dismissToast(toastId);
        },
      },
      duration: 5500,
      saveToHistory: false,
    });
  }, [markAsRead, addToast, dismissToast, undoRead]);

  return (
    <>
      {isPanelOpen && (
        <div
          className="nc-backdrop"
          onClick={closePanel}
          aria-hidden="true"
        />
      )}

      <div
        ref={setRefs}
        id={PANEL_ID}
        className={[
          'nc-panel',
          isPanelOpen ? 'nc-panel-open' : '',
          isMobileSheet ? `nc-panel-snap-${snapPoint}` : '',
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal={isPanelOpen}
        aria-label="Notification center"
        aria-hidden={!isPanelOpen}
        onKeyDown={e => { if (e.key === 'Escape') closePanel(); }}
      >
        <div
          className="nc-drag-handle-area"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          aria-hidden="true"
        >
          <div className="nc-drag-handle" />
        </div>

        {isMobileSheet && isPanelOpen && (
          <div className="nc-sheet-controls">
            <button
              type="button"
              className="nc-sheet-control-btn"
              onClick={() => setSnapPoint('full')}
              aria-label="Expand notification panel to full height"
            >
              ⌃
            </button>
            <button
              type="button"
              className="nc-sheet-control-btn"
              onClick={() => setSnapPoint('half')}
              aria-label="Collapse notification panel to half height"
            >
              ⌄
            </button>
          </div>
        )}

        <div className="nc-header">
          <div className="nc-header-left">
            <span className="nc-title">Notifications</span>
            {unreadCount > 0 && (
              <span className="nc-badge tabular-nums" aria-label={`${unreadCount} unread`}>
                {unreadCount}
              </span>
            )}
          </div>
          <div className="nc-header-actions">
            <button
              className="nc-icon-btn"
              onClick={() => setShowPrefs(p => !p)}
              aria-label="Notification preferences"
              aria-expanded={showPrefs}
              aria-controls="nc-prefs-panel"
            >
              ⚙
            </button>
            <button
              className="nc-text-btn"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
              aria-label={`Mark all notifications as read${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            >
              <span className="nc-btn-content">
                Mark all read
                {unreadCount > 0 && (
                  <KbdHint 
                    keys={['Shift', 'R']} 
                    variant="badge"
                    className="nc-shortcut-hint"
                    aria-label="Keyboard shortcut: Shift then R"
                  />
                )}
              </span>
            </button>
            {notifications.length > 0 && (
              <button
                className="nc-text-btn nc-text-btn-danger"
                onClick={handleClearAll}
                aria-label="Clear all notifications"
              >
                Clear all
              </button>
            )}
            <button
              className="nc-close-btn"
              onClick={closePanel}
              aria-label="Close notification center"
            >
              ×
            </button>
          </div>
        </div>

        <div
          id="nc-prefs-panel"
          className={`nc-prefs ${showPrefs ? 'nc-prefs-open' : ''}`}
          aria-hidden={!showPrefs}
        >
          <p className="nc-prefs-title">Notification Preferences</p>
          {CATEGORIES.filter(c => c.value !== 'all').map(cat => (
            <label key={cat.value} className="nc-pref-row">
              <span className="nc-pref-label">
                {CATEGORY_ICON[cat.value as NotificationCategory]} {cat.label}
              </span>
              <input
                type="checkbox"
                className="nc-pref-toggle"
                checked={preferences[cat.value as NotificationCategory]}
                onChange={e =>
                  updatePreferences({ [cat.value]: e.target.checked })
                }
              />
            </label>
          ))}
        </div>

        <div className="nc-filters" role="tablist" aria-label="Filter notifications by category">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              role="tab"
              aria-selected={activeFilter === cat.value}
              className={`nc-filter-tab ${activeFilter === cat.value ? 'nc-filter-active' : ''}`}
              onClick={() => setActiveFilter(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div
          className="nc-list"
          role="feed"
          aria-label={`${filtered.length} notification${filtered.length !== 1 ? 's' : ''}`}
          aria-busy="false"
        >
          {filtered.length === 0 ? (
            <div className="nc-empty" role="status">
              <span className="nc-empty-icon" aria-hidden="true">🔔</span>
              <p>No notifications</p>
            </div>
          ) : (
            filtered.map(n => {
              const colors = TYPE_COLOR[n.type];
              return (
                <article
                  key={n.id}
                  className={`nc-item ${!n.read ? 'nc-item-unread' : ''}`}
                  aria-label={`${n.title}${!n.read ? ', unread' : ''}`}
                  onClick={() => handleItemClick(n)}
                >
                  <span
                    className="nc-item-icon"
                    style={{ background: colors.bg, color: colors.icon }}
                    aria-hidden="true"
                  >
                    {TYPE_ICON[n.type]}
                  </span>
                  <div className="nc-item-body">
                    <div className="nc-item-header">
                      <span className="nc-item-title">{n.title}</span>
                      <time
                        className="nc-item-time tabular-nums"
                        dateTime={n.timestamp}
                        aria-label={`Received ${relativeTime(n.timestamp)}`}
                      >
                        {relativeTime(n.timestamp)}
                      </time>
                    </div>
                    <p className="nc-item-message">{n.message}</p>
                    {n.action && (
                      <button
                        className="nc-item-action"
                        style={{ color: colors.text }}
                        onClick={e => { e.stopPropagation(); n.action!.onClick(); }}
                        aria-label={`${n.action.label} for notification: ${n.title}`}
                      >
                        {n.action.label} →
                      </button>
                    )}
                  </div>
                  {!n.read && (
                    <span className="nc-unread-dot" aria-hidden="true" />
                  )}
                </article>
              );
            })
          )}
        </div>

        {announcement && (
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {announcement}
          </div>
        )}
      </div>
    </>
  );
}
