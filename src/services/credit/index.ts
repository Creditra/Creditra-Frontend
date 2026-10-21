/**
 * Credit data source factory.
 *
 * Reads VITE_CREDIT_DATA_SOURCE from the environment and returns the
 * appropriate adapter.  Supported values:
 *
 *   mock  (default) – wraps MOCK_CREDIT_LINES; safe for demo and CI
 *
 * Future adapters (soroban-rpc, horizon, http-backend) will be added here
 * as separate cases; pages and hooks import only from this module.
 *
 * An unknown value throws a descriptive error at module-evaluation time
 * (i.e. at app startup), not silently at first use.
 */

export type {
  CreditDataSource,
  CreditDataError,
  CreditDataErrorCode,
  DataSourceOptions,
  TransactionWithLineRef,
  TransactionQuery,
  TransactionPage,
} from './CreditDataSource';

import { CreditDataError } from './CreditDataSource';
import type { CreditDataSource } from './CreditDataSource';
import { createMockCreditDataSource } from './mockCreditDataSource';

export type CreditDataSourceName = 'mock';

/**
 * Creates and returns the credit data source selected by the
 * `VITE_CREDIT_DATA_SOURCE` environment variable.
 *
 * Defaults to `mock` when the variable is unset or empty.
 *
 * @throws {CreditDataError} with code `'invalid_response'` when an
 *   unknown adapter name is configured, so the misconfiguration is
 *   caught immediately at startup.
 */
export function createCreditDataSource(): CreditDataSource {
  const name = (import.meta.env.VITE_CREDIT_DATA_SOURCE ?? 'mock') as string;

  switch (name) {
    case 'mock':
    case '':
      return createMockCreditDataSource();

    default:
      throw new CreditDataError(
        'invalid_response',
        `Unknown VITE_CREDIT_DATA_SOURCE value: "${name}". ` +
          `Supported values: mock`,
      );
  }
}
