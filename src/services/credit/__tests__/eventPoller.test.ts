import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Address, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { CREDIT_EVENT_TOPIC, mapCreditEvent, startCreditEventPoller } from '../eventPoller';

const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const BORROWER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const OTHER_BORROWER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const INTERVAL_MS = 1_000;

function symbol(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: 'symbol' });
}

function payload(fields: Record<string, xdr.ScVal>): xdr.ScVal {
  return xdr.ScVal.scvMap(
    Object.entries(fields)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => new xdr.ScMapEntry({ key: symbol(key), val })),
  );
}

function creditEvent(
  id: string,
  name: string,
  fields: Record<string, xdr.ScVal> = {},
  borrower = BORROWER,
  namespace = 'credit',
): rpc.Api.EventResponse {
  return {
    id,
    type: 'contract',
    ledger: 100,
    ledgerClosedAt: '2026-11-23T00:00:00Z',
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: `tx-${id}`,
    topic: [symbol(namespace), symbol(name)],
    value: payload({ borrower: new Address(borrower).toScVal(), ...fields }),
  };
}

function drawEvent(id: string, amount = 25_000_000n, borrower = BORROWER) {
  return creditEvent(id, 'drawn', { amount: nativeToScVal(amount, { type: 'i128' }) }, borrower);
}

function page(events: rpc.Api.EventResponse[], cursor = 'cursor-1'): rpc.Api.GetEventsResponse {
  return {
    events,
    cursor,
    latestLedger: 100,
    oldestLedger: 1,
    latestLedgerCloseTime: '0',
    oldestLedgerCloseTime: '0',
  };
}

function createServer() {
  return {
    getLatestLedger: vi.fn().mockResolvedValue({ id: 'ledger', sequence: 100, protocolVersion: 22 }),
    getEvents: vi.fn().mockResolvedValue(page([])),
  };
}

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('CREDIT_EVENT_TOPIC', () => {
  it('is the base64 XDR of the credit symbol', () => {
    expect(scValToNative(xdr.ScVal.fromXDR(CREDIT_EVENT_TOPIC, 'base64'))).toBe('credit');
  });
});

describe('mapCreditEvent', () => {
  it('maps draw and repay events with decoded amounts', () => {
    expect(mapCreditEvent(drawEvent('e1', 25_000_000n))).toEqual({
      id: 'e1',
      kind: 'draw',
      borrower: BORROWER,
      ledger: 100,
      txHash: 'tx-e1',
      amount: 2.5,
    });
    expect(
      mapCreditEvent(creditEvent('e2', 'repay', { amount: nativeToScVal(10_000_000n, { type: 'i128' }) })),
    ).toMatchObject({ kind: 'repay', amount: 1 });
  });

  it('maps status topics to credit line statuses', () => {
    expect(mapCreditEvent(creditEvent('s1', 'suspend'))).toMatchObject({ kind: 'status', status: 'Suspended' });
    expect(mapCreditEvent(creditEvent('s2', 'closed_v2'))).toMatchObject({ status: 'Closed' });
    expect(mapCreditEvent(creditEvent('s3', 'defaulted'))).toMatchObject({ status: 'Defaulted' });
    expect(
      mapCreditEvent(
        creditEvent('s4', 'reinstate', { target_status: xdr.ScVal.scvVec([symbol('Suspended')]) }),
      ),
    ).toMatchObject({ status: 'Suspended' });
  });

  it('ignores unrelated topics, other namespaces and malformed payloads', () => {
    expect(mapCreditEvent(creditEvent('u1', 'accrue'))).toBeNull();
    expect(mapCreditEvent(creditEvent('u2', 'drawn', {}, BORROWER, 'auction'))).toBeNull();
    expect(mapCreditEvent({ ...drawEvent('u3'), value: symbol('oops') })).toBeNull();
  });
});

