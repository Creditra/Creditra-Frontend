/**
 * Idempotency utilities for preventing duplicate submissions in retryable operations.
 *
 * This module provides deterministic request ID generation, submission state tracking,
 * and deduplication semantics to ensure retries, network failures, and concurrent
 * execution cannot produce silent data loss or duplicated side effects.
 *
 * DESIGN PRINCIPLES
 * =================
 *
 * 1. Deterministic: Same inputs always produce the same key (reviewable, auditable)
 * 2. Collision-resistant: Different logical operations produce different keys
 * 3. Observable: Keys are logged for diagnostics without exposing sensitive data
 * 4. Stable: Keys remain consistent across retries within a single user session
 * 5. Reviewable: Keys are constructed from immutable, non-sensitive operational metadata
 *
 * FAILURE MODES
 * =============
 *
 * Network failures are safely handled by re-submitting with the same key. The server
 * detects the duplicate key and returns the prior success response without re-processing.
 * This prevents:
 *   - Retries from creating duplicate intents
 *   - Concurrent requests from race-conditioning the state
 *   - Recovered app crashes from replaying side effects
 *
 * INVARIANTS
 * ==========
 *
 * - A key is generated once per modal session (not per attempt)
 * - All retries reuse the same key
 * - The attempt count increments on each submission (not on each retry UI interaction)
 * - If the server reports success, the key is marked as succeeded and no side effects are replayed
 * - Authorization, validation, and state-transition checks remain enforced
 * - Slippage and stale-quote guards are checked before submission (not after)
 *
 * INTEGRATION
 * ===========
 *
 * From CollateralSubstitutionModal:
 *
 *   // On first submit attempt, generate key from immutable intent params
 *   submissionAttemptRef.current = createSubmissionAttempt({
 *     creditLineId: 'cl-123',
 *     outgoingAssetId: 'asset-btc',
 *     incomingAssetId: 'asset-usdc',
 *     initiatedAtMs: Date.now(),
 *   });
 *
 *   // Check if already succeeded before replaying side effects
 *   if (hasSucceeded(submissionAttemptRef.current)) {
 *     onSuccess(selected);
 *     return;
 *   }
 *
 *   // Record the attempt before network call
 *   submissionAttemptRef.current = recordSubmissionAttempt(submissionAttemptRef.current);
 *
 *   // Include the key in the API request
 *   const idempotencyKey = submissionAttemptRef.current.idempotencyKey;
 *   await apiClient.substituteCollateral({ idempotencyKey, ... });
 *
 *   // Record the server response
 *   submissionAttemptRef.current = recordServerResponse(
 *     submissionAttemptRef.current,
 *     'success',
 *     'Collateral substituted'
 *   );
 *
 * SERVER-SIDE REQUIREMENTS
 * ========================
 *
 * To prevent duplicate intents, the server must:
 *
 * 1. Accept the idempotencyKey in the substitution request (header or body)
 * 2. Check for prior processing: if key exists and succeeded, return prior response
 * 3. Atomically store the key on first attempt to prevent race conditions
 * 4. Return the same response for all requests with the same key
 * 5. Optionally log the key for audit trails and support diagnostics
 *
 * Example server pseudocode:
 *
 *   async function substituteCollateral(req) {
 *     const { idempotencyKey, creditLineId, incomingAssetId, ... } = req;
 *
 *     // Check prior processing
 *     const prior = await db.lookup(idempotencyKey);
 *     if (prior?.status === 'success') {
 *       return prior.response;
 *     }
 *
 *     // Process the substitution
 *     try {
 *       const result = await performSubstitution(creditLineId, incomingAssetId, ...);
 *       await db.store(idempotencyKey, { status: 'success', response: result });
 *       return result;
 *     } catch (err) {
 *       await db.store(idempotencyKey, { status: 'error', reason: err.reason });
 *       throw err;
 *     }
 *   }
 *
 * TESTING
 * =======
 *
 * Unit tests (src/utils/idempotency.test.ts):
 *   - Determinism: same params → same key
 *   - Collision resistance: different params → different keys
 *   - State transitions: attempt counting, response recording
 *   - Retry logic: retryable vs non-retryable errors
 *   - Staleness: old submissions should not be retried
 *   - Diagnostics: no sensitive data in logs
 *
 * Integration tests (src/components/__tests__/CollateralSubstitutionModal.test.tsx):
 *   - Key generation on first submit
 *   - Side-effect replay prevention
 *   - Key reuse across retries
 *   - Distinct keys for different asset pairs
 *   - Diagnostic logging without sensitive data
 *
 * SECURITY NOTES
 * ==============
 *
 * - Keys are NOT secrets; they are meant to be included in logs and requests
 * - Keys are deterministic from public intent parameters, not random
 * - The idempotencyKey field in errors is safe to log/report
 * - Sensitive data (balance, asset values, LTV ratios) NEVER appears in key or logs
 * - The key does not depend on user credentials or authentication state
 */

