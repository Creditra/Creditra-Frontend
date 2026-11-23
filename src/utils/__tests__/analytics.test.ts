import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  trackEvent,
  flushAnalytics,
  hasConsent,
  redactFinancialData,
  BATCH_SIZE,
  FLUSH_INTERVAL_MS,
  MAX_QUEUE_SIZE,
} from '../analytics';
import * as storage from '../storage';
import { AnalyticsPreferences } from '../../types/analytics';

// Mock storage and fetch
vi.mock('../storage', () => ({
  readJson: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const ALL_CONSENT: AnalyticsPreferences = {
  usage: true,
  performance: true,
  crash_reports: true,
  feature_flags: true,
};

const USAGE_ONLY_CONSENT: AnalyticsPreferences = {
  usage: true,
  performance: false,
  crash_reports: false,
  feature_flags: false,
};

const NO_CONSENT: AnalyticsPreferences = {
  usage: false,
  performance: false,
  crash_reports: false,
  feature_flags: false,
};

describe('Analytics Engine', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    vi.mocked(storage.readJson).mockReturnValue(NO_CONSENT);
    // Ensure queue and timers are completely drained before each test
    await flushAnalytics();
    mockFetch.mockClear();
  });

  afterEach(async () => {
    vi.mocked(storage.readJson).mockReturnValue(NO_CONSENT);
    await flushAnalytics();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('hasConsent', () => {
    it('returns true when consent is granted for a category', () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);

      expect(hasConsent('usage')).toBe(true);
      expect(hasConsent('performance')).toBe(false);
    });

    it('returns false when storage fails or is unreadable', () => {
      vi.mocked(storage.readJson).mockImplementation(() => {
        throw new Error('Quota Exceeded');
      });

      expect(hasConsent('usage')).toBe(false);
    });
  });

  describe('redactFinancialData', () => {
    it('redacts ethereum addresses in strings', () => {
      expect(redactFinancialData('0x1234567890123456789012345678901234567890')).toBe('[REDACTED]');
      expect(redactFinancialData('normal string')).toBe('normal string');
    });

    it('redacts sensitive keys in objects', () => {
      const payload = {
        amount: 1000,
        balance_usd: 500,
        userWallet: '0xabc',
        accountNumber: '1234',
        creditLineId: 'xyz',
        priceData: { val: 10 },
        nonSensitive: 'keep this',
      };

      const redacted = redactFinancialData(payload) as any;
      expect(redacted.amount).toBe('[REDACTED]');
      expect(redacted.balance_usd).toBe('[REDACTED]');
      expect(redacted.userWallet).toBe('[REDACTED]');
      expect(redacted.accountNumber).toBe('[REDACTED]');
      expect(redacted.creditLineId).toBe('[REDACTED]');
      expect(redacted.priceData).toBe('[REDACTED]');
      expect(redacted.nonSensitive).toBe('keep this');
    });

    it('handles nested objects and arrays', () => {
      const payload = {
        transactions: [
          { amount: 100, id: 1 },
          { amount: 200, id: 2 },
        ],
        deep: {
          nested: {
            walletAddress: '0x123',
            safeValue: 42,
          },
        },
      };

      const redacted = redactFinancialData(payload) as any;
      expect(redacted.transactions[0].amount).toBe('[REDACTED]');
      expect(redacted.transactions[0].id).toBe(1);
      expect(redacted.deep.nested.walletAddress).toBe('[REDACTED]');
      expect(redacted.deep.nested.safeValue).toBe(42);
    });

    it('prevents maximum call stack size exceeded on deep objects (depth limit)', () => {
      const deepObject: any = {};
      let current = deepObject;
      for (let i = 0; i < 15; i++) {
        current.next = {};
        current = current.next;
      }
      current.amount = 100;

      const redacted = redactFinancialData(deepObject) as any;
      let depthCount = 0;
      let node = redacted;
      while (node.next) {
        depthCount++;
        node = node.next;
        if (node === '[REDACTED]') {
          break;
        }
      }
      expect(depthCount).toBeLessThanOrEqual(10);
    });

    it('handles null and undefined', () => {
      expect(redactFinancialData(null)).toBeNull();
      expect(redactFinancialData(undefined)).toBeUndefined();
    });
  });

  describe('trackEvent and batching', () => {
    it('does not send or queue event if consent is missing', async () => {
      vi.mocked(storage.readJson).mockReturnValue(NO_CONSENT);

      await trackEvent({
        eventName: 'TestEvent',
        category: 'usage',
        payload: { amount: 100 },
      });

      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('fails closed when storage is unavailable', async () => {
      vi.mocked(storage.readJson).mockImplementation(() => {
        throw new Error('SecurityError: storage unavailable');
      });

      await trackEvent({
        eventName: 'StorageFailEvent',
        category: 'usage',
        payload: { safe: true },
      });

      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('aborts cleanly on invalid events', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await trackEvent(null as any);
      expect(consoleSpy).toHaveBeenCalledWith('[Analytics] Invalid event payload');
      expect(mockFetch).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);

      consoleSpy.mockRestore();
    });

    it('does nothing when flushing an empty queue', async () => {
      await flushAnalytics();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('batches multiple events and flushes after the debounce interval with redacted payloads and event-time timestamps', async () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);

      const t0 = new Date('2026-01-01T00:00:00.000Z');
      vi.setSystemTime(t0);

      await trackEvent({
        eventName: 'FirstEvent',
        category: 'usage',
        payload: { amount: 100, safe: true },
      });

      // Advance 2s (< 5s debounce), then enqueue second event
      vi.advanceTimersByTime(2000);
      const t1 = new Date('2026-01-01T00:00:02.000Z');
      expect(mockFetch).not.toHaveBeenCalled();

      await trackEvent({
        eventName: 'SecondEvent',
        category: 'usage',
        payload: { wallet: '0xabc', step: 2 },
      });

      // 3s after second event (5s after first) should NOT flush yet due to debounce
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockFetch).not.toHaveBeenCalled();

      // Remaining 2s completes the 5s debounce after the second event
      await vi.advanceTimersByTimeAsync(2000);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/analytics');
      expect(init.method).toBe('POST');

      const body = JSON.parse(init.body);
      expect(body.events).toHaveLength(2);
      expect(body.events[0]).toEqual({
        event: 'FirstEvent',
        category: 'usage',
        payload: { amount: '[REDACTED]', safe: true },
        timestamp: t0.toISOString(),
      });
      expect(body.events[1]).toEqual({
        event: 'SecondEvent',
        category: 'usage',
        payload: { wallet: '[REDACTED]', step: 2 },
        timestamp: t1.toISOString(),
      });
      expect(vi.getTimerCount()).toBe(0);
    });

    it('flushes immediately in a single request when queue reaches BATCH_SIZE', async () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);

      for (let i = 0; i < BATCH_SIZE - 1; i++) {
        await trackEvent({
          eventName: `Event_${i}`,
          category: 'usage',
          payload: { index: i },
        });
      }

      expect(mockFetch).not.toHaveBeenCalled();

      await trackEvent({
        eventName: `Event_${BATCH_SIZE - 1}`,
        category: 'usage',
        payload: { index: BATCH_SIZE - 1 },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.events).toHaveLength(BATCH_SIZE);
      expect(body.events[0].event).toBe('Event_0');
      expect(body.events[BATCH_SIZE - 1].event).toBe(`Event_${BATCH_SIZE - 1}`);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('re-checks consent at flush time and drops events whose category was revoked', async () => {
      vi.mocked(storage.readJson).mockReturnValue(ALL_CONSENT);

      await trackEvent({ eventName: 'UsageEvent', category: 'usage' });
      await trackEvent({ eventName: 'PerfEvent', category: 'performance' });

      // Revoke performance consent before flush
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);

      await flushAnalytics();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.events).toHaveLength(1);
      expect(body.events[0].event).toBe('UsageEvent');
    });

    it('drops all queued events and makes no request if all categories are revoked before flush', async () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);

      await trackEvent({ eventName: 'UsageEvent', category: 'usage' });

      vi.mocked(storage.readJson).mockReturnValue(NO_CONSENT);
      await flushAnalytics();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('bounds queue length at MAX_QUEUE_SIZE and drops oldest events on overflow', async () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);

      // Hold the first flush in flight so subsequent events accumulate in the queue
      let resolveFirstFlush!: (value: unknown) => void;
      mockFetch.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirstFlush = resolve;
          })
      );

      // Trigger initial in-flight flush of BATCH_SIZE events without awaiting the held fetch
      for (let i = 0; i < BATCH_SIZE - 1; i++) {
        await trackEvent({ eventName: `Initial_${i}`, category: 'usage' });
      }
      const initialFlushPromise = trackEvent({
        eventName: `Initial_${BATCH_SIZE - 1}`,
        category: 'usage',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Enqueue MAX_QUEUE_SIZE + 5 events while first flush is in flight
      const overflowCount = 5;
      for (let i = 0; i < MAX_QUEUE_SIZE + overflowCount; i++) {
        await trackEvent({ eventName: `Queued_${i}`, category: 'usage' });
      }

      // Resolve first flush; the finally block will flush the bounded queue
      resolveFirstFlush({ ok: true, status: 200 });
      await initialFlushPromise;
      await Promise.resolve();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.events).toHaveLength(MAX_QUEUE_SIZE);
      expect(body.events[0].event).toBe(`Queued_${overflowCount}`);
      expect(body.events[MAX_QUEUE_SIZE - 1].event).toBe(`Queued_${MAX_QUEUE_SIZE + overflowCount - 1}`);
    });

    it('retries once on fetch failure then drops with safe console.warn', async () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);
      mockFetch.mockRejectedValue(new Error('Network Error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await trackEvent({ eventName: 'FailEvent', category: 'usage' });

      // First attempt fails -> re-queued once and timer scheduled
      await flushAnalytics();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('[Analytics] Failed to send batch of 1 event(s).');
      expect(vi.getTimerCount()).toBe(1);

      // Second attempt (retry) fails -> dropped, no further timer scheduled
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);

      // Further flush does nothing because event was dropped
      await flushAnalytics();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('flushes via navigator.sendBeacon on pagehide', async () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'sendBeacon', {
        value: sendBeaconMock,
        configurable: true,
        writable: true,
      });

      await trackEvent({ eventName: 'PageHideEvent', category: 'usage', payload: { page: 'home' } });

      window.dispatchEvent(new Event('pagehide'));

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      const [url, blob] = sendBeaconMock.mock.calls[0];
      expect(url).toBe('/api/analytics');
      expect(blob).toBeInstanceOf(Blob);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('flushes via navigator.sendBeacon on visibilitychange to hidden', async () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'sendBeacon', {
        value: sendBeaconMock,
        configurable: true,
        writable: true,
      });

      await trackEvent({ eventName: 'HiddenEvent', category: 'usage' });

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();

      // Restore visibilityState
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
    });

    it('falls back to fetch with keepalive: true when sendBeacon is unavailable', async () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);
      Object.defineProperty(navigator, 'sendBeacon', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      await trackEvent({ eventName: 'FallbackEvent', category: 'usage' });

      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/analytics');
      expect(init.keepalive).toBe(true);
      const body = JSON.parse(init.body);
      expect(body.events).toHaveLength(1);
      expect(body.events[0].event).toBe('FallbackEvent');
    });

    it('flushes newly queued events via sendBeacon on pagehide while a normal flush is in flight', async () => {
      vi.mocked(storage.readJson).mockReturnValue(USAGE_ONLY_CONSENT);
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'sendBeacon', {
        value: sendBeaconMock,
        configurable: true,
        writable: true,
      });

      let resolveInFlight!: (value: unknown) => void;
      mockFetch.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveInFlight = resolve;
          })
      );

      // Start an in-flight flush
      await trackEvent({ eventName: 'InFlightEvent', category: 'usage' });
      const inFlightPromise = flushAnalytics();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Queue another event while the first flush is still in flight
      await trackEvent({ eventName: 'QueuedDuringFlight', category: 'usage' });

      // Trigger pagehide while first flush is still in flight
      window.dispatchEvent(new Event('pagehide'));

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(sendBeaconMock.mock.calls[0][0]).toBe('/api/analytics');

      // Complete the in-flight flush; no duplicate fetch should be issued
      resolveInFlight({ ok: true, status: 200 });
      await inFlightPromise;
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
