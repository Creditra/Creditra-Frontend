/**
 * Simulated purchase service for a Dutch auction.
 *
 * The service is abortable and idempotent: a repeated call with the same
 * idempotency key returns the original receipt instead of buying twice, and
 * concurrent calls for the same key share one in-flight purchase.
 */
import type {
  PurchaseOptions,
  PurchaseReceipt,
} from '../lib/dutch-auction-purchase';

const PURCHASE_DELAY_MS = 200;

const receipts = new Map<string, PurchaseReceipt>();
const inFlight = new Map<string, Promise<PurchaseReceipt>>();

let txCounter = 0;

const toStroops = (price: number | bigint): bigint =>
  typeof price === 'bigint' ? price : BigInt(Math.round(price));

const createAbortError = (): Error => {
  const error = new Error('Purchase aborted');
  error.name = 'AbortError';
  return error;
};

const defaultKey = (auctionId: string, priceStroops: bigint): string =>
  `auction:${auctionId}:stroops:${priceStroops.toString()}`;

const createTxId = (): string => {
  txCounter += 1;
  return `tx_${Date.now().toString(36)}_${txCounter.toString(36)}`;
};

const abortableDelay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };

    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Purchase an auction at the supplied price.
 *
 * @param auctionId - The auction identifier.
 * @param priceStroops - Price in stroops. BigInt values are preserved.
 * @param options - Optional abort signal and idempotency key.
 * @throws An `AbortError` when `options.signal` aborts before settlement.
 */
export async function purchaseAuction(
  auctionId: string,
  priceStroops: number | bigint,
  options: PurchaseOptions = {},
): Promise<PurchaseReceipt> {
  const stroops = toStroops(priceStroops);
  const key = options.idempotencyKey ?? defaultKey(auctionId, stroops);

  // A settled purchase is always returned, even if the caller's signal has
  // since aborted; the money has already moved.
  const cached = receipts.get(key);
  if (cached) return cached;

  if (options.signal?.aborted) {
    throw createAbortError();
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const purchase = (async (): Promise<PurchaseReceipt> => {
    await abortableDelay(PURCHASE_DELAY_MS, options.signal);

    if (options.signal?.aborted) {
      throw createAbortError();
    }

    const receipt: PurchaseReceipt = {
      auctionId,
      priceStroops: stroops,
      txId: createTxId(),
      purchasedAt: Date.now(),
      idempotencyKey: key,
    };
    receipts.set(key, receipt);
    return receipt;
  })();

  inFlight.set(key, purchase);
  try {
    return await purchase;
  } finally {
    inFlight.delete(key);
  }
}