describe('startCreditEventPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function start(server = createServer(), onEvents = vi.fn()) {
    const stop = startCreditEventPoller({
      server: server as unknown as rpc.Server,
      contractId: CONTRACT_ID,
      borrower: BORROWER,
      onEvents,
      intervalMs: INTERVAL_MS,
      maxBackoffMs: 4 * INTERVAL_MS,
    });
    return { server, onEvents, stop };
  }

  it('starts from the latest ledger then follows the cursor', async () => {
    const { server, stop } = start();
    await vi.advanceTimersByTimeAsync(0);

    expect(server.getEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ startLedger: 100 }),
    );
    const [{ filters }] = server.getEvents.mock.calls[0];
    expect(filters).toEqual([
      { type: 'contract', contractIds: [CONTRACT_ID], topics: [[CREDIT_EVENT_TOPIC, '*']] },
    ]);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(server.getEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1' }),
    );
    expect(server.getLatestLedger).toHaveBeenCalledTimes(1);
    stop();
  });

  it('emits only events for the borrower and never repeats an event id', async () => {
    const server = createServer();
    server.getEvents
      .mockResolvedValueOnce(page([drawEvent('a'), drawEvent('b', 1n, OTHER_BORROWER)]))
      .mockResolvedValueOnce(page([drawEvent('a'), creditEvent('c', 'suspend')], 'cursor-2'));
    const { onEvents, stop } = start(server);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(onEvents).toHaveBeenCalledTimes(2);
    expect(onEvents.mock.calls[0][0].map((e: { id: string }) => e.id)).toEqual(['a']);
    expect(onEvents.mock.calls[1][0].map((e: { id: string }) => e.id)).toEqual(['c']);
    stop();
  });

  it('does not start a second poll while one is in flight', async () => {
    const server = createServer();
    server.getEvents.mockReturnValue(new Promise(() => undefined));
    const { stop } = start(server);

    await vi.advanceTimersByTimeAsync(10 * INTERVAL_MS);
    setVisibility('hidden');
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(10 * INTERVAL_MS);

    expect(server.getEvents).toHaveBeenCalledTimes(1);
    stop();
  });

  it('backs off exponentially on failures and resets after a success', async () => {
    const server = createServer();
    server.getEvents
      .mockRejectedValueOnce(new Error('rpc down'))
      .mockRejectedValueOnce(new Error('rpc down'))
      .mockRejectedValueOnce(new Error('rpc down'))
      .mockResolvedValue(page([]));
    const { stop } = start(server);

    await vi.advanceTimersByTimeAsync(0);
    expect(server.getEvents).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2 * INTERVAL_MS - 1);
    expect(server.getEvents).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.getEvents).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(4 * INTERVAL_MS);
    expect(server.getEvents).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(4 * INTERVAL_MS);
    expect(server.getEvents).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(server.getEvents).toHaveBeenCalledTimes(5);
    stop();
  });

  it('pauses while the page is hidden and resumes when visible', async () => {
    const { server, stop } = start();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.getEvents).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(10 * INTERVAL_MS);
    expect(server.getEvents).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.getEvents).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does not poll at all when started in a hidden tab', async () => {
    visibility = 'hidden';
    const { server, stop } = start();

    await vi.advanceTimersByTimeAsync(10 * INTERVAL_MS);

    expect(server.getEvents).not.toHaveBeenCalled();
    stop();
  });

  it('stops polling and drops results after stop', async () => {
    const server = createServer();
    let resolvePage: (value: rpc.Api.GetEventsResponse) => void = () => undefined;
    server.getEvents.mockReturnValueOnce(new Promise((resolve) => { resolvePage = resolve; }));
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const { onEvents, stop } = start(server);

    await vi.advanceTimersByTimeAsync(0);
    stop();
    resolvePage(page([drawEvent('late')]));
    await vi.advanceTimersByTimeAsync(10 * INTERVAL_MS);

    expect(onEvents).not.toHaveBeenCalled();
    expect(server.getEvents).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeListener.mockRestore();
  });
});
