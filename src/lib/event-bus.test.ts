import { afterEach, describe, expect, it, vi } from "vitest";
import { emit, off, once, on } from "./event-bus";

describe("typed app event bus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delivers typed payloads to subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = on("repay:success", listener);
    const payload = {
      transactionId: "repay-1",
      creditLineId: "line-1",
      creditLineName: "Builder line",
      amount: 25,
      remainingDebt: 75,
      timestamp: "2026-11-23T08:00:00.000Z",
    };

    emit("repay:success", payload);

    expect(listener).toHaveBeenCalledWith(payload);
    unsubscribe();
  });

  it("supports explicit off and unsubscribe cleanup", () => {
    const listener = vi.fn();
    on("draw:success", listener);
    off("draw:success", listener);

    emit("draw:success", {
      transactionId: "draw-1",
      creditLineId: "line-1",
      creditLineName: "Builder line",
      amount: 10,
      timestamp: "2026-11-23T08:00:00.000Z",
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it("runs once listeners only for the first event", () => {
    const listener = vi.fn();
    once("line:statusChanged", listener);
    const payload = { creditLineId: "line-1", status: "Suspended" as const };

    emit("line:statusChanged", payload);
    emit("line:statusChanged", payload);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it("isolates listener errors and continues dispatching", () => {
    const failure = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const throwingListener = () => {
      throw new Error("subscriber failed");
    };
    const succeedingListener = vi.fn();

    on("draw:success", throwingListener);
    on("draw:success", succeedingListener);

    emit("draw:success", {
      transactionId: "draw-2",
      creditLineId: "line-2",
      creditLineName: "Growth line",
      amount: 50,
      timestamp: "2026-11-23T08:00:00.000Z",
    });

    expect(failure).toHaveBeenCalledTimes(1);
    expect(succeedingListener).toHaveBeenCalledTimes(1);
  });
});
