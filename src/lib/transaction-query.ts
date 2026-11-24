import type {
  CreditLineStatus,
  TransactionStatus,
  TransactionType,
} from "../types/creditLine";
import {
  matchesAmountFilter,
  type AmountFilter,
} from "../utils/transactionAmountFilter";
import type {
  TransactionCsvOptions,
  TransactionCsvRow,
} from "./transaction-csv";

export interface LedgerTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  note?: string;
  status: TransactionStatus;
  txHash?: string;
  lineId: string;
  lineName: string;
  lineStatus: CreditLineStatus;
}

export type LedgerDateRange = "today" | "7d" | "30d" | "90d" | "custom";
export type LedgerPresetRange =
  | "this-week"
  | "this-month"
  | "all-time"
  | "custom";

export interface TransactionQueryFilters {
  selectedLine: string;
  selectedType: TransactionType | "all";
  selectedStatus: string;
  searchQuery: string;
  amountFilter: AmountFilter;
  dateRange: LedgerDateRange;
  presetRange: LedgerPresetRange;
  customStartDate: string;
  customEndDate: string;
}

export interface TransactionQueryOptions {
  nowMs: number;
  suggestionQuery: string;
}

export interface TransactionQueryResult {
  filteredTransactions: LedgerTransaction[];
  suggestions: string[];
  totalTransactions: number;
}

export interface TransactionCsvExport {
  csv: string;
  filename: string;
}

export type LedgerWorkerRequest =
  | {
      requestId: number;
      type: "query";
      transactions: readonly LedgerTransaction[];
      filters: TransactionQueryFilters;
      options: TransactionQueryOptions;
    }
  | {
      requestId: number;
      type: "exportCsv";
      rows: readonly TransactionCsvRow[];
      options: TransactionCsvOptions;
    };

export type LedgerWorkerResponse =
  | {
      requestId: number;
      type: "query";
      result: TransactionQueryResult;
    }
  | {
      requestId: number;
      type: "exportCsv";
      result: TransactionCsvExport;
    }
  | {
      requestId: number;
      type: "error";
      error: string;
    };

function startOfWeekMs(date: Date): number {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result.getTime();
}

function startOfMonthMs(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0,
  ).getTime();
}

function getSuggestions(
  transactions: readonly LedgerTransaction[],
  query: string,
): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const transaction of transactions) {
    if (suggestions.length >= 8) break;

    for (const candidate of [
      transaction.lineName,
      transaction.lineId,
      transaction.note,
    ]) {
      if (!candidate) continue;
      if (
        candidate.toLowerCase().includes(normalizedQuery) &&
        !seen.has(candidate)
      ) {
        seen.add(candidate);
        suggestions.push(candidate);
        if (suggestions.length >= 8) break;
      }
    }
  }

  return suggestions;
}

export function queryTransactions(
  transactions: readonly LedgerTransaction[],
  filters: TransactionQueryFilters,
  options: TransactionQueryOptions,
): TransactionQueryResult {
  const sortedTransactions = transactions
    .map((transaction) => ({ ...transaction }))
    .sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });

  const now = new Date(options.nowMs);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const sevenDaysAgo = options.nowMs - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = options.nowMs - 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = options.nowMs - 90 * 24 * 60 * 60 * 1000;
  const weekStart = startOfWeekMs(now);
  const monthStart = startOfMonthMs(now);
  const customStart = filters.customStartDate
    ? new Date(`${filters.customStartDate}T00:00:00`).getTime()
    : null;
  const customEnd = filters.customEndDate
    ? new Date(`${filters.customEndDate}T23:59:59.999`).getTime()
    : null;
  const search = filters.searchQuery.toLowerCase();

  const filteredTransactions = sortedTransactions.filter((transaction) => {
    const transactionTime = new Date(transaction.date).getTime();
    if (Number.isNaN(transactionTime)) return false;

    if (filters.selectedLine !== "all" && transaction.lineId !== filters.selectedLine) {
      return false;
    }
    if (filters.selectedType !== "all" && transaction.type !== filters.selectedType) {
      return false;
    }
    if (
      filters.selectedStatus !== "all" &&
      transaction.status !== filters.selectedStatus
    ) {
      return false;
    }
    if (!matchesAmountFilter(filters.amountFilter, transaction.amount)) {
      return false;
    }
    if (search) {
      const matchesNote = transaction.note?.toLowerCase().includes(search);
      const matchesLine = transaction.lineName.toLowerCase().includes(search);
      const matchesId = transaction.lineId.toLowerCase().includes(search);
      const matchesHash = transaction.txHash?.toLowerCase().includes(search);
      if (!matchesNote && !matchesLine && !matchesId && !matchesHash) {
        return false;
      }
    }

    if (filters.dateRange === "today" && transactionTime < startOfToday) {
      return false;
    }
    if (filters.dateRange === "7d" && transactionTime < sevenDaysAgo) {
      return false;
    }
    if (filters.dateRange === "30d" && transactionTime < thirtyDaysAgo) {
      return false;
    }
    if (filters.dateRange === "90d" && transactionTime < ninetyDaysAgo) {
      return false;
    }

    if (filters.presetRange === "this-week" && transactionTime < weekStart) {
      return false;
    }
    if (filters.presetRange === "this-month" && transactionTime < monthStart) {
      return false;
    }
    if (filters.presetRange === "custom" && filters.dateRange === "custom") {
      if (customStart !== null && transactionTime < customStart) return false;
      if (customEnd !== null && transactionTime > customEnd) return false;
    }

    return true;
  });

  return {
    filteredTransactions,
    suggestions: getSuggestions(sortedTransactions, options.suggestionQuery),
    totalTransactions: transactions.length,
  };
}
