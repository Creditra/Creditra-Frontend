/**
 * Adapters for fetching and decoding credit data.
 *
 * These adapters wrap data sources (mock data, APIs, blockchain) and apply
 * runtime validation via the decode module. Invalid records are dropped from
 * list responses and cause rejections for single-record fetches.
 */

import { MOCK_CREDIT_LINES } from '../../data/mockData';
import type { CreditLine, Transaction } from '../../types/creditLine';
import {
  decodeCreditLine,
  decodeCreditLines,
  decodeTransaction,
  decodeTransactions,
  type DecodedCreditLine,
} from './decode';
import { CreditDataError } from './errors';

/**
 * Result from fetching a list of credit lines.
 */
export interface CreditLinesResult {
  /** Successfully decoded credit lines. */
  creditLines: DecodedCreditLine[];
  /** Count of records that failed validation and were skipped. */
  skipped: number;
}

/**
 * Result from fetching a list of transactions.
 */
export interface TransactionsResult {
  /** Successfully decoded transactions. */
  transactions: Transaction[];
  /** Count of records that failed validation and were skipped. */
  skipped: number;
}

/**
 * Fetch all credit lines.
 *
 * Invalid records are dropped and a warning is logged for each. The skipped
 * count is returned so the UI can surface a notification when appropriate.
 *
 * @returns Promise resolving to valid credit lines and skipped count.
 */
export async function fetchCreditLines(): Promise<CreditLinesResult> {
  // Simulate async fetch; in production this would call an API or blockchain adapter
  await new Promise((resolve) => setTimeout(resolve, 0));

  const result = decodeCreditLines(MOCK_CREDIT_LINES);

  return {
    creditLines: result.creditLines,
    skipped: result.skipped,
  };
}

/**
 * Fetch a single credit line by ID.
 *
 * If the record is invalid, rejects with CreditDataError('invalid_response').
 * If the record is not found, rejects with CreditDataError('not_found').
 *
 * @param id - Credit line ID.
 * @returns Promise resolving to the decoded credit line.
 * @throws {CreditDataError} When the record is invalid or not found.
 */
export async function fetchCreditLineById(
  id: string,
): Promise<DecodedCreditLine> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  const raw = MOCK_CREDIT_LINES.find((line) => line.id === id);

  if (!raw) {
    throw new CreditDataError('not_found', `Credit line ${id} not found`);
  }

  const result = decodeCreditLine(raw);

  if (!result.ok) {
    console.error('Invalid credit line data:', {
      id,
      issues: result.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    throw new CreditDataError(
      'invalid_response',
      `Credit line ${id} failed validation`,
    );
  }

  return result.value;
}

/**
 * Fetch all transactions across all credit lines.
 *
 * Invalid records are dropped and a warning is logged for each. The skipped
 * count is returned so the UI can surface a notification when appropriate.
 *
 * @returns Promise resolving to valid transactions and skipped count.
 */
export async function fetchAllTransactions(): Promise<TransactionsResult> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  const allTransactions: unknown[] = [];

  for (const line of MOCK_CREDIT_LINES) {
    if (Array.isArray(line.transactions)) {
      allTransactions.push(...line.transactions);
    }
  }

  const result = decodeTransactions(allTransactions);

  return {
    transactions: result.transactions,
    skipped: result.skipped,
  };
}

/**
 * Fetch transactions for a specific credit line.
 *
 * Invalid records are dropped and a warning is logged for each.
 *
 * @param creditLineId - Credit line ID.
 * @returns Promise resolving to valid transactions and skipped count.
 */
export async function fetchTransactionsByCreditLine(
  creditLineId: string,
): Promise<TransactionsResult> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  const line = MOCK_CREDIT_LINES.find((l) => l.id === creditLineId);

  if (!line) {
    return { transactions: [], skipped: 0 };
  }

  const result = decodeTransactions(
    Array.isArray(line.transactions) ? line.transactions : [],
  );

  return {
    transactions: result.transactions,
    skipped: result.skipped,
  };
}

/**
 * Fetch a single transaction by ID.
 *
 * If the record is invalid, rejects with CreditDataError('invalid_response').
 * If the record is not found, rejects with CreditDataError('not_found').
 *
 * @param transactionId - Transaction ID.
 * @returns Promise resolving to the decoded transaction.
 * @throws {CreditDataError} When the record is invalid or not found.
 */
export async function fetchTransactionById(
  transactionId: string,
): Promise<Transaction> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  let raw: unknown = null;

  for (const line of MOCK_CREDIT_LINES) {
    if (Array.isArray(line.transactions)) {
      const found = line.transactions.find((tx: any) => tx.id === transactionId);
      if (found) {
        raw = found;
        break;
      }
    }
  }

  if (!raw) {
    throw new CreditDataError('not_found', `Transaction ${transactionId} not found`);
  }

  const result = decodeTransaction(raw);

  if (!result.ok) {
    console.error('Invalid transaction data:', {
      id: transactionId,
      issues: result.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    throw new CreditDataError(
      'invalid_response',
      `Transaction ${transactionId} failed validation`,
    );
  }

  return result.value;
}
