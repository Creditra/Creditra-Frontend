/**
 * Structured logging and metrics for collateral substitution operations.
 *
 * This module provides a consistent interface for logging substitution events,
 * diagnostic information, and metrics. All logs are structured to avoid exposing
 * sensitive data (balance amounts, asset values, LTV ratios, user PII).
 *
 * Integrates with the browser console and can be extended to send metrics to
 * analytics services (Sentry, DataDog, etc.) without sensitive payload data.
 */

import type { SubmissionAttempt } from './idempotency';
import type { SubstitutionError, SubstitutionFailureReason } from '../types/collateral';

/**
 * Log levels for structured diagnostics.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Safe diagnostic context for logging (excludes sensitive data).
 */
export interface SafeDiagnosticContext {
  /** Idempotency key for linking attempts and errors. */
  idempotencyKey: string;
  /** Current attempt number. */
  attemptCount: number;
  /** Time elapsed since operation initiation (ms). */
  ageMs: number;
  /** Whether a server response has been received. */
  hasServerResponse: boolean;
  /** Last known server response status or reason (no message). */
  lastServerStatusOrReason?: string;
}

/**
 * Event types for structured logging.
 */
export type SubstitutionLogEvent =
  | 'substitution_initiated'
  | 'idempotency_key_generated'
  | 'duplicate_detected'
  | 'submission_attempted'
  | 'submission_succeeded'
  | 'submission_failed'
  | 'submission_retried'
  | 'max_retries_exhausted'
  | 'slippage_exceeded'
  | 'stale_quote_detected'
  | 'concurrent_submission_blocked';

/**
 * Structured log entry for analytics and debugging.
 */
export interface StructuredLogEntry {
  /** Timestamp when the event occurred. */
  timestamp: number;
  /** Event type identifier. */
  event: SubstitutionLogEvent;
  /** Log level (debug, info, warn, error). */
  level: LogLevel;
  /** Safe diagnostic context (no sensitive data). */
  context: SafeDiagnosticContext;
  /** Reason code or message (human-safe, no secrets). */
  reason?: string;
  /** Optional error classification (for error events). */
  errorReason?: SubstitutionFailureReason;
}

/**
 * Collection of logged events for a single substitution operation.
 * Useful for debugging, support, and post-mortems.
 */
export interface SubstitutionEventLog {
  /** All logged events in order. */
  entries: StructuredLogEntry[];
  /** Start time of the operation. */
  startTimeMs: number;
  /** Total duration of the operation (if completed). */
  durationMs?: number;
}

/**
 * Create a safe diagnostic context from a submission attempt.
 * This function extracts only non-sensitive information for logging.
 *
 * @param attempt  The submission attempt to extract diagnostics from
 * @returns        Safe context suitable for logging/analytics
 */
export function createSafeDiagnosticContext(attempt: SubmissionAttempt): SafeDiagnosticContext {
  return {
    idempotencyKey: attempt.idempotencyKey,
    attemptCount: attempt.attemptCount,
    ageMs: Date.now() - attempt.initiatedAtMs,
    hasServerResponse: attempt.lastServerResponse != null,
    lastServerStatusOrReason: attempt.lastServerResponse?.statusOrReason,
  };
}

/**
 * Extract safe diagnostic information from an error object.
 * Returns only non-sensitive fields suitable for logging.
 *
 * @param error  The error to extract diagnostics from
 * @returns      Safe diagnostic fields
 */
export function createSafeErrorContext(error: SubstitutionError) {
  return {
    reason: error.reason,
    retryable: error.retryable,
    code: error.code,
    idempotencyKey: error.idempotencyKey,
  };
}

/**
 * Logger interface for extensibility. Implementations can send logs to
 * different backends (console, Sentry, DataDog, etc.).
 */
export interface ISubstitutionLogger {
  /**
   * Log a structured event.
   *
   * @param entry  The log entry to record
   */
  log(entry: StructuredLogEntry): void;

  /**
   * Retrieve all logged events (for debugging in development).
   */
  getLog(): SubstitutionEventLog | null;
}

/**
 * Default logger implementation that writes to the browser console.
 * Does not send data to external services; suitable for development.
 */
export class ConsoleSubstitutionLogger implements ISubstitutionLogger {
  private eventLog: SubstitutionEventLog | null = null;

  log(entry: StructuredLogEntry): void {
    // Initialize event log on first entry
    if (!this.eventLog) {
      this.eventLog = {
        entries: [],
        startTimeMs: entry.timestamp,
      };
    }

    // Record the entry
    this.eventLog.entries.push(entry);
    this.eventLog.durationMs = entry.timestamp - this.eventLog.startTimeMs;

    // Write to console with appropriate level
    const logFn = console[entry.level] || console.log;
    logFn(
      `[CollateralSubstitution/${entry.event}] ${entry.reason || ''}`.trim(),
      entry.context,
    );
  }

