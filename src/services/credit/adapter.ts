/**
 * Adapters for fetching and decoding credit data.
 *
 * These adapters wrap data sources (mock data, APIs, blockchain) and apply
 * runtime validation via the decode module. Invalid records are dropped from
 * list responses and cause rejections for single-record fetches.
 */

import { MOCK_CREDIT_LINES } from '../../data/mockData';
import type { CreditLine, Transaction } from '../../types/creditLine';
import type { DrawQuote } from '../../types/draw-credit.types';
import { getDrawPricingQuote } from '../../lib/draw-credit-pricing';
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

/**
 * Quote a draw for a specific credit line and amount.
 *
 * Returns an authoritative quote with a unique ID and expiry timestamp.
 * The quote is valid for the TTL duration (default 60 seconds) and must
 * be submitted before expiry or the backend will reject it.
 *
 * @param owner - Public key of the line owner (future use).
 * @param lineId - Credit line ID.
 * @param amount - Draw amount in USD.
 * @param ttlSeconds - Quote validity period in seconds (default 60).
 * @returns Promise resolving to a DrawQuote.
 * @throws {CreditDataError} When the line is not found or parameters are invalid.
 */
export async function quoteDraw(
  owner: string,
  lineId: string,
  amount: number,
  ttlSeconds = 60,
): Promise<DrawQuote> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Find the credit line
  const line = MOCK_CREDIT_LINES.find((l) => l.id === lineId);

  if (!line) {
    throw new CreditDataError('not_found', `Credit line ${lineId} not found`);
  }

  if (amount <= 0 || !Number.isFinite(amount)) {
    throw new CreditDataError(
      'invalid_response',
      'Draw amount must be positive and finite',
    );
  }

  // Build a mock credit line for the pricing helper
  const mockCreditLine = {
    id: line.id,
    name: line.name,
    limit: line.limit,
    available: line.limit - line.utilized,
    utilization: Math.round((line.utilized / line.limit) * 100),
    riskBand: (line.riskScore >= 700
      ? 'Prime'
      : line.riskScore >= 600
        ? 'Standard'
        : 'Watch') as 'Prime' | 'Standard' | 'Watch',
    termMonths: 12, // Mock default term
  };

  // Get pricing from the existing helper
  const pricing = getDrawPricingQuote(mockCreditLine, amount);

  // Generate a unique quote ID
  const quoteId = `QUOTE-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Compute expiry using server time (simulated here as Date.now())
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  // Extract adjustments
  const adjustments = [
    {
      label: pricing.utilizationAdjustmentLabel,
      points:
        mockCreditLine.utilization >= 80
          ? 2
          : mockCreditLine.utilization >= 50
            ? 1.25
            : 0.5,
    },
    {
      label: pricing.termAdjustmentLabel,
      points:
        pricing.termMonths > 24 ? 2.5 : pricing.termMonths > 12 ? 1.5 : 0.5,
    },
  ];

  return {
    quoteId,
    apr: pricing.apr,
    fee: pricing.fee,
    estimatedMonthlyInterest: pricing.estimatedMonthlyInterest,
    riskBand: pricing.riskBand,
    termMonths: pricing.termMonths,
    adjustments,
    expiresAt,
  };
}