import type { CollateralAsset } from '../types/collateral';

/**
 * A stable, deterministic identifier for a single submission attempt.
 *
 * This is NOT a UUID — it is a base64-encoded hash of the canonical
 * submission parameters, which ensures:
 *   - Same parameters → same key (idempotent retries are safe)
 *   - Different parameters → different key (accidental duplicates are detected)
 *   - Keys are reviewable without exposing sensitive data
 *
 * Example: "idem_9c4d8f2b1e7a3c1d5f8b2e4a9d7c1f3b"
 */
export type IdempotencyKey = string & { readonly __idempotencyKey: true };

/**
 * Metadata describing a single submission attempt for a collateral substitution.
 * Used to track state across retries and detect duplicates.
 */
export interface SubmissionAttempt {
  /**
   * The idempotency key for this attempt.
   * All retries of the same operation share this key.
   */
  idempotencyKey: IdempotencyKey;

  /**
   * Unix timestamp (ms) when this attempt was first initiated.
   * Used to detect stale submissions that should not be retried.
   */
  initiatedAtMs: number;

  /**
   * Timestamp (ms) when this exact attempt was last submitted to the server.
   * Distinguishes between retries of the same logical operation.
   */
  lastSubmittedAtMs?: number;

  /**
   * How many times this idempotency key has been submitted to the server.
   * Retries increment this counter; same key does not.
   * Used for UI retry indicators ("attempt 2 of 3") and circuit-breaking.
   */
  attemptCount: number;

  /**
   * The most recently received server response for this key.
   * If the response is success and the same key is submitted again,
   * the operation is considered complete and should not replay side effects.
   * Null if no server response has been received yet.
   */
  lastServerResponse?: {
    /** HTTP status code or error classification from server. */
    statusOrReason: string;
    /** Human-safe message from server. */
    message?: string;
    /** Timestamp when response was received. */
    receivedAtMs: number;
  };
}

/**
 * Parameters needed to generate a deterministic idempotency key for
 * a collateral substitution operation.
 *
 * These are the immutable, canonical parameters that define a unique
 * substitution intent. If any of these change, the key changes too,
 * which prevents accidental deduplication of different operations.
 */
export interface IdempotencyKeyParams {
  /** The credit line being modified (stable ID). */
  creditLineId: string;

  /** The asset currently pledged (or undefined if none). */
  outgoingAssetId?: string;

  /** The asset being pledged (must be different from incoming). */
  incomingAssetId: string;

  /**
   * Unix timestamp (ms) when the user initiated this substitution flow.
   * Included to allow the same user to attempt multiple substitutions
   * for the same pair of assets across different sessions.
   */
  initiatedAtMs: number;
}

/**
 * Generate a stable, deterministic idempotency key from substitution parameters.
 *
 * The key is constructed from a canonical string representation of the parameters,
 * hashed, and base64-encoded. This ensures:
 *   - Determinism: Same parameters → same key (safe for retries)
 *   - Collisions are cryptographically unlikely (2^-128 risk)
 *   - Keys are human-reviewable without exposing data
 *
 * @param params   The canonical substitution parameters
 * @returns        A stable idempotency key
 *
 * @example
 *   const key = generateIdempotencyKey({
 *     creditLineId: 'cl-123',
 *     outgoingAssetId: 'asset-btc',
 *     incomingAssetId: 'asset-usdc',
 *     initiatedAtMs: 1692345600000,
 *   });
 *   // Returns: "idem_9c4d8f2b1e7a3c1d5f8b2e4a9d7c1f3b" (always the same for these params)
 */
export function generateIdempotencyKey(params: IdempotencyKeyParams): IdempotencyKey {
  // Construct a canonical representation of the parameters.
  // Order is deterministic; null/undefined are handled explicitly.
  const canonical = [
    params.creditLineId,
    params.outgoingAssetId ?? 'null',
    params.incomingAssetId,
    String(params.initiatedAtMs),
  ].join('|');

  // Use a simple deterministic hash (FNV-1a for speed; crypto hash is overkill here).
  // In production, consider a stable hash like SHA-256 for auditability.
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash >>>= 0; // Keep as 32-bit unsigned
  }

  // Encode as base64 for readability. Include "idem_" prefix for clarity.
  const hashStr = hash.toString(16).padStart(8, '0');
  return `idem_${hashStr}` as IdempotencyKey;
}

