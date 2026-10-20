/**
 * Error types for credit data operations.
 */

/**
 * Error thrown when credit data cannot be decoded or is invalid.
 */
export class CreditDataError extends Error {
  constructor(
    public readonly code: 'invalid_response' | 'network_error' | 'not_found',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'CreditDataError';
  }
}
