import { describe, it, expect, vi } from 'vitest';
import { SorobanCreditDataSource } from '../sorobanCreditDataSource';
import {
  HorizonCreditHistorySource,
  MAX_UPSTREAM_REQUESTS_PER_CALL,
  TRANSACTION_TYPE_BY_FUNCTION,
  decodeArguments,
  functionSymbolFrom,
  resolveTransactionType,
  scaleBaseUnits,
} from '../horizonHistorySource';
import { CreditDataError } from '../CreditDataSource';
import {
  BORROWER,
  CREDIT_CONTRACT_ID,
  HORIZON_URL,
  OTHER_CONTRACT_ID,
  horizonResponse,
  invokeOperation,
  newestFirst,
  nonCreditOperation,
  stubHorizonFetch,
  type StubReply,
} from '../../../test/fixtures/horizonOperations';

function sourceFor(replies: StubReply[], overrides: Record<string, unknown> = {}) {
  const fetchStub = stubHorizonFetch(replies);
  const source = new HorizonCreditHistorySource({
    horizonUrl: HORIZON_URL,
    contractId: CREDIT_CONTRACT_ID,
    fetchImpl: fetchStub.fetchImpl,
    retryDelayMs: 0,
    ...overrides,
  });
  return { source, fetchStub };
}

