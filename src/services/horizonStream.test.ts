import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  subscribeToAccount,
  computeBackoffDelay,
  type HorizonStreamStatus,
} from './horizonStream';

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emitOpen() {
    this.onopen?.(new Event('open'));
  }

  emitMessage(data: unknown) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.onmessage?.(new MessageEvent('message', { data: payload }));
  }

  emitError() {
    this.onerror?.(new Event('error'));
  }
}

const PUBLIC_KEY = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
}

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
}

describe('horizonStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    setDocumentHidden(false);
    setNavigatorOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setDocumentHidden(false);
    setNavigatorOnline(true);
    vi.restoreAllMocks();
  });

  describe('computeBackoffDelay', () => {
    it('grows exponentially with jitter and caps at maxBackoffMs', () => {
      // With random() = 1.0, jitterFactor = 1.0 → exact base values
      expect(computeBackoffDelay(1, 1000, 30000, () => 1)).toBe(1000);
      expect(computeBackoffDelay(2, 1000, 30000, () => 1)).toBe(2000);
      expect(computeBackoffDelay(3, 1000, 30000, () => 1)).toBe(4000);
      expect(computeBackoffDelay(4, 1000, 30000, () => 1)).toBe(8000);
      expect(computeBackoffDelay(5, 1000, 30000, () => 1)).toBe(16000);
      expect(computeBackoffDelay(6, 1000, 30000, () => 1)).toBe(30000);

      // With random() = 0.0, jitterFactor = 0.5
      expect(computeBackoffDelay(1, 1000, 30000, () => 0)).toBe(500);
      expect(computeBackoffDelay(6, 1000, 30000, () => 0)).toBe(15000);
    });
  });

  describe('message handling', () => {
    it('opens an EventSource to the account endpoint and forwards valid JSON account events', () => {
      const onUpdate = vi.fn();
      const statuses: HorizonStreamStatus[] = [];

      const unsubscribe = subscribeToAccount(PUBLIC_KEY, {
        horizonUrl: HORIZON_URL,
        onUpdate,
        onStatus: (s) => statuses.push(s),
        EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
      });

      expect(FakeEventSource.instances).toHaveLength(1);
      const es = FakeEventSource.instances[0];
      expect(es.url).toBe(`${HORIZON_URL}/accounts/${PUBLIC_KEY}`);

      es.emitOpen();
      expect(statuses).toEqual(['live']);

      // Non-JSON greeting / heartbeat is ignored
      es.emitMessage('"hello"');
      es.emitMessage('not-json');
      expect(onUpdate).not.toHaveBeenCalled();

      // Valid account event
      const payload = {
        id: PUBLIC_KEY,
        balances: [{ asset_type: 'native', balance: '250.0000000' }],
      };
      es.emitMessage(payload);
      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(payload);

      unsubscribe();
    });
  });

  describe('backoff schedule and duplicate stream prevention', () => {
    it('reconnects with growing delays after errors, resets on message, and never opens duplicate streams', () => {
      const onUpdate = vi.fn();
      const statuses: HorizonStreamStatus[] = [];

      const unsubscribe = subscribeToAccount(PUBLIC_KEY, {
        horizonUrl: HORIZON_URL,
        onUpdate,
        onStatus: (s) => statuses.push(s),
        initialBackoffMs: 1000,
        maxBackoffMs: 30000,
        maxConsecutiveFailures: 5,
        EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
        random: () => 1, // deterministic: 1s, 2s, 4s...
      });

      expect(FakeEventSource.instances).toHaveLength(1);

      // 1st failure → 1000 ms delay
      FakeEventSource.instances[0].emitError();
      expect(FakeEventSource.instances[0].closed).toBe(true);
      expect(statuses).toEqual(['reconnecting']);

      vi.advanceTimersByTime(999);
      expect(FakeEventSource.instances).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(FakeEventSource.instances).toHaveLength(2);

      // 2nd failure → 2000 ms delay
      FakeEventSource.instances[1].emitError();
      expect(FakeEventSource.instances[1].closed).toBe(true);

      vi.advanceTimersByTime(1999);
      expect(FakeEventSource.instances).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(FakeEventSource.instances).toHaveLength(3);

      // Successful message resets backoff counter
      FakeEventSource.instances[2].emitMessage({
        id: PUBLIC_KEY,
        balances: [{ asset_type: 'native', balance: '50.0' }],
      });
      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(statuses[statuses.length - 1]).toBe('live');

      // Next failure starts back at 1000 ms (not 4000 ms)
      FakeEventSource.instances[2].emitError();
      vi.advanceTimersByTime(1000);
      expect(FakeEventSource.instances).toHaveLength(4);

      // Only the latest instance is open
      const openInstances = FakeEventSource.instances.filter((i) => !i.closed);
      expect(openInstances).toHaveLength(1);

      unsubscribe();
    });
  });

  describe('hidden-tab and offline pause', () => {
    it('pauses the stream while document.hidden is true and resumes when visible', () => {
      const onUpdate = vi.fn();

      const unsubscribe = subscribeToAccount(PUBLIC_KEY, {
        horizonUrl: HORIZON_URL,
        onUpdate,
        EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
      });

      expect(FakeEventSource.instances).toHaveLength(1);
      expect(FakeEventSource.instances[0].closed).toBe(false);

      // Tab becomes hidden
      setDocumentHidden(true);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(FakeEventSource.instances[0].closed).toBe(true);

      // No reconnect while hidden
      vi.advanceTimersByTime(60_000);
      expect(FakeEventSource.instances).toHaveLength(1);

      // Tab becomes visible again
      setDocumentHidden(false);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(FakeEventSource.instances).toHaveLength(2);
      expect(FakeEventSource.instances[1].closed).toBe(false);

      unsubscribe();
    });

    it('pauses when offline and resumes when online', () => {
      const unsubscribe = subscribeToAccount(PUBLIC_KEY, {
        horizonUrl: HORIZON_URL,
        onUpdate: vi.fn(),
        EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
      });

      expect(FakeEventSource.instances).toHaveLength(1);

      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
      expect(FakeEventSource.instances[0].closed).toBe(true);

      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
      expect(FakeEventSource.instances).toHaveLength(2);
      expect(FakeEventSource.instances[1].closed).toBe(false);

      unsubscribe();
    });
  });

  describe('polling fallback', () => {
    it('falls back to polling after maxConsecutiveFailures', () => {
      const onPoll = vi.fn();
      const statuses: HorizonStreamStatus[] = [];

      const unsubscribe = subscribeToAccount(PUBLIC_KEY, {
        horizonUrl: HORIZON_URL,
        onUpdate: vi.fn(),
        onStatus: (s) => statuses.push(s),
        onPoll,
        pollIntervalMs: 10_000,
        initialBackoffMs: 1_000,
        maxConsecutiveFailures: 3,
        EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
        random: () => 1,
      });

      // Failure 1 → reconnect after 1s
      FakeEventSource.instances[0].emitError();
      vi.advanceTimersByTime(1_000);
      // Failure 2 → reconnect after 2s
      FakeEventSource.instances[1].emitError();
      vi.advanceTimersByTime(2_000);
      // Failure 3 → enters polling fallback
      FakeEventSource.instances[2].emitError();

      expect(statuses[statuses.length - 1]).toBe('polling');
      expect(FakeEventSource.instances).toHaveLength(3);

      // Polling ticks fire at pollIntervalMs
      vi.advanceTimersByTime(10_000);
      expect(onPoll).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(10_000);
      expect(onPoll).toHaveBeenCalledTimes(2);

      unsubscribe();
    });

    it('falls back to polling immediately when EventSource is unavailable', () => {
      const onPoll = vi.fn();
      const statuses: HorizonStreamStatus[] = [];

      const originalES = globalThis.EventSource;
      // @ts-expect-error simulate environment without EventSource
      delete globalThis.EventSource;

      try {
        const unsubscribe = subscribeToAccount(PUBLIC_KEY, {
          horizonUrl: HORIZON_URL,
          onUpdate: vi.fn(),
          onStatus: (s) => statuses.push(s),
          onPoll,
          pollIntervalMs: 5_000,
        });

        expect(statuses).toEqual(['polling']);
        vi.advanceTimersByTime(5_000);
        expect(onPoll).toHaveBeenCalledTimes(1);

        unsubscribe();
        vi.advanceTimersByTime(10_000);
        expect(onPoll).toHaveBeenCalledTimes(1);
      } finally {
        globalThis.EventSource = originalES;
      }
    });
  });

  describe('unsubscribe', () => {
    it('closes the stream, clears pending timers, and ignores further events', () => {
      const onUpdate = vi.fn();
      const onPoll = vi.fn();

      const unsubscribe = subscribeToAccount(PUBLIC_KEY, {
        horizonUrl: HORIZON_URL,
        onUpdate,
        onPoll,
        initialBackoffMs: 1_000,
        EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
        random: () => 1,
      });

      const es = FakeEventSource.instances[0];
      es.emitError(); // schedules reconnect timer

      unsubscribe();
      unsubscribe(); // idempotent

      expect(es.closed).toBe(true);

      // Advance well past reconnect delay — no new EventSource should be created
      vi.advanceTimersByTime(60_000);
      expect(FakeEventSource.instances).toHaveLength(1);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onPoll).not.toHaveBeenCalled();
    });
  });
});
