// src/services/__tests__/support.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { submitSupportRequest, type SupportContext } from "../support";

describe("submitSupportRequest service (#1142)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("submits a support request payload with sanitized, non-sensitive context", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, ticketId: "TCK-9901" }),
    } as Response);

    const context: SupportContext = {
      route: "/credit-lines",
      appVersion: "0.1.0",
      walletType: "freighter",
      timestamp: 1700000000000,
    };

    const result = await submitSupportRequest(
      {
        subject: "  Credit line question  ",
        message: "  Can I increase my credit limit?  ",
      },
      context
    );

    expect(result).toEqual({ success: true, ticketId: "TCK-9901" });
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, requestInit] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/support");
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.headers).toEqual({ "Content-Type": "application/json" });

    const sentPayload = JSON.parse(requestInit?.body as string);

    // Subject and message are trimmed
    expect(sentPayload.subject).toBe("Credit line question");
    expect(sentPayload.message).toBe("Can I increase my credit limit?");

    // Non-sensitive context included
    expect(sentPayload.context).toEqual({
      route: "/credit-lines",
      appVersion: "0.1.0",
      walletType: "freighter",
      timestamp: 1700000000000,
    });

    // Explicitly verify sensitive financial / security fields are NOT included
    expect(sentPayload).not.toHaveProperty("privateKey");
    expect(sentPayload).not.toHaveProperty("secretKey");
    expect(sentPayload).not.toHaveProperty("balance");
    expect(sentPayload).not.toHaveProperty("balances");
    expect(sentPayload).not.toHaveProperty("creditLimit");
    expect(sentPayload).not.toHaveProperty("accountNumber");
    expect(sentPayload.context).not.toHaveProperty("privateKey");
    expect(sentPayload.context).not.toHaveProperty("publicKey");
  });

  it("falls back to default context values when context is omitted", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await submitSupportRequest({
      subject: "General inquiry",
      message: "How does the protocol work?",
    });

    const [, requestInit] = vi.mocked(fetch).mock.calls[0];
    const sentPayload = JSON.parse(requestInit?.body as string);

    expect(sentPayload.context.route).toBe("/");
    expect(sentPayload.context.appVersion).toBe("0.1.0");
    expect(sentPayload.context.walletType).toBe("none");
    expect(sentPayload.context.timestamp).toBeTypeOf("number");
  });

  it("throws server error message on 4xx/5xx responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: "Too many requests. Please wait before submitting again." }),
    } as Response);

    await expect(
      submitSupportRequest({
        subject: "Rate limit test",
        message: "Will this trigger a rate limit error?",
      })
    ).rejects.toThrow("Too many requests. Please wait before submitting again.");
  });

  it("throws generic status code error if backend returns no error message body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    } as Response);

    await expect(
      submitSupportRequest({
        subject: "Service outage",
        message: "Support gateway appears down.",
      })
    ).rejects.toThrow("Failed to submit support request (503)");
  });

  it("propagates network errors to caller", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Network request failed"));

    await expect(
      submitSupportRequest({
        subject: "Offline test",
        message: "Testing offline behavior.",
      })
    ).rejects.toThrow("Network request failed");
  });
});
