import { getCreditNetworkConfig } from '../config/creditNetwork';

export type HorizonStreamStatus = 'live' | 'reconnecting' | 'polling';

export interface HorizonAccountBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

export interface HorizonAccountEvent {
  id?: string;
  balances?: HorizonAccountBalance[];
  [key: string]: unknown;
}

export interface SubscribeToAccountOptions {
  /** Called whenever a valid Horizon account message arrives over SSE. */
  onUpdate: (account: HorizonAccountEvent) => void;
  /** Called whenever the stream connection state changes. */
  onStatus?: (status: HorizonStreamStatus) => void;
  /** Override Horizon base URL (defaults to `getCreditNetworkConfig().horizonUrl`). */
  horizonUrl?: string;
  /** Callback invoked on each polling tick when falling back to polling. */
  onPoll?: () => Promise<unknown> | unknown;
  /** Polling interval in ms when in fallback mode (default: 30_000). */
  pollIntervalMs?: number;
  /** Initial reconnect backoff delay in ms (default: 1_000). */
  initialBackoffMs?: number;
  /** Maximum reconnect backoff delay in ms (default: 30_000). */
  maxBackoffMs?: number;
  /** Consecutive stream errors before falling back to polling (default: 5). */
  maxConsecutiveFailures?: number;
  /** Optional EventSource constructor override (primarily for tests). */
  EventSourceImpl?: typeof EventSource;
  /** Optional random number generator in [0, 1) for deterministic jitter in tests. */
  random?: () => number;
}

export const DEFAULT_INITIAL_BACKOFF_MS = 1_000;
export const DEFAULT_MAX_BACKOFF_MS = 30_000;
export const DEFAULT_POLL_INTERVAL_MS = 30_000;
export const DEFAULT_MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Compute exponential backoff with equal jitter:
 * base = min(initial * 2^(attempt - 1), max)
 * delay = round(base * (0.5 + random() * 0.5))
 */
export function computeBackoffDelay(
  attempt: number,
  initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
  maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
  random: () => number = Math.random,
): number {
  const safeAttempt = Math.max(1, attempt);
  const base = Math.min(initialBackoffMs * Math.pow(2, safeAttempt - 1), maxBackoffMs);
  const jitterFactor = 0.5 + random() * 0.5;
  return Math.min(maxBackoffMs, Math.round(base * jitterFactor));
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden === true;
}

function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Subscribe to a Stellar account's Horizon SSE stream (`/accounts/{publicKey}`)
 * with exponential backoff + jitter, visibility/offline pausing, and automatic
 * polling fallback when `EventSource` is unavailable or fails repeatedly.
 *
 * Returns an idempotent unsubscribe function that tears down all streams,
 * timers, and event listeners.
 */
export function subscribeToAccount(
  publicKey: string,
  options: SubscribeToAccountOptions,
): () => void {
  const {
    onUpdate,
    onStatus,
    onPoll,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
    maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
    maxConsecutiveFailures = DEFAULT_MAX_CONSECUTIVE_FAILURES,
    EventSourceImpl = typeof EventSource !== 'undefined' ? EventSource : undefined,
    random = Math.random,
  } = options;

  let unsubscribed = false;
  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let consecutiveFailures = 0;
  let inPollingFallback = false;
  let lastReportedStatus: HorizonStreamStatus | null = null;

  const baseUrl = (options.horizonUrl ?? getCreditNetworkConfig().horizonUrl).replace(/\/+$/, '');
  const streamUrl = `${baseUrl}/accounts/${encodeURIComponent(publicKey)}`;

  const reportStatus = (next: HorizonStreamStatus) => {
    if (unsubscribed || lastReportedStatus === next) return;
    lastReportedStatus = next;
    onStatus?.(next);
  };

  const isPaused = (): boolean => isDocumentHidden() || isNavigatorOffline();

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const stopPolling = () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const closeStream = () => {
    if (es !== null) {
      es.onopen = null;
      es.onmessage = null;
      es.onerror = null;
      es.close();
      es = null;
    }
  };

  const startPolling = () => {
    if (unsubscribed || isPaused() || pollTimer !== null) return;
    pollTimer = setInterval(() => {
      if (unsubscribed || isPaused()) return;
      void onPoll?.();
    }, pollIntervalMs);
  };

  const enterPollingFallback = () => {
    inPollingFallback = true;
    closeStream();
    clearReconnectTimer();
    reportStatus('polling');
    startPolling();
  };

  const openStream = () => {
    if (unsubscribed || isPaused() || inPollingFallback) return;

    if (!EventSourceImpl) {
      enterPollingFallback();
      return;
    }

    // Never open duplicate streams.
    closeStream();
    clearReconnectTimer();

    let source: EventSource;
    try {
      source = new EventSourceImpl(streamUrl);
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures >= maxConsecutiveFailures) {
        enterPollingFallback();
      } else {
        reportStatus('reconnecting');
        const delay = computeBackoffDelay(
          consecutiveFailures,
          initialBackoffMs,
          maxBackoffMs,
          random,
        );
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          openStream();
        }, delay);
      }
      return;
    }

    es = source;

    source.onopen = () => {
      if (unsubscribed || es !== source) return;
      reportStatus('live');
    };

    source.onmessage = (event: MessageEvent) => {
      if (unsubscribed || es !== source) return;
      if (typeof event.data !== 'string') return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        // Ignore non-JSON heartbeat / greeting payloads (e.g. Horizon "hello").
        return;
      }

      if (!parsed || typeof parsed !== 'object') return;

      consecutiveFailures = 0;
      reportStatus('live');
      onUpdate(parsed as HorizonAccountEvent);
    };

    source.onerror = () => {
      if (unsubscribed || es !== source) return;

      // Close immediately so the browser's built-in EventSource reconnect
      // does not race with our custom backoff or create duplicate streams.
      closeStream();

      if (isPaused()) {
        return;
      }

      consecutiveFailures += 1;
      if (consecutiveFailures >= maxConsecutiveFailures) {
        enterPollingFallback();
        return;
      }

      reportStatus('reconnecting');
      const delay = computeBackoffDelay(
        consecutiveFailures,
        initialBackoffMs,
        maxBackoffMs,
        random,
      );
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        openStream();
      }, delay);
    };
  };

  const handleStateChange = () => {
    if (unsubscribed) return;

    if (isPaused()) {
      closeStream();
      clearReconnectTimer();
      stopPolling();
      return;
    }

    // Resumed (visible & online)
    if (inPollingFallback || !EventSourceImpl) {
      reportStatus('polling');
      startPolling();
    } else if (!es && !reconnectTimer) {
      openStream();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleStateChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleStateChange);
    window.addEventListener('offline', handleStateChange);
  }

  // Kick off initial connection (or polling fallback if EventSource is unavailable).
  if (!EventSourceImpl) {
    inPollingFallback = true;
    reportStatus('polling');
    if (!isPaused()) {
      startPolling();
    }
  } else if (!isPaused()) {
    openStream();
  }

  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    closeStream();
    clearReconnectTimer();
    stopPolling();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleStateChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleStateChange);
      window.removeEventListener('offline', handleStateChange);
    }
  };
}
