/**
 * Runtime decoders for credit data.
 *
 * These functions validate that raw data from adapters (Soroban, Horizon,
 * backend APIs) conforms to the CreditLine and Transaction interfaces,
 * enforcing closed unions, non-negative amounts, valid dates, and other
 * invariants that TypeScript types alone cannot check.
 *
 * Design:
 * - Pure functions; no side effects, no React dependencies
 * - Never mutate input; always return new objects
 * - Return Result<T, DecodeIssue[]> for composable error handling
 * - Security: note fields are length-capped at 500 characters
 * - Performance: decoding 1,000 records must take < 10 ms
 */

import type {
  CreditLine,
  CreditLineStatus,
  Transaction,
  TransactionType,
  TransactionStatus,
  StatusHistoryEntry,
  AprHistoryEntry,
} from '../../types/creditLine';

// ─── Result Type ──────────────────────────────────────────────────────────────

/**
 * Path to a field in a nested object, e.g. ['transactions', 0, 'amount'].
 */
export type Path = Array<string | number>;

/**
 * A single validation issue found during decoding.
 */
export interface DecodeIssue {
  /** Path to the invalid field. */
  path: Path;
  /** Human-readable description of the problem. */
  message: string;
}

/**
 * Discriminated union representing success or failure of decoding.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; issues: DecodeIssue[] };

/**
 * Helper to create a success result.
 */
function success<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * Helper to create a failure result with one issue.
 */
function failure<T>(path: Path, message: string): Result<T> {
  return { ok: false, issues: [{ path, message }] };
}

/**
 * Helper to prepend a path segment to all issues in a result.
 */
function prependPath<T>(result: Result<T>, segment: string | number): Result<T> {
  if (result.ok) return result;
  return {
    ok: false,
    issues: result.issues.map((issue) => ({
      path: [segment, ...issue.path],
      message: issue.message,
    })),
  };
}

// ─── Closed Union Validators ──────────────────────────────────────────────────

const CREDIT_LINE_STATUSES: readonly CreditLineStatus[] = [
  'Active',
  'Suspended',
  'Defaulted',
  'Closed',
  'Frozen',
] as const;

const TRANSACTION_TYPES: readonly TransactionType[] = [
  'Draw',
  'Repay',
  'Fee',
  'Interest',
  'StatusChange',
] as const;

const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  'Completed',
  'Pending',
  'Failed',
] as const;

function isCreditLineStatus(value: unknown): value is CreditLineStatus {
  return (
    typeof value === 'string' &&
    CREDIT_LINE_STATUSES.includes(value as CreditLineStatus)
  );
}

function isTransactionType(value: unknown): value is TransactionType {
  return (
    typeof value === 'string' &&
    TRANSACTION_TYPES.includes(value as TransactionType)
  );
}

function isTransactionStatus(value: unknown): value is TransactionStatus {
  return (
    typeof value === 'string' &&
    TRANSACTION_STATUSES.includes(value as TransactionStatus)
  );
}

// ─── Primitive Validators ─────────────────────────────────────────────────────

/**
 * Validate that a value is a non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate that a value is a finite non-negative number.
 */
function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Validate that a value is a finite positive number.
 */
function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Validate that a string is a valid ISO 8601 date.
 */
function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

/**
 * Validate that a string is a 64-character hexadecimal transaction hash.
 */
function isValidTxHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-fA-F]{64}$/.test(value);
}

/**
 * Validate and cap a note field at 500 characters.
 */
function sanitizeNote(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, 500);
}

// ─── Transaction Decoder ──────────────────────────────────────────────────────

/**
 * Decode a raw transaction object.
 *
 * Validates:
 * - id is a non-empty string
 * - type is a member of TransactionType union
 * - amount is finite and non-negative
 * - date is a valid ISO 8601 string
 * - status is a member of TransactionStatus union
 * - txHash, when present, is 64 hex characters
 * - note is capped at 500 characters
 *
 * @param raw - The raw object to decode.
 * @returns A Result containing the decoded Transaction or validation issues.
 */