  getLog(): SubstitutionEventLog | null {
    return this.eventLog;
  }
}

/**
 * Singleton logger instance (can be extended with analytics backends).
 */
let globalLogger: ISubstitutionLogger = new ConsoleSubstitutionLogger();

/**
 * Set a custom logger implementation (e.g., for analytics integration).
 *
 * @param logger  The logger to use for all subsequent events
 */
export function setSubstitutionLogger(logger: ISubstitutionLogger): void {
  globalLogger = logger;
}

/**
 * Get the current logger instance.
 */
export function getSubstitutionLogger(): ISubstitutionLogger {
  return globalLogger;
}

/**
 * Log a substitution event using the global logger.
 *
 * @param event     Event type identifier
 * @param level     Log level (debug, info, warn, error)
 * @param context   Safe diagnostic context
 * @param reason    Optional human-safe message
 * @param errorReason Optional error classification
 */
export function logSubstitutionEvent(
  event: SubstitutionLogEvent,
  level: LogLevel,
  context: SafeDiagnosticContext,
  reason?: string,
  errorReason?: SubstitutionFailureReason,
): void {
  const entry: StructuredLogEntry = {
    timestamp: Date.now(),
    event,
    level,
    context,
    reason,
    errorReason,
  };
  globalLogger.log(entry);
}

// ─── Convenience logging functions ─────────────────────────────────────────

/**
 * Log the generation of an idempotency key.
 */
export function logIdempotencyKeyGenerated(context: SafeDiagnosticContext): void {
  logSubstitutionEvent(
    'idempotency_key_generated',
    'debug',
    context,
    `Generated key: ${context.idempotencyKey}`,
  );
}

/**
 * Log detection of a duplicate submission (already succeeded).
 */
export function logDuplicateDetected(context: SafeDiagnosticContext): void {
  logSubstitutionEvent(
    'duplicate_detected',
    'debug',
    context,
    `Duplicate submission detected; skipping side-effect replay`,
  );
}

/**
 * Log a submission attempt.
 */
export function logSubmissionAttempted(context: SafeDiagnosticContext): void {
  logSubstitutionEvent(
    'submission_attempted',
    'debug',
    context,
    `Submitting attempt ${context.attemptCount}`,
  );
}

/**
 * Log a successful submission.
 */
export function logSubmissionSucceeded(context: SafeDiagnosticContext): void {
  logSubstitutionEvent(
    'submission_succeeded',
    'info',
    context,
    `Submission succeeded on attempt ${context.attemptCount}`,
  );
}

/**
 * Log a failed submission.
 */
export function logSubmissionFailed(
  context: SafeDiagnosticContext,
  error: SubstitutionError,
): void {
  logSubstitutionEvent(
    'submission_failed',
    'warn',
    context,
    `Submission failed: ${error.reason}${error.retryable ? ' (retryable)' : ''}`,
    error.reason,
  );
}

/**
 * Log a retry attempt.
 */
export function logSubmissionRetried(context: SafeDiagnosticContext): void {
  logSubstitutionEvent(
    'submission_retried',
    'debug',
    context,
    `Retrying submission; new attempt ${context.attemptCount}`,
  );
}

/**
 * Log exhaustion of retry attempts.
 */
export function logMaxRetriesExhausted(
  context: SafeDiagnosticContext,
  error: SubstitutionError,
): void {
  logSubstitutionEvent(
    'max_retries_exhausted',
    'error',
    context,
    `Max retries exhausted; final error: ${error.reason}`,
    error.reason,
  );
}

/**
 * Log slippage exceeded error (non-retryable).
 */
export function logSlippageExceeded(context: SafeDiagnosticContext): void {
  logSubstitutionEvent(
    'slippage_exceeded',
    'warn',
    context,
    'Collateral LTV drifted beyond user tolerance',
  );
}

/**
 * Log stale quote detection.
 */
export function logStaleQuoteDetected(context: SafeDiagnosticContext): void {
  logSubstitutionEvent(
    'stale_quote_detected',
    'warn',
    context,
    'Review snapshot older than threshold; user must refresh',
  );
}

/**
 * Log blocked concurrent submission.
 */
export function logConcurrentSubmissionBlocked(context: SafeDiagnosticContext): void {
  logSubstitutionEvent(
    'concurrent_submission_blocked',
    'debug',
    context,
    'Concurrent submission attempt blocked by guard',
  );
}
