import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithTimeout,
  FetchTimeoutError,
  isAbortError,
} from "./fetchWithTimeout";

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resolves normally when fetch completes before timeout", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse);

    const response = await fetchWithTimeout(
      "/api/test",
      { method: "GET" },
      { timeoutMs: 5000 },
    );

    expect(response).toBe(mockResponse);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("aborts and throws FetchTimeoutError when timeout elapses", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );

    const promise = fetchWithTimeout("/api/slow", {}, { timeoutMs: 3000 });
    const assertion = expect(promise).rejects.toThrow(FetchTimeoutError);

    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
  });

  it("aborts with caller signal without throwing FetchTimeoutError", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );

    const callerController = new AbortController();
    const promise = fetchWithTimeout(
      "/api/cancel",
      {},
      { timeoutMs: 15000, signal: callerController.signal },
    );

    callerController.abort();

    await expect(promise).rejects.toSatisfy(
      (err: unknown) => isAbortError(err) && !(err instanceof FetchTimeoutError),
    );
  });
});
