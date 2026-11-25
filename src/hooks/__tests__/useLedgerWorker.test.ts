import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTransactionCsv,
  buildTransactionCsvFilename,
} from "../../lib/transaction-csv";
import {
  queryTransactions,
  type LedgerTransaction,
  type LedgerWorkerRequest,
  type LedgerWorkerResponse,
  type TransactionQueryFilters,
} from "../../lib/transaction-query";
import { useLedgerWorker } from "../useLedgerWorker";

class MockWorker {
  static instances: MockWorker[] = [];

  readonly requests: LedgerWorkerRequest[] = [];
  readonly terminate = vi.fn();
  onmessage: ((event: MessageEvent<LedgerWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  constructor() {
    MockWorker.instances.push(this);
  }

  postMessage(request: LedgerWorkerRequest) {
    this.requests.push(request);
  }

  respond(response: LedgerWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<LedgerWorkerResponse>);
  }

  fail() {
    this.onerror?.({
      preventDefault: vi.fn(),
    } as unknown as ErrorEvent);
  }
}

const originalWorkerDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "Worker",
);

const filters: TransactionQueryFilters = {
  selectedLine: "all",
  selectedType: "all",
  selectedStatus: "all",
  searchQuery: "",
  amountFilter: { kind: "all" },
  dateRange: "custom",
  presetRange: "custom",
  customStartDate: "",
  customEndDate: "",
};

const options = {
  nowMs: Date.parse("2025-02-20T12:00:00.000Z"),
  suggestionQuery: "",
};

const row: LedgerTransaction = {
  id: "tx-1",
  type: "Draw",
  amount: 125.5,
  date: "2025-02-20T12:00:00.000Z",
  status: "Completed",
  lineId: "line-1",
  lineName: "Builder line",
  lineStatus: "Active",
  note: "Inventory",
};

function installWorker() {
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: MockWorker as unknown as typeof Worker,
    writable: true,
  });
}

describe("useLedgerWorker", () => {
  beforeEach(() => {
    MockWorker.instances = [];
    installWorker();
  });

  afterEach(() => {
    if (originalWorkerDescriptor) {
      Object.defineProperty(globalThis, "Worker", originalWorkerDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "Worker");
    }
  });

  it("uses the inline query when Worker is unavailable, including for empty ledgers", async () => {
    Reflect.deleteProperty(globalThis, "Worker");
    const { result } = renderHook(() => useLedgerWorker());

    await expect(result.current.query([], filters, options)).resolves.toEqual({
      filteredTransactions: [],
      suggestions: [],
      totalTransactions: 0,
    });
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("uses the shared query inline when the Worker API is unavailable", async () => {
    Reflect.deleteProperty(globalThis, "Worker");
    const { result } = renderHook(() => useLedgerWorker());

    await expect(result.current.query([row], filters, options)).resolves.toEqual(
      queryTransactions([row], filters, options),
    );
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("drops stale query responses and keeps only the newest result", async () => {
    const { result } = renderHook(() => useLedgerWorker());
    let oldQuery!: ReturnType<typeof result.current.query>;
    let latestQuery!: ReturnType<typeof result.current.query>;
    const latestFilters = { ...filters, selectedLine: "line-2" };
    act(() => {
      oldQuery = result.current.query([row], filters, options);
      latestQuery = result.current.query([row], latestFilters, options);
    });
    expect(result.current.isQuerying).toBe(true);
    const worker = MockWorker.instances[0];
    const oldRequest = worker.requests[0];
    const latestRequest = worker.requests[1];

    if (oldRequest.type !== "query" || latestRequest.type !== "query") {
      throw new Error("Expected query requests");
    }

    const latestResult = queryTransactions([row], latestFilters, options);
    act(() => {
      worker.respond({
        requestId: latestRequest.requestId,
        type: "query",
        result: latestResult,
      });
      worker.respond({
        requestId: oldRequest.requestId,
        type: "query",
        result: queryTransactions([row], filters, options),
      });
    });

    await expect(oldQuery).resolves.toBeNull();
    await expect(latestQuery).resolves.toEqual(latestResult);
    expect(result.current.isQuerying).toBe(false);
  });

  it("falls back to the shared query when the worker errors", async () => {
    const { result } = renderHook(() => useLedgerWorker());
    let query!: ReturnType<typeof result.current.query>;
    act(() => {
      query = result.current.query([row], filters, options);
    });
    const worker = MockWorker.instances[0];

    act(() => worker.fail());

    await expect(query).resolves.toEqual(
      queryTransactions([row], filters, options),
    );
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("returns CSV bytes identical to the shared builder", async () => {
    const { result } = renderHook(() => useLedgerWorker());
    let exportPromise!: ReturnType<typeof result.current.exportCsv>;
    act(() => {
      exportPromise = result.current.exportCsv([row], { asset: "USD" });
    });
    expect(result.current.isExporting).toBe(true);
    const worker = MockWorker.instances[0];
    const request = worker.requests[0];

    if (request.type !== "exportCsv") {
      throw new Error("Expected a CSV export request");
    }

    const expected = {
      csv: buildTransactionCsv([row], { asset: "USD" }),
      filename: buildTransactionCsvFilename([row]),
    };
    act(() => {
      worker.respond({
        requestId: request.requestId,
        type: "exportCsv",
        result: expected,
      });
    });

    await expect(exportPromise).resolves.toEqual(expected);
    expect(result.current.isExporting).toBe(false);
  });

  it("builds the same CSV inline when Worker is unavailable", async () => {
    Reflect.deleteProperty(globalThis, "Worker");
    const { result } = renderHook(() => useLedgerWorker());

    await expect(
      result.current.exportCsv([row], { asset: "USD" }),
    ).resolves.toEqual({
      csv: buildTransactionCsv([row], { asset: "USD" }),
      filename: buildTransactionCsvFilename([row]),
    });
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("terminates the worker and rejects pending requests on unmount", async () => {
    const { result, unmount } = renderHook(() => useLedgerWorker());
    let pendingQuery!: ReturnType<typeof result.current.query>;
    act(() => {
      pendingQuery = result.current.query([row], filters, options);
    });
    const worker = MockWorker.instances[0];
    const rejection = expect(pendingQuery).rejects.toMatchObject({
      name: "AbortError",
    });

    unmount();

    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