export function decodeTransaction(raw: unknown): Result<Transaction> {
  if (!raw || typeof raw !== 'object') {
    return failure([], 'Expected an object');
  }

  const obj = raw as Record<string, unknown>;
  const issues: DecodeIssue[] = [];

  // Validate id
  if (!isNonEmptyString(obj.id)) {
    issues.push({ path: ['id'], message: 'Must be a non-empty string' });
  }

  // Validate type
  if (!isTransactionType(obj.type)) {
    issues.push({
      path: ['type'],
      message: `Must be one of: ${TRANSACTION_TYPES.join(', ')}`,
    });
  }

  // Validate amount
  if (!isNonNegativeNumber(obj.amount)) {
    issues.push({
      path: ['amount'],
      message: 'Must be a finite non-negative number',
    });
  }

  // Validate date
  if (!isValidDate(obj.date)) {
    issues.push({ path: ['date'], message: 'Must be a valid ISO 8601 date' });
  }

  // Validate status
  if (!isTransactionStatus(obj.status)) {
    issues.push({
      path: ['status'],
      message: `Must be one of: ${TRANSACTION_STATUSES.join(', ')}`,
    });
  }

  // Validate txHash (optional)
  if (obj.txHash !== undefined && !isValidTxHash(obj.txHash)) {
    issues.push({
      path: ['txHash'],
      message: 'Must be a 64-character hexadecimal string',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // All validations passed; construct the transaction
  return success({
    id: obj.id as string,
    type: obj.type as TransactionType,
    amount: obj.amount as number,
    date: obj.date as string,
    note: sanitizeNote(obj.note),
    status: obj.status as TransactionStatus,
    txHash: obj.txHash as string | undefined,
  });
}

// ─── StatusHistoryEntry Decoder ───────────────────────────────────────────────

function decodeStatusHistoryEntry(raw: unknown): Result<StatusHistoryEntry> {
  if (!raw || typeof raw !== 'object') {
    return failure([], 'Expected an object');
  }

  const obj = raw as Record<string, unknown>;
  const issues: DecodeIssue[] = [];

  if (!isCreditLineStatus(obj.status)) {
    issues.push({
      path: ['status'],
      message: `Must be one of: ${CREDIT_LINE_STATUSES.join(', ')}`,
    });
  }

  if (!isValidDate(obj.date)) {
    issues.push({ path: ['date'], message: 'Must be a valid ISO 8601 date' });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return success({
    status: obj.status as CreditLineStatus,
    date: obj.date as string,
    note: sanitizeNote(obj.note),
  });
}

// ─── AprHistoryEntry Decoder ──────────────────────────────────────────────────

function decodeAprHistoryEntry(raw: unknown): Result<AprHistoryEntry> {
  if (!raw || typeof raw !== 'object') {
    return failure([], 'Expected an object');
  }

  const obj = raw as Record<string, unknown>;
  const issues: DecodeIssue[] = [];

  if (!isValidDate(obj.date)) {
    issues.push({ path: ['date'], message: 'Must be a valid ISO 8601 date' });
  }

  if (!isNonNegativeNumber(obj.apr)) {
    issues.push({
      path: ['apr'],
      message: 'Must be a finite non-negative number',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return success({
    date: obj.date as string,
    apr: obj.apr as number,
  });
}

// ─── CreditLine Decoder ───────────────────────────────────────────────────────

/**
 * Flags attached to a decoded credit line indicating special conditions.
 */
export interface CreditLineFlags {
  /**
   * True when utilized > limit. This is valid on chain (interest accrual can
   * push utilization above the limit), but may need special UI treatment.
   */
  over_limit?: boolean;
}

/**
 * A CreditLine with optional runtime flags.
 */
export interface DecodedCreditLine extends CreditLine {
  flags?: string[];
}

/**
 * Decode a raw credit line object.
 *
 * Validates:
 * - id and name are non-empty strings
 * - status is a member of CreditLineStatus union
 * - limit is positive (> 0) for non-Closed lines, non-negative for Closed
 * - utilized, apr, and riskScore are non-negative and finite
 * - dates are valid ISO 8601 strings
 * - transactions array contains valid Transaction objects
 * - statusHistory array contains valid StatusHistoryEntry objects
 * - aprHistory array (when present) contains valid AprHistoryEntry objects
 *
 * Special cases:
 * - utilized > limit: allowed, returns with flags: ['over_limit']
 * - Closed lines with limit: 0: allowed
 *
 * @param raw - The raw object to decode.
 * @returns A Result containing the decoded CreditLine or validation issues.
 */
export function decodeCreditLine(raw: unknown): Result<DecodedCreditLine> {
  if (!raw || typeof raw !== 'object') {
    return failure([], 'Expected an object');
  }

  const obj = raw as Record<string, unknown>;
  const issues: DecodeIssue[] = [];

  // Validate id
  if (!isNonEmptyString(obj.id)) {
    issues.push({ path: ['id'], message: 'Must be a non-empty string' });
  }

  // Validate name
  if (!isNonEmptyString(obj.name)) {
    issues.push({ path: ['name'], message: 'Must be a non-empty string' });
  }

  // Validate status
  if (!isCreditLineStatus(obj.status)) {
    issues.push({
      path: ['status'],
      message: `Must be one of: ${CREDIT_LINE_STATUSES.join(', ')}`,
    });
  }

  // Validate limit (positive for non-Closed, non-negative for Closed)
  const isClosed = obj.status === 'Closed';
  if (isClosed) {
    if (!isNonNegativeNumber(obj.limit)) {
      issues.push({
        path: ['limit'],
        message: 'Must be a finite non-negative number',
      });
    }
  } else {
    if (!isPositiveNumber(obj.limit)) {
      issues.push({
        path: ['limit'],
        message: 'Must be a finite positive number for non-Closed lines',
      });
    }
  }

  // Validate utilized
  if (!isNonNegativeNumber(obj.utilized)) {
    issues.push({
      path: ['utilized'],
      message: 'Must be a finite non-negative number',
    });
  }

  // Validate apr
  if (!isNonNegativeNumber(obj.apr)) {
    issues.push({
      path: ['apr'],
      message: 'Must be a finite non-negative number',
    });
  }

  // Validate riskScore
  if (!isNonNegativeNumber(obj.riskScore)) {
    issues.push({
      path: ['riskScore'],
      message: 'Must be a finite non-negative number',
    });
  }

  // Validate openedAt
  if (!isValidDate(obj.openedAt)) {
    issues.push({
      path: ['openedAt'],
      message: 'Must be a valid ISO 8601 date',
    });
  }

  // Validate updatedAt
  if (!isValidDate(obj.updatedAt)) {
    issues.push({
      path: ['updatedAt'],
      message: 'Must be a valid ISO 8601 date',
    });
  }

  // Validate optional dates
  if (
    obj.nextPaymentDate !== undefined &&
    !isValidDate(obj.nextPaymentDate)
  ) {
    issues.push({
      path: ['nextPaymentDate'],
      message: 'Must be a valid ISO 8601 date',
    });
  }

  if (
    obj.nextInterestAccrualDate !== undefined &&
    !isValidDate(obj.nextInterestAccrualDate)
  ) {
    issues.push({
      path: ['nextInterestAccrualDate'],
      message: 'Must be a valid ISO 8601 date',
    });
  }

  if (
    obj.lastActivityAt !== undefined &&
    !isValidDate(obj.lastActivityAt)
  ) {
    issues.push({
      path: ['lastActivityAt'],
      message: 'Must be a valid ISO 8601 date',
    });
  }

  // Validate nextPaymentAmount (optional)
  if (
    obj.nextPaymentAmount !== undefined &&
    !isNonNegativeNumber(obj.nextPaymentAmount)
  ) {
    issues.push({
      path: ['nextPaymentAmount'],
      message: 'Must be a finite non-negative number',
    });
  }

  // Validate transactions array
  if (!Array.isArray(obj.transactions)) {
    issues.push({ path: ['transactions'], message: 'Must be an array' });
  } else {
    const decodedTransactions: Transaction[] = [];
    for (let i = 0; i < obj.transactions.length; i++) {
      const txResult = decodeTransaction(obj.transactions[i]);
      if (!txResult.ok) {
        issues.push(...txResult.issues.map((issue) => ({
          path: ['transactions', i, ...issue.path],
          message: issue.message,
        })));
      } else {
        decodedTransactions.push(txResult.value);
      }
    }
  }

  // Validate statusHistory array
  if (!Array.isArray(obj.statusHistory)) {
    issues.push({ path: ['statusHistory'], message: 'Must be an array' });
  } else {
    const decodedStatusHistory: StatusHistoryEntry[] = [];
    for (let i = 0; i < obj.statusHistory.length; i++) {
      const entryResult = decodeStatusHistoryEntry(obj.statusHistory[i]);
      if (!entryResult.ok) {
        issues.push(...entryResult.issues.map((issue) => ({
          path: ['statusHistory', i, ...issue.path],
          message: issue.message,
        })));
      } else {
        decodedStatusHistory.push(entryResult.value);
      }
    }
  }

  // Validate aprHistory array (optional)
  if (obj.aprHistory !== undefined) {
    if (!Array.isArray(obj.aprHistory)) {
      issues.push({ path: ['aprHistory'], message: 'Must be an array' });
    } else {
      const decodedAprHistory: AprHistoryEntry[] = [];
      for (let i = 0; i < obj.aprHistory.length; i++) {
        const entryResult = decodeAprHistoryEntry(obj.aprHistory[i]);
        if (!entryResult.ok) {
          issues.push(...entryResult.issues.map((issue) => ({
            path: ['aprHistory', i, ...issue.path],
            message: issue.message,
          })));
        } else {
          decodedAprHistory.push(entryResult.value);
        }
      }
    }
  }

  // Return early if there are validation issues
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // All validations passed; construct the credit line
  const creditLine: DecodedCreditLine = {
    id: obj.id as string,
    name: obj.name as string,
    status: obj.status as CreditLineStatus,
    limit: obj.limit as number,
    utilized: obj.utilized as number,
    apr: obj.apr as number,
    riskScore: obj.riskScore as number,
    collateral: sanitizeNote(obj.collateral),
    openedAt: obj.openedAt as string,
    updatedAt: obj.updatedAt as string,
    transactions: (obj.transactions as unknown[]).map((tx) => {
      const result = decodeTransaction(tx);
      // We already validated above, so this cast is safe
      return result.ok ? result.value : ({} as Transaction);
    }).filter(tx => tx.id !== undefined),
    statusHistory: (obj.statusHistory as unknown[]).map((entry) => {
      const result = decodeStatusHistoryEntry(entry);
      return result.ok ? result.value : ({} as StatusHistoryEntry);
    }).filter(entry => entry.status !== undefined),
  };

  // Add optional fields
  if (obj.aprHistory !== undefined && Array.isArray(obj.aprHistory)) {
    creditLine.aprHistory = (obj.aprHistory as unknown[]).map((entry) => {
      const result = decodeAprHistoryEntry(entry);
      return result.ok ? result.value : ({} as AprHistoryEntry);
    }).filter(entry => entry.date !== undefined);
  }

  if (obj.nextPaymentDate !== undefined) {
    creditLine.nextPaymentDate = obj.nextPaymentDate as string;
  }

  if (obj.nextPaymentAmount !== undefined) {
    creditLine.nextPaymentAmount = obj.nextPaymentAmount as number;
  }

  if (obj.nextInterestAccrualDate !== undefined) {
    creditLine.nextInterestAccrualDate = obj.nextInterestAccrualDate as string;
  }

  if (obj.lastActivityAt !== undefined) {
    creditLine.lastActivityAt = obj.lastActivityAt as string;
  }

  // Check for over-limit condition and add flag
  const flags: string[] = [];
  if (
    typeof obj.utilized === 'number' &&
    typeof obj.limit === 'number' &&
    obj.utilized > obj.limit
  ) {
    flags.push('over_limit');
  }

  if (flags.length > 0) {
    creditLine.flags = flags;
  }

  return success(creditLine);
}

/**
 * Decode an array of credit lines, dropping invalid records.
 *
 * @param rawArray - Array of raw credit line objects.
 * @returns Object with valid credit lines and count of skipped records.
 */
export function decodeCreditLines(rawArray: unknown[]): {
  creditLines: DecodedCreditLine[];
  skipped: number;
} {
  const creditLines: DecodedCreditLine[] = [];
  let skipped = 0;

  for (const raw of rawArray) {
    const result = decodeCreditLine(raw);
    if (result.ok) {
      creditLines.push(result.value);
    } else {
      skipped++;
      console.warn('Invalid credit line record:', {
        issues: result.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        raw,
      });
    }
  }

  return { creditLines, skipped };
}

/**
 * Decode an array of transactions, dropping invalid records.
 *
 * @param rawArray - Array of raw transaction objects.
 * @returns Object with valid transactions and count of skipped records.
 */
export function decodeTransactions(rawArray: unknown[]): {
  transactions: Transaction[];
  skipped: number;
} {
  const transactions: Transaction[] = [];
  let skipped = 0;

  for (const raw of rawArray) {
    const result = decodeTransaction(raw);
    if (result.ok) {
      transactions.push(result.value);
    } else {
      skipped++;
      console.warn('Invalid transaction record:', {
        issues: result.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        raw,
      });
    }
  }

  return { transactions, skipped };
}
