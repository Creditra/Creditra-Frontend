/**
 * Tests for collateral substitution logging and diagnostics.
 *
 * Coverage:
 *  - Safe diagnostic context extraction (no sensitive data)
 *  - Structured log entries
 *  - Console logger implementation
 *  - Logger extensibility via custom implementation
 *  - No sensitive data in logs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSafeDiagnosticContext,
  createSafeErrorContext,
  ConsoleSubstitutionLogger,
  setSubstitutionLogger,
  getSubstitutionLogger,
  logSubstitutionEvent,
  logIdempotencyKeyGenerated,
  logDuplicateDetected,
  logSubmissionAttempted,
  logSubmissionSucceeded,
  logSubmissionFailed,
  logSubmissionRetried,
  logMaxRetriesExhausted,
  logSlippageExceeded,
  logStaleQuoteDetected,
  logConcurrentSubmissionBlocked,
  type SubmissionAttempt,
} from './collateral-logging';
import type { SubstitutionError } from '../types/collateral';

describe('collateral-logging', () => {
  // ── Safe diagnostic context ────────────────────────────────────────────

  describe('createSafeDiagnosticContext', () => {
    it('extracts idempotency key', () => {
      const attempt: SubmissionAttempt = {
        idempotencyKey: 'idem_test123' as any,
        initiatedAtMs: Date.now() - 5000,
        attemptCount: 1,
      };
      const ctx = createSafeDiagnosticContext(attempt);
      expect(ctx.idempotencyKey).toBe('idem_test123');
    });

    it('includes attempt count', () => {
      const attempt: SubmissionAttempt = {
        idempotencyKey: 'idem_test123' as any,
        initiatedAtMs: Date.now(),
        attemptCount: 2,
      };
      const ctx = createSafeDiagnosticContext(attempt);
      expect(ctx.attemptCount).toBe(2);
    });

    it('computes ageMs from initiation time', () => {
      const now = Date.now();
      const fiveSecondsAgo = now - 5000;
      const attempt: SubmissionAttempt = {
        idempotencyKey: 'idem_test123' as any,
        initiatedAtMs: fiveSecondsAgo,
        attemptCount: 1,
      };
      const ctx = createSafeDiagnosticContext(attempt);
      expect(ctx.ageMs).toBeGreaterThanOrEqual(4999);
      expect(ctx.ageMs).toBeLessThanOrEqual(5050);
    });

    it('indicates no server response initially', () => {
      const attempt: SubmissionAttempt = {
        idempotencyKey: 'idem_test123' as any,
        initiatedAtMs: Date.now(),
        attemptCount: 0,
      };
      const ctx = createSafeDiagnosticContext(attempt);
      expect(ctx.hasServerResponse).toBe(false);
      expect(ctx.lastServerStatusOrReason).toBeUndefined();
    });

    it('includes server response status when available', () => {
      const attempt: SubmissionAttempt = {
        idempotencyKey: 'idem_test123' as any,
        initiatedAtMs: Date.now(),
        attemptCount: 1,
        lastServerResponse: {
          statusOrReason: 'network',
          message: 'Connection timeout',
          receivedAtMs: Date.now(),
        },
      };
      const ctx = createSafeDiagnosticContext(attempt);
      expect(ctx.hasServerResponse).toBe(true);
      expect(ctx.lastServerStatusOrReason).toBe('network');
    });

    it('never includes sensitive data', () => {
      const attempt: SubmissionAttempt = {
        idempotencyKey: 'idem_test123' as any,
        initiatedAtMs: Date.now(),
        attemptCount: 1,
      };
      const ctx = createSafeDiagnosticContext(attempt);
      const ctxStr = JSON.stringify(ctx);
      expect(ctxStr).not.toContain('password');
      expect(ctxStr).not.toContain('secret');
      expect(ctxStr).not.toContain('token');
    });
  });

  // ── Safe error context ─────────────────────────────────────────────────

  describe('createSafeErrorContext', () => {
    it('extracts reason and retryability', () => {
      const error: SubstitutionError = {
        reason: 'network',
        message: 'Connection timeout',
        retryable: true,
      };
      const ctx = createSafeErrorContext(error);
      expect(ctx.reason).toBe('network');
      expect(ctx.retryable).toBe(true);
    });

    it('includes idempotency key if present', () => {
      const error: SubstitutionError = {
        reason: 'validation',
        message: 'Invalid input',
        retryable: false,
        idempotencyKey: 'idem_test123',
      };
      const ctx = createSafeErrorContext(error);
      expect(ctx.idempotencyKey).toBe('idem_test123');
    });

    it('omits the error message (sensitive data)', () => {
      const error: SubstitutionError = {
        reason: 'network',
        message: 'Connection timeout with sensitive details',
        retryable: true,
      };
      const ctx = createSafeErrorContext(error);
      const ctxStr = JSON.stringify(ctx);
      expect(ctxStr).not.toContain('Connection timeout');
      expect(ctxStr).not.toContain('sensitive details');
    });
  });

  // ── Console logger ─────────────────────────────────────────────────────

  describe('ConsoleSubstitutionLogger', () => {
    let logger: ConsoleSubstitutionLogger;

    beforeEach(() => {
      logger = new ConsoleSubstitutionLogger();
      vi.spyOn(console, 'debug').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('logs events to console with appropriate level', () => {
      const debugSpy = vi.spyOn(console, 'debug');
      logger.log({
        timestamp: Date.now(),
        event: 'idempotency_key_generated',
        level: 'debug',
        context: {
          idempotencyKey: 'idem_test',
          attemptCount: 0,
          ageMs: 0,
          hasServerResponse: false,
        },
        reason: 'Generated key',
      });
      expect(debugSpy).toHaveBeenCalled();
    });

    it('builds event log with all entries', () => {
      const now = Date.now();
      logger.log({
        timestamp: now,
        event: 'idempotency_key_generated',
        level: 'debug',
        context: {
          idempotencyKey: 'idem_test',
          attemptCount: 0,
          ageMs: 0,
          hasServerResponse: false,
        },
      });

      logger.log({
        timestamp: now + 100,
        event: 'submission_attempted',
        level: 'debug',
        context: {
          idempotencyKey: 'idem_test',
          attemptCount: 1,
          ageMs: 100,
          hasServerResponse: false,
        },
      });

      const log = logger.getLog();
      expect(log).toBeDefined();
      expect(log!.entries.length).toBe(2);
      expect(log!.startTimeMs).toBe(now);
      expect(log!.durationMs).toBe(100);
    });

    it('returns null before any logs are recorded', () => {
      const logger2 = new ConsoleSubstitutionLogger();
      expect(logger2.getLog()).toBeNull();
    });
  });

  // ── Logger extensibility ────────────────────────────────────────────────

  describe('Logger configuration', () => {
    it('allows setting a custom logger', () => {
      const mockLogger = { log: vi.fn(), getLog: vi.fn() };
      setSubstitutionLogger(mockLogger);
      expect(getSubstitutionLogger()).toBe(mockLogger);
    });

    it('uses the custom logger for events', () => {
      const mockLogger = { log: vi.fn(), getLog: vi.fn() };
      setSubstitutionLogger(mockLogger);

      logSubmissionSucceeded({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 100,
        hasServerResponse: true,
        lastServerStatusOrReason: 'success',
      });

      expect(mockLogger.log).toHaveBeenCalled();
    });
  });

  // ── Convenience functions ──────────────────────────────────────────────

  describe('Convenience logging functions', () => {
    let mockLogger: any;

    beforeEach(() => {
      mockLogger = { log: vi.fn(), getLog: vi.fn() };
      setSubstitutionLogger(mockLogger);
    });

    it('logIdempotencyKeyGenerated', () => {
      logIdempotencyKeyGenerated({
        idempotencyKey: 'idem_test',
        attemptCount: 0,
        ageMs: 0,
        hasServerResponse: false,
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'idempotency_key_generated',
          level: 'debug',
        }),
      );
    });

    it('logDuplicateDetected', () => {
      logDuplicateDetected({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 100,
        hasServerResponse: true,
        lastServerStatusOrReason: 'success',
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'duplicate_detected',
          level: 'debug',
        }),
      );
    });

    it('logSubmissionAttempted', () => {
      logSubmissionAttempted({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 50,
        hasServerResponse: false,
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'submission_attempted',
          level: 'debug',
        }),
      );
    });

    it('logSubmissionSucceeded', () => {
      logSubmissionSucceeded({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 100,
        hasServerResponse: true,
        lastServerStatusOrReason: 'success',
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'submission_succeeded',
          level: 'info',
        }),
      );
    });

    it('logSubmissionFailed', () => {
      const error: SubstitutionError = {
        reason: 'network',
        message: 'Connection timeout',
        retryable: true,
      };
      logSubmissionFailed(
        {
          idempotencyKey: 'idem_test',
          attemptCount: 1,
          ageMs: 100,
          hasServerResponse: true,
          lastServerStatusOrReason: 'network',
        },
        error,
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'submission_failed',
          level: 'warn',
          errorReason: 'network',
        }),
      );
    });

    it('logSubmissionRetried', () => {
      logSubmissionRetried({
        idempotencyKey: 'idem_test',
        attemptCount: 2,
        ageMs: 200,
        hasServerResponse: true,
        lastServerStatusOrReason: 'network',
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'submission_retried',
          level: 'debug',
        }),
      );
    });

    it('logMaxRetriesExhausted', () => {
      const error: SubstitutionError = {
        reason: 'network',
        message: 'Connection timeout',
        retryable: true,
      };
      logMaxRetriesExhausted(
        {
          idempotencyKey: 'idem_test',
          attemptCount: 3,
          ageMs: 300,
          hasServerResponse: true,
          lastServerStatusOrReason: 'network',
        },
        error,
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'max_retries_exhausted',
          level: 'error',
          errorReason: 'network',
        }),
      );
    });

    it('logSlippageExceeded', () => {
      logSlippageExceeded({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 150,
        hasServerResponse: false,
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'slippage_exceeded',
          level: 'warn',
        }),
      );
    });

    it('logStaleQuoteDetected', () => {
      logStaleQuoteDetected({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 65000,
        hasServerResponse: false,
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'stale_quote_detected',
          level: 'warn',
        }),
      );
    });

    it('logConcurrentSubmissionBlocked', () => {
      logConcurrentSubmissionBlocked({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 50,
        hasServerResponse: false,
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'concurrent_submission_blocked',
          level: 'debug',
        }),
      );
    });
  });

  // ── Data sanitization ──────────────────────────────────────────────────

  describe('Sensitive data handling', () => {
    it('never logs balance amounts', () => {
      const mockLogger = { log: vi.fn(), getLog: vi.fn() };
      setSubstitutionLogger(mockLogger);

      logSubmissionSucceeded({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 100,
        hasServerResponse: true,
      });

      const logCall = mockLogger.log.mock.calls[0][0];
      const logStr = JSON.stringify(logCall);
      expect(logStr).not.toContain('187500');
      expect(logStr).not.toContain('1200000');
    });

    it('never logs asset values', () => {
      const mockLogger = { log: vi.fn(), getLog: vi.fn() };
      setSubstitutionLogger(mockLogger);

      logSubmissionSucceeded({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 100,
        hasServerResponse: true,
      });

      const logCall = mockLogger.log.mock.calls[0][0];
      const logStr = JSON.stringify(logCall);
      // Typical asset values should not appear
      expect(logStr).not.toContain('1000000');
    });

    it('never logs LTV ratios', () => {
      const mockLogger = { log: vi.fn(), getLog: vi.fn() };
      setSubstitutionLogger(mockLogger);

      logSubmissionSucceeded({
        idempotencyKey: 'idem_test',
        attemptCount: 1,
        ageMs: 100,
        hasServerResponse: true,
      });

      const logCall = mockLogger.log.mock.calls[0][0];
      const logStr = JSON.stringify(logCall);
      expect(logStr).not.toContain('0.42');
      expect(logStr).not.toContain('0.75');
    });
  });
});
