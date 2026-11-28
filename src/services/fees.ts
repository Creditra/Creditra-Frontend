import {
  Account,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { getCreditNetworkConfig } from '../config/creditNetwork';

/**
 * Network fee estimation for the draw and repay previews.
 *
 * Two sources are combined:
 *  - Horizon `/fee_stats` gives the inclusion fee (p50 / p90 of `fee_charged`).
 *  - Soroban `simulateTransaction` gives the contract's `minResourceFee`.
 *
 * Both calls are cached briefly, bounded by a timeout and cancellable through
 * an `AbortSignal`. Callers treat any failure as "estimate unavailable" and
 * must never block submission on it.
 */

export const STROOPS_PER_XLM = 10_000_000;

const DEFAULT_TIMEOUT_MS = 8_000;
const ESTIMATE_CACHE_TTL_MS = 30_000;
const FEE_STATS_CACHE_TTL_MS = 60_000;
const DEFAULT_INCLUSION_FEE_STROOPS = 100;
const THROWAWAY_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export type FeeEstimateErrorCode =
  | 'aborted'
  | 'timeout'
  | 'invalid_invocation'
  | 'contract_not_configured'
  | 'fee_stats_unavailable'
  | 'simulation_failed'
  | 'network_error';

export class FeeEstimateError extends Error {
  readonly code: FeeEstimateErrorCode;

  constructor(code: FeeEstimateErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'FeeEstimateError';
    this.code = code;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    Object.setPrototypeOf(this, FeeEstimateError.prototype);
  }
}

export interface FeeStats {
  /** Median inclusion fee, in stroops. */
  p50Stroops: number;
  /** 90th-percentile inclusion fee, in stroops. */
  p90Stroops: number;
  fetchedAt: number;
}

export interface NetworkFeeEstimate {
  method: string;
  /** Inclusion (base) fee taken from Horizon fee stats, in stroops. */
  inclusionFeeStroops: number;
  /** Soroban resource fee from simulation, in stroops. */
  resourceFeeStroops: number;
  totalStroops: number;
  totalXlm: number;
  stats?: FeeStats;
  fetchedAt: number;
}

export interface FeeServiceOptions {
  fetchImpl?: typeof fetch;
  server?: Pick<rpc.Server, 'simulateTransaction'>;
  horizonUrl?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  contractId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  cacheTtlMs?: number;
  now?: () => number;
  /** Bypass cached values for this call. */
  force?: boolean;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const feeStatsCache = new Map<string, CacheEntry<FeeStats>>();
const estimateCache = new Map<string, CacheEntry<NetworkFeeEstimate>>();

/** Clears both caches. Intended for tests and network switches. */
export function clearFeeCaches(): void {
  feeStatsCache.clear();
  estimateCache.clear();
}

interface ResolvedFeeConfig {
  horizonUrl: string;
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
}

function resolveConfig(options: FeeServiceOptions): ResolvedFeeConfig {
  if (
    options.horizonUrl &&
    options.rpcUrl &&
    options.networkPassphrase &&
    options.contractId !== undefined
  ) {
    return {
      horizonUrl: options.horizonUrl,
      rpcUrl: options.rpcUrl,
      networkPassphrase: options.networkPassphrase,
      contractId: options.contractId,
    };
  }

  const config = getCreditNetworkConfig();
  return {
    horizonUrl: options.horizonUrl ?? config.horizonUrl,
    rpcUrl: options.rpcUrl ?? config.sorobanRpcUrl,
    networkPassphrase: options.networkPassphrase ?? config.networkPassphrase,
    contractId: options.contractId ?? config.creditContractId,
  };
}

/** True when a credit contract is configured, i.e. simulation can run. */
export function isFeeEstimationConfigured(): boolean {
  try {
    return resolveConfig({}).contractId !== '';
  } catch {
    return false;
  }
}

function toStroops(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new FeeEstimateError('aborted', 'The fee estimate was cancelled.');
  }
}

function linkAbort(
  controller: AbortController,
  callerSignal: AbortSignal | undefined,
): () => void {
  if (!callerSignal) return () => undefined;
  if (callerSignal.aborted) {
    controller.abort(callerSignal.reason);
    return () => undefined;
  }
  const onAbort = () => controller.abort(callerSignal.reason);
  callerSignal.addEventListener('abort', onAbort, { once: true });
  return () => callerSignal.removeEventListener('abort', onAbort);
}

async function requestWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  options: FeeServiceOptions,
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const unlink = linkAbort(controller, options.signal);
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new FeeEstimateError(
        'timeout',
        `Fee stats request timed out after ${timeoutMs}ms.`,
        { cause: error },
      );
    }
    if (controller.signal.aborted) {
      throw new FeeEstimateError('aborted', 'The fee estimate was cancelled.', {
        cause: error,
      });
    }
    throw new FeeEstimateError('fee_stats_unavailable', 'Fee stats request failed.', {
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

/** Fetches Horizon `/fee_stats` and returns the p50 / p90 inclusion fees. */
export async function fetchFeeStats(options: FeeServiceOptions = {}): Promise<FeeStats> {
  const config = resolveConfig(options);
  const now = options.now ?? Date.now;
  const ttl = options.cacheTtlMs ?? FEE_STATS_CACHE_TTL_MS;
  const cacheKey = config.horizonUrl;

  assertNotAborted(options.signal);

  if (!options.force) {
    const cached = feeStatsCache.get(cacheKey);
    if (cached && cached.expiresAt > now()) return cached.value;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new FeeEstimateError('fee_stats_unavailable', 'fetch is not available.');
  }

  const url = `${config.horizonUrl.replace(/\/+$/, '')}/fee_stats`;
  const response = await requestWithTimeout(fetchImpl, url, options);

  if (!response.ok) {
    throw new FeeEstimateError(
      'fee_stats_unavailable',
      `Fee stats request failed with status ${response.status}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new FeeEstimateError('fee_stats_unavailable', 'Fee stats response was not JSON.', {
      cause: error,
    });
  }

  const charged = (payload as { fee_charged?: Record<string, unknown> } | null)?.fee_charged;
  const p50 = toStroops(charged?.p50);
  const p90 = toStroops(charged?.p90);

  if (p50 === undefined && p90 === undefined) {
    throw new FeeEstimateError(
      'fee_stats_unavailable',
      'Fee stats response did not include fee_charged percentiles.',
    );
  }

  const value: FeeStats = {
    p50Stroops: p50 ?? p90 ?? DEFAULT_INCLUSION_FEE_STROOPS,
    p90Stroops: p90 ?? p50 ?? DEFAULT_INCLUSION_FEE_STROOPS,
    fetchedAt: now(),
  };
  feeStatsCache.set(cacheKey, { value, expiresAt: now() + ttl });
  return value;
}

async function simulateWithTimeout(
  server: Pick<rpc.Server, 'simulateTransaction'>,
  tx: ReturnType<TransactionBuilder['build']>,
  options: FeeServiceOptions,
): Promise<rpc.Api.SimulateTransactionResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const unlink = linkAbort(controller, options.signal);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new FeeEstimateError('timeout', `Fee simulation timed out after ${timeoutMs}ms.`),
      );
    }, timeoutMs);
  });

  const abortPromise = new Promise<never>((_, reject) => {
    if (controller.signal.aborted) {
      reject(new FeeEstimateError('aborted', 'The fee estimate was cancelled.'));
      return;
    }
    controller.signal.addEventListener(
      'abort',
      () =>
        reject(
          new FeeEstimateError(
            'aborted',
            'The fee estimate was cancelled.',
          ),
        ),
      { once: true },
    );
  });

  try {
    return await Promise.race([
      server.simulateTransaction(tx),
      timeoutPromise,
      abortPromise,
    ]);
  } catch (error) {
    if (error instanceof FeeEstimateError) throw error;
    throw new FeeEstimateError('network_error', 'Fee simulation request failed.', {
      cause: error,
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    unlink();
  }
}

function stableSerialize(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return String(value);
  const kind = typeof value;
  if (kind === 'bigint' || kind === 'number' || kind === 'boolean' || kind === 'string') {
    return `${kind}:${String(value)}`;
  }
  if (kind !== 'object') return `${kind}:${String(value)}`;
  if (depth > 8) return '[deep]';
  if (value instanceof Uint8Array) return `bytes:${Array.from(value).join('.')}`;
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item, depth + 1)).join('|')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${key}=${stableSerialize(record[key], depth + 1)}`)
    .join(';')}}`;
}

/** Stable, realm-safe cache key for a list of contract-call args. */
export function feeArgsKey(args: xdr.ScVal[]): string {
  return args.map((arg) => stableSerialize(arg)).join(',');
}

/**
 * Estimates the total network fee (inclusion + Soroban resource fee) for a
 * contract invocation by simulating it. Falls back to the base inclusion fee
 * when Horizon fee stats are unavailable; simulation failures are surfaced as
 * `FeeEstimateError` so callers can show their "unavailable" state.
 */
export async function estimateInvocationFee(
  method: string,
  args: xdr.ScVal[] = [],
  options: FeeServiceOptions = {},
): Promise<NetworkFeeEstimate> {
  if (!method || method.trim() === '') {
    throw new FeeEstimateError('invalid_invocation', 'A contract method is required.');
  }

  const config = resolveConfig(options);
  if (!config.contractId) {
    throw new FeeEstimateError(
      'contract_not_configured',
      'VITE_CREDIT_CONTRACT_ID is required to estimate the network fee.',
    );
  }

  const now = options.now ?? Date.now;
  const ttl = options.cacheTtlMs ?? ESTIMATE_CACHE_TTL_MS;
  const cacheKey = [
    config.networkPassphrase,
    config.contractId,
    method,
    feeArgsKey(args),
  ].join('|');

  assertNotAborted(options.signal);

  if (!options.force) {
    const cached = estimateCache.get(cacheKey);
    if (cached && cached.expiresAt > now()) return cached.value;
  }

  const contract = new Contract(config.contractId);
  const tx = new TransactionBuilder(new Account(THROWAWAY_ACCOUNT, '0'), {
    fee: '100',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const server =
    options.server ??
    new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith('http://'),
    });

  const simulation = await simulateWithTimeout(server, tx, options);

  if (rpc.Api.isSimulationError(simulation)) {
    throw new FeeEstimateError(
      'simulation_failed',
      simulation.error || 'Transaction simulation failed.',
    );
  }

  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new FeeEstimateError('simulation_failed', 'Transaction simulation failed.');
  }

  const resourceFeeStroops = toStroops(simulation.minResourceFee);
  if (resourceFeeStroops === undefined) {
    throw new FeeEstimateError(
      'simulation_failed',
      'Simulation did not report a resource fee.',
    );
  }

  let stats: FeeStats | undefined;
  let inclusionFeeStroops = DEFAULT_INCLUSION_FEE_STROOPS;
  try {
    stats = await fetchFeeStats(options);
    inclusionFeeStroops = stats.p50Stroops;
  } catch (error) {
    if (error instanceof FeeEstimateError && error.code === 'aborted') throw error;
    // Fee stats are advisory: fall back to the network base fee.
  }

  const totalStroops = inclusionFeeStroops + resourceFeeStroops;
  const value: NetworkFeeEstimate = {
    method,
    inclusionFeeStroops,
    resourceFeeStroops,
    totalStroops,
    totalXlm: totalStroops / STROOPS_PER_XLM,
    stats,
    fetchedAt: now(),
  };

  estimateCache.set(cacheKey, { value, expiresAt: now() + ttl });
  return value;
}

/** Builds the `[lineId, amount]` args used by the `draw` and `repay` methods. */
export function buildCreditInvocationArgs(lineId: string, amount: number): xdr.ScVal[] {
  const safeAmount = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
  const stroops = BigInt(Math.round(safeAmount * STROOPS_PER_XLM));
  return [
    nativeToScVal(lineId, { type: 'string' }),
    nativeToScVal(stroops, { type: 'i128' }),
  ];
}

/** Formats a stroop amount as an XLM string with at least two decimals. */
export function formatFeeXlm(stroops: number): string {
  const safe = Number.isFinite(stroops) ? Math.max(stroops, 0) : 0;
  const fixed = (safe / STROOPS_PER_XLM).toFixed(7);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  const [whole, fraction = ''] = trimmed.split('.');
  const decimals = fraction.length < 2 ? fraction.padEnd(2, '0') : fraction;
  return `${whole}.${decimals} XLM`;
}
