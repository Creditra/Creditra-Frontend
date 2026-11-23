import { useCallback, useEffect, useState } from 'react';
import { useCreditData } from '../context/CreditDataContext';
import { formatRelative } from '../utils/dates';
import { TYPE_COLOR, TYPE_ICON } from './notifications/notificationIcons';
import './notifications/BannerAlert.css';

/** Default age threshold (5 minutes) after which credit data is considered stale. */
export const STALE_DATA_THRESHOLD_MS = 5 * 60 * 1000;

const DEFAULT_POLL_INTERVAL_MS = 30_000;

export interface StaleDataBannerProps {
  /** Age in milliseconds before the stale-data banner appears. Defaults to 5 minutes. */
  thresholdMs?: number;
  /** Interval in milliseconds for re-evaluating data age. Defaults to 30 seconds. */
  pollIntervalMs?: number;
}

/**
 * Displays a polite status banner when loaded credit data is older than
 * `thresholdMs`, with a keyboard-accessible Refresh action.
 */
export function StaleDataBanner({
  thresholdMs = STALE_DATA_THRESHOLD_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: StaleDataBannerProps = {}) {
  const { status, lastUpdatedAt, refetch } = useCreditData();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    setRefreshError(null);
  }, [lastUpdatedAt]);

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());

    const intervalId = setInterval(updateNow, pollIntervalMs);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollIntervalMs]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await refetch();
      setNowMs(Date.now());
    } catch {
      setRefreshError('Refresh failed. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  // Never show before the first successful load (including idle, initial loading, or initial error)
  if (!lastUpdatedAt) {
    return null;
  }

  const ageMs = nowMs - lastUpdatedAt.getTime();
  if (ageMs < thresholdMs) {
    return null;
  }

  const ageLabel = formatRelative(lastUpdatedAt, new Date(nowMs));
  const colors = TYPE_COLOR.warning;
  const icon = TYPE_ICON.warning;
  const busy = isRefreshing || status === 'loading';

  return (
    <div
      className="banner-stack"
      style={{ position: 'relative', zIndex: 999, marginBottom: '1rem' }}
    >
      <div
        className="banner-alert"
        style={{ background: colors.bg, borderColor: colors.border }}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          className="banner-icon"
          style={{ color: colors.icon }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="banner-message">
          Credit data may be stale — last updated {ageLabel}.
          {refreshError && (
            <span
              className="banner-error"
              style={{ display: 'block', marginTop: '0.25rem' }}
            >
              {refreshError}
            </span>
          )}
        </span>
        <button
          type="button"
          className="banner-action"
          style={{ color: colors.text }}
          onClick={handleRefresh}
          disabled={busy}
        >
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
