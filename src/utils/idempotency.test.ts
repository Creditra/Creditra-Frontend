/**
 * Unit tests for idempotency key generation and submission attempt tracking.
 *
 * Tests cover:
 *   - Deterministic key generation (same inputs → same key)
 *   - Collision resistance (different inputs → different keys)
 *   - State transitions (idle → pending → success/error)
 *   - Retry logic and attempt counting
 *   - Staleness detection
 *   - Server response recording
 *   - Safe duplicate detection
 */

import {
  generateIdempotencyKey,
  type IdempotencyKeyParams,
  createSubmissionAttempt,
  recordSubmissionAttempt,
  recordServerResponse,
  hasSucceeded,
  isRetryable,
  isStaleSubmission,
  extractDiagnostics,
  type SubmissionAttempt,
} from './idempotency';

describe('generateIdempotencyKey', () => {
  it('generates a key with the correct prefix', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const key = generateIdempotencyKey(params);
    expect(key).toMatch(/^idem_/);
  });

  it('is deterministic: same params produce the same key', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const key1 = generateIdempotencyKey(params);
    const key2 = generateIdempotencyKey(params);
    expect(key1).toBe(key2);
  });

  it('produces different keys for different credit lines', () => {
    const base: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const key1 = generateIdempotencyKey(base);
    const key2 = generateIdempotencyKey({
      ...base,
      creditLineId: 'cl-456',
    });
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different outgoing assets', () => {
    const base: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const key1 = generateIdempotencyKey(base);
    const key2 = generateIdempotencyKey({
      ...base,
      outgoingAssetId: 'asset-xlm',
    });
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different incoming assets', () => {
    const base: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const key1 = generateIdempotencyKey(base);
    const key2 = generateIdempotencyKey({
      ...base,
      incomingAssetId: 'asset-xlm',
    });
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different timestamps', () => {
    const base: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const key1 = generateIdempotencyKey(base);
    const key2 = generateIdempotencyKey({
      ...base,
      initiatedAtMs: 1692345600001,
    });
    expect(key1).not.toBe(key2);
  });

  it('handles undefined outgoing asset correctly', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: undefined,
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const key = generateIdempotencyKey(params);
    expect(key).toMatch(/^idem_/);
  });

  it('treats undefined and omitted outgoing asset the same', () => {
    const params1: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: undefined,
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const params2: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const key1 = generateIdempotencyKey(params1);
    const key2 = generateIdempotencyKey(params2);
    expect(key1).toBe(key2);
  });

  it('produces valid, non-empty keys', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const key = generateIdempotencyKey(params);
    expect(key).toBeTruthy();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan('idem_'.length);
  });
});

describe('createSubmissionAttempt', () => {
  it('creates an attempt with the idempotency key', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const attempt = createSubmissionAttempt(params);
    expect(attempt.idempotencyKey).toMatch(/^idem_/);
  });

  it('initializes with zero attempt count', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const attempt = createSubmissionAttempt(params);
    expect(attempt.attemptCount).toBe(0);
  });

  it('captures the initiated timestamp', () => {
    const now = Date.now();
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: now,
    };
    const attempt = createSubmissionAttempt(params);
    expect(attempt.initiatedAtMs).toBe(now);
  });

  it('has no server response initially', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const attempt = createSubmissionAttempt(params);
    expect(attempt.lastServerResponse).toBeUndefined();
  });
});

describe('recordSubmissionAttempt', () => {
  it('increments attempt count', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    expect(attempt.attemptCount).toBe(0);

    attempt = recordSubmissionAttempt(attempt);
    expect(attempt.attemptCount).toBe(1);

    attempt = recordSubmissionAttempt(attempt);
    expect(attempt.attemptCount).toBe(2);
  });

  it('records the submission timestamp', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const attempt = recordSubmissionAttempt(createSubmissionAttempt(params));
    expect(attempt.lastSubmittedAtMs).toBeDefined();
    expect(typeof attempt.lastSubmittedAtMs).toBe('number');
  });

  it('does not mutate the input', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const original = createSubmissionAttempt(params);
    const updated = recordSubmissionAttempt(original);
    expect(original.attemptCount).toBe(0);
    expect(updated.attemptCount).toBe(1);
  });

  it('preserves the idempotency key', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const original = createSubmissionAttempt(params);
    const updated = recordSubmissionAttempt(original);
    expect(updated.idempotencyKey).toBe(original.idempotencyKey);
  });
});

describe('recordServerResponse', () => {
  it('records a successful response', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordServerResponse(attempt, 'success', 'Collateral substituted successfully');
    expect(attempt.lastServerResponse).toBeDefined();
    expect(attempt.lastServerResponse?.statusOrReason).toBe('success');
    expect(attempt.lastServerResponse?.message).toBe('Collateral substituted successfully');
  });

  it('records an error response', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordServerResponse(attempt, 'network', 'Connection timeout');
    expect(attempt.lastServerResponse?.statusOrReason).toBe('network');
    expect(attempt.lastServerResponse?.message).toBe('Connection timeout');
  });

  it('records the response timestamp', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordServerResponse(attempt, 'success');
    expect(attempt.lastServerResponse?.receivedAtMs).toBeDefined();
    expect(typeof attempt.lastServerResponse?.receivedAtMs).toBe('number');
  });

  it('allows message to be undefined', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordServerResponse(attempt, 'validation');
    expect(attempt.lastServerResponse?.message).toBeUndefined();
  });

  it('does not mutate the input', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const original = createSubmissionAttempt(params);
    const updated = recordServerResponse(original, 'success');
    expect(original.lastServerResponse).toBeUndefined();
    expect(updated.lastServerResponse).toBeDefined();
  });
});

