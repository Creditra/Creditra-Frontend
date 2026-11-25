import type {
  CreditLine,
  CreditLineStatus,
  StatusHistoryEntry,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../types/creditLine';
import { CreditDataError } from './CreditDataSource';

const VALID_STATUSES: Set<string> = new Set<CreditLineStatus>([
  'Active',
  'Suspended',
  'Defaulted',
  'Closed',
  'Frozen',
]);

const VALID_TRANSACTION_TYPES: Set<string> = new Set<TransactionType>([
  'Draw',
  'Repay',
  'Fee',
  'Interest',
  'StatusChange',
]);

const VALID_TRANSACTION_STATUSES: Set<string> = new Set<TransactionStatus>([
  'Completed',
  'Pending',
  'Failed',
]);

const STROOPS_PER_UNIT = 10_000_000n;

export type DecodeLosslessAmountOptions = {
  /**
   * Unit used when `raw` is a JavaScript number. Bigints are always interpreted
   * as stroops because Soroban i128 values are decoded as bigint.
   */
  numberUnit?: 'units' | 'stroops';
};

/**
 * Decode a contract amount into standard currency units for display.
 *
 * Soroban i128 amounts arrive as bigint values expressed in stroops (10^7
 * stroops per unit). The bigint arithmetic and decimal representation remain
 * exact until the final conversion to JavaScript number. That final conversion
 * is rounded to the nearest representable IEEE-754 number, so values beyond
 * Number's safe integer precision are suitable for display but are not a
 * lossless representation for further financial arithmetic.
 *
 * JavaScript numbers default to already being expressed in standard units.
 * Pass `{ numberUnit: 'stroops' }` when a numeric input is expressed in
 * stroops and should be scaled by 10^7.
 */
export function decodeLosslessAmount(
  raw: unknown,
  { numberUnit = 'units' }: DecodeLosslessAmountOptions = {},
): number {
  if (typeof raw === 'bigint') {
    const negative = raw < 0n;
    const absolute = negative ? -raw : raw;
    const whole = absolute / STROOPS_PER_UNIT;
    const fraction = absolute % STROOPS_PER_UNIT;
    const decimal = `${negative ? '-' : ''}${whole.toString()}.${fraction
      .toString()
      .padStart(7, '0')}`;
    return Number(decimal);
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return numberUnit === 'stroops' ? raw / Number(STROOPS_PER_UNIT) : raw;
  }
  throw new CreditDataError(
    'invalid_response',
    `Invalid amount: expected i128 (bigint) or number, got ${typeof raw}`,
  );
}

function decodeTimestamp(raw: unknown, fieldName: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (typeof raw === 'number' || typeof raw === 'bigint') {
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) {
      throw new CreditDataError('invalid_response', `Invalid timestamp for ${fieldName}: ${raw}`);
    }
    // Handle both unix seconds (< 1e11) and unix milliseconds
    const ms = num < 1e11 ? num * 1000 : num;
    return new Date(ms).toISOString();
  }
  throw new CreditDataError(
    'invalid_response',
    `Missing or invalid timestamp for ${fieldName}: got ${typeof raw}`,
  );
}

function decodeNumber(raw: unknown, fieldName: string): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'bigint') {
    return Number(raw);
  }
  throw new CreditDataError(
    'invalid_response',
    `Expected number for ${fieldName}, got ${typeof raw}`,
  );
}

export function decodeTransaction(raw: unknown): Transaction {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CreditDataError(
      'invalid_response',
      `Malformed ScVal: expected object for Transaction, got ${raw === null ? 'null' : typeof raw}`,
    );
  }

  const record = raw as Record<string, unknown>;

  const id = record.id;
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new CreditDataError('invalid_response', 'Malformed ScVal: missing or invalid transaction "id"');
  }

  const rawType = record.type;
  if (typeof rawType !== 'string' || !VALID_TRANSACTION_TYPES.has(rawType)) {
    throw new CreditDataError(
      'invalid_response',
      `Malformed ScVal: unknown transaction type "${String(rawType)}"`,
    );
  }
  const type = rawType as TransactionType;

  const rawStatus = record.status;
  if (typeof rawStatus !== 'string' || !VALID_TRANSACTION_STATUSES.has(rawStatus)) {
    throw new CreditDataError(
      'invalid_response',
      `Malformed ScVal: unknown transaction status "${String(rawStatus)}"`,
    );
  }
  const status = rawStatus as TransactionStatus;

  if (!('amount' in record) || record.amount === undefined || record.amount === null) {
    throw new CreditDataError('invalid_response', 'Malformed ScVal: missing transaction "amount"');
  }
  const amount = decodeLosslessAmount(record.amount);

  const rawDate = record.date ?? record.timestamp;
  const date = decodeTimestamp(rawDate, 'date');

  const rawNote = record.note;
  const note =
    typeof rawNote === 'string' && rawNote.trim().length > 0 ? rawNote : undefined;

  const rawTxHash = record.tx_hash ?? record.txHash;
  const txHash =
    typeof rawTxHash === 'string' && rawTxHash.trim().length > 0 ? rawTxHash : undefined;

  const tx: Transaction = {
    id,
    type,
    amount,
    date,
    status,
  };
  if (note !== undefined) {
    tx.note = note;
  }
  if (txHash !== undefined) {
    tx.txHash = txHash;
  }
  return tx;
}

