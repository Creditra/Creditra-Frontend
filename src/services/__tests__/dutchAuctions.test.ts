import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseAuction } from "../dutchAuctions";

const settle = async <T>(promise: Promise<T>): Promise<T> => {
  await vi.advanceTimersByTimeAsync(200);
  return promise;
};

describe("purchaseAuction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a receipt with the auction, price, tx id and key", async () => {
    const receipt = await settle(
      purchaseAuction("AUCTION-1", 12_345n, { idempotencyKey: "key-1" }),
    );

    expect(receipt.auctionId).toBe("AUCTION-1");
    expect(receipt.priceStroops).toBe(12_345n);
    expect(receipt.idempotencyKey).toBe("key-1");
    expect(receipt.txId).toMatch(/^tx_/);
    expect(receipt.purchasedAt).toBeTypeOf("number");
  });

  it("preserves a bigint price exactly", async () => {
    const price = 9_876_543_210n;
    const receipt = await settle(
      purchaseAuction("AUCTION-2", price, { idempotencyKey: "key-2" }),
    );

    expect(receipt.priceStroops).toBe(price);
  });

  it("returns the same receipt for a repeat call with the same key", async () => {
    const first = await settle(
      purchaseAuction("AUCTION-3", 500n, { idempotencyKey: "key-3" }),
    );
    const second = await purchaseAuction("AUCTION-3", 500n, {
      idempotencyKey: "key-3",
    });

    expect(second).toBe(first);
    expect(second.txId).toBe(first.txId);
  });

  it("shares one in-flight purchase across concurrent calls with the same key", async () => {
    const first = purchaseAuction("AUCTION-4", 700n, {
      idempotencyKey: "key-4",
    });
    const second = purchaseAuction("AUCTION-4", 700n, {
      idempotencyKey: "key-4",
    });

    await vi.advanceTimersByTimeAsync(200);

    const [a, b] = await Promise.all([first, second]);
    expect(b).toBe(a);
  });

  it("deduplicates by auction and price when no key is supplied", async () => {
    const first = await settle(purchaseAuction("AUCTION-5", 800n));
    const second = await purchaseAuction("AUCTION-5", 800n);
    expect(second).toBe(first);

    const differentPrice = await settle(purchaseAuction("AUCTION-5", 900n));
    expect(differentPrice.txId).not.toBe(first.txId);
  });

  it("rejects with an AbortError when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      purchaseAuction("AUCTION-6", 100n, {
        idempotencyKey: "key-6",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects with an AbortError when aborted mid-purchase", async () => {
    const controller = new AbortController();
    const promise = purchaseAuction("AUCTION-7", 100n, {
      idempotencyKey: "key-7",
      signal: controller.signal,
    });
    const rejection = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    await rejection;
  });

  it("does not cache an aborted purchase, so a retry can complete", async () => {
    const controller = new AbortController();
    const aborted = purchaseAuction("AUCTION-8", 100n, {
      idempotencyKey: "key-8",
      signal: controller.signal,
    });
    const rejection = expect(aborted).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejection;

    const retry = await settle(
      purchaseAuction("AUCTION-8", 100n, { idempotencyKey: "key-8" }),
    );
    expect(retry.txId).toMatch(/^tx_/);
  });

  it("still returns a settled receipt when the signal aborts after success", async () => {
    const controller = new AbortController();
    const receipt = await settle(
      purchaseAuction("AUCTION-9", 100n, {
        idempotencyKey: "key-9",
        signal: controller.signal,
      }),
    );

    controller.abort();

    await expect(
      purchaseAuction("AUCTION-9", 100n, {
        idempotencyKey: "key-9",
        signal: controller.signal,
      }),
    ).resolves.toBe(receipt);
  });
});
