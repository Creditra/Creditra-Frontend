import {
  rpc,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';
import { getCreditDataSourceType, getSorobanConfig } from './config';
import { parseMoney, type Money } from '../../utils/money';
import {
  signTransaction,
  WalletConnectError,
  type WalletType,
} from '../../utils/wallet';

export const STROOP_DECIMALS = 7;

export type WriteTxStatus = 'SUCCESS';

export interface WriteTxResult {
  txHash: string;
  status: WriteTxStatus;
}

export type SorobanWriteErrorCode =
  | 'user_rejected'
  | 'simulation_error'
  | 'transaction_failed'
  | 'timeout'
  | 'network_error'
  | 'wallet_not_connected'
  | 'invalid_amount';

export class SorobanWriteError extends Error {
  readonly code: SorobanWriteErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    code: SorobanWriteErrorCode,
    message: string,
    options?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message);
    this.name = 'SorobanWriteError';
    this.code = code;
    this.retryable =
      options?.retryable ?? (code === 'timeout' || code === 'network_error');
    this.cause = options?.cause;
    Object.setPrototypeOf(this, SorobanWriteError.prototype);
  }
}

export interface SubmitContractCallParams {
  method: string;
  args: xdr.ScVal[];
  source: string;
  walletType?: WalletType;
  /** Optional custom signer; defaults to `signTransaction(walletType, xdr, networkPassphrase)`. */
  sign?: (txXdr: string, networkPassphrase: string) => Promise<string>;
  /** Optional idempotency key to prevent duplicate submissions for the same draft. */
  idempotencyKey?: string;
}

export interface CreditWriteOptions {
  /** Connected Stellar public key (G...). Required for live Soroban writes. */
  source?: string;
  /** Connected wallet type. Required for live Soroban writes unless `sign` is provided. */
  walletType?: WalletType;
  /** Optional custom signer override. */
  sign?: (txXdr: string, networkPassphrase: string) => Promise<string>;
  /** Optional idempotency key to prevent duplicate submissions for the same draft. */
  idempotencyKey?: string;
}

export interface SorobanWriteClientOptions {
  rpcUrl?: string;
  networkPassphrase?: string;
  contractId?: string;
  server?: rpc.Server;
  /** Base fee in stroops for building the initial transaction before simulation. Defaults to '100'. */
  baseFee?: string;
  /** Transaction timeout in seconds. Defaults to 30. */
  txTimeoutSeconds?: number;
  /** Interval between `getTransaction` polls in ms. Defaults to 1000. */
  pollIntervalMs?: number;
  /** Maximum time to wait for transaction confirmation in ms. Defaults to 30000. */
  pollTimeoutMs?: number;
  /** Custom sleep function for deterministic testing. */
  sleep?: (ms: number) => Promise<void>;
  /** Custom wallet signer for testing. */
  signTransaction?: (
    type: WalletType,
    txXdr: string,
    networkPassphrase: string,
  ) => Promise<string>;
}

export interface CreditWriteClient {
  submitContractCall(params: SubmitContractCallParams): Promise<WriteTxResult>;
  drawCredit(
    lineId: string,
    amount: Money | string | number,
    options?: CreditWriteOptions,
  ): Promise<WriteTxResult>;
  repayCredit(
    lineId: string,
    amount: Money | string | number,
    options?: CreditWriteOptions,
  ): Promise<WriteTxResult>;
}

const DEFAULT_BASE_FEE = '100';
const DEFAULT_TX_TIMEOUT_SECONDS = 30;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_POLL_TIMEOUT_MS = 30_000;

/**
 * Convert a `Money`, decimal string, or number to exact stroops (`bigint`, 7 decimals)
 * using `src/utils/money.ts` — never floating-point multiplication.
 */
