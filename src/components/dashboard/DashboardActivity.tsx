import { Link } from 'react-router-dom';
import { CopyLoanButton } from '../CopyLoanButton';
import { Skeleton } from '../Skeleton';
import { SyncIndicator } from '../SyncIndicator';
import { useDashboardDataContext } from '../../hooks/useDashboardData';
import { relativeTime, TX_COLOR, TX_ICON } from '../../pages/dashboard-utils';
import { COLOR, fmt } from '../../utils/tokens';

export function DashboardActivity() {
  const {
    animDelay,
    status,
    activitySyncedAt,
    handleActivityRefresh,
    hasLines,
    activeLinesOnly,
    totalAvailable,
    hasUtilized,
    totalUtilized,
    creditLines,
    recentActivity,
    notifications,
  } = useDashboardDataContext();

  return (
    <div>
      <div className="card" style={animDelay({ animationDelay: '0.12s' })}>
        <h2>
          <span className="icon">⚡</span> Quick Actions
        </h2>
        <div className="quick-actions-grid">
          {!hasLines && (
            <button
              className="qa-btn"
              style={{ borderColor: 'rgba(88,166,255,0.3)' }}
            >
              <div
                className="qa-icon"
                style={{
                  background: 'rgba(88,166,255,0.12)',
                  color: COLOR.accent,
                }}
              >
                🆕
              </div>
              <div>
                <div className="qa-label" style={{ color: COLOR.accent }}>
                  Open Credit Line
                </div>
                <div className="qa-desc" style={{ color: COLOR.muted }}>
                  Get started with your first line
                </div>
              </div>
              <span className="qa-arrow" style={{ color: COLOR.muted }}>
                →
              </span>
            </button>
          )}
          {hasLines && activeLinesOnly.length > 0 && (
            <button
              className="qa-btn"
              style={{ borderColor: 'rgba(88,166,255,0.3)' }}
            >
              <div
                className="qa-icon"
                style={{
                  background: 'rgba(88,166,255,0.12)',
                  color: COLOR.accent,
                }}
              >
                ↗
              </div>
              <div>
                <div className="qa-label" style={{ color: COLOR.accent }}>
                  Draw Credit
                </div>
                <div
                  className="qa-desc num-tabular"
                  style={{ color: COLOR.muted }}
                >
                  {fmt(totalAvailable)} available
                </div>
              </div>
              <span className="qa-arrow" style={{ color: COLOR.muted }}>
                →
              </span>
            </button>
          )}
          {hasUtilized && (
            <button
              className="qa-btn"
              style={{ borderColor: 'rgba(63,185,80,0.3)' }}
            >
              <div
                className="qa-icon"
                style={{
                  background: 'rgba(63,185,80,0.12)',
                  color: COLOR.success,
                }}
              >
                ↙
              </div>
              <div>
                <div className="qa-label" style={{ color: COLOR.success }}>
                  Repay Credit
                </div>
                <div
                  className="qa-desc num-tabular"
                  style={{ color: COLOR.muted }}
                >
                  {fmt(totalUtilized)} outstanding
                </div>
              </div>
              <span className="qa-arrow" style={{ color: COLOR.muted }}>
                →
              </span>
            </button>
          )}
          <Link
            to="/credit-lines"
            className="qa-btn"
            style={{ borderColor: 'transparent', textDecoration: 'none' }}
          >
            <div
              className="qa-icon"
              style={{
                background: 'rgba(139,148,158,0.12)',
                color: COLOR.muted,
              }}
            >
              📋
            </div>
            <div>
              <div className="qa-label" style={{ color: COLOR.text }}>
                View Credit Lines
              </div>
              <div className="qa-desc" style={{ color: COLOR.muted }}>
                Manage all your credit lines
              </div>
            </div>
            <span className="qa-arrow" style={{ color: COLOR.muted }}>
              →
            </span>
          </Link>
          {hasLines && <CopyLoanButton creditLines={creditLines} />}
        </div>
      </div>

      <div
        className="card"
        style={animDelay({ animationDelay: '0.18s' })}
        aria-busy={status === 'loading'}
      >
        <h2>
          <span className="icon">📝</span> Recent Activity
          {status === 'success' && activitySyncedAt && (
            <SyncIndicator
              lastSyncedAt={activitySyncedAt}
              onRefresh={handleActivityRefresh}
              className="sync-indicator--card-header"
            />
          )}
        </h2>
        {status === 'loading' ? (
          <>
            <div className="activity-item">
              <Skeleton
                className="activity-icon"
                style={{ borderRadius: '6px' }}
              />
              <div
                className="activity-content"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                }}
              >
                <Skeleton
                  style={{
                    width: '120px',
                    height: 'var(--space-3)',
                    borderRadius: '2px',
                  }}
                />
                <Skeleton
                  style={{
                    width: '180px',
                    height: '10px',
                    borderRadius: '2px',
                  }}
                />
              </div>
              <Skeleton
                style={{
                  width: '60px',
                  height: 'var(--space-3)',
                  marginLeft: 'auto',
                  borderRadius: '2px',
                }}
              />
            </div>
            <div className="activity-item">
              <Skeleton
                className="activity-icon"
                style={{ borderRadius: '6px' }}
              />
              <div
                className="activity-content"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                }}
              >
                <Skeleton
                  style={{
                    width: '100px',
                    height: 'var(--space-3)',
                    borderRadius: '2px',
                  }}
                />
                <Skeleton
                  style={{
                    width: '150px',
                    height: '10px',
                    borderRadius: '2px',
                  }}
                />
              </div>
              <Skeleton
                style={{
                  width: '50px',
                  height: 'var(--space-3)',
                  marginLeft: 'auto',
                  borderRadius: '2px',
                }}
              />
            </div>
            <div className="activity-item">
              <Skeleton
                className="activity-icon"
                style={{ borderRadius: '6px' }}
              />
              <div
                className="activity-content"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                }}
              >
                <Skeleton
                  style={{
                    width: '140px',
                    height: 'var(--space-3)',
                    borderRadius: '2px',
                  }}
                />
                <Skeleton
                  style={{
                    width: '160px',
                    height: '10px',
                    borderRadius: '2px',
                  }}
                />
              </div>
              <Skeleton
                style={{
                  width: '70px',
                  height: 'var(--space-3)',
                  marginLeft: 'auto',
                  borderRadius: '2px',
                }}
              />
            </div>
          </>
        ) : recentActivity.length === 0 ? (
          <p
            style={{
              color: COLOR.muted,
              fontSize: '0.8rem',
              textAlign: 'center',
              padding: '1.5rem 0',
            }}
          >
            No transactions yet
          </p>
        ) : (
          recentActivity.map((transaction, index) => (
            <div
              key={`${transaction.id}-${index}`}
              className="activity-item"
            >
              <div
                className="activity-icon"
                style={{
                  background: `${TX_COLOR[transaction.type]}15`,
                  color: TX_COLOR[transaction.type],
                }}
              >
                {TX_ICON[transaction.type]}
              </div>
              <div className="activity-content">
                <div className="activity-title">
                  {transaction.note || transaction.type}
                </div>
                <div className="activity-sub">
                  {transaction.lineName} · {relativeTime(transaction.date)}
                </div>
              </div>
              <div
                className="activity-amount num-tabular"
                style={{ color: TX_COLOR[transaction.type] }}
              >
                {transaction.type === 'Repay' ? '+' : '-'}
                {fmt(transaction.amount)}
              </div>
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div
          className="card"
          style={animDelay({ animationDelay: '0.22s' })}
        >
          <h2>
            <span className="icon">🔔</span> Alerts
          </h2>
          {notifications.map((note, index) => (
            <div
              key={index}
              className={`notification-item notification-item--${note.type}`}
              role={note.type === 'danger' ? 'alert' : 'status'}
            >
              <span className="notification-icon" aria-hidden="true">
                {note.icon}
              </span>
              <div>
                <div className="notification-text">{note.content}</div>
                {note.time && (
                  <div className="notification-time">
                    {relativeTime(note.time)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
