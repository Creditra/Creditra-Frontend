import type { CreditLine, CreditLineStatus } from '../../types/creditLine';
import { CreditDataError } from './CreditDataSource';

const VALID_STATUSES: Set<string> = new Set<CreditLineStatus>([
  'Active',
  'Suspended',
  'Defaulted',
  'Closed',
  'Frozen',
]);

const STROOPS_PER_UNIT = 10_000_000n;

/**
 * Losslessly decode a contract amount into standard currency units.
 *
 * Contract amounts are represented as i128 (decoded as bigint in stroops, 1e7 base units).
 * This function scales the amount in BigInt BEFORE converting to Number to avoid precision
 * loss above Number.MAX_SAFE_INTEGER.
 */
export function decodeLosslessAmount(raw: unknown): number {
  if (typeof raw === 'bigint') {
    const whole = raw / STROOPS_PER_UNIT;
    const fraction = raw % STROOPS_PER_UNIT;
    return Number(whole) + Number(fraction) / 10_000_000;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
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
    transactions: [],
    statusHistory: [],
  };
}
