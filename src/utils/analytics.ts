import { readJson } from './storage';
import { AnalyticsCategory, AnalyticsPreferences, DEFAULT_ANALYTICS_PREFS } from '../types/analytics';

const STORAGE_KEY = 'creditra_analytics_prefs';
const REDACTED = '[REDACTED]';
const ANALYTICS_ENDPOINT = '/api/analytics';

export const BATCH_SIZE = 10;
export const FLUSH_INTERVAL_MS = 5000;
export const MAX_QUEUE_SIZE = 100;

/**
 * Checks if the user has explicitly consented to a specific analytics category.
 * Defaults to false (fail-closed) if storage is unavailable or preferences are unreadable.
 */
export function hasConsent(category: AnalyticsCategory): boolean {
  try {
    const prefs = readJson<AnalyticsPreferences>(STORAGE_KEY, DEFAULT_ANALYTICS_PREFS);
    return prefs[category] === true;
  } catch {
    return false;
  }
}

/**
 * Deterministically redacts financial and sensitive data from an analytics payload.
 * Enforces least privilege by redacting fields commonly containing PII or financial values.
 * Limits depth to prevent stack overflow from deep or circular references.
 */
export function redactFinancialData(payload: unknown, depth = 0): unknown {
  // Enforce invariant: bounded depth
  if (depth >= 10) return REDACTED;

  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    // Redact generic hex addresses (e.g. Ethereum)
    if (/^0x[a-fA-F0-9]{40}$/i.test(payload)) {
      return REDACTED;
    }
    return payload;
  }

  // Primitives that aren't strings
  if (typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => redactFinancialData(item, depth + 1));
  }

  // Handle plain objects
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    
    // Authorization boundary: sensitive keys are stripped
    if (
      lowerKey.includes('amount') ||
      lowerKey.includes('balance') ||
      lowerKey.includes('wallet') ||
      lowerKey.includes('address') ||
      lowerKey.includes('account') ||
      lowerKey.includes('price') ||
      lowerKey.includes('credit')
    ) {
      redacted[key] = REDACTED;
    } else {
      redacted[key] = redactFinancialData(value, depth + 1);
    }
  }
  
  return redacted;
}

export interface AnalyticsEvent {
  eventName: string;
  category: AnalyticsCategory;
  payload?: unknown;
}

interface SerializedAnalyticsEvent {
  event: string;
  category: AnalyticsCategory;
  payload: unknown;
  timestamp: string;
}

interface QueuedAnalyticsEvent {
  data: SerializedAnalyticsEvent;
  retried: boolean;
}

export interface FlushAnalyticsOptions {
  useBeacon?: boolean;
}

let eventQueue: QueuedAnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let listenersAttached = false;

function clearFlushTimer(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function scheduleFlush(): void {
  clearFlushTimer();
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalytics();
  }, FLUSH_INTERVAL_MS);
}

function handlePageHide(): void {
  void flushAnalytics({ useBeacon: true });
}

function handleVisibilityChange(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    void flushAnalytics({ useBeacon: true });
  }
}

function ensureLifecycleListeners(): void {
  if (listenersAttached) return;
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handlePageHide);
    listenersAttached = true;
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    listenersAttached = true;
  }
}

ensureLifecycleListeners();

/**
 * Flushes all currently queued analytics events in a single batch request.
 * Re-checks consent for each event at flush time and drops revoked categories.
 * Uses navigator.sendBeacon (with keepalive fetch fallback) when `useBeacon` is true.
 */
export async function flushAnalytics(options: FlushAnalyticsOptions = {}): Promise<void> {
  const { useBeacon = false } = options;

  clearFlushTimer();

  if (eventQueue.length === 0) {
    return;
  }

  // Prevent overlapping normal flushes; beacon flushes on pagehide/visibilitychange
  // still drain any newly queued events immediately so they are not lost on navigation.
  if (isFlushing && !useBeacon) {
    return;
  }

  const batch = eventQueue.splice(0, eventQueue.length);

  // Re-check consent at flush time and drop events whose category was revoked
  const consentedBatch = batch.filter(item => hasConsent(item.data.category));
  if (consentedBatch.length === 0) {
    return;
  }

  const body = JSON.stringify({
    events: consentedBatch.map(item => item.data),
  });

  if (useBeacon) {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        const sent = navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
        if (sent) {
          return;
        }
      } catch {
        // Fall through to keepalive fetch fallback
      }
    }

    try {
      const response = await fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });

      if (!response.ok) {
        throw new Error(`Analytics API returned status ${response.status}`);
      }
    } catch {
      console.warn(`[Analytics] Failed to send batch of ${consentedBatch.length} event(s).`);
      requeueOnce(consentedBatch);
    }
    return;
  }

  isFlushing = true;
  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok) {
      throw new Error(`Analytics API returned status ${response.status}`);
    }
  } catch {
    // Failure path: safe logging without exposing sensitive data
    console.warn(`[Analytics] Failed to send batch of ${consentedBatch.length} event(s).`);
    requeueOnce(consentedBatch);
  } finally {
    isFlushing = false;
    if (eventQueue.length >= BATCH_SIZE) {
      void flushAnalytics();
    } else if (eventQueue.length > 0 && flushTimer === null) {
      scheduleFlush();
    }
  }
}

function requeueOnce(failedBatch: QueuedAnalyticsEvent[]): void {
  const retryable = failedBatch
    .filter(item => !item.retried)
    .map(item => ({ ...item, retried: true }));

  if (retryable.length === 0) {
    return;
  }

  const combined = [...retryable, ...eventQueue];
  eventQueue = combined.slice(Math.max(0, combined.length - MAX_QUEUE_SIZE));
  scheduleFlush();
}

/**
 * Tracks an analytics event if the user has consented to the specific category.
 * Applies redaction to any payload and enqueues the event for batched delivery.
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  // Validation invariant: valid event shape
  if (!event || !event.category || !event.eventName) {
    console.warn('[Analytics] Invalid event payload');
    return;
  }

  // State-transition invariant: Gate on consent
  if (!hasConsent(event.category)) {
    return;
  }

  ensureLifecycleListeners();

  const redactedPayload = redactFinancialData(event.payload);

  // Bound queue memory by dropping oldest event on overflow
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    eventQueue.shift();
  }

  eventQueue.push({
    data: {
      event: event.eventName,
      category: event.category,
      payload: redactedPayload,
      timestamp: new Date().toISOString(),
    },
    retried: false,
  });

  if (eventQueue.length >= BATCH_SIZE) {
    await flushAnalytics();
  } else {
    scheduleFlush();
  }
}
