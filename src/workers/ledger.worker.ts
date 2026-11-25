import {
  buildTransactionCsv,
  buildTransactionCsvFilename,
} from "../lib/transaction-csv";
import {
  queryTransactions,
  type LedgerWorkerRequest,
  type LedgerWorkerResponse,
} from "../lib/transaction-query";

self.addEventListener(
  "message",
  (event: MessageEvent<LedgerWorkerRequest>) => {
    const request = event.data;
    let response: LedgerWorkerResponse;

    try {
      if (request.type === "query") {
        response = {
          requestId: request.requestId,
          type: "query",
          result: queryTransactions(
            request.transactions,
            request.filters,
            request.options,
          ),
        };
      } else {
        response = {
          requestId: request.requestId,
          type: "exportCsv",
          result: {
            csv: buildTransactionCsv(request.rows, request.options),
            filename: buildTransactionCsvFilename(request.rows),
          },
        };
      }
    } catch (error) {
      response = {
        requestId: request.requestId,
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }

    self.postMessage(response);
  },
);
