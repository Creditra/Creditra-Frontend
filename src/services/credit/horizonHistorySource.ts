import { scValToNative, xdr } from '@stellar/stellar-sdk';
import type { Transaction, TransactionType } from '../../types/creditLine';
import { DEFAULT_HISTORY_PAGE_SIZE, MAX_HISTORY_PAGE_SIZE } from '../../utils/cursorPagination';
import { SOROBAN_TOKEN_DECIMALS } from './sorobanAdapter';
import {
  CreditDataError,
  type TransactionPage,
  type TransactionPageQuery,
} from './CreditDataSource';
import { getSorobanConfig, type SorobanCreditConfig } from './config';

/**
 * Horizon `accounts/{address}/operations` record, narrowed to the fields this
 * adapter reads. Horizon keeps other fields (and future ones) on the record.
 */
interface HorizonOperationRecord {
  id?: unknown;
  paging_token?: unknown;
  transaction_hash?: unknown;
  type?: unknown;
  transaction_successful?: unknown;
  created_at?: unknown;
  contract_id?: unknown;
  function?: unknown;
  parameters?: unknown;
  arguments?: unknown;
}

export interface HorizonCreditHistorySourceOptions {
  horizonUrl?: string;
  contractId?: string;
  /** Injectable for tests and for callers that need auth or a custom agent. */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  defaultTimeoutMs?: number;
  /** Base delay of the single 429 retry; doubled per retry attempt. */
  retryDelayMs?: number;
  amountDecimals?: number;
}

/** Operations resource kind that carries a contract invocation. */
const INVOKE_HOST_FUNCTION = 'invoke_host_function';

/** Hard cap on upstream Horizon requests per `listTransactions` call. */
export const MAX_UPSTREAM_REQUESTS_PER_CALL = 5;

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAY_MS = 500;

/**
 * Contract entrypoint symbol -> history row type.
 *
 * Soroban stores the entrypoint as a plain symbol, so the lookup is keyed by the
 * exact on-chain name (lower snake_case, the style `get_lines_by_borrower` and
 * `get_line` already use). Aliases cover the names a write path is just as likely
 * to ship under. Anything absent falls through to `StatusChange` with the raw
 * symbol preserved on the row — see `resolveTransactionType`.
 *
 * Needs maintainer confirmation against the deployed contract; the list is
 * mirrored in docs/SOROBAN_CREDIT_ADAPTER.md.
 */
export const TRANSACTION_TYPE_BY_FUNCTION: Readonly<Record<string, TransactionType>> = {
  draw: 'Draw',
  draw_credit: 'Draw',
  draw_line: 'Draw',
  borrow: 'Draw',
  repay: 'Repay',
  repay_line: 'Repay',
  payment: 'Repay',
  charge_fee: 'Fee',
  fee: 'Fee',
  origin_fee: 'Fee',
  accrue_interest: 'Interest',
  interest: 'Interest',
  pay_interest: 'Interest',
  set_status: 'StatusChange',
  change_status: 'StatusChange',
  suspend: 'StatusChange',
  unfreeze: 'StatusChange',
  freeze: 'StatusChange',
  close: 'StatusChange',
  default_line: 'StatusChange',
};

/** Normalise a Horizon function field, which may arrive as `contract#method`. */
export function functionSymbolFrom(record: { function?: unknown; contract_id?: unknown }): string {
  const raw = typeof record.function === 'string' ? record.function.trim() : '';
  if (!raw) return '';
  const separator = raw.lastIndexOf('#');
  return (separator === -1 ? raw : raw.slice(separator + 1)).toLowerCase();
}

export function resolveTransactionType(symbol: string): TransactionType {
  return TRANSACTION_TYPE_BY_FUNCTION[symbol] ?? 'StatusChange';
}

/**
 * Soroban integers reach the browser either as base64 `ScVal` XDR (what Horizon
 * stores in `value` / `arguments`) or already decoded under `value_decoded`.
 * XDR is decoded with the SDK so i128 amounts keep full precision.
 */