describe('hasSucceeded', () => {
  it('returns false when no response has been recorded', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const attempt = createSubmissionAttempt(params);
    expect(hasSucceeded(attempt)).toBe(false);
  });

  it('returns false when an error response has been recorded', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordServerResponse(attempt, 'network');
    expect(hasSucceeded(attempt)).toBe(false);
  });

  it('returns true when a success response has been recorded', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordServerResponse(attempt, 'success');
    expect(hasSucceeded(attempt)).toBe(true);
  });
});

describe('isRetryable', () => {
  it('returns false when the operation has already succeeded', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordServerResponse(attempt, 'success');
    expect(isRetryable(attempt, 3, true)).toBe(false);
  });

  it('returns false when max attempts have been reached', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordSubmissionAttempt(attempt);
    attempt = recordSubmissionAttempt(attempt);
    attempt = recordSubmissionAttempt(attempt);
    expect(attempt.attemptCount).toBe(3);
    expect(isRetryable(attempt, 3, true)).toBe(false);
  });

  it('returns false when the error is not retryable', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    const attempt = createSubmissionAttempt(params);
    expect(isRetryable(attempt, 3, false)).toBe(false);
  });

  it('returns true when retryable conditions are met', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordSubmissionAttempt(attempt);
    expect(isRetryable(attempt, 3, true)).toBe(true);
  });

  it('returns true up to max attempts', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: 1692345600000,
    };
    let attempt = createSubmissionAttempt(params);

    // First retry: should be retryable
    attempt = recordSubmissionAttempt(attempt);
    expect(isRetryable(attempt, 3, true)).toBe(true);

    // Second retry: should be retryable
    attempt = recordSubmissionAttempt(attempt);
    expect(isRetryable(attempt, 3, true)).toBe(true);

    // Third retry: should be retryable
    attempt = recordSubmissionAttempt(attempt);
    expect(isRetryable(attempt, 3, true)).toBe(true);

    // Fourth retry: max reached, not retryable
    attempt = recordSubmissionAttempt(attempt);
    expect(isRetryable(attempt, 3, true)).toBe(false);
  });
});

describe('isStaleSubmission', () => {
  it('returns false for fresh submissions', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: Date.now(),
    };
    const attempt = createSubmissionAttempt(params);
    expect(isStaleSubmission(attempt, 30 * 60 * 1000)).toBe(false);
  });

  it('returns true for old submissions (default 30 min threshold)', () => {
    const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: thirtyOneMinutesAgo,
    };
    const attempt = createSubmissionAttempt(params);
    expect(isStaleSubmission(attempt)).toBe(true);
  });

  it('respects custom threshold', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: fiveMinutesAgo,
    };
    const attempt = createSubmissionAttempt(params);

    // Should not be stale with 10-minute threshold
    expect(isStaleSubmission(attempt, 10 * 60 * 1000)).toBe(false);

    // Should be stale with 1-minute threshold
    expect(isStaleSubmission(attempt, 1 * 60 * 1000)).toBe(true);
  });

  it('returns false when exactly at the threshold', () => {
    const exactlyThirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: exactlyThirtyMinutesAgo,
    };
    const attempt = createSubmissionAttempt(params);
    expect(isStaleSubmission(attempt, 30 * 60 * 1000)).toBe(false);
  });

  it('returns true when 1ms over the threshold', () => {
    const thirtyMinutesPlusOneMs = Date.now() - 30 * 60 * 1000 - 1;
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: thirtyMinutesPlusOneMs,
    };
    const attempt = createSubmissionAttempt(params);
    expect(isStaleSubmission(attempt, 30 * 60 * 1000)).toBe(true);
  });
});

describe('extractDiagnostics', () => {
  it('extracts diagnostics from a fresh attempt', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: Date.now(),
    };
    const attempt = createSubmissionAttempt(params);
    const diag = extractDiagnostics(attempt);

    expect(diag.idempotencyKey).toBe(attempt.idempotencyKey);
    expect(diag.attemptCount).toBe(0);
    expect(diag.ageMs).toBeLessThan(100); // Should be very recent
    expect(diag.hasServerResponse).toBe(false);
    expect(diag.lastServerStatusOrReason).toBeUndefined();
  });

  it('extracts diagnostics from an attempt with server response', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: Date.now() - 5000,
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordSubmissionAttempt(attempt);
    attempt = recordServerResponse(attempt, 'network', 'Connection timeout');

    const diag = extractDiagnostics(attempt);
    expect(diag.idempotencyKey).toBe(attempt.idempotencyKey);
    expect(diag.attemptCount).toBe(1);
    expect(diag.ageMs).toBeGreaterThanOrEqual(5000);
    expect(diag.hasServerResponse).toBe(true);
    expect(diag.lastServerStatusOrReason).toBe('network');
  });

  it('never exposes sensitive data in diagnostics', () => {
    const params: IdempotencyKeyParams = {
      creditLineId: 'cl-123',
      outgoingAssetId: 'asset-btc',
      incomingAssetId: 'asset-usdc',
      initiatedAtMs: Date.now(),
    };
    let attempt = createSubmissionAttempt(params);
    attempt = recordServerResponse(attempt, 'success', 'Secret API key: sk_live_123456789');

    const diag = extractDiagnostics(attempt);

    // Diagnostics should not include the server message
    expect(JSON.stringify(diag)).not.toContain('sk_live_');
    expect(JSON.stringify(diag)).not.toContain('Secret');
    expect(diag).toEqual({
      idempotencyKey: expect.any(String),
      attemptCount: expect.any(Number),
      ageMs: expect.any(Number),
      hasServerResponse: true,
      lastServerStatusOrReason: 'success',
    });
  });
});
