import { describe, expect, it, vi } from 'vitest';
import { Account, rpc, nativeToScVal } from '@stellar/stellar-sdk';
import {
  SorobanWriteClient,
  SorobanWriteError,
  MockSorobanWriteClient,
  amountToStroops,
} from '../sorobanWriteClient';
import { WalletConnectError } from '../../../utils/wallet';
import { parseMoney } from '../../../utils/money';

const TEST_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const TEST_CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const TEST_PASSPHRASE = 'Test SDF Network ; September 2015';
const TEST_TX_HASH = 'a'.repeat(64);

function makeSuccessSimResponse() {
  return {
    id: 'sim-1',
    latestLedger: 1000,
    minResourceFee: '100',
    transactionData: '',
    result: {
      auth: [],
      retval: nativeToScVal(true),
    },
  };
}

function makeStubServer(overrides: Partial<Record<keyof rpc.Server, unknown>> = {}) {
  const account = new Account(TEST_SOURCE, '100');
  return {
    getAccount: vi.fn().mockResolvedValue(account),
    simulateTransaction: vi.fn().mockResolvedValue(makeSuccessSimResponse()),
    sendTransaction: vi.fn().mockResolvedValue({
      status: 'PENDING',
      hash: TEST_TX_HASH,
      latestLedger: 1001,
      latestLedgerCloseTime: 1700000000,
    }),
    getTransaction: vi.fn().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.SUCCESS,
      txHash: TEST_TX_HASH,
    }),
    ...overrides,
  } as unknown as rpc.Server;
}

describe('amountToStroops', () => {
  it('converts Money, string, and number to exact 7-decimal stroops without floats', () => {
    expect(amountToStroops('100')).toBe(1_000_000_000n);
    expect(amountToStroops('12.3456789')).toBe(123_456_789n);
    expect(amountToStroops(250.5)).toBe(2_505_000_000n);
    expect(amountToStroops(parseMoney('42.5', 7, 'USDC'))).toBe(425_000_000n);
  });

  it('rejects zero, negative, or invalid amounts', () => {
    expect(() => amountToStroops('0')).toThrow(SorobanWriteError);
    expect(() => amountToStroops('-10')).toThrow(SorobanWriteError);
    expect(() => amountToStroops(0)).toThrow(SorobanWriteError);
    expect(() => amountToStroops('abc')).toThrow(SorobanWriteError);
  });
});

