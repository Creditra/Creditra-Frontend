import { useEffect, useState, useSyncExternalStore } from 'react';
import { useOnline } from '../hooks/useOnline';
import {
  getQueuedActionsSnapshot,
  subscribeToOfflineQueue,
  type QueuedAction,
} from '../utils/offline';
import { openOfflineQueuePanel } from './OfflineQueuePanel';
import './OfflineBanner.css';

const EMPTY_QUEUE: readonly QueuedAction[] = Object.freeze([]);

export function OfflineBanner() {
  const { isOnline, checkOnlineStatus } = useOnline();
  const [show, setShow] = useState(false);
  const queuedActions = useSyncExternalStore(
    subscribeToOfflineQueue,
    getQueuedActionsSnapshot,
    () => EMPTY_QUEUE,
  );
  const queuedCount = queuedActions.length;

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
    } else if (show) {
      // Hide after a brief delay when connection is restored
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, show]);

  if (!show && isOnline) return null;

  return (
    <div
      className={`offline-banner ${isOnline ? 'offline-banner--restored' : ''}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="offline-banner__content">
        <span>
          {isOnline ? 'Connection restored.' : 'You are currently offline. Actions will be queued.'}
        </span>
        {queuedCount > 0 && (
          <button
            type="button"
            onClick={openOfflineQueuePanel}
            className="offline-banner__retry-button"
            aria-label={`View ${queuedCount} queued action${queuedCount === 1 ? '' : 's'}`}
          >
            View queue ({queuedCount})
          </button>
        )}
        {!isOnline && (
          <button
            type="button"
            onClick={checkOnlineStatus}
            className="offline-banner__retry-button"
            aria-label="Retry connection"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