function decodeScVal(source: unknown): unknown {
  if (typeof source !== 'string' || source === '') return undefined;
  try {
    return scValToNative(xdr.ScVal.fromXDR(source, 'base64'));
  } catch {
    return undefined;
  }
}

/** Picks up integers from the handful of decoded shapes Horizon/Soroban emit. */
function decodedInteger(source: unknown): bigint | null {
  if (typeof source === 'bigint') return source;
  if (typeof source === 'number' && Number.isInteger(source)) return BigInt(source);
  if (typeof source === 'string' && /^[+-]?\d+$/.test(source)) return BigInt(source);
  if (source && typeof source === 'object') {
    for (const key of ['i128', 'u128', 'i64', 'u64', 'i32', 'u32']) {
      const inner = (source as Record<string, unknown>)[key];
      const parsed = decodedInteger(inner);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function decodedText(source: unknown): string | null {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object') {
    const inner = (source as { str?: unknown; string?: unknown; sym?: unknown });
    for (const value of [inner.str, inner.string, inner.sym]) {
      if (typeof value === 'string') return value;
    }
  }
  return null;
}

/** A parameter key may be a bare string or a symbol ScVal. */
function parameterKey(parameter: Record<string, unknown>): string {
  const decoded = decodedText(parameter.key) ?? decodeScVal(parameter.key);
  return typeof decoded === 'string' ? decoded.toLowerCase() : '';
}

function asText(value: unknown): string | null {
  return typeof value === 'string' ? value : decodedText(value);
}

function isStrKeyLike(value: string): boolean {
  return value.length === 56 && /^[GCD]/.test(value);
}

interface DecodedArguments {
  amount: number | null;
  lineId: string | null;
}

const LINE_ID_KEYS = ['line_id', 'credit_line_id', 'creditline_id', 'line'];

/**
 * Reads the amount and credit line id out of a contract invocation.
 *
 * Preferred order is by parameter name (`amount`, `line_id`); the positional
 * fallback covers contracts whose symbols carry no parameter names, where the
 * amount is the first integer argument and the line id the first plain string
 * (account and contract strkeys are excluded).
 */
export function decodeArguments(parameters: unknown, decimals: number): DecodedArguments {
  const result: DecodedArguments = { amount: null, lineId: null };
  // `arguments` is a bare list of base64 ScVals; `parameters` pairs them with keys.
  const entries = (Array.isArray(parameters) ? parameters : [])
    .map((entry) => (typeof entry === 'string' ? { value: entry } : entry))
    .filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object',
    );

  const values = entries.map((entry) => ({
    key: parameterKey(entry),
    value: decodeScVal(entry.value) ?? entry.value_decoded ?? entry.value,
  }));

  const amountEntry = values.find((entry) => entry.key === 'amount');
  const lineEntry = values.find((entry) => LINE_ID_KEYS.includes(entry.key));

  if (amountEntry) {
    const amount = decodedInteger(amountEntry.value);
    if (amount !== null) result.amount = scaleBaseUnits(amount, decimals);
  }
  if (lineEntry) {
    const text = asText(lineEntry.value);
    if (text) result.lineId = text;
  }

  if (result.amount === null) {
    for (const entry of values) {
      const amount = decodedInteger(entry.value);
      if (amount !== null) {
        result.amount = scaleBaseUnits(amount, decimals);
        break;
      }
    }
  }
  if (result.lineId === null) {
    for (const entry of values) {
      const text = asText(entry.value);
      if (text && !isStrKeyLike(text)) {
        result.lineId = text;
        break;
      }
    }
  }

  return result;
}

/** Converts base units to the UI's number amount without float division drift. */
export function scaleBaseUnits(baseUnits: bigint, decimals: number): number {
  const negative = baseUnits < 0n;
  const digits = (negative ? -baseUnits : baseUnits).toString().padStart(decimals + 1, '0');
  const split = digits.length - decimals;
  const text =
    decimals === 0 ? digits : `${digits.slice(0, split)}.${digits.slice(split)}`;
  return Number(negative ? `-${text}` : text);
}

function recordField(record: HorizonOperationRecord, key: keyof HorizonOperationRecord): string {
  const value = record[key];
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function buildUrl(
  horizonUrl: string,
  borrower: string,
  limit: number,
  cursor: string | null,
): string {
  const base = horizonUrl.endsWith('/') ? horizonUrl.slice(0, -1) : horizonUrl;
  const url = new URL(`${base}/accounts/${encodeURIComponent(borrower)}/operations`);
  url.searchParams.set('order', 'desc');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('include_failed', 'true');
  // An empty first page must not carry a cursor param at all.
  if (cursor) url.searchParams.set('cursor', cursor);
  return url.toString();
}

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new CreditDataError('aborted', 'The operation was aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Reads a borrower's transaction history from Horizon operations.
 *
 * The contract filter runs after the fetch, so a page of raw operations can
 * contain few (or zero) credit rows. The source therefore keeps walking
 * backwards through `paging_token`s until it has `limit` matches, Horizon runs
 * out, or the {@link MAX_UPSTREAM_REQUESTS_PER_CALL} cap is reached.
 */
export class HorizonCreditHistorySource {
  private readonly horizonUrl: string;
  private readonly contractId: string;
  private readonly fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  private readonly defaultTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly amountDecimals: number;

  constructor(options: HorizonCreditHistorySourceOptions = {}) {
    const config: SorobanCreditConfig = getSorobanConfig();
    this.horizonUrl = (options.horizonUrl || config.horizonUrl).replace(/\/+$/, '');
    this.contractId = options.contractId || config.contractId;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.amountDecimals = options.amountDecimals ?? SOROBAN_TOKEN_DECIMALS;
    this.fetchImpl =
      options.fetchImpl ??
      ((url, init) => globalThis.fetch(url, init) as Promise<Response>);
  }

  async listTransactions(
    borrower: string,
    query: TransactionPageQuery = {},
  ): Promise<TransactionPage> {
    if (!borrower || typeof borrower !== 'string') {
      throw new CreditDataError('invalid_response', 'Borrower address is required');
    }
    if (query.signal?.aborted) {
      throw new CreditDataError('aborted', 'The operation was aborted');
    }

    const limit = clampLimit(query.limit);
    const matched: Array<{ row: Transaction; token: string }> = [];
    const seen = new Set<string>();
    let scanCursor = query.cursor ?? null;
    /** False only once Horizon has handed us a short (or empty) page. */
    let upstreamHasMore = true;
    let requests = 0;

    while (requests < MAX_UPSTREAM_REQUESTS_PER_CALL && matched.length < limit) {
      requests += 1;
      const records = await this.fetchPage(borrower, limit, scanCursor, query);

      if (records === null) {
        // Unfunded account: Horizon has no operations resource for it at all.
        upstreamHasMore = false;
        break;
      }
      if (records.length === 0) {
        upstreamHasMore = false;
        break;
      }
      // A short page is Horizon telling us the account's history is exhausted.
      const shortPage = records.length < limit;

      for (const record of records) {
        const token = recordField(record, 'paging_token');
        if (token) scanCursor = token;

        const row = this.mapOperation(record);
        if (!row) continue;
        if (query.lineId && row.lineId !== query.lineId) continue;
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        matched.push({ row, token });
        if (matched.length === limit) break;
      }

      if (shortPage) {
        upstreamHasMore = false;
        break;
      }
      upstreamHasMore = true;
    }

    const last = matched[matched.length - 1];
    // Operations arrive newest first, so a cursor taken from the last delivered
    // record can only ever move backwards: rows that landed between two page
    // requests sit above it and are never re-sent or skipped.
    const nextCursor =
      matched.length >= limit
        ? last?.token || null
        : upstreamHasMore && requests >= MAX_UPSTREAM_REQUESTS_PER_CALL
          ? scanCursor
          : null;

    return {
      transactions: matched.map((entry) => entry.row),
      nextCursor: normaliseCursor(nextCursor),
    };
  }

  /**
   * One Horizon operations request. Retries a rate limit once, then reports it as
   * a network failure. Returns `null` for a 404, which means "no operations".
   */
  private async fetchPage(
    borrower: string,
    limit: number,
    cursor: string | null,
    query: TransactionPageQuery,
  ): Promise<HorizonOperationRecord[] | null> {
    const url = buildUrl(this.horizonUrl, borrower, limit, cursor);
    const timeoutMs = query.timeoutMs ?? this.defaultTimeoutMs;

    let attempt = 0;
    for (;;) {
      if (query.signal?.aborted) {
        throw new CreditDataError('aborted', 'The operation was aborted');
      }

      const controller = new AbortController();
      const abortCaller = () => controller.abort();
      query.signal?.addEventListener('abort', abortCaller, { once: true });
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: 'GET',
          headers: { Accept: 'application/hal+json' },
          signal: controller.signal,
        });
      } catch (cause) {
        if (query.signal?.aborted) {
          throw new CreditDataError('aborted', 'The operation was aborted');
        }
        throw new CreditDataError(
          'network',
          `Horizon request failed after ${timeoutMs}ms: ${describeCause(cause)}`,
          { cause },
        );
      } finally {
        clearTimeout(timer);
        query.signal?.removeEventListener('abort', abortCaller);
      }

      if (response.status === 404) return null;

      if (response.status === 429) {
        if (attempt >= 1) {
          throw new CreditDataError('network', 'Horizon rate limited the request after one retry');
        }
        attempt += 1;
        await sleep(this.retryDelayMs * 2 ** (attempt - 1), query.signal);
        continue;
      }

      if (!response.ok) {
        throw new CreditDataError(
          'network',
          `Horizon responded ${response.status} for ${url}`,
          { cause: response.status },
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (cause) {
        throw new CreditDataError('invalid_response', 'Horizon returned malformed JSON', {
          cause,
        });
      }

      const records = (payload as { _embedded?: { records?: unknown } })?._embedded?.records;
      if (!Array.isArray(records)) {
        throw new CreditDataError(
          'invalid_response',
          'Horizon response is missing _embedded.records',
        );
      }
      return records as HorizonOperationRecord[];
    }
  }

  /** Maps one Horizon operation to a history row, or `null` when it is not ours. */
  private mapOperation(record: HorizonOperationRecord): Transaction | null {
    if (record.type !== INVOKE_HOST_FUNCTION) return null;

    const symbol = functionSymbolFrom(record);
    const invokedContract = recordField(record, 'contract_id');
    // A record without contract_id and without a `contract#method` function
    // cannot be attributed, so it is not a call on the credit contract.
    const functionContract = rawFunctionContract(record);
    if (invokedContract && invokedContract !== this.contractId) return null;
    if (!invokedContract && functionContract !== this.contractId) return null;

    const id = recordField(record, 'id');
    const pagingToken = recordField(record, 'paging_token');
    if (!id || !pagingToken) {
      throw new CreditDataError(
        'invalid_response',
        `Horizon operation is missing id or paging_token: ${id || '<none>'}`,
      );
    }

    const createdAt = recordField(record, 'created_at');
    const { amount, lineId } = decodeArguments(
      record.parameters ?? record.arguments,
      this.amountDecimals,
    );
    const successful = record.transaction_successful === true;
    const row: Transaction = {
      id,
      type: resolveTransactionType(symbol),
      amount: amount ?? 0,
      date: createdAt,
      status: successful ? 'Completed' : 'Failed',
    };
    const txHash = recordField(record, 'transaction_hash');
    if (txHash) row.txHash = txHash;
    if (lineId) row.lineId = lineId;
    if (!TRANSACTION_TYPE_BY_FUNCTION[symbol] && symbol) {
      row.note = `Unmapped contract call: ${symbol}`;
    }
    return row;
  }
}

function rawFunctionContract(record: HorizonOperationRecord): string {
  const raw = typeof record.function === 'string' ? record.function : '';
  const separator = raw.lastIndexOf('#');
  return separator === -1 ? '' : raw.slice(0, separator);
}

function normaliseCursor(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message;
  return 'transport error';
}

export function clampLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_HISTORY_PAGE_SIZE;
  return Math.min(MAX_HISTORY_PAGE_SIZE, Math.max(1, Math.floor(limit)));
}
