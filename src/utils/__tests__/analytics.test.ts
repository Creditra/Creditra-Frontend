import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackEvent, hasConsent, redactFinancialData } from '../analytics';
import * as storage from '../storage';
import { AnalyticsPreferences } from '../../types/analytics';

// Mock storage and fetch
vi.mock('../storage', () => ({
  readJson: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Analytics Engine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('hasConsent', () => {
    it('returns true when consent is granted for a category', () => {
      vi.mocked(storage.readJson).mockReturnValue({
        usage: true,
        performance: false,
        crash_reports: false,
        feature_flags: false,
      } as AnalyticsPreferences);

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
          }
        }
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
      // It should cap at depth 10
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

  describe('trackEvent', () => {
    it('does not send event if consent is missing', async () => {
      vi.mocked(storage.readJson).mockReturnValue({
        usage: false,
        performance: false,
        crash_reports: false,
        feature_flags: false,
      } as AnalyticsPreferences);

      await trackEvent({
        eventName: 'TestEvent',
        category: 'usage',
        payload: { amount: 100 },
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends redacted event if consent is granted', async () => {
      vi.mocked(storage.readJson).mockReturnValue({
        usage: true,
        performance: false,
        crash_reports: false,
        feature_flags: false,
      } as AnalyticsPreferences);

      await trackEvent({
        eventName: 'TestEvent',
        category: 'usage',
        payload: { amount: 100, safe: true },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchArgs = mockFetch.mock.calls[0];
      expect(fetchArgs[0]).toBe('/api/analytics');
      const body = JSON.parse(fetchArgs[1].body);
      expect(body.event).toBe('TestEvent');
      expect(body.category).toBe('usage');
      expect(body.payload.amount).toBe('[REDACTED]');
      expect(body.payload.safe).toBe(true);
    });

    it('silently recovers and logs on fetch failure', async () => {
      vi.mocked(storage.readJson).mockReturnValue({
        usage: true,
        performance: false,
        crash_reports: false,
        feature_flags: false,
      } as AnalyticsPreferences);

      mockFetch.mockRejectedValue(new Error('Network Error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await trackEvent({
        eventName: 'FailEvent',
        category: 'usage',
      });

      expect(consoleSpy).toHaveBeenCalledWith('[Analytics] Failed to send event "FailEvent" in category "usage".');
      
      consoleSpy.mockRestore();
    });
    
    it('aborts cleanly on invalid events', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await trackEvent(null as any);
      expect(consoleSpy).toHaveBeenCalledWith('[Analytics] Invalid event payload');
      expect(mockFetch).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});