describe('HorizonCreditHistorySource.listTransactions', () => {
  it('returns only credit-contract invocations across pages, mapped by function name', async () => {
    const pageOne = horizonResponse(
      newestFirst([
        invokeOperation({ seq: 5, functionName: 'draw', amountUnits: 5000, lineId: 'CL-101' }),
        invokeOperation({ seq: 4, functionName: 'repay', amountUnits: 1200, lineId: 'CL-101' }),
        invokeOperation({ seq: 3, functionName: 'transfer', contractId: OTHER_CONTRACT_ID }),
        nonCreditOperation(2),
      ]),
    );
    const pageTwo = horizonResponse(
      newestFirst([
        invokeOperation({ seq: 1, functionName: 'charge_fee', amountUnits: 25, lineId: 'CL-101' }),
        invokeOperation({ seq: 0, functionName: 'accrue_interest', amountUnits: 10.5 }),
      ]),
    );
    const pageThree = horizonResponse([], { hasNext: false });

    const { source, fetchStub } = sourceFor([
      { body: pageOne },
      { body: pageTwo },
      { body: pageThree },
    ]);

    const first = await source.listTransactions(BORROWER, { limit: 2 });
    expect(first.transactions.map((row) => row.type)).toEqual(['Draw', 'Repay']);
    expect(first.transactions[0]).toMatchObject({
      amount: 5000,
      status: 'Completed',
      lineId: 'CL-101',
      txHash: 'txhash0005',
      date: '2025-02-20T12:00:00Z',
    });

    const second = await source.listTransactions(BORROWER, { limit: 2, cursor: first.nextCursor });
    expect(second.transactions.map((row) => row.type)).toEqual(['Fee', 'Interest']);
    expect(second.transactions[1].amount).toBe(10.5);

    // A full page always yields a cursor, even when the next page turns out to
    // be empty; only a short page closes the history off.
    expect(second.nextCursor).not.toBeNull();
    const third = await source.listTransactions(BORROWER, { limit: 2, cursor: second.nextCursor });
    expect(third).toEqual({ transactions: [], nextCursor: null });

    // The first page request must carry no cursor at all; later ones must reuse
    // the opaque paging token handed back by the previous page.
    expect(fetchStub.params(0)).toMatchObject({ order: 'desc', limit: '2', include_failed: 'true' });
    expect(fetchStub.params(0).cursor).toBeUndefined();
    expect(fetchStub.calls).toHaveLength(3);
    expect(fetchStub.params(1).cursor).toBe(first.nextCursor);
    expect(fetchStub.params(2).cursor).toBe(second.nextCursor);
    expect(fetchStub.calls[0]).toContain(`/accounts/${BORROWER}/operations`);
  });

  it('requests the next page while contract filtering starves the page', async () => {
    // Each page carries three operations but only one belongs to the contract.
    const pages = [3, 2, 1].map((seq) =>
      horizonResponse(
        newestFirst([
          nonCreditOperation(seq * 10 + 2),
          invokeOperation({ seq, functionName: 'repay', amountUnits: seq }),
          nonCreditOperation(seq * 10 + 1),
        ]),
      ),
    );

    const { source, fetchStub } = sourceFor(pages.map((body) => ({ body })));
    const page = await source.listTransactions(BORROWER, { limit: 3 });

    expect(page.transactions).toHaveLength(3);
    expect(fetchStub.calls).toHaveLength(3);
  });

  it('stops at five upstream requests and keeps a cursor so history stays reachable', async () => {
    const noise = horizonResponse(
      newestFirst([nonCreditOperation(1), nonCreditOperation(2), nonCreditOperation(3)]),
    );

    const { source, fetchStub } = sourceFor([{ body: noise }]);
    const page = await source.listTransactions(BORROWER, { limit: 3 });

    expect(fetchStub.calls).toHaveLength(MAX_UPSTREAM_REQUESTS_PER_CALL);
    expect(page.transactions).toEqual([]);
    // Dropping the cursor here would make the rest of the ledger unreachable.
    expect(page.nextCursor).not.toBeNull();
  });

  it('marks failed operations as Failed and keeps their hash', async () => {
    const body = horizonResponse(
      newestFirst([
        invokeOperation({
          seq: 9,
          functionName: 'draw',
          amountUnits: 250,
          successful: false,
        }),
      ]),
      { hasNext: false },
    );

    const { source } = sourceFor([{ body }]);
    const page = await source.listTransactions(BORROWER, { limit: 5 });

    expect(page.transactions).toHaveLength(1);
    expect(page.transactions[0]).toMatchObject({ status: 'Failed', txHash: 'txhash0009' });
    expect(page.nextCursor).toBeNull();
  });

  it('pages without duplicates or gaps when a new operation lands mid-pagination', async () => {
    const firstPage = horizonResponse(
      newestFirst([
        invokeOperation({ seq: 6, functionName: 'draw', amountUnits: 100 }),
        invokeOperation({ seq: 5, functionName: 'repay', amountUnits: 50 }),
      ]),
    );
    // Horizon answered page 2 after a newer operation arrived; because the
    // request is cursor-bounded it can only contain older records.
    const secondPage = horizonResponse(
      newestFirst([
        invokeOperation({ seq: 4, functionName: 'repay', amountUnits: 20 }),
        invokeOperation({ seq: 3, functionName: 'charge_fee', amountUnits: 1 }),
      ]),
      { hasNext: false },
    );

    const { source, fetchStub } = sourceFor([{ body: firstPage }, { body: secondPage }]);
    const pageOne = await source.listTransactions(BORROWER, { limit: 2 });
    const pageTwo = await source.listTransactions(BORROWER, {
      limit: 2,
      cursor: pageOne.nextCursor,
    });

    const ids = [...pageOne.transactions, ...pageTwo.transactions].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(fetchStub.params(1).cursor).toBe(pageOne.nextCursor);

    // A record repeated inside one page is still delivered once.
    const duplicated = horizonResponse(
      newestFirst([
        invokeOperation({ seq: 2, functionName: 'repay', amountUnits: 5 }),
        invokeOperation({ seq: 2, functionName: 'repay', amountUnits: 5 }),
      ]),
      { hasNext: false },
    );
    const withDupes = sourceFor([{ body: duplicated }]);
    const deduped = await withDupes.source.listTransactions(BORROWER, { limit: 5 });
    expect(deduped.transactions).toHaveLength(1);
  });

  it('retries a rate limit once and succeeds', async () => {
    const body = horizonResponse(
      newestFirst([invokeOperation({ seq: 1, functionName: 'draw', amountUnits: 10 })]),
      { hasNext: false },
    );

    const { source, fetchStub } = sourceFor([
      { status: 429, body: {} },
      { body },
    ]);
    const page = await source.listTransactions(BORROWER, { limit: 5 });

    expect(fetchStub.calls).toHaveLength(2);
    expect(page.transactions[0].type).toBe('Draw');
  });

  it('fails with network when the single retry is also rate limited', async () => {
    const { source, fetchStub } = sourceFor([{ status: 429, body: {} }]);

    await expect(source.listTransactions(BORROWER, { limit: 5 })).rejects.toMatchObject({
      code: 'network',
    });
    expect(fetchStub.calls).toHaveLength(2);
  });

  it('treats an unfunded account as empty history rather than an error', async () => {
    const { source, fetchStub } = sourceFor([{ status: 404, body: {} }]);

    await expect(source.listTransactions(BORROWER, { limit: 5 })).resolves.toEqual({
      transactions: [],
      nextCursor: null,
    });
    expect(fetchStub.calls).toHaveLength(1);
  });

  it('reports malformed payloads as invalid_response', async () => {
    const notJson = sourceFor([{ raw: '<html>gateway timeout</html>' }]);
    await expect(
      notJson.source.listTransactions(BORROWER, { limit: 5 }),
    ).rejects.toMatchObject({ code: 'invalid_response' });

    const missingRecords = sourceFor([{ body: { _embedded: {} } }]);
    await expect(
      missingRecords.source.listTransactions(BORROWER, { limit: 5 }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('reports a transport failure as network and honours an abort', async () => {
    const fetchImpl = async () => {
      throw new TypeError('fetch failed');
    };
    const source = new HorizonCreditHistorySource({
      horizonUrl: HORIZON_URL,
      contractId: CREDIT_CONTRACT_ID,
      fetchImpl: fetchImpl as never,
    });
    await expect(source.listTransactions(BORROWER, { limit: 5 })).rejects.toMatchObject({
      code: 'network',
    });

    const { source: okSource } = sourceFor([{ body: horizonResponse([]) }]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      okSource.listTransactions(BORROWER, { limit: 5, signal: controller.signal }),
    ).rejects.toBeInstanceOf(CreditDataError);
  });

  it('bounds a slow Horizon reply by the request timeout', async () => {
    const hangingSource = new HorizonCreditHistorySource({
      horizonUrl: HORIZON_URL,
      contractId: CREDIT_CONTRACT_ID,
      fetchImpl: ((_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        })) as never,
    });

    await expect(
      hangingSource.listTransactions(BORROWER, { limit: 5, timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: 'network' });
  });

  it('requires a borrower address', async () => {
    const { source } = sourceFor([]);
    await expect(source.listTransactions('', { limit: 5 })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
});

describe('SorobanCreditDataSource history delegation', () => {
  it('answers listTransactions from the Horizon adapter', async () => {
    const listTransactions = vi.fn().mockResolvedValue({
      transactions: [],
      nextCursor: 'token-1',
    });
    const source = new SorobanCreditDataSource({
      server: { simulateTransaction: vi.fn() } as never,
      contractId: CREDIT_CONTRACT_ID,
      historySource: { listTransactions },
    });

    expect(source.kind).toBe('soroban');
    const page = await source.listTransactions(BORROWER, { cursor: 'token-0', limit: 4 });

    expect(page).toEqual({ transactions: [], nextCursor: 'token-1' });
    expect(listTransactions).toHaveBeenCalledWith(
      BORROWER,
      expect.objectContaining({ cursor: 'token-0', limit: 4, timeoutMs: 15_000 }),
    );
  });

  it('builds a Horizon-backed history reader for the configured contract by default', () => {
    const source = new SorobanCreditDataSource({
      server: { simulateTransaction: vi.fn() } as never,
      contractId: CREDIT_CONTRACT_ID,
    });
    expect(typeof source.listTransactions).toBe('function');
  });
});

describe('Horizon operation mapping', () => {
  it('maps every entrypoint in the lookup table to a transaction type', () => {
    const expected = {
      draw: 'Draw',
      repay: 'Repay',
      charge_fee: 'Fee',
      accrue_interest: 'Interest',
      set_status: 'StatusChange',
    };
    for (const [symbol, type] of Object.entries(expected)) {
      expect(TRANSACTION_TYPE_BY_FUNCTION[symbol]).toBe(type);
    }
  });

  it('reads the entrypoint out of a qualified function field', () => {
    expect(functionSymbolFrom({ function: `${CREDIT_CONTRACT_ID}#Draw` })).toBe('draw');
    expect(functionSymbolFrom({ function: 'repay' })).toBe('repay');
    expect(functionSymbolFrom({})).toBe('');
  });

  it('keeps unrecognised calls visible as lifecycle events', () => {
    expect(resolveTransactionType('governance_transfer')).toBe('StatusChange');
  });

  it('reads named parameters and falls back to positional arguments', () => {
    const named = decodeArguments(
      [
        { key: 'line_id', value_decoded: { str: 'CL-7' } },
        { key: 'amount', value_decoded: { i128: '150000000' } },
      ],
      7,
    );
    expect(named).toEqual({ amount: 15, lineId: 'CL-7' });

    const positional = decodeArguments(
      [{ value_decoded: { str: BORROWER } }, { value_decoded: { u32: 42 } }],
      7,
    );
    expect(positional.amount).toBe(0.0000042);
    expect(positional.lineId).toBeNull();
  });

  it('scales base units without float drift', () => {
    expect(scaleBaseUnits(50_000_000_000n, 7)).toBe(5000);
    expect(scaleBaseUnits(1n, 7)).toBe(0.0000001);
    expect(scaleBaseUnits(-12_345_678n, 7)).toBe(-1.2345678);
    expect(scaleBaseUnits(100n, 0)).toBe(100);
  });
});