export function amountToStroops(amount: Money | string | number): bigint {
  try {
    let units: bigint;
    if (typeof amount === 'object' && amount !== null && 'units' in amount) {
      if (amount.decimals === STROOP_DECIMALS) {
        units = amount.units;
      } else if (amount.decimals < STROOP_DECIMALS) {
        units = amount.units * 10n ** BigInt(STROOP_DECIMALS - amount.decimals);
      } else {
        units = amount.units / 10n ** BigInt(amount.decimals - STROOP_DECIMALS);
      }
    } else if (typeof amount === 'string') {
      units = parseMoney(amount, STROOP_DECIMALS, 'USDC').units;
    } else if (typeof amount === 'number') {
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new SorobanWriteError('invalid_amount', 'Amount must be a positive number.');
      }
      units = parseMoney(amount.toFixed(STROOP_DECIMALS), STROOP_DECIMALS, 'USDC').units;
    } else {
      throw new SorobanWriteError('invalid_amount', 'Invalid amount.');
    }

    if (units <= 0n) {
      throw new SorobanWriteError('invalid_amount', 'Amount must be greater than zero.');
    }
    return units;
  } catch (err) {
    if (err instanceof SorobanWriteError) {
      throw err;
    }
    throw new SorobanWriteError(
      'invalid_amount',
      err instanceof Error ? err.message : 'Invalid amount.',
      { cause: err },
    );
  }
}

function deterministicHexHash(input: string): string {
  // Deterministic 64-char hex string (Stellar tx hash length) with no Math.random()
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= ch + ((h2 << 6) >>> 0) + (h2 >>> 2);
    h2 >>>= 0;
  }
  const part1 = h1.toString(16).padStart(8, '0');
  const part2 = h2.toString(16).padStart(8, '0');
  return `${part1}${part2}`.repeat(4);
}

export class SorobanWriteClient implements CreditWriteClient {
  readonly server: rpc.Server;
  readonly contractId: string;
  private readonly networkPassphrase: string;
  private readonly baseFee: string;
  private readonly txTimeoutSeconds: number;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly walletSigner: (
    type: WalletType,
    txXdr: string,
    networkPassphrase: string,
  ) => Promise<string>;
  private readonly inFlightByKey = new Map<string, Promise<WriteTxResult>>();
  private readonly completedByKey = new Map<string, WriteTxResult>();

  constructor(options: SorobanWriteClientOptions = {}) {
    const config = getSorobanConfig();
    const rpcUrl = options.rpcUrl || config.rpcUrl;
    this.networkPassphrase = options.networkPassphrase || config.networkPassphrase;
    this.contractId = options.contractId || config.contractId;
    this.baseFee = options.baseFee ?? DEFAULT_BASE_FEE;
    this.txTimeoutSeconds = options.txTimeoutSeconds ?? DEFAULT_TX_TIMEOUT_SECONDS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
    this.sleep =
      options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.walletSigner = options.signTransaction ?? signTransaction;
    this.server =
      options.server ||
      new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  }

  async submitContractCall(params: SubmitContractCallParams): Promise<WriteTxResult> {
    const { idempotencyKey } = params;
    if (idempotencyKey) {
      const completed = this.completedByKey.get(idempotencyKey);
      if (completed) {
        return completed;
      }
      const inFlight = this.inFlightByKey.get(idempotencyKey);
      if (inFlight) {
        return inFlight;
      }
    }

    const promise = this.executeContractCall(params)
      .then((result) => {
        if (idempotencyKey) {
          this.completedByKey.set(idempotencyKey, result);
        }
        return result;
      })
      .finally(() => {
        if (idempotencyKey) {
          this.inFlightByKey.delete(idempotencyKey);
        }
      });

    if (idempotencyKey) {
      this.inFlightByKey.set(idempotencyKey, promise);
    }

    return promise;
  }

