import { describe, expect, it, vi, beforeEach } from 'vitest';
import { rpc } from '@stellar/stellar-sdk';
import {
  FeeEstimateError,
  buildCreditInvocationArgs,
  clearFeeCaches,
  estimateInvocationFee,
  fetchFeeStats,
  formatFeeXlm,
  isFeeEstimationConfigured,
} from '../fees';

// jsdom's TextEncoder returns a Uint8Array from another realm, which breaks the
// `instanceof Uint8Array` checks in @stellar/js-xdr. Copy bytes into this realm.
const NativeTextEncoder = globalThis.TextEncoder;
const nativeEncode = NativeTextEncoder.prototype.encode;
(globalThis as { TextEncoder: typeof TextEncoder }).TextEncoder = class extends NativeTextEncoder {
  encode(input?: string): Uint8Array {
    return new Uint8Array(nativeEncode.call(this, input));
  }
} as typeof TextEncoder;

const CONFIG = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function simulationSuccess(minResourceFee: string): rpc.Api.SimulateTransactionResponse {
  return {
    transactionData: {},
    minResourceFee,
    latestLedger: 1,
    events: [],
    _parsed: true,
  } as unknown as rpc.Api.SimulateTransactionResponse;
}

function simulationError(error: string): rpc.Api.SimulateTransactionResponse {
  return {
    error,
    latestLedger: 1,
    events: [],
    _parsed: true,
  } as unknown as rpc.Api.SimulateTransactionResponse;
}

const FEE_STATS_BODY = {
  fee_charged: {
    min: '100',
    max: '10000',
    mode: '100',
    p50: '250',
    p90: '1000',
  },
};

beforeEach(() => {
  clearFeeCaches();
});

describe('fetchFeeStats', () => {
  it('reads p50 and p90 inclusion fees from Horizon fee_stats', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(FEE_STATS_BODY));

    const stats = await fetchFeeStats({ ...CONFIG, fetchImpl, now: () => 1000 });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://horizon-testnet.stellar.org/fee_stats',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(stats).toEqual({ p50Stroops: 250, p90Stroops: 1000, fetchedAt: 1000 });
  });

  it('caches fee stats for the configured TTL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(FEE_STATS_BODY));
    const now = vi.fn().mockReturnValue(1000);

    await fetchFeeStats({ ...CONFIG, fetchImpl, now, cacheTtlMs: 5000 });
    await fetchFeeStats({ ...CONFIG, fetchImpl, now, cacheTtlMs: 5000 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    now.mockReturnValue(7000);
    await fetchFeeStats({ ...CONFIG, fetchImpl, now, cacheTtlMs: 5000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws fee_stats_unavailable for a non-OK response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));

    await expect(fetchFeeStats({ ...CONFIG, fetchImpl })).rejects.toMatchObject({
      code: 'fee_stats_unavailable',
    });
  });

  it('throws fee_stats_unavailable when the payload lacks percentiles', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ fee_charged: {} }));

    await expect(fetchFeeStats({ ...CONFIG, fetchImpl })).rejects.toBeInstanceOf(
      FeeEstimateError,
    );
  });

  it('times out a hanging request', async () => {
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    ) as unknown as typeof fetch;

    await expect(
      fetchFeeStats({ ...CONFIG, fetchImpl, timeoutMs: 5 }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejects immediately when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchFeeStats({ ...CONFIG, fetchImpl: vi.fn(), signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('estimateInvocationFee', () => {
  it('adds the simulated resource fee to the Horizon inclusion fee', async () => {
    const simulateTransaction = vi.fn().mockResolvedValue(simulationSuccess('12345'));
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(FEE_STATS_BODY));

    const estimate = await estimateInvocationFee(
      'draw',
      buildCreditInvocationArgs('line-1', 100),
      { ...CONFIG, server: { simulateTransaction }, fetchImpl },
    );

    expect(simulateTransaction).toHaveBeenCalledTimes(1);
    expect(estimate).toMatchObject({
      method: 'draw',
      resourceFeeStroops: 12345,
      inclusionFeeStroops: 250,
      totalStroops: 12595,
    });
    expect(estimate.totalXlm).toBeCloseTo(0.0012595, 10);
  });

  it('caches an estimate for the same method and args', async () => {
    const simulateTransaction = vi.fn().mockResolvedValue(simulationSuccess('100'));
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(FEE_STATS_BODY));
    const options = { ...CONFIG, server: { simulateTransaction }, fetchImpl };

    await estimateInvocationFee('repay', buildCreditInvocationArgs('line-1', 50), options);
    await estimateInvocationFee('repay', buildCreditInvocationArgs('line-1', 50), options);

    expect(simulateTransaction).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to the base inclusion fee when fee stats are unavailable', async () => {
    const simulateTransaction = vi.fn().mockResolvedValue(simulationSuccess('5000'));
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));

    const estimate = await estimateInvocationFee(
      'draw',
      buildCreditInvocationArgs('line-1', 10),
      { ...CONFIG, server: { simulateTransaction }, fetchImpl },
    );

    expect(estimate.inclusionFeeStroops).toBe(100);
    expect(estimate.totalStroops).toBe(5100);
    expect(estimate.stats).toBeUndefined();
  });

  it('throws contract_not_configured without a contract id', async () => {
    await expect(
      estimateInvocationFee('draw', [], { ...CONFIG, contractId: '' }),
    ).rejects.toMatchObject({ code: 'contract_not_configured' });
  });

  it('throws simulation_failed when the simulation reports an error', async () => {
    const simulateTransaction = vi.fn().mockResolvedValue(simulationError('host trap'));

    await expect(
      estimateInvocationFee('draw', buildCreditInvocationArgs('line-1', 10), {
        ...CONFIG,
        server: { simulateTransaction },
        fetchImpl: vi.fn().mockResolvedValue(jsonResponse(FEE_STATS_BODY)),
      }),
    ).rejects.toMatchObject({ code: 'simulation_failed' });
  });

  it('times out a hanging simulation', async () => {
    const simulateTransaction = vi.fn(() => new Promise<never>(() => undefined));

    await expect(
      estimateInvocationFee('draw', buildCreditInvocationArgs('line-1', 10), {
        ...CONFIG,
        server: { simulateTransaction },
        fetchImpl: vi.fn().mockResolvedValue(jsonResponse(FEE_STATS_BODY)),
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejects an empty method name', async () => {
    await expect(estimateInvocationFee('', [], CONFIG)).rejects.toMatchObject({
      code: 'invalid_invocation',
    });
  });
});

describe('formatFeeXlm', () => {
  it.each([
    [0, '0.00 XLM'],
    [100, '0.00001 XLM'],
    [100_000, '0.01 XLM'],
    [1_000_000, '0.10 XLM'],
    [12_595, '0.0012595 XLM'],
    [15_000_000, '1.50 XLM'],
    [12_345_678, '1.2345678 XLM'],
  ])('formats %s stroops as %s', (stroops, expected) => {
    expect(formatFeeXlm(stroops)).toBe(expected);
  });
});

describe('isFeeEstimationConfigured', () => {
  it('returns false when the environment has no contract id', () => {
    expect(isFeeEstimationConfigured()).toBe(false);
  });
});
