import { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import type { NotificationCategory } from '../../types/notification';
import { CATEGORY_ICON, TYPE_COLOR, TYPE_ICON } from './notificationIcons';
import './NotificationCenter.css';

const CATEGORIES: { value: NotificationCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'transaction', label: 'Transactions' },
  { value: 'credit_line', label: 'Credit Lines' },
  { value: 'risk_score', label: 'Risk Score' },
  { value: 'rate_change', label: 'Rates' },
  { value: 'system', label: 'System' },
];

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export function NotificationCenter() {
  const {
    isPanelOpen,
    closePanel,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    filterByCategory,
    preferences,
    updatePreferences,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<NotificationCategory | 'all'>('all');
  const [showPrefs, setShowPrefs] = useState(false);

  const filtered = filterByCategory(activeFilter);

  return (
    <>
      {/* Backdrop */}
      {isPanelOpen && (
        <div className="nc-backdrop" onClick={closePanel} aria-hidden="true" />
      )}

      {/* Slide-in panel */}
      <div className={`nc-panel ${isPanelOpen ? 'nc-panel-open' : ''}`} role="dialog" aria-label="Notification center">
        {/* Header */}
        <div className="nc-header">
          <div className="nc-header-left">
            <span className="nc-title">Notifications</span>
            {unreadCount > 0 && (
              <span className="nc-badge">{unreadCount}</span>
            )}
          </div>
          <div className="nc-header-actions">
            <button
              className="nc-icon-btn"
              onClick={() => setShowPrefs(p => !p)}
              title="Preferences"
              aria-label="Notification preferences"
            >
              ⚙
            </button>
            {unreadCount > 0 && (
              <button className="nc-text-btn" onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button className="nc-text-btn nc-text-btn-danger" onClick={clearAll}>
                Clear all
              </button>
            )}
            <button className="nc-close-btn" onClick={closePanel} aria-label="Close">
              ×
            </button>
          </div>
        </div>

        {/* Preferences panel */}
        {showPrefs && (
          <div className="nc-prefs">
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
        )}

        {/* Filter tabs */}
        <div className="nc-filters" role="tablist">
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

        {/* Notification list */}
        <div className="nc-list">
          {filtered.length === 0 ? (
            <div className="nc-empty">
              <span className="nc-empty-icon">🔔</span>
              <p>No notifications</p>
            </div>
          ) : (
            filtered.map(n => {
              const colors = TYPE_COLOR[n.type];
              return (
                <div
                  key={n.id}
                  className={`nc-item ${!n.read ? 'nc-item-unread' : ''}`}
                  onClick={() => markAsRead(n.id)}
                >
                  <span
                    className="nc-item-icon"
                    style={{ background: colors.bg, color: colors.icon }}
                  >
                    {TYPE_ICON[n.type]}
                  </span>
                  <div className="nc-item-body">
                    <div className="nc-item-header">
                      <span className="nc-item-title">{n.title}</span>
                      <span className="nc-item-time">{relativeTime(n.timestamp)}</span>
                    </div>
                    <p className="nc-item-message">{n.message}</p>
                    {n.action && (
                      <button
                        className="nc-item-action"
                        style={{ color: colors.text }}
                        onClick={e => { e.stopPropagation(); n.action!.onClick(); }}
                      >
                        {n.action.label} →
                      </button>
                    )}
                  </div>
                  {!n.read && <span className="nc-unread-dot" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