  private async executeContractCall(
    params: SubmitContractCallParams,
  ): Promise<WriteTxResult> {
    const { method, args, source, walletType, sign } = params;

    if (!source) {
      throw new SorobanWriteError(
        'wallet_not_connected',
        'Connect your Stellar wallet before submitting this transaction.',
      );
    }

    if (!sign && !walletType) {
      throw new SorobanWriteError(
        'wallet_not_connected',
        'A connected wallet is required to sign this transaction.',
      );
    }

    // 1. Load source account
    let account: Awaited<ReturnType<rpc.Server['getAccount']>>;
    try {
      account = await this.server.getAccount(source);
    } catch (err) {
      throw new SorobanWriteError(
        'network_error',
        err instanceof Error ? err.message : 'Failed to load Stellar source account.',
        { retryable: true, cause: err },
      );
    }

    // 2. Build contract invocation transaction
    const contract = new Contract(this.contractId);
    const tx = new TransactionBuilder(account, {
      fee: this.baseFee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(this.txTimeoutSeconds)
      .build();

    // 3. Simulate transaction
    let simResponse: Awaited<ReturnType<rpc.Server['simulateTransaction']>>;
    try {
      simResponse = await this.server.simulateTransaction(tx);
    } catch (err) {
      throw new SorobanWriteError(
        'network_error',
        err instanceof Error ? err.message : 'Failed to simulate Soroban transaction.',
        { retryable: true, cause: err },
      );
    }

    if (rpc.Api.isSimulationError(simResponse)) {
      throw new SorobanWriteError(
        'simulation_error',
        simResponse.error || 'Transaction simulation failed.',
        { retryable: false, cause: simResponse },
      );
    }

    if (!rpc.Api.isSimulationSuccess(simResponse)) {
      const errMsg =
        (simResponse as { error?: string }).error || 'Transaction simulation failed.';
      throw new SorobanWriteError('simulation_error', errMsg, {
        retryable: false,
        cause: simResponse,
      });
    }

    // 4. Assemble transaction with footprint & auth
    const assembledTx = rpc.assembleTransaction(tx, simResponse).build();

    // 5. Request wallet signature
    let signedXdr: string;
    try {
      signedXdr = sign
        ? await sign(assembledTx.toXDR(), this.networkPassphrase)
        : await this.walletSigner(walletType!, assembledTx.toXDR(), this.networkPassphrase);
    } catch (err) {
      if (err instanceof WalletConnectError && err.type === 'user_rejected') {
        throw new SorobanWriteError('user_rejected', err.message, {
          retryable: false,
          cause: err,
        });
      }
      if (err instanceof SorobanWriteError) {
        throw err;
      }
      throw new SorobanWriteError(
        'network_error',
        err instanceof Error ? err.message : 'Failed to sign transaction.',
        { retryable: true, cause: err },
      );
    }

    // 6. Submit signed transaction
    const signedTx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    let sendResponse: Awaited<ReturnType<rpc.Server['sendTransaction']>>;
    try {
      sendResponse = await this.server.sendTransaction(signedTx);
    } catch (err) {
      throw new SorobanWriteError(
        'network_error',
        err instanceof Error ? err.message : 'Failed to submit transaction to Soroban RPC.',
        { retryable: true, cause: err },
      );
    }

    if (sendResponse.status === 'ERROR') {
      throw new SorobanWriteError(
        'transaction_failed',
        'Transaction was rejected by the Stellar network.',
        { retryable: false, cause: sendResponse },
      );
    }

    if (sendResponse.status === 'TRY_AGAIN_LATER') {
      throw new SorobanWriteError(
        'network_error',
        'Network is busy. Please try again shortly.',
        { retryable: true, cause: sendResponse },
      );
    }

    const txHash = sendResponse.hash;

    // 7. Poll getTransaction until SUCCESS / FAILED / timeout
    const deadline = Date.now() + this.pollTimeoutMs;

    while (true) {
      let txResponse: Awaited<ReturnType<rpc.Server['getTransaction']>>;
      try {
        txResponse = await this.server.getTransaction(txHash);
      } catch (err) {
        throw new SorobanWriteError(
          'network_error',
          err instanceof Error ? err.message : 'Failed to poll transaction status.',
          { retryable: true, cause: err },
        );
      }

      if (txResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return { txHash, status: 'SUCCESS' };
      }

      if (txResponse.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new SorobanWriteError(
          'transaction_failed',
          'Transaction failed on the Stellar ledger.',
          { retryable: false, cause: txResponse },
        );
      }

      // NOT_FOUND — keep polling until deadline
      if (Date.now() >= deadline) {
        throw new SorobanWriteError(
          'timeout',
          `Transaction confirmation timed out after ${this.pollTimeoutMs}ms.`,
          { retryable: true },
        );
      }

      await this.sleep(this.pollIntervalMs);
    }
  }

  async drawCredit(
    lineId: string,
    amount: Money | string | number,
    options: CreditWriteOptions = {},
  ): Promise<WriteTxResult> {
    const stroops = amountToStroops(amount);
    const args = [
      nativeToScVal(lineId, { type: 'string' }),
      nativeToScVal(stroops, { type: 'i128' }),
    ];
    return this.submitContractCall({
      method: 'draw',
      args,
      source: options.source ?? '',
      walletType: options.walletType,
      sign: options.sign,
      idempotencyKey: options.idempotencyKey,
    });
  }

  async repayCredit(
    lineId: string,
    amount: Money | string | number,
    options: CreditWriteOptions = {},
  ): Promise<WriteTxResult> {
    const stroops = amountToStroops(amount);
    const args = [
      nativeToScVal(lineId, { type: 'string' }),
      nativeToScVal(stroops, { type: 'i128' }),
    ];
    return this.submitContractCall({
      method: 'repay',
      args,
      source: options.source ?? '',
      walletType: options.walletType,
      sign: options.sign,
      idempotencyKey: options.idempotencyKey,
    });
  }
}

export class MockSorobanWriteClient implements CreditWriteClient {
  private readonly completedByKey = new Map<string, WriteTxResult>();
  private counter = 0;

  async submitContractCall(params: SubmitContractCallParams): Promise<WriteTxResult> {
    if (params.idempotencyKey) {
      const existing = this.completedByKey.get(params.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    this.counter += 1;
    const seed = params.idempotencyKey
      ? `${params.method}:${params.idempotencyKey}`
      : `${params.method}:${params.source}:${this.counter}`;
    const result: WriteTxResult = {
      txHash: deterministicHexHash(seed),
      status: 'SUCCESS',
    };

    if (params.idempotencyKey) {
      this.completedByKey.set(params.idempotencyKey, result);
    }
    return result;
  }

  async drawCredit(
    lineId: string,
    amount: Money | string | number,
    options: CreditWriteOptions = {},
  ): Promise<WriteTxResult> {
    const stroops = amountToStroops(amount);
    return this.submitContractCall({
      method: 'draw',
      args: [
        nativeToScVal(lineId, { type: 'string' }),
        nativeToScVal(stroops, { type: 'i128' }),
      ],
      source: options.source ?? 'mock',
      walletType: options.walletType,
      idempotencyKey: options.idempotencyKey,
    });
  }

  async repayCredit(
    lineId: string,
    amount: Money | string | number,
    options: CreditWriteOptions = {},
  ): Promise<WriteTxResult> {
    const stroops = amountToStroops(amount);
    return this.submitContractCall({
      method: 'repay',
      args: [
        nativeToScVal(lineId, { type: 'string' }),
        nativeToScVal(stroops, { type: 'i128' }),
      ],
      source: options.source ?? 'mock',
      walletType: options.walletType,
      idempotencyKey: options.idempotencyKey,
    });
  }
}

let customWriteClient: CreditWriteClient | null = null;
let defaultSorobanClient: SorobanWriteClient | null = null;
let defaultMockClient: MockSorobanWriteClient | null = null;

/**
 * Returns the active credit write client based on `VITE_CREDIT_DATA_SOURCE`:
 * - `'soroban'` -> `SorobanWriteClient`
 * - `'mock'` (or unset) -> `MockSorobanWriteClient`
 */
export function getCreditWriteClient(): CreditWriteClient {
  if (customWriteClient) {
    return customWriteClient;
  }
  if (getCreditDataSourceType() === 'soroban') {
    if (!defaultSorobanClient) {
      defaultSorobanClient = new SorobanWriteClient();
    }
    return defaultSorobanClient;
  }
  if (!defaultMockClient) {
    defaultMockClient = new MockSorobanWriteClient();
  }
  return defaultMockClient;
}

/**
 * Override the active write client (for tests). Pass `null` to restore default selection.
 */
export function setCreditWriteClientForTesting(client: CreditWriteClient | null): void {
  customWriteClient = client;
}

export async function drawCredit(
  lineId: string,
  amount: Money | string | number,
  options?: CreditWriteOptions,
): Promise<WriteTxResult> {
  return getCreditWriteClient().drawCredit(lineId, amount, options);
}

export async function repayCredit(
  lineId: string,
  amount: Money | string | number,
  options?: CreditWriteOptions,
): Promise<WriteTxResult> {
  return getCreditWriteClient().repayCredit(lineId, amount, options);
}
