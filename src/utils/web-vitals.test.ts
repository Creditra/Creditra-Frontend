import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  handlePerformanceConsentChange,
  initWebVitals,
  rateWebVital,
  resetWebVitalsForTesting,
} from './web-vitals';

const PREFS_KEY = 'creditra_analytics_prefs';

type ObserverCallback = (list: { getEntries: () => unknown[] }) => void;

class MockPerformanceObserver {
  static instances = new Map<string, { callback: ObserverCallback; disconnected: boolean }>();

  private callback: ObserverCallback;
  private observedType = '';

  constructor(callback: ObserverCallback) {
    this.callback = callback;
  }

  observe(options: { type?: string }) {
    if (options.type) {
      this.observedType = options.type;
      MockPerformanceObserver.instances.set(options.type, {
        callback: this.callback,
        disconnected: false,
      });
    }
  }

  disconnect() {
    const entry = MockPerformanceObserver.instances.get(this.observedType);
    if (entry) {
      entry.disconnected = true;
    }
  }

  static emit(type: string, entries: unknown[]) {
    const inst = MockPerformanceObserver.instances.get(type);
    if (!inst || inst.disconnected) return;
    inst.callback({ getEntries: () => entries });
  }

  static reset() {
    MockPerformanceObserver.instances.clear();
  }
}

function setPerformanceConsent(enabled: boolean) {
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({
      usage: false,
      performance: enabled,
      crash_reports: false,
      feature_flags: false,
    }),
  );
}

describe('web-vitals telemetry', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    MockPerformanceObserver.reset();
    resetWebVitalsForTesting();

    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
  });

  afterEach(() => {
    resetWebVitalsForTesting();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rates Core Web Vitals according to standard thresholds', () => {
    expect(rateWebVital('LCP', 2000)).toBe('good');
    expect(rateWebVital('LCP', 3000)).toBe('needs-improvement');
    expect(rateWebVital('LCP', 4500)).toBe('poor');
    expect(rateWebVital('CLS', 0.05)).toBe('good');
    expect(rateWebVital('CLS', 0.3)).toBe('poor');
    expect(rateWebVital('INP', 150)).toBe('good');
    expect(rateWebVital('FCP', 1200)).toBe('good');
    expect(rateWebVital('TTFB', 500)).toBe('good');
  });

  it('makes no network calls when performance consent is not granted', () => {
    initWebVitals();

    MockPerformanceObserver.emit('navigation', [{ type: 'navigate', responseStart: 320 }]);
    MockPerformanceObserver.emit('paint', [{ name: 'first-contentful-paint', startTime: 910 }]);
    MockPerformanceObserver.emit('largest-contentful-paint', [{ startTime: 1850 }]);
    MockPerformanceObserver.emit('layout-shift', [{ value: 0.04, hadRecentInput: false }]);
    MockPerformanceObserver.emit('event', [{ duration: 120, interactionId: 1 }]);
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('buffers metrics until consent is granted, then flushes each metric once with no PII', () => {
    initWebVitals();

    // Collect metrics before consent
    MockPerformanceObserver.emit('navigation', [{ type: 'navigate', responseStart: 410 }]);
    MockPerformanceObserver.emit('paint', [{ name: 'first-contentful-paint', startTime: 1100 }]);
    MockPerformanceObserver.emit('largest-contentful-paint', [{ startTime: 2100 }]);
    MockPerformanceObserver.emit('layout-shift', [
      { value: 0.02, hadRecentInput: false },
      { value: 0.5, hadRecentInput: true }, // ignored because hadRecentInput is true
    ]);
    MockPerformanceObserver.emit('event', [{ duration: 96, interactionId: 7 }]);
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchMock).not.toHaveBeenCalled();

    // Grant consent and notify collector
    setPerformanceConsent(true);
    handlePerformanceConsentChange(true);

    expect(fetchMock).toHaveBeenCalledTimes(5);

    const sentPayloads = fetchMock.mock.calls.map(([, init]) => {
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.category).toBe('performance');
      expect(body.event).toBe('web_vital');
      return body.payload;
    });

    const byName = Object.fromEntries(sentPayloads.map((p) => [p.name, p]));
    expect(byName.TTFB).toEqual({ name: 'TTFB', value: 410, rating: 'good', navigationType: 'navigate' });
    expect(byName.FCP).toEqual({ name: 'FCP', value: 1100, rating: 'good', navigationType: 'navigate' });
    expect(byName.LCP).toEqual({ name: 'LCP', value: 2100, rating: 'good', navigationType: 'navigate' });
    expect(byName.CLS).toEqual({ name: 'CLS', value: 0.02, rating: 'good', navigationType: 'navigate' });
    expect(byName.INP).toEqual({ name: 'INP', value: 96, rating: 'good', navigationType: 'navigate' });

    // Re-triggering pagehide or consent flush must not report any metric a second time
    window.dispatchEvent(new Event('pagehide'));
    handlePerformanceConsentChange(true);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('drops buffered metrics when consent is declined', () => {
    initWebVitals();

    MockPerformanceObserver.emit('paint', [{ name: 'first-contentful-paint', startTime: 950 }]);
    expect(fetchMock).not.toHaveBeenCalled();

    // Decline consent -> buffer is dropped
    setPerformanceConsent(false);
    handlePerformanceConsentChange(false);

    // Later granting consent should NOT send previously dropped metrics
    setPerformanceConsent(true);
    handlePerformanceConsentChange(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports each metric at most once per page view when consent is already granted', () => {
    setPerformanceConsent(true);
    initWebVitals();

    MockPerformanceObserver.emit('paint', [
      { name: 'first-contentful-paint', startTime: 800 },
      { name: 'first-contentful-paint', startTime: 850 },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