describe('SorobanWriteClient', () => {
  it('builds, simulates, assembles, signs, submits, and polls to SUCCESS', async () => {
    const server = makeStubServer();
    const assembleSpy = vi
      .spyOn(rpc, 'assembleTransaction')
      .mockImplementation((tx) => ({ build: () => tx }) as unknown as ReturnType<typeof rpc.assembleTransaction>);
    const signMock = vi.fn().mockImplementation(async (txXdr: string) => txXdr);

    const client = new SorobanWriteClient({
      server,
      contractId: TEST_CONTRACT_ID,
      networkPassphrase: TEST_PASSPHRASE,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    const result = await client.drawCredit('CL-001', '500.25', {
      source: TEST_SOURCE,
      sign: signMock,
    });

    expect(result).toEqual({ txHash: TEST_TX_HASH, status: 'SUCCESS' });
    expect(server.getAccount).toHaveBeenCalledWith(TEST_SOURCE);
    expect(server.simulateTransaction).toHaveBeenCalledTimes(1);
    expect(assembleSpy).toHaveBeenCalledTimes(1);
    expect(signMock).toHaveBeenCalledTimes(1);
    expect(server.sendTransaction).toHaveBeenCalledTimes(1);
    expect(server.getTransaction).toHaveBeenCalledWith(TEST_TX_HASH);

    assembleSpy.mockRestore();
  });

  it('throws classified simulation_error and does not sign or submit on simulation failure', async () => {
    const server = makeStubServer({
      simulateTransaction: vi.fn().mockResolvedValue({
        id: 'sim-err',
        latestLedger: 1000,
        error: 'HostError: Error(Contract, #3)',
      }),
    });
    const signMock = vi.fn();

    const client = new SorobanWriteClient({
      server,
      contractId: TEST_CONTRACT_ID,
      networkPassphrase: TEST_PASSPHRASE,
    });

    await expect(
      client.drawCredit('CL-001', '100', { source: TEST_SOURCE, sign: signMock }),
    ).rejects.toMatchObject({
      name: 'SorobanWriteError',
      code: 'simulation_error',
      retryable: false,
      message: 'HostError: Error(Contract, #3)',
    });

    expect(signMock).not.toHaveBeenCalled();
    expect(server.sendTransaction).not.toHaveBeenCalled();
  });

  it('throws classified user_rejected and does not submit when wallet rejects signature', async () => {
    const server = makeStubServer();
    const assembleSpy = vi
      .spyOn(rpc, 'assembleTransaction')
      .mockImplementation((tx) => ({ build: () => tx }) as unknown as ReturnType<typeof rpc.assembleTransaction>);
    const walletSigner = vi
      .fn()
      .mockRejectedValue(
        new WalletConnectError('user_rejected', 'User declined signature'),
      );

    const client = new SorobanWriteClient({
      server,
      contractId: TEST_CONTRACT_ID,
      networkPassphrase: TEST_PASSPHRASE,
      signTransaction: walletSigner,
    });

    await expect(
      client.repayCredit('CL-001', '250', {
        source: TEST_SOURCE,
        walletType: 'freighter',
      }),
    ).rejects.toMatchObject({
      name: 'SorobanWriteError',
      code: 'user_rejected',
      retryable: false,
    });

    expect(server.sendTransaction).not.toHaveBeenCalled();
    assembleSpy.mockRestore();
  });

  it('polls NOT_FOUND then resolves on SUCCESS', async () => {
    const getTransaction = vi
      .fn()
      .mockResolvedValueOnce({ status: rpc.Api.GetTransactionStatus.NOT_FOUND })
      .mockResolvedValueOnce({ status: rpc.Api.GetTransactionStatus.NOT_FOUND })
      .mockResolvedValueOnce({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        txHash: TEST_TX_HASH,
      });
    const server = makeStubServer({ getTransaction });
    const assembleSpy = vi
      .spyOn(rpc, 'assembleTransaction')
      .mockImplementation((tx) => ({ build: () => tx }) as unknown as ReturnType<typeof rpc.assembleTransaction>);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const client = new SorobanWriteClient({
      server,
      contractId: TEST_CONTRACT_ID,
      networkPassphrase: TEST_PASSPHRASE,
      pollIntervalMs: 10,
      pollTimeoutMs: 5_000,
      sleep,
    });

    const result = await client.repayCredit('CL-001', '100', {
      source: TEST_SOURCE,
      sign: async (txXdr) => txXdr,
    });

    expect(result).toEqual({ txHash: TEST_TX_HASH, status: 'SUCCESS' });
    expect(getTransaction).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    assembleSpy.mockRestore();
  });

  it('throws retryable timeout error when polling exceeds pollTimeoutMs', async () => {
    const getTransaction = vi
      .fn()
      .mockResolvedValue({ status: rpc.Api.GetTransactionStatus.NOT_FOUND });
    const server = makeStubServer({ getTransaction });
    const assembleSpy = vi
      .spyOn(rpc, 'assembleTransaction')
      .mockImplementation((tx) => ({ build: () => tx }) as unknown as ReturnType<typeof rpc.assembleTransaction>);

    let now = 1_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const sleep = vi.fn().mockImplementation(async (ms: number) => {
      now += ms;
    });

    const client = new SorobanWriteClient({
      server,
      contractId: TEST_CONTRACT_ID,
      networkPassphrase: TEST_PASSPHRASE,
      pollIntervalMs: 500,
      pollTimeoutMs: 1_000,
      sleep,
    });

    await expect(
      client.drawCredit('CL-001', '100', {
        source: TEST_SOURCE,
        sign: async (txXdr) => txXdr,
      }),
    ).rejects.toMatchObject({
      name: 'SorobanWriteError',
      code: 'timeout',
      retryable: true,
    });

    nowSpy.mockRestore();
    assembleSpy.mockRestore();
  });

  it('throws terminal transaction_failed error when ledger returns FAILED', async () => {
    const server = makeStubServer({
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.FAILED,
        txHash: TEST_TX_HASH,
      }),
    });
    const assembleSpy = vi
      .spyOn(rpc, 'assembleTransaction')
      .mockImplementation((tx) => ({ build: () => tx }) as unknown as ReturnType<typeof rpc.assembleTransaction>);

    const client = new SorobanWriteClient({
      server,
      contractId: TEST_CONTRACT_ID,
      networkPassphrase: TEST_PASSPHRASE,
    });

    await expect(
      client.drawCredit('CL-001', '100', {
        source: TEST_SOURCE,
        sign: async (txXdr) => txXdr,
      }),
    ).rejects.toMatchObject({
      name: 'SorobanWriteError',
      code: 'transaction_failed',
      retryable: false,
    });

    assembleSpy.mockRestore();
  });

  it('deduplicates concurrent and repeated submissions sharing an idempotencyKey', async () => {
    const server = makeStubServer();
    const assembleSpy = vi
      .spyOn(rpc, 'assembleTransaction')
      .mockImplementation((tx) => ({ build: () => tx }) as unknown as ReturnType<typeof rpc.assembleTransaction>);

    const client = new SorobanWriteClient({
      server,
      contractId: TEST_CONTRACT_ID,
      networkPassphrase: TEST_PASSPHRASE,
    });

    const [first, second] = await Promise.all([
      client.drawCredit('CL-001', '100', {
        source: TEST_SOURCE,
        sign: async (txXdr) => txXdr,
        idempotencyKey: 'idem_test_1',
      }),
      client.drawCredit('CL-001', '100', {
        source: TEST_SOURCE,
        sign: async (txXdr) => txXdr,
        idempotencyKey: 'idem_test_1',
      }),
    ]);

    const third = await client.drawCredit('CL-001', '100', {
      source: TEST_SOURCE,
      sign: async (txXdr) => txXdr,
      idempotencyKey: 'idem_test_1',
    });

    expect(first).toEqual({ txHash: TEST_TX_HASH, status: 'SUCCESS' });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(server.sendTransaction).toHaveBeenCalledTimes(1);
    assembleSpy.mockRestore();
  });
});

describe('MockSorobanWriteClient', () => {
  it('returns deterministic hashes without Math.random and respects idempotencyKey', async () => {
    const client = new MockSorobanWriteClient();
    const r1 = await client.drawCredit('CL-001', '100', { idempotencyKey: 'idem_a' });
    const r2 = await client.drawCredit('CL-001', '100', { idempotencyKey: 'idem_a' });
    expect(r1.status).toBe('SUCCESS');
    expect(r1.txHash).toHaveLength(64);
    expect(r2).toEqual(r1);
  });
});
