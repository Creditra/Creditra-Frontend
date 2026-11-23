import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  rpc,
  xdr,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { CreditDataError } from '../CreditDataSource';
import {
  SorobanCreditDataSource,
  type SorobanCreditDataSourceOptions,
} from '../sorobanCreditDataSource';

const BORROWER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const SECOND_BORROWER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function createSuccessSimulation(retval: xdr.ScVal): rpc.Api.SimulateTransactionSuccessResponse {
  return {
    id: 'sim-test-id',
    latestLedger: 12345,
    events: [],
    _parsed: true,
    minResourceFee: '100',
    transactionData: {} as any,
    result: {
      auth: [],
      retval,
    },
  };
}

function createErrorSimulation(
  error: string,
  events: rpc.Api.DiagnosticEvent[] = [],
): rpc.Api.SimulateTransactionErrorResponse {
  return {
    id: 'sim-test-id',
    latestLedger: 12345,
    events,
    _parsed: true,
    error,
  };
}

function createAdapter(
  server: rpc.Server,
  options: Pick<SorobanCreditDataSourceOptions, 'defaultTimeoutMs' | 'minListIntervalMs' | 'retry'> = {},
): SorobanCreditDataSource {
  return new SorobanCreditDataSource({
    server,
    networkPassphrase: 'Test SDF Network ; September 2015',
    contractId: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
    ...options,
  });
}

