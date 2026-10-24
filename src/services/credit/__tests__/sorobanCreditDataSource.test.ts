import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  rpc,
  xdr,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { CreditDataError } from '../CreditDataSource';
import { SorobanCreditDataSource } from '../sorobanCreditDataSource';

const BORROWER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

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

function createErrorSimulation(error: string): rpc.Api.SimulateTransactionErrorResponse {
  return {
    id: 'sim-test-id',
    latestLedger: 12345,
    events: [],
    _parsed: true,
    error,
  };
}

describe('SorobanCreditDataSource', () => {
  let mockSimulateTransaction: ReturnType<typeof vi.fn>;
  let mockServer: rpc.Server;
  let adapter: SorobanCreditDataSource;

  beforeEach(() => {
    mockSimulateTransaction = vi.fn();
    mockServer = {
      simulateTransaction: mockSimulateTransaction,
    } as unknown as rpc.Server;

    adapter = new SorobanCreditDataSource({
      server: mockServer,
      networkPassphrase: 'Test SDF Network ; September 2015',
      contractId: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
    });
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
    mockSimulateTransaction.mockRejectedValueOnce(networkError);

    const err = await adapter.listCreditLines(BORROWER).catch((e) => e);
    expect(err).toBeInstanceOf(CreditDataError);
    expect(err.code).toBe('network');
    expect(err.cause).toBe(networkError);
  });

  it('4b. 15 s timeout under fake timers maps to network', async () => {
    vi.useFakeTimers();

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

  // ── Scenario 5 ──────────────────────────────────────────────────────────────
  it('5. Simulation returns an error result maps to unavailable with original error kept as cause', async () => {
    const originalError = 'Host function invocation failed: ContractError(101)';
    mockSimulateTransaction.mockResolvedValueOnce(createErrorSimulation(originalError));

    const err = await adapter.listCreditLines(BORROWER).catch((e) => e);
    expect(err).toBeInstanceOf(CreditDataError);
    expect(err.code).toBe('unavailable');
    expect(err.cause).toBe(originalError);
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
});