export function decodeStatusHistoryEntry(raw: unknown): StatusHistoryEntry {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CreditDataError(
      'invalid_response',
      `Malformed ScVal: expected object for StatusHistoryEntry, got ${raw === null ? 'null' : typeof raw}`,
    );
  }

  const record = raw as Record<string, unknown>;

  const rawStatus = record.status;
  if (typeof rawStatus !== 'string' || !VALID_STATUSES.has(rawStatus)) {
    throw new CreditDataError(
      'invalid_response',
      `Malformed ScVal: unknown status history variant "${String(rawStatus)}"`,
    );
  }
  const status = rawStatus as CreditLineStatus;

  const rawDate = record.date ?? record.timestamp;
  const date = decodeTimestamp(rawDate, 'date');

  const rawNote = record.note;
  const note =
    typeof rawNote === 'string' && rawNote.trim().length > 0 ? rawNote : undefined;

  const entry: StatusHistoryEntry = {
    status,
    date,
  };
  if (note !== undefined) {
    entry.note = note;
  }
  return entry;
}

export function decodeCreditLine(raw: unknown): CreditLine {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CreditDataError(
      'invalid_response',
      `Malformed ScVal: expected object for CreditLine, got ${raw === null ? 'null' : typeof raw}`,
    );
  }

  const record = raw as Record<string, unknown>;

  // Check required fields
  const id = record.id;
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new CreditDataError('invalid_response', 'Malformed ScVal: missing or invalid "id"');
  }

  const name = record.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new CreditDataError('invalid_response', 'Malformed ScVal: missing or invalid "name"');
  }

  const rawStatus = record.status;
  if (typeof rawStatus !== 'string' || !VALID_STATUSES.has(rawStatus)) {
    throw new CreditDataError(
      'invalid_response',
      `Malformed ScVal: unknown status variant "${String(rawStatus)}"`,
    );
  }
  const status = rawStatus as CreditLineStatus;

  if (!('limit' in record) || record.limit === undefined || record.limit === null) {
    throw new CreditDataError('invalid_response', 'Malformed ScVal: missing "limit"');
  }
  const limit = decodeLosslessAmount(record.limit);

  if (!('utilized' in record) || record.utilized === undefined || record.utilized === null) {
    throw new CreditDataError('invalid_response', 'Malformed ScVal: missing "utilized"');
  }
  const utilized = decodeLosslessAmount(record.utilized);

  const rawApr = record.apr;
  if (rawApr === undefined || rawApr === null) {
    throw new CreditDataError('invalid_response', 'Malformed ScVal: missing "apr"');
  }
  const apr = decodeNumber(rawApr, 'apr');

  const rawRiskScore = record.risk_score ?? record.riskScore;
  if (rawRiskScore === undefined || rawRiskScore === null) {
    throw new CreditDataError('invalid_response', 'Malformed ScVal: missing "risk_score"');
  }
  const riskScore = decodeNumber(rawRiskScore, 'risk_score');

  const rawOpenedAt = record.opened_at ?? record.openedAt;
  const openedAt = decodeTimestamp(rawOpenedAt, 'opened_at');

  const rawUpdatedAt = record.updated_at ?? record.updatedAt;
  const updatedAt = decodeTimestamp(rawUpdatedAt, 'updated_at');

  const rawCollateral = record.collateral;
  const collateral =
    typeof rawCollateral === 'string' && rawCollateral.trim().length > 0
      ? rawCollateral
      : undefined;

  const rawTransactions = record.transactions;
  let transactions: Transaction[] = [];
  if (rawTransactions !== undefined && rawTransactions !== null) {
    if (!Array.isArray(rawTransactions)) {
      throw new CreditDataError(
        'invalid_response',
        `Malformed ScVal: expected array for "transactions", got ${typeof rawTransactions}`,
      );
    }
    transactions = rawTransactions.map((item) => decodeTransaction(item));
  }

  const rawStatusHistory = record.status_history ?? record.statusHistory;
  let statusHistory: StatusHistoryEntry[] = [];
  if (rawStatusHistory !== undefined && rawStatusHistory !== null) {
    if (!Array.isArray(rawStatusHistory)) {
      throw new CreditDataError(
        'invalid_response',
        `Malformed ScVal: expected array for "status_history", got ${typeof rawStatusHistory}`,
      );
    }
    statusHistory = rawStatusHistory.map((item) => decodeStatusHistoryEntry(item));
  }

  return {
    id,
    name,
    status,
    limit,
    utilized,
    apr,
    riskScore,
    collateral,
    openedAt,
    updatedAt,
    transactions,
    statusHistory,
  };
}
