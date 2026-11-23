import { hasConsent, trackEvent } from './analytics';

export type WebVitalName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalMetric {
  name: WebVitalName;
  value: number;
  rating: WebVitalRating;
  navigationType?: string;
}

const ANALYTICS_PREFS_KEY = 'creditra_analytics_prefs';

const THRESHOLDS: Record<WebVitalName, [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

export function rateWebVital(name: WebVitalName, value: number): WebVitalRating {
  const [good, poor] = THRESHOLDS[name];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function roundMetricValue(name: WebVitalName, value: number): number {
  if (name === 'CLS') {
    return Math.round(value * 10_000) / 10_000;
  }
  return Math.round(value);
}

// ── Module state (per page view) ────────────────────────────────────────────

const reported = new Set<WebVitalName>();
const buffered = new Map<WebVitalName, WebVitalMetric>();

let activeCleanup: (() => void) | null = null;
let latestLcp: number | null = null;
let cumulativeCls = 0;
let hasCls = false;
let maxInp: number | null = null;
let navigationType: string | undefined;

function emitOrBuffer(name: WebVitalName, rawValue: number): void {
  if (reported.has(name) || !Number.isFinite(rawValue) || rawValue < 0) {
    return;
  }

  const value = roundMetricValue(name, rawValue);
  const metric: WebVitalMetric = {
    name,
    value,
    rating: rateWebVital(name, value),
    ...(navigationType ? { navigationType } : {}),
  };

  if (hasConsent('performance')) {
    reported.add(name);
    buffered.delete(name);
    void trackEvent({
      eventName: 'web_vital',
      category: 'performance',
      payload: metric,
    });
  } else {
    buffered.set(name, metric);
  }
}

function flushBuffered(): void {
  if (!hasConsent('performance')) return;

  for (const [name, metric] of buffered.entries()) {
    if (reported.has(name)) continue;
    reported.add(name);
    void trackEvent({
      eventName: 'web_vital',
      category: 'performance',
      payload: metric,
    });
  }
  buffered.clear();
}

function finalizePendingMetrics(): void {
  if (latestLcp !== null) {
    emitOrBuffer('LCP', latestLcp);
  }
  if (hasCls) {
    emitOrBuffer('CLS', cumulativeCls);
  }
  if (maxInp !== null) {
    emitOrBuffer('INP', maxInp);
  }
}

/**
 * Notify the web-vitals collector when performance analytics consent changes.
 * - `granted === true`: flushes any buffered metrics through `trackEvent`.
 * - `granted === false`: drops all buffered metrics without sending them.
 */
export function handlePerformanceConsentChange(granted: boolean): void {
  if (granted) {
    flushBuffered();
  } else {
    buffered.clear();
  }
}

/**
 * Initialise Core Web Vitals collection (LCP, CLS, INP, FCP, TTFB) via
 * `PerformanceObserver`. Safe to call in non-browser environments and
 * idempotent across repeated calls.
 */
export function initWebVitals(): () => void {
  if (activeCleanup) {
    return activeCleanup;
  }

  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  const observers: PerformanceObserver[] = [];

  const observe = (
    type: string,
    callback: (entries: PerformanceEntryList) => void,
    extraOptions?: Record<string, unknown>,
  ) => {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true, ...extraOptions } as PerformanceObserverInit);
      observers.push(observer);
    } catch {
      // Entry type not supported in this browser — skip gracefully.
    }
  };

  // TTFB (navigation timing)
  observe('navigation', (entries) => {
    const nav = entries[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return;
    if (typeof nav.type === 'string') {
      navigationType = nav.type;
    }
    if (typeof nav.responseStart === 'number') {
      emitOrBuffer('TTFB', Math.max(0, nav.responseStart));
    }
  });

  // FCP (paint timing)
  observe('paint', (entries) => {
    for (const entry of entries) {
      if (entry.name === 'first-contentful-paint') {
        emitOrBuffer('FCP', entry.startTime);
      }
    }
  });

  // LCP (largest-contentful-paint)
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1];
    if (last) {
      latestLcp = last.startTime;
    }
  });

  // CLS (layout-shift)
  observe('layout-shift', (entries) => {
    for (const entry of entries) {
      const shift = entry as PerformanceEntry & {
        value?: number;
        hadRecentInput?: boolean;
      };
      if (!shift.hadRecentInput && typeof shift.value === 'number') {
        cumulativeCls += shift.value;
        hasCls = true;
      }
    }
  });

  // INP (event timing)
  observe(
    'event',
    (entries) => {
      for (const entry of entries) {
        const eventEntry = entry as PerformanceEntry & {
          interactionId?: number;
        };
        if (
          typeof eventEntry.duration === 'number' &&
          (eventEntry.interactionId === undefined || eventEntry.interactionId > 0)
        ) {
          maxInp = maxInp === null ? eventEntry.duration : Math.max(maxInp, eventEntry.duration);
        }
      }
    },
    { durationThreshold: 40 },
  );

  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      finalizePendingMetrics();
    }
  };

  const handlePageHide = () => {
    finalizePendingMetrics();
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ANALYTICS_PREFS_KEY) {
      handlePerformanceConsentChange(hasConsent('performance'));
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('storage', handleStorage);

  const cleanup = () => {
    for (const observer of observers) {
      try {
        observer.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('storage', handleStorage);
    activeCleanup = null;
  };

  activeCleanup = cleanup;
  return cleanup;
}

/**
 * Reset internal state and tear down active observers. Intended for unit tests.
 */
export function resetWebVitalsForTesting(): void {
  if (activeCleanup) {
    activeCleanup();
  }
  reported.clear();
  buffered.clear();
  latestLcp = null;
  cumulativeCls = 0;
  hasCls = false;
  maxInp = null;
  navigationType = undefined;
}
