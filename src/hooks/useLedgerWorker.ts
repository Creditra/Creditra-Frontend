import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildTransactionCsv,
  buildTransactionCsvFilename,
} from "../lib/transaction-csv";
import {
  queryTransactions,
  type LedgerTransaction,
  type LedgerWorkerResponse,
  type TransactionCsvExport,
  type TransactionQueryFilters,
  type TransactionQueryOptions,
  type TransactionQueryResult,
} from "../lib/transaction-query";

interface QueryPendingRequest {
  type: "query";
  fallback: () => TransactionQueryResult;
  resolve: (result: TransactionQueryResult | null) => void;
  reject: (error: Error) => void;
}

interface ExportPendingRequest {
  type: "exportCsv";
  fallback: () => TransactionCsvExport;
  resolve: (result: TransactionCsvExport) => void;
  reject: (error: Error) => void;
}

type PendingRequest = QueryPendingRequest | ExportPendingRequest;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function createAbortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Ledger worker request was cancelled.", "AbortError");
  }

  const error = new Error("Ledger worker request was cancelled.");
  error.name = "AbortError";
  return error;
}

export function useLedgerWorker() {
  const workerRef = useRef<Worker | null>(null);
  const workerUnavailable = useRef(false);
  const mounted = useRef(false);
  const nextRequestId = useRef(0);
  const latestQueryRequestId = useRef<number | null>(null);
  const pendingRequests = useRef(new Map<number, PendingRequest>());
  const [activeCounts, setActiveCounts] = useState({ query: 0, exportCsv: 0 });

  const updateActiveCounts = useCallback(() => {
    if (!mounted.current) return;

    let query = 0;
    let exportCsv = 0;
    for (const request of pendingRequests.current.values()) {
      if (request.type === "query") query += 1;
      else exportCsv += 1;
    }
    setActiveCounts({ query, exportCsv });
  }, []);

  const cancelPendingQueries = useCallback(() => {
    let cancelled = false;
    for (const [requestId, request] of pendingRequests.current) {
      if (request.type !== "query") continue;
      pendingRequests.current.delete(requestId);
      request.resolve(null);
      cancelled = true;
    }
    if (cancelled) updateActiveCounts();
  }, [updateActiveCounts]);

  const runFallback = useCallback(
    (requestId: number, request: PendingRequest) => {
      pendingRequests.current.delete(requestId);
      updateActiveCounts();

      if (request.type === "query") {
        if (requestId !== latestQueryRequestId.current) {
          request.resolve(null);
          return;
        }

        try {
          request.resolve(request.fallback());
        } catch (error) {
          request.reject(toError(error));
        }
        return;
      }

      try {
        request.resolve(request.fallback());
      } catch (error) {
        request.reject(toError(error));
      }
    },
    [updateActiveCounts],
  );

  const failWorker = useCallback(() => {
    workerUnavailable.current = true;
    workerRef.current?.terminate();
    workerRef.current = null;

    for (const [requestId, request] of pendingRequests.current) {
      runFallback(requestId, request);
    }
  }, [runFallback]);

  const handleWorkerMessage = useCallback(
    (response: LedgerWorkerResponse) => {
      const request = pendingRequests.current.get(response.requestId);
      if (!request) return;

      if (response.type === "error") {
        runFallback(response.requestId, request);
        return;
      }

      if (request.type === "query" && response.type !== "query") {
        runFallback(response.requestId, request);
        return;
      }
      if (request.type === "exportCsv" && response.type !== "exportCsv") {
        runFallback(response.requestId, request);
        return;
      }

      pendingRequests.current.delete(response.requestId);
      updateActiveCounts();

      if (request.type === "query") {
        if (response.requestId !== latestQueryRequestId.current) {
          request.resolve(null);
          return;
        }
        request.resolve(response.result);
      } else {
        request.resolve(response.result);
      }
    },
    [runFallback, updateActiveCounts],
  );

  const getWorker = useCallback((): Worker | null => {
    if (workerUnavailable.current) return null;
    if (workerRef.current) return workerRef.current;
    if (typeof Worker === "undefined") {
      workerUnavailable.current = true;
      return null;
    }

    try {
      const worker = new Worker(
        new URL("../workers/ledger.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event: MessageEvent<LedgerWorkerResponse>) => {
        handleWorkerMessage(event.data);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        failWorker();
      };
      worker.onmessageerror = () => failWorker();
      workerRef.current = worker;
      return worker;
    } catch {
      workerUnavailable.current = true;
      return null;
    }
  }, [failWorker, handleWorkerMessage]);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      workerRef.current?.terminate();
      workerRef.current = null;
      for (const request of pendingRequests.current.values()) {
        request.reject(createAbortError());
      }
      pendingRequests.current.clear();
    };
  }, []);

  const query = useCallback(
    (
      transactions: readonly LedgerTransaction[],
      filters: TransactionQueryFilters,
      options: TransactionQueryOptions,
    ): Promise<TransactionQueryResult | null> => {
      const requestId = ++nextRequestId.current;
      latestQueryRequestId.current = requestId;
      cancelPendingQueries();
      const fallback = () =>
        queryTransactions(transactions, filters, options);
      const worker = getWorker();

      if (!worker) {
        try {
          return Promise.resolve(fallback());
        } catch (error) {
          return Promise.reject(toError(error));
        }
      }

      return new Promise((resolve, reject) => {
        pendingRequests.current.set(requestId, {
          type: "query",
          fallback,
          resolve,
          reject,
        });
        updateActiveCounts();

        try {
          worker.postMessage({
            requestId,
            type: "query",
            transactions,
            filters,
            options,
          });
        } catch {
          failWorker();
        }
      });
    },
    [cancelPendingQueries, failWorker, getWorker, updateActiveCounts],
  );

  const exportCsv = useCallback(
    (
      rows: readonly LedgerTransaction[],
      options: { asset: string },
    ): Promise<TransactionCsvExport> => {
      const requestId = ++nextRequestId.current;
      const fallback = () => ({
        csv: buildTransactionCsv(rows, options),
        filename: buildTransactionCsvFilename(rows),
      });
      const worker = getWorker();

      if (!worker) {
        try {
          return Promise.resolve(fallback());
        } catch (error) {
          return Promise.reject(toError(error));
        }
      }

      return new Promise((resolve, reject) => {
        pendingRequests.current.set(requestId, {
          type: "exportCsv",
          fallback,
          resolve,
          reject,
        });
        updateActiveCounts();

        try {
          worker.postMessage({
            requestId,
            type: "exportCsv",
            rows,
            options,
          });
        } catch {
          failWorker();
        }
      });
    },
    [failWorker, getWorker, updateActiveCounts],
  );

  const cancelQueries = useCallback(() => {
    latestQueryRequestId.current = ++nextRequestId.current;
    cancelPendingQueries();
  }, [cancelPendingQueries]);

  return {
    query,
    exportCsv,
    cancelQueries,
    isQuerying: activeCounts.query > 0,
    isExporting: activeCounts.exportCsv > 0,
    isBusy: activeCounts.query > 0 || activeCounts.exportCsv > 0,
  };
}
