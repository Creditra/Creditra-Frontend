import { generateIdempotencyKey } from '../utils/idempotency';

export interface SubmitRepaymentParams {
  creditLineId: string;
  amount: number;
  idempotencyKey: string;
  signal?: AbortSignal;
}

export interface SubmitRepaymentResult {
  txId: string;
  completedAt: string;
}

const MOCK_DELAY_MS = 150;

function deriveDeterministicTxId(
  creditLineId: string,
  amount: number,
  idempotencyKey: string,
): string {
  const part1 = generateIdempotencyKey({
    creditLineId,
    outgoingAssetId: idempotencyKey,
    incomingAssetId: `repay:${amount.toFixed(2)}`,
    initiatedAtMs: 0,
  }).replace(/^idem_/, '');

  const part2 = generateIdempotencyKey({
    creditLineId: `tx:${creditLineId}`,
    outgoingAssetId: `repay:${amount.toFixed(2)}`,
    incomingAssetId: idempotencyKey,
    initiatedAtMs: 1,
  }).replace(/^idem_/, '');

  return `0x${part1}${part2}`;
}

function createAbortError(): Error {
  const err = new Error('Repayment request was aborted.');
  err.name = 'AbortError';
  return err;
}

/**
 * Submit a credit line repayment.
 *
 * Mock implementation behind a short delay that returns a deterministic
 * transaction ID derived from the idempotency key (no Math.random).
 */
export async function submitRepayment({
  creditLineId,
  amount,
  idempotencyKey,
  signal,
}: SubmitRepaymentParams): Promise<SubmitRepaymentResult> {
  if (signal?.aborted) {
    throw createAbortError();
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, MOCK_DELAY_MS);

    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });

  return {
    txId: deriveDeterministicTxId(creditLineId, amount, idempotencyKey),
    completedAt: new Date().toISOString(),
  };
}
