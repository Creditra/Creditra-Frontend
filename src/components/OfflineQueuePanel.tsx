import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  cancelQueuedAction,
  getQueuedActionsSnapshot,
  retryQueuedAction,
  subscribeToOfflineQueue,
  type QueuedAction,
} from '../utils/offline';
import './OfflineQueuePanel.css';

// ─── Panel open state ───────────────────────────────────────────────────────
// A tiny module store so the banner and the header badge can both open the
// single panel instance mounted by the app shell.

let panelOpen = false;
let lastFocused: HTMLElement | null = null;
const openListeners = new Set<() => void>();

function emitOpenState(): void {
  for (const listener of openListeners) listener();
}

function subscribeToOpenState(listener: () => void): () => void {
  openListeners.add(listener);
  return () => openListeners.delete(listener);
}

export function openOfflineQueuePanel(): void {
  if (panelOpen) return;
  lastFocused =
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
  panelOpen = true;
  emitOpenState();
}

export function closeOfflineQueuePanel(): void {
  if (!panelOpen) return;
  panelOpen = false;
  emitOpenState();
  if (lastFocused?.isConnected) lastFocused.focus();
  lastFocused = null;
}

export function useOfflineQueuePanelOpen(): boolean {
  return useSyncExternalStore(
    subscribeToOpenState,
    () => panelOpen,
    () => false,
  );
}

/** Resets the open/closed module state. Intended for tests. */
export function resetOfflineQueuePanelForTests(): void {
  panelOpen = false;
  lastFocused = null;
  openListeners.clear();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMPTY_ACTIONS: readonly QueuedAction[] = Object.freeze([]);

const STATUS_LABELS: Record<QueuedAction['status'], string> = {
  pending: 'Waiting for connection',
  running: 'Retrying…',
  failed: 'Failed',
};

/**
 * Compact relative age, e.g. "just now", "4m ago", "2h ago", "3d ago".
 * Exported so the formatting can be unit-tested directly.
 */
export function formatQueuedActionAge(createdAt: number, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - createdAt);
  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Dialog listing actions queued while offline. Each item shows its type, age
 * and status, and can be cancelled (removed permanently) or retried.
 *
 * Mount once from the app shell. `OfflineBanner` and the header badge call
 * `openOfflineQueuePanel()`.
 */
export function OfflineQueuePanel() {
  const isOpen = useOfflineQueuePanelOpen();
  const actions = useSyncExternalStore(
    subscribeToOfflineQueue,
    getQueuedActionsSnapshot,
    () => EMPTY_ACTIONS,
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(
    null,
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
      return;
    }
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeOfflineQueuePanel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleRetry = useCallback(async (action: QueuedAction) => {
    setBusyId(action.id);
    const result = await retryQueuedAction(action.id);
    if (result.ok) {
      setFeedback({ kind: 'success', message: `“${action.label}” completed.` });
    } else {
      setFeedback({
        kind: 'error',
        message: result.error ?? `“${action.label}” could not be completed.`,
      });
    }
    setBusyId(null);
  }, []);

  const handleCancel = useCallback((action: QueuedAction) => {
    if (cancelQueuedAction(action.id)) {
      setFeedback({ kind: 'success', message: `“${action.label}” cancelled.` });
    }
  }, []);

  if (!isOpen) return null;

  const hasActions = actions.length > 0;

  return (
    <div
      className="offline-queue-panel__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeOfflineQueuePanel();
      }}
    >
      <div
        className="offline-queue-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-queue-title"
        aria-describedby="offline-queue-description"
      >
        <div className="offline-queue-panel__header">
          <div>
            <h2 id="offline-queue-title" className="offline-queue-panel__title">
              Queued actions
            </h2>
            <p id="offline-queue-description" className="offline-queue-panel__subtitle">
              {hasActions
                ? `${actions.length} action${actions.length === 1 ? '' : 's'} waiting to be sent.`
                : 'Actions you start while offline will appear here.'}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="offline-queue-panel__close"
            aria-label="Close queued actions"
            onClick={closeOfflineQueuePanel}
          >
            ×
          </button>
        </div>

        {feedback && (
          <p
            className={`offline-queue-panel__feedback offline-queue-panel__feedback--${feedback.kind}`}
            role="status"
            aria-live="polite"
          >
            {feedback.message}
          </p>
        )}

        {hasActions ? (
          <ul className="offline-queue-panel__list">
            {actions.map((action) => {
              const isBusy = busyId === action.id || action.status === 'running';
              return (
                <li key={action.id} className="offline-queue-panel__item">
                  <div className="offline-queue-panel__item-head">
                    <span className="offline-queue-panel__type">{action.type}</span>
                    <span
                      className={`offline-queue-panel__status offline-queue-panel__status--${action.status}`}
                    >
                      {STATUS_LABELS[action.status]}
                    </span>
                  </div>
                  <p className="offline-queue-panel__label">{action.label}</p>
                  {action.description && (
                    <p className="offline-queue-panel__description">{action.description}</p>
                  )}
                  <p className="offline-queue-panel__meta">
                    Queued {formatQueuedActionAge(action.createdAt)}
                    {action.attempts > 0
                      ? ` · ${action.attempts} attempt${action.attempts === 1 ? '' : 's'}`
                      : ''}
                  </p>
                  {action.status === 'failed' && action.error && (
                    <p className="offline-queue-panel__error">{action.error}</p>
                  )}
                  <div className="offline-queue-panel__actions">
                    <button
                      type="button"
                      className="offline-queue-panel__button offline-queue-panel__button--primary"
                      onClick={() => void handleRetry(action)}
                      disabled={isBusy}
                      aria-label={`Retry ${action.label}`}
                    >
                      {isBusy ? 'Retrying…' : 'Retry'}
                    </button>
                    <button
                      type="button"
                      className="offline-queue-panel__button"
                      onClick={() => handleCancel(action)}
                      aria-label={`Cancel ${action.label}`}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="offline-queue-panel__empty">
            <p className="offline-queue-panel__empty-title">Nothing queued</p>
            <p className="offline-queue-panel__empty-body">
              Draws and uploads started while offline are saved here and sent automatically when
              your connection returns.
            </p>
          </div>
        )}

        <p className="offline-queue-panel__note">
          Pending actions retry automatically when the connection is restored. Cancelling removes
          an action permanently.
        </p>
      </div>
    </div>
  );
}
