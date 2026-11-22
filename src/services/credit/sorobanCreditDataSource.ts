import {
  rpc,
  Contract,
  Address,
  scValToNative,
  nativeToScVal,
  Account,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import type { CreditLine } from '../../types/creditLine';
import {
  CreditDataError,
  type CreditDataOptions,
  type CreditDataSource,
} from './CreditDataSource';
import { getSorobanConfig, type SorobanCreditConfig } from './config';
import { decodeCreditLine } from './decoder';

export interface SorobanCreditDataSourceOptions {
  rpcUrl?: string;
  networkPassphrase?: string;
  contractId?: string;
  server?: rpc.Server;
  defaultTimeoutMs?: number;
}

const THROWAWAY_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const DEFAULT_TIMEOUT_MS = 15_000;

export class SorobanCreditDataSource implements CreditDataSource {
  private readonly server: rpc.Server;
  private readonly networkPassphrase: string;
  private readonly contractId: string;
  private readonly defaultTimeoutMs: number;

  constructor(options: SorobanCreditDataSourceOptions = {}) {
    const config: SorobanCreditConfig = getSorobanConfig();
    const rpcUrl = options.rpcUrl || config.rpcUrl;
    this.networkPassphrase = options.networkPassphrase || config.networkPassphrase;
    this.contractId = options.contractId || config.contractId;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

    this.server = options.server || new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  }

  /**
   * Helper that runs a read-only transaction simulation with timeout and abort handling.
   */
  private async simulateCall(
    functionName: string,
    args: xdr.ScVal[],
    options?: CreditDataOptions,
  ): Promise<xdr.ScVal> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const callerSignal = options?.signal;

    if (callerSignal?.aborted) {
      throw new CreditDataError('aborted', 'The operation was aborted');
    }

    const dummySource = new Account(THROWAWAY_ACCOUNT, '0');
    const contract = new Contract(this.contractId);
    const operation = contract.call(functionName, ...args);

    const tx = new TransactionBuilder(dummySource, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new CreditDataError('network', `RPC request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const abortPromise = new Promise<never>((_, reject) => {
      if (callerSignal) {
        abortListener = () => {
          reject(new CreditDataError('aborted', 'The operation was aborted'));
        };
        callerSignal.addEventListener('abort', abortListener, { once: true });
      }
    });

    try {
      const simResponse = await Promise.race([
        this.server.simulateTransaction(tx),
        timeoutPromise,
        abortPromise,
      ]);

      if (!simResponse || typeof simResponse !== 'object') {
        throw new CreditDataError('invalid_response', 'Simulation response is invalid or empty');
      }

      if (rpc.Api.isSimulationError(simResponse)) {
        throw new CreditDataError('unavailable', `Simulation error: ${simResponse.error}`, {
          cause: simResponse.error,
        });
      }

      if (!rpc.Api.isSimulationSuccess(simResponse) || !simResponse.result?.retval) {
        const errorCause =
          (simResponse as { error?: unknown }).error ?? 'Simulation unsuccessful';
        throw new CreditDataError(
          'unavailable',
          `Simulation was unsuccessful or returned no return value: ${String(errorCause)}`,
          { cause: errorCause },
        );
      }

      const retval = simResponse.result.retval;
      if (typeof retval === 'string') {
        return xdr.ScVal.fromXDR(retval, 'base64');
      }
      return retval;
    } catch (err) {
      if (err instanceof CreditDataError) {
        throw err;
      }
      if (callerSignal?.aborted) {
        throw new CreditDataError('aborted', 'The operation was aborted');
      }
      throw new CreditDataError(
        'network',
        err instanceof Error ? err.message : 'Soroban RPC transport error',
        { cause: err },
      );
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      if (callerSignal && abortListener) {
        callerSignal.removeEventListener('abort', abortListener);
      }
    }
  }

  async listCreditLines(borrower: string, options?: CreditDataOptions): Promise<CreditLine[]> {
    if (!borrower || typeof borrower !== 'string') {
      throw new CreditDataError('invalid_response', 'Borrower address is required');
    }

    let borrowerScVal: xdr.ScVal;
    try {
      borrowerScVal = new Address(borrower).toScVal();
    } catch (err) {
      throw new CreditDataError('invalid_response', `Invalid borrower address: ${borrower}`, {
        cause: err,
      });
    }

    const retval = await this.simulateCall('get_lines_by_borrower', [borrowerScVal], options);

    let nativeVal: unknown;
    try {
      nativeVal = scValToNative(retval);
    } catch (err) {
      throw new CreditDataError('invalid_response', 'Failed to decode ScVal return value', {
        cause: err,
      });
    }

    if (!Array.isArray(nativeVal)) {
      throw new CreditDataError(
        'invalid_response',
        `Malformed ScVal: expected array of credit lines, got ${typeof nativeVal}`,
      );
    }

    // Losslessly decode each credit line
    return nativeVal.map((item) => decodeCreditLine(item));
  }

  async getCreditLine(id: string, options?: CreditDataOptions): Promise<CreditLine> {
    if (!id || typeof id !== 'string') {
      throw new CreditDataError('invalid_response', 'Credit line id is required');
    }

    let idScVal: xdr.ScVal;
    try {
      idScVal = nativeToScVal(id, { type: 'string' });
    } catch (err) {
      throw new CreditDataError('invalid_response', `Invalid credit line id: ${id}`, {
        cause: err,
      });
    }

    const retval = await this.simulateCall('get_line', [idScVal], options);

    let nativeVal: unknown;
    try {
      nativeVal = scValToNative(retval);
    } catch (err) {
      throw new CreditDataError('invalid_response', 'Failed to decode ScVal return value', {
        cause: err,
      });
    }

    // Option None decodes to null/undefined
    if (nativeVal === null || nativeVal === undefined) {
      throw new CreditDataError('not_found', `Credit line not found: ${id}`);
    }

    return decodeCreditLine(nativeVal);
  }
}
