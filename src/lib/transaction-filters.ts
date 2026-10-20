import { type TransactionRange } from "@/lib/transaction-range";

export type TransactionType = "Payment" | "Repay" | "Drawdown" | "Fee";

export type TransactionStatus = "Success" | "Pending" | "Failed";

export interface TransactionFilters {
  line: string;
  type: TransactionType | "";
  status: TransactionStatus | "";
  q: string;
  range: TransactionRange;
  start: string;
  end: string;
  amount: string;
  min: string;
  max: string;
  page: number;
}

export type TransactionFilterErrors = Record<string, string>;

export const TRANSACTION_TYPES = ["Payment", "Repay", "Drawdown", "Fee"] as const;

export const TRANSACTION_STATUSES = ["Success", "Pending", "Failed"] as const;

export const TRANSACTION_RANGES = [
  "custom",
  "this-week",
  "this-month",
  "last-30-days",
  "last-90-days",
] as const;

export const FILTER_KEYS = [
  "line",
  "type",
  "status",
  "q",
  "range",
  "start",
  "end",
  "amount",
  "min",
  "max",
  "page",
] as const;

export const DEFAULT_FILTERS: TransactionFilters = {
  line: "",
  type: "",
  status: "",
  q: "",
  range: "custom",
  start: "",
  end: "",
  amount: "",
  min: "",
  max: "",
  page: 1,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function isNumeric(value: string): boolean {
  if (value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

function isTransactionType(value: string): value is TransactionType {
  return (TRANSACTION_TYPES as readonly string[]).includes(value);
}

function isTransactionStatus(value: string): value is TransactionStatus {
  return (TRANSACTION_STATUSES as readonly string[]).includes(value);
}

function isTransactionRange(value: string): value is TransactionRange {
  return (TRANSACTION_RANGES as readonly string[]).includes(value);
}

export function parseTransactionFilters(search: string): {
  filters: TransactionFilters;
  errors: TransactionFilterErrors;
} {
  const params = new URLSearchParams(search);
  const filters: TransactionFilters = { ...DEFAULT_FILTERS };
  const errors: TransactionFilterErrors = {};

  const line = params.get("line");
  if (line) filters.line = line;

  const type = params.get("type");
  if (type) {
    if (isTransactionType(type)) {
      filters.type = type;
    } else {
      errors.type = `Unknown transaction type "${type}". Filter ignored.`;
    }
  }

  const status = params.get("status");
  if (status) {
    if (isTransactionStatus(status)) {
      filters.status = status;
    } else {
      errors.status = `Unknown status "${status}". Filter ignored.`;
    }
  }

  const q = params.get("q");
  if (q) {
    filters.q = q;
  }

  const range = params.get("range");
  if (range) {
    if (isTransactionRange(range)) {
      filters.range = range;
    } else {
      errors.range = `Unknown range "${range}". Filter ignored.`;
    }
  }

  const start = params.get("start");
  if (start) {
    if (isIsoDate(start)) {
      filters.start = start;
    } else {
      errors.start = `Invalid start date "${start}". Filter ignored.`;
    }
  }

  const end = params.get("end");
  if (end) {
    if (isIsoDate(end)) {
      filters.end = end;
    } else {
      errors.end = `Invalid end date "${end}". Filter ignored.`;
    }
  }

  if (filters.start && filters.end && filters.start > filters.end) {
    errors.dateRange = "Start date must be on or before the end date.";
  }

  const amount = params.get("amount");
  if (amount) {
    filters.amount = amount;
  }

  const min = params.get("min");
  if (min !== null && min !== "") {
    if (isNumeric(min)) {
      filters.min = min;
    } else {
      errors.min = `Minimum amount "${min}" is not a number. Filter ignored.`;
    }
  }

  const max = params.get("max");
  if (max !== null && max !== "") {
    if (isNumeric(max)) {
      filters.max = max;
    } else {
      errors.max = `Maximum amount "${max}" is not a number. Filter ignored.`;
    }
  }

  if (filters.min && filters.max && Number(filters.min) > Number(filters.max)) {
    errors.amountRange = "Minimum amount must be less than or equal to the maximum.";
  }

  const page = params.get("page");
  if (page !== null && page !== "") {
    const parsed = Number(page);
    if (Number.isFinite(parsed) && parsed >= 1) {
      filters.page = Math.floor(parsed);
    } else {
      errors.page = `Invalid page "${page}". Defaulting to page 1.`;
    }
  }

  return { filters, errors };
}

export function serializeTransactionFilters(filters: TransactionFilters): string {
  const params = new URLSearchParams();

  if (filters.line) params.set("line", filters.line);
  if (filters.type) { params.set("type", filters.type); }
  if (filters.status) { params.set("status", filters.status); }
  if (filters.q) params.set("q", filters.q);
  if (filters.range && filters.range !== "custom") {
    params.set("range", filters.range);
  }
  if (filters.start) params.set("start", filters.start);
  if (filters.end) params.set("end", filters.end);
  if (filters.amount) params.set("amount", filters.amount);
  if (filters.min) params.set("min", filters.min);
  if (filters.max) params.set("max", filters.max);
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return params.toString();
}

export function clearTransactionFilters(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of FILTER_KEYS) {
    params.delete(key);
  }
  return params.toString();
}
