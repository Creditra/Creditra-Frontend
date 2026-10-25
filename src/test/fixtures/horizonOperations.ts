import { StrKey, nativeToScVal } from '@stellar/stellar-sdk';

/**
 * Recorded Horizon operation fixtures for the credit transaction history
 * adapter. Shapes follow `GET {horizon}/accounts/{address}/operations`, where
 * a Soroban call surfaces as `type: "invoke_host_function"` with the invoked
 * contract, the entrypoint symbol and the arguments as base64 `ScVal` XDR.
 */

export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const CREDIT_CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

/** Real strkeys: the adapter rejects anything that is not shaped like one. */
export const BORROWER = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(3));

/** A second, structurally valid contract address for cross-contract filtering. */
export const OTHER_CONTRACT_ID = StrKey.encodeContract(new Uint8Array(32).fill(9));

/** One unit of the settlement token, i.e. `amount` in UI terms is `x * 10^7`. */
export const TOKEN_DECIMALS = 7;

export function baseUnits(units: number): bigint {
  return BigInt(Math.round(units * 10 ** TOKEN_DECIMALS));
}

function toXdr(value: string, type: 'i128' | 'string'): string {
  const scVal =
    type === 'i128'
      ? nativeToScVal(BigInt(value), { type: 'i128' })
      : nativeToScVal(new Uint8Array(new TextEncoder().encode(value)), { type: 'string' });
  return scVal.toXDR('base64');
}

export interface InvokeOptions {
  /** Sequence number; drives both `id` and `paging_token`. */
  seq: number;
  functionName: string;
  contractId?: string;
  amountUnits?: number | string;
  lineId?: string;
  successful?: boolean;
  createdAt?: string;
  /** Escape hatch for records the helpers above cannot express. */
  parameters?: unknown;
  operationOverrides?: Record<string, unknown>;
}

const LEDGER = 2_100_000_000_000_000n;

/** Builds a `invoke_host_function` operation record as Horizon returns it. */
export function invokeOperation(options: InvokeOptions): Record<string, unknown> {
  const seq = BigInt(options.seq);
  const token = `${LEDGER + seq}-00000${options.seq}`;
  const transactionHash = `txhash${String(options.seq).padStart(4, '0')}`;
  const amountBaseUnits =
    options.amountUnits === undefined
      ? undefined
      : typeof options.amountUnits === 'string'
        ? options.amountUnits
        : baseUnits(options.amountUnits).toString();

  const parameters: unknown[] = [];
  if (options.lineId !== undefined) {
    parameters.push({
      key: 'line_id',
      value: toXdr(options.lineId, 'string'),
      value_decoded: { str: options.lineId },
    });
  }
  if (amountBaseUnits !== undefined) {
    parameters.push({
      key: 'amount',
      value: toXdr(amountBaseUnits, 'i128'),
      value_decoded: { i128: amountBaseUnits },
    });
  }

  return {
    id: token,
    paging_token: token,
    transaction_hash: transactionHash,
    source_account: BORROWER,
    type: 'invoke_host_function',
    type_i: 28,
    transaction_successful: options.successful ?? true,
    created_at: options.createdAt ?? '2025-02-20T12:00:00Z',
    contract_id: options.contractId ?? CREDIT_CONTRACT_ID,
    function: options.functionName,
    parameters: options.parameters === undefined ? parameters : options.parameters,
    arguments:
      options.parameters === undefined
        ? parameters.map((parameter) => (parameter as { value: string }).value)
        : undefined,
    _links: {
      self: {
        href: `${HORIZON_URL}/accounts/${BORROWER}/operations/${token}`,
      },
      transaction: {
        href: `${HORIZON_URL}/transactions/${transactionHash}`,
      },
    },
    ...options.operationOverrides,
  };
}

/** A payment-ish operation the adapter must skip without dropping the page. */
export function nonCreditOperation(seq: number, type = 'payment'): Record<string, unknown> {
  const token = `${LEDGER + BigInt(seq)}-00001${seq}`;
  return {
    id: token,
    paging_token: token,
    transaction_hash: `other${seq}`,
    source_account: BORROWER,
    type,
    type_i: type === 'payment' ? 1 : 0,
    transaction_successful: true,
    created_at: '2025-02-19T12:00:00Z',
    _links: { self: { href: `${HORIZON_URL}/operations/${token}` } },
  };
}

/** Wraps records in the paged collection envelope Horizon replies with. */
export function horizonResponse(
  records: Array<Record<string, unknown>>,
  options: { hasNext?: boolean } = {},
): Record<string, unknown> {
  const selfHref = `${HORIZON_URL}/accounts/${BORROWER}/operations?order=desc&limit=3`;
  return {
    _links: {
      self: { href: selfHref },
      next:
        options.hasNext === false
          ? undefined
          : { href: `${selfHref}&cursor=${records.at(-1)?.paging_token ?? '0'}` },
      prev: { href: selfHref },
    },
    _embedded: { records },
  };
}

/** Horizon's `order=desc` puts the newest operation first. */
export function newestFirst(
  records: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return [...records].sort((a, b) =>
    String(b.paging_token).localeCompare(String(a.paging_token), undefined, { numeric: true }),
  );
}

export interface StubReply {
  status?: number;
  /** Sent as the parsed JSON body when given, otherwise `body` is returned raw. */
  body?: unknown;
  raw?: string;
}

/**
 * Minimal `fetch` stand-in that answers from a queue and records every URL it
 * was asked for. A queue shorter than the calls made repeats the last reply.
 */
export function stubHorizonFetch(replies: StubReply[]) {
  const calls: string[] = [];
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(url);
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    const status = reply.status ?? 200;
    const body = reply.raw ?? JSON.stringify(reply.body ?? {});

    const signal = init?.signal;
    if (signal) {
      // Mirror a real transport: an aborted request never produces a response.
      if (signal.aborted) throw new DOMException('The operation was aborted', 'AbortError');
      await new Promise<void>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), {
          once: true,
        });
        setTimeout(resolve, 0);
      });
    }

    return new Response(status === 204 ? null : body, {
      status,
      headers: { 'Content-Type': 'application/hal+json' },
    });
  };

  return {
    calls,
    fetchImpl: fetchImpl as unknown as (url: string, init?: RequestInit) => Promise<Response>,
    /** Parsed query params of the nth request. */
    params: (index = 0) => Object.fromEntries(new URL(calls[index]).searchParams),
  };
}