describe('SorobanCreditDataSource', () => {
  let mockSimulateTransaction: ReturnType<typeof vi.fn>;
  let mockSleep: ReturnType<typeof vi.fn>;
  let mockServer: rpc.Server;
  let adapter: SorobanCreditDataSource;

  beforeEach(() => {
    mockSimulateTransaction = vi.fn();
    mockSleep = vi.fn().mockResolvedValue(undefined);
    mockServer = {
      simulateTransaction: mockSimulateTransaction,
    } as unknown as rpc.Server;

    adapter = createAdapter(mockServer, { retry: { sleep: mockSleep } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Scenario 1 ──────────────────────────────────────────────────────────────
  it('1. Borrower with two lines (fixture) returns two CreditLine objects with exact limit and utilized values', async () => {
    const rawFixture = [
      {
        id: 'cl-prime-001',
        name: 'Prime Working Capital',
        status: 'Active',
        limit: 50_000_000_000n, // 5,000 units
        utilized: 12_500_000_000n, // 1,250 units
        apr: 8n,
        risk_score: 750n,
        opened_at: 1704067200n,
        updated_at: 1706745600n,
        collateral: 'USDC-Stellar',
      },
      {
        id: 'cl-prime-002',
        name: 'Growth Credit Line',
        status: 'Active',
        limit: 100_000_000_000n, // 10,000 units
        utilized: 40_000_000_000n, // 4,000 units
        apr: 12n,
        risk_score: 680n,
        opened_at: 1704067200n,
        updated_at: 1706745600n,
      },
    ];

    const scval = nativeToScVal(rawFixture);
    mockSimulateTransaction.mockResolvedValueOnce(createSuccessSimulation(scval));

    const lines = await adapter.listCreditLines(BORROWER);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      id: 'cl-prime-001',
      name: 'Prime Working Capital',
      status: 'Active',
      limit: 5000,
      utilized: 1250,
      apr: 8,
      riskScore: 750,
      collateral: 'USDC-Stellar',
      transactions: [],
      statusHistory: [],
    });
    expect(lines[1]).toMatchObject({
      id: 'cl-prime-002',
      name: 'Growth Credit Line',
      status: 'Active',
      limit: 10000,
      utilized: 4000,
      apr: 12,
      riskScore: 680,
    });
  });

  // ── Scenario 2 ──────────────────────────────────────────────────────────────
  it('2. Borrower with no lines returns [], not an error', async () => {
    const scval = xdr.ScVal.scvVec([]);
    mockSimulateTransaction.mockResolvedValueOnce(createSuccessSimulation(scval));

    const lines = await adapter.listCreditLines(BORROWER);

    expect(lines).toEqual([]);
  });

  // ── Scenario 3 ──────────────────────────────────────────────────────────────
  it('3. getCreditLine for a missing id throws CreditDataError with not_found', async () => {
    const scval = xdr.ScVal.scvVoid();
    mockSimulateTransaction.mockResolvedValueOnce(createSuccessSimulation(scval));

    const err = await adapter.getCreditLine('non-existent-id').catch((e) => e);
    expect(err).toBeInstanceOf(CreditDataError);
    expect(err.code).toBe('not_found');
  });

  // ── Scenario 4 ──────────────────────────────────────────────────────────────
  it('4. RPC transport error maps to network', async () => {
    const networkError = new Error('fetch failed: connection refused');
    mockSimulateTransaction.mockRejectedValue(networkError);

    const err = await adapter.listCreditLines(BORROWER).catch((e) => e);
    expect(err).toBeInstanceOf(CreditDataError);
    expect(err.code).toBe('network');
    expect(err.cause).toBe(networkError);
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(3);
  });

  it('4b. 15 s timeout under fake timers maps to network', async () => {
    vi.useFakeTimers();
    adapter = createAdapter(mockServer, {
      retry: { attempts: 0, sleep: mockSleep },
    });

    // Never resolves
    mockSimulateTransaction.mockImplementationOnce(() => new Promise(() => {}));

    const promise = adapter.listCreditLines(BORROWER);

    // Fast-forward past 15s default timeout
    vi.advanceTimersByTime(15_000);

    const err = await promise.catch((e) => e);
    expect(err).toBeInstanceOf(CreditDataError);
    expect(err.code).toBe('network');

    vi.useRealTimers();
  });

  it('4c. retries a timeout and succeeds on the next attempt', async () => {
    vi.useFakeTimers();
    adapter = createAdapter(mockServer, {
      defaultTimeoutMs: 10,
      retry: { sleep: mockSleep },
    });
    mockSimulateTransaction
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])));

    const promise = adapter.listCreditLines(BORROWER);
    await vi.advanceTimersByTimeAsync(10);

    await expect(promise).resolves.toEqual([]);
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('retries a network failure and returns the successful response', async () => {
    mockSimulateTransaction
      .mockRejectedValueOnce(new Error('temporary transport failure'))
      .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])));

    await expect(adapter.listCreditLines(BORROWER)).resolves.toEqual([]);
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(2);
    expect(mockSleep).toHaveBeenCalledWith(250);
  });

  it('does not retry an invalid simulation response', async () => {
    mockSimulateTransaction.mockResolvedValueOnce(null);

    await expect(adapter.listCreditLines(BORROWER)).rejects.toMatchObject({
      code: 'invalid_response',
    });
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
  });

  it('doubles retry delays up to the configured cap', async () => {
    adapter = createAdapter(mockServer, {
      retry: {
        attempts: 4,
        baseDelayMs: 100,
        maxDelayMs: 250,
        sleep: mockSleep,
      },
    });
    mockSimulateTransaction
      .mockRejectedValueOnce(new Error('network error 1'))
      .mockRejectedValueOnce(new Error('network error 2'))
      .mockRejectedValueOnce(new Error('network error 3'))
      .mockRejectedValueOnce(new Error('network error 4'))
      .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])));

    await expect(adapter.listCreditLines(BORROWER)).resolves.toEqual([]);
    expect(mockSleep.mock.calls.map(([delay]) => delay)).toEqual([
      100, 200, 250, 250,
    ]);
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(5);
  });

  it('surfaces the last network error after exhausting retries', async () => {
    const lastError = new Error('last network failure');
    mockSimulateTransaction
      .mockRejectedValueOnce(new Error('first network failure'))
      .mockRejectedValueOnce(new Error('second network failure'))
      .mockRejectedValueOnce(lastError);

    const err = await adapter.listCreditLines(BORROWER).catch((error) => error);
    expect(err).toMatchObject({ code: 'network', cause: lastError });
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(3);
  });

  it('attempts only once when retries are disabled', async () => {
    adapter = createAdapter(mockServer, {
      retry: { attempts: 0, sleep: mockSleep },
    });
    mockSimulateTransaction.mockRejectedValueOnce(new Error('network failure'));

    await expect(adapter.listCreditLines(BORROWER)).rejects.toMatchObject({
      code: 'network',
    });
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
    expect(mockSleep).not.toHaveBeenCalled();
  });

  it('aborting during retry delay stops the next RPC attempt', async () => {
    const sleep = vi.fn(() => new Promise<void>(() => {}));
    adapter = createAdapter(mockServer, {
      retry: {
        sleep,
      },
    });
    mockSimulateTransaction.mockRejectedValueOnce(new Error('temporary failure'));
    const controller = new AbortController();
    const promise = adapter.listCreditLines(BORROWER, { signal: controller.signal });

    await vi.waitFor(() => expect(sleep).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
  });

  // ── Scenario 5 ──────────────────────────────────────────────────────────────
  it('5. Simulation returns an error result maps to unavailable with original error kept as cause', async () => {
    const originalError = 'Host function invocation failed: ContractError(101)';
    mockSimulateTransaction.mockResolvedValueOnce(createErrorSimulation(originalError));

    const err = await adapter.listCreditLines(BORROWER).catch((e) => e);
    expect(err).toBeInstanceOf(CreditDataError);
    expect(err.code).toBe('unavailable');
    expect(err.cause).toBe(originalError);
  });

  it('5b. Preserves simulation diagnostics in details so contract codes stay classifiable', async () => {
    const originalError = 'Host function invocation failed: Error(Contract, #6)';
    const diagnosticEvent = {
      type: 'diagnostic',
      contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
      topics: ['error'],
      data: 'Error(Contract, #6)',
    } as unknown as rpc.Api.DiagnosticEvent;
    mockSimulateTransaction.mockResolvedValueOnce(
      createErrorSimulation(originalError, [diagnosticEvent]),
    );

    const err = await adapter.listCreditLines(BORROWER).catch((e) => e);
    expect(err).toBeInstanceOf(CreditDataError);
    expect(err.cause).toBe(originalError);
    expect(err.details).toEqual({
      error: originalError,
      events: [diagnosticEvent],
    });
  });

  // ── Scenario 6 ──────────────────────────────────────────────────────────────
  describe('6. Malformed ScVal throws invalid_response and never returns partially populated lines', () => {
    it('throws invalid_response when required field is missing', async () => {
      const malformedLine = {
        id: 'cl-incomplete',
        name: 'Missing Limit Line',
        status: 'Active',
        // limit is missing!
        utilized: 1000n,
        apr: 5n,
        risk_score: 700n,
        opened_at: 1704067200n,
        updated_at: 1706745600n,
      };

      const scval = nativeToScVal([malformedLine]);
      mockSimulateTransaction.mockResolvedValueOnce(createSuccessSimulation(scval));

      const err = await adapter.listCreditLines(BORROWER).catch((e) => e);
      expect(err).toBeInstanceOf(CreditDataError);
      expect(err.code).toBe('invalid_response');
    });

    it('throws invalid_response when field has wrong type', async () => {
      const malformedLine = {
        id: 'cl-wrong-type',
        name: 'Invalid Type Line',
        status: 'Active',
        limit: 'not-an-amount-or-bigint',
        utilized: 0n,
        apr: 5n,
        risk_score: 700n,
        opened_at: 1704067200n,
        updated_at: 1706745600n,
      };

      const scval = nativeToScVal([malformedLine]);
      mockSimulateTransaction.mockResolvedValueOnce(createSuccessSimulation(scval));

      const err = await adapter.listCreditLines(BORROWER).catch((e) => e);
      expect(err).toBeInstanceOf(CreditDataError);
      expect(err.code).toBe('invalid_response');
    });

    it('throws invalid_response when status variant is unknown', async () => {
      const malformedLine = {
        id: 'cl-bad-status',
        name: 'Unknown Status Line',
        status: 'Destroyed', // Not in CreditLineStatus
        limit: 10_000_000_000n,
        utilized: 0n,
        apr: 5n,
        risk_score: 700n,
        opened_at: 1704067200n,
        updated_at: 1706745600n,
      };

      const scval = nativeToScVal([malformedLine]);
      mockSimulateTransaction.mockResolvedValueOnce(createSuccessSimulation(scval));

      const err = await adapter.listCreditLines(BORROWER).catch((e) => e);
      expect(err).toBeInstanceOf(CreditDataError);
      expect(err.code).toBe('invalid_response');
    });
  });

  // ── Scenario 7 ──────────────────────────────────────────────────────────────
  it('7. i128 above Number.MAX_SAFE_INTEGER is decoded exactly with no precision loss', async () => {
    // 20_000_000_000_000_000n stroops is 2_000_000_000 units.
    // 20_000_000_000_000_000n > Number.MAX_SAFE_INTEGER (9_007_199_254_740_991n).
    const rawStroopsLimit = 20_000_000_000_000_000n;
    expect(rawStroopsLimit > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);

    const rawLine = {
      id: 'cl-large-i128',
      name: 'Whale Liquidity Line',
      status: 'Active',
      limit: rawStroopsLimit,
      utilized: 10_000_000_000_000_000n, // 1_000_000_000 units
      apr: 10n,
      risk_score: 800n,
      opened_at: 1704067200n,
      updated_at: 1706745600n,
    };

    const scval = nativeToScVal([rawLine]);
    mockSimulateTransaction.mockResolvedValueOnce(createSuccessSimulation(scval));

    const lines = await adapter.listCreditLines(BORROWER);

    expect(lines).toHaveLength(1);
    expect(lines[0].limit).toBe(2_000_000_000);
    expect(lines[0].utilized).toBe(1_000_000_000);
  });

  // ── Scenario 8 ──────────────────────────────────────────────────────────────
  it('8. Aborted signal throws aborted and leaks no state', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      adapter.listCreditLines(BORROWER, { signal: controller.signal }),
    ).rejects.toMatchObject({
      code: 'aborted',
    });

    // Verify simulateTransaction was never even dispatched when pre-aborted
    expect(mockSimulateTransaction).not.toHaveBeenCalled();
  });

  it('8b. In-flight abort triggers aborted error and cleans up listeners', async () => {
    const controller = new AbortController();

    mockSimulateTransaction.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );

    const promise = adapter.listCreditLines(BORROWER, { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({
      code: 'aborted',
    });
  });

  // ── Scenario 9: Coalescing & Throttling ────────────────────────────────────
  describe('9. Coalescing and throttling for listCreditLines', () => {
    it('coalesces N parallel calls for the same borrower into one RPC', async () => {
      let resolveSim!: (val: rpc.Api.SimulateTransactionSuccessResponse) => void;
      mockSimulateTransaction.mockImplementationOnce(
        () => new Promise((resolve) => { resolveSim = resolve; }),
      );

      const p1 = adapter.listCreditLines(BORROWER);
      const p2 = adapter.listCreditLines(BORROWER);
      const p3 = adapter.listCreditLines(BORROWER);

      expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);

      resolveSim(createSuccessSimulation(xdr.ScVal.scvVec([])));

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      expect(r1).toEqual([]);
      expect(r2).toEqual([]);
      expect(r3).toEqual([]);
      expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
    });

    it('does not coalesce concurrent calls for different borrowers', async () => {
      mockSimulateTransaction
        .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])))
        .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])));

      const [r1, r2] = await Promise.all([
        adapter.listCreditLines(BORROWER),
        adapter.listCreditLines(SECOND_BORROWER),
      ]);

      expect(r1).toEqual([]);
      expect(r2).toEqual([]);
      expect(mockSimulateTransaction).toHaveBeenCalledTimes(2);
    });

    it('returns cached result within minListIntervalMs and fetches again after interval', async () => {
      vi.useFakeTimers();
      try {
        adapter = createAdapter(mockServer, {
          minListIntervalMs: 1_000,
          retry: { attempts: 0, sleep: mockSleep },
        });

        mockSimulateTransaction
          .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])))
          .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])));

        await expect(adapter.listCreditLines(BORROWER)).resolves.toEqual([]);
        expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);

        // Within interval: returns cached result without another RPC
        vi.advanceTimersByTime(500);
        await expect(adapter.listCreditLines(BORROWER)).resolves.toEqual([]);
        expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);

        // Past interval: issues a second RPC
        vi.advanceTimersByTime(500);
        await expect(adapter.listCreditLines(BORROWER)).resolves.toEqual([]);
        expect(mockSimulateTransaction).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('bypasses the minimum interval when options.force is true', async () => {
      vi.useFakeTimers();
      try {
        adapter = createAdapter(mockServer, {
          minListIntervalMs: 1_000,
          retry: { attempts: 0, sleep: mockSleep },
        });

        mockSimulateTransaction
          .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])))
          .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])));

        await expect(adapter.listCreditLines(BORROWER)).resolves.toEqual([]);
        expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);

        await expect(adapter.listCreditLines(BORROWER, { force: true })).resolves.toEqual([]);
        expect(mockSimulateTransaction).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not cache failed calls', async () => {
      adapter = createAdapter(mockServer, {
        minListIntervalMs: 1_000,
        retry: { attempts: 0, sleep: mockSleep },
      });

      mockSimulateTransaction
        .mockRejectedValueOnce(new Error('temporary rpc failure'))
        .mockResolvedValueOnce(createSuccessSimulation(xdr.ScVal.scvVec([])));

      await expect(adapter.listCreditLines(BORROWER)).rejects.toMatchObject({
        code: 'network',
      });
      expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);

      await expect(adapter.listCreditLines(BORROWER)).resolves.toEqual([]);
      expect(mockSimulateTransaction).toHaveBeenCalledTimes(2);
    });

    it('aborting one joined consumer rejects only that consumer while others resolve', async () => {
      let resolveSim!: (val: rpc.Api.SimulateTransactionSuccessResponse) => void;
      mockSimulateTransaction.mockImplementationOnce(
        () => new Promise((resolve) => { resolveSim = resolve; }),
      );

      const controllerA = new AbortController();
      const controllerB = new AbortController();

      const pA = adapter.listCreditLines(BORROWER, { signal: controllerA.signal });
      const pB = adapter.listCreditLines(BORROWER, { signal: controllerB.signal });

      // Pre-aborted caller joining an existing in-flight request rejects immediately without affecting others
      const preAborted = new AbortController();
      preAborted.abort();
      await expect(
        adapter.listCreditLines(BORROWER, { signal: preAborted.signal }),
      ).rejects.toMatchObject({ code: 'aborted' });

      // Abort consumer A after join
      controllerA.abort();
      await expect(pA).rejects.toMatchObject({ code: 'aborted' });

      // Shared RPC completes -> consumer B still resolves
      resolveSim(createSuccessSimulation(xdr.ScVal.scvVec([])));
      await expect(pB).resolves.toEqual([]);
      expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
    });

    it('timeout of one joined consumer rejects only that consumer while others resolve', async () => {
      vi.useFakeTimers();
      try {
        adapter = createAdapter(mockServer, {
          defaultTimeoutMs: 15_000,
          retry: { attempts: 0, sleep: mockSleep },
        });

        let resolveSim!: (val: rpc.Api.SimulateTransactionSuccessResponse) => void;
        mockSimulateTransaction.mockImplementationOnce(
          () => new Promise((resolve) => { resolveSim = resolve; }),
        );

        const pLong = adapter.listCreditLines(BORROWER);
        const pShort = adapter.listCreditLines(BORROWER, { timeoutMs: 50 });

        vi.advanceTimersByTime(50);
        await expect(pShort).rejects.toMatchObject({ code: 'network' });

        resolveSim(createSuccessSimulation(xdr.ScVal.scvVec([])));
        await expect(pLong).resolves.toEqual([]);
        expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