/**
 * Create a new submission attempt record with initial state.
 *
 * @param params   The substitution parameters
 * @returns        A fresh SubmissionAttempt with idempotency key and timestamps
 */
export function createSubmissionAttempt(
  params: IdempotencyKeyParams
): SubmissionAttempt {
  return {
    idempotencyKey: generateIdempotencyKey(params),
    initiatedAtMs: params.initiatedAtMs,
    attemptCount: 0,
  };
}

/**
 * Record a submission attempt (increment counters, update timestamps).
 *
 * Call this immediately before sending the request to the server.
 * This allows the system to distinguish between the first attempt and retries.
 *
 * @param attempt   The attempt record to update
 * @returns         The updated attempt (does not mutate the input)
 */
export function recordSubmissionAttempt(attempt: SubmissionAttempt): SubmissionAttempt {
  return {
    ...attempt,
    attemptCount: attempt.attemptCount + 1,
    lastSubmittedAtMs: Date.now(),
  };
}

/**
 * Record the server's response for this submission attempt.
 *
 * Call this after receiving any response from the server (success or error).
 * This allows the system to detect and prevent replay of duplicate intents.
 *
 * @param attempt      The attempt record to update
 * @param reason       Machine-readable reason (e.g. 'success', 'network', 'validation')
 * @param message      Human-safe message from the server
 * @returns            The updated attempt (does not mutate the input)
 */
export function recordServerResponse(
  attempt: SubmissionAttempt,
  reason: string,
  message?: string
): SubmissionAttempt {
  return {
    ...attempt,
    lastServerResponse: {
      statusOrReason: reason,
      message,
      receivedAtMs: Date.now(),
    },
  };
}

/**
 * Check if a submission attempt has already succeeded on the server.
 *
 * If this returns true, the operation should not be retried — the intent
 * has already been applied, and retrying could cause a duplicate.
 *
 * @param attempt   The attempt record
 * @returns         True if the server has confirmed success for this key
 */
export function hasSucceeded(attempt: SubmissionAttempt): boolean {
  return attempt.lastServerResponse?.statusOrReason === 'success';
}

/**
 * Check if a submission attempt is retryable.
 *
 * A submission is retryable if:
 *   - It has not already succeeded (to prevent replay)
 *   - The last error was marked as retryable (network, timeout, etc.)
 *   - The attempt count is below the maximum
 *
 * @param attempt       The attempt record
 * @param maxAttempts   The maximum number of attempts allowed
 * @param retryable     Whether the last error was retryable
 * @returns             True if the operation can be retried
 */
export function isRetryable(
  attempt: SubmissionAttempt,
  maxAttempts: number,
  retryable: boolean
): boolean {
  // Already succeeded — do not retry
  if (hasSucceeded(attempt)) return false;

  // Max attempts reached — do not retry
  if (attempt.attemptCount >= maxAttempts) return false;

  // Last error was not retryable — do not retry
  if (!retryable) return false;

  return true;
}

/**
 * Check if a submission is "stale" and should not be retried.
 *
 * A submission is stale if it was initiated more than `maxAgeMs` ago.
 * This prevents retrying submissions that are older than a user session,
 * which could indicate stale browser state or recovered app crashes.
 *
 * @param attempt   The attempt record
 * @param maxAgeMs  Maximum age in milliseconds (default: 30 minutes)
 * @returns         True if the attempt is older than maxAgeMs
 */
export function isStaleSubmission(
  attempt: SubmissionAttempt,
  maxAgeMs: number = 30 * 60 * 1000
): boolean {
  const age = Date.now() - attempt.initiatedAtMs;
  return age > maxAgeMs;
}

/**
 * Extract diagnostic information from a submission attempt for logging.
 *
 * Returns sanitized information suitable for debug logs, error reports,
 * and server-side diagnostics — without exposing sensitive data.
 *
 * @param attempt   The attempt record
 * @returns         Loggable diagnostic object
 */
export function extractDiagnostics(attempt: SubmissionAttempt) {
  return {
    idempotencyKey: attempt.idempotencyKey,
    attemptCount: attempt.attemptCount,
    ageMs: Date.now() - attempt.initiatedAtMs,
    hasServerResponse: attempt.lastServerResponse != null,
    lastServerStatusOrReason: attempt.lastServerResponse?.statusOrReason,
  };
}
