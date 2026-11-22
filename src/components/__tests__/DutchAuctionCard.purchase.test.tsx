import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DutchAuctionCard } from "../DutchAuctionCard";
import type { DutchAuction } from "../../types/dutchAuction";
import type { PurchaseOptions, PurchaseReceipt } from "../../lib/dutch-auction-purchase";

const purchaseMock = vi.hoisted(() => vi.fn());

vi.mock("../../services/dutchAuctions", () => ({
  purchaseAuction: purchaseMock,
}));

const walletState = vi.hoisted(() => ({
  current: {
    wallet: {
      publicKey: "GDBUYER987654321",
      network: "TESTNET",
      type: "freighter",
    },
    status: "connected" as const,
  },
}));

vi.mock("../../context/WalletContext", () => ({
  useWallet: () => walletState.current,
}));

const auction: DutchAuction = {
  id: "AUCTION-REAL",
  nft: {
    id: "NFT-REAL",
    name: "Receipt NFT",
    description: "Receipt test auction",
    image: "https://example.test/nft.png",
    collection: "Test Collection",
    tokenId: "1",
  },
  seller: "GDSELLER1234567890",
  startPrice: 1000,
  floorPrice: 200,
  startTime: new Date(Date.now() - 60_000).toISOString(),
  endTime: new Date(Date.now() + 600_000).toISOString(),
  duration: 660,
  status: "Active",
};

const receipt: PurchaseReceipt = {
  auctionId: auction.id,
  priceStroops: 1_000_000_000n,
  txId: "tx_receipt_123",
  purchasedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  idempotencyKey: "idem_receipt",
};

describe("DutchAuctionCard purchase flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletState.current = {
      wallet: {
        publicKey: "GDBUYER987654321",
        network: "TESTNET",
        type: "freighter",
      },
      status: "connected",
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a receipt with transaction id, price and time", async () => {
    const onPurchase = vi.fn().mockResolvedValue(receipt);
    render(<DutchAuctionCard auction={auction} onPurchase={onPurchase} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Purchase Now for/i }));
    });

    const panel = await screen.findByTestId("purchase-receipt");
    expect(panel).toHaveTextContent("Purchase receipt");
    expect(panel).toHaveTextContent(receipt.txId);
    expect(panel).toHaveTextContent("$100 USD");

    const time = panel.querySelector("time");
    expect(time).toHaveAttribute(
      "dateTime",
      new Date(receipt.purchasedAt).toISOString(),
    );
    expect(onPurchase).toHaveBeenCalledWith(
      auction.id,
      expect.any(BigInt),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^idem_/) }),
    );
  });

  it("announces the receipt through the live region", async () => {
    const onPurchase = vi.fn().mockResolvedValue(receipt);
    render(<DutchAuctionCard auction={auction} onPurchase={onPurchase} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Purchase Now for/i }));
    });

    const live = await screen.findByText(/Purchased auction AUCTION-REAL/i);
    expect(live).toHaveTextContent(receipt.txId);
  });

  it("aborts an in-flight purchase on unmount", async () => {
    let aborted = false;
    purchaseMock.mockImplementation(
      (_auctionId: string, _price: bigint, options: PurchaseOptions) =>
        new Promise<PurchaseReceipt>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => {
            aborted = true;
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );

    const { unmount } = render(<DutchAuctionCard auction={auction} />);

    fireEvent.click(screen.getByRole("button", { name: /Purchase Now for/i }));
    expect(purchaseMock).toHaveBeenCalledTimes(1);

    const options = purchaseMock.mock.calls[0][2] as PurchaseOptions;
    unmount();

    expect(options.signal?.aborted).toBe(true);
    expect(aborted).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("does not call the service when the wallet is on the wrong network", () => {
    walletState.current = {
      wallet: {
        publicKey: "GDBUYER987654321",
        network: "PUBLIC",
        type: "freighter",
      },
      status: "connected",
    };

    render(<DutchAuctionCard auction={auction} />);

    const button = screen.getByRole("button", { name: /Purchase Now for/i });
    expect(button).toBeDisabled();
    expect(screen.getByText("Switch to TESTNET to buy")).toBeInTheDocument();
    fireEvent.click(button);
    expect(purchaseMock).not.toHaveBeenCalled();
  });
});
