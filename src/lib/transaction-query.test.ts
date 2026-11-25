import { describe, expect, it } from "vitest";
import type { LedgerTransaction, TransactionQueryFilters } from "./transaction-query";
import { queryTransactions } from "./transaction-query";

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

function createTransaction(
  overrides: Partial<LedgerTransaction> = {},
): LedgerTransaction {
  return {
    id: "tx-1",
    type: "Draw",
    amount: 100,
    date: "2025-02-20T12:00:00.000Z",
    status: "Completed",
    lineId: "line-1",
    lineName: "Builder line",
    lineStatus: "Active",
    ...overrides,
  };
}

describe("queryTransactions", () => {
  it("sorts a copy and applies all filter types without mutating its input", () => {
    const input = [
      createTransaction({ id: "old", date: "2025-02-01T12:00:00.000Z" }),
      createTransaction({
        id: "match",
        type: "Repay",
        amount: 1_500,
        date: "2025-02-20T12:00:00.000Z",
        lineId: "line-2",
        lineName: "Growth line",
        note: "Invoice 42",
        txHash: "abc123",
      }),
      createTransaction({
        id: "invalid",
        date: "not-a-date",
        lineId: "line-2",
        lineName: "Growth line",
        note: "Invoice 42",
        txHash: "abc123",
      }),
    ];
    const filtered = queryTransactions(
      input,
      {
        ...filters,
        selectedLine: "line-2",
        selectedType: "Repay",
        selectedStatus: "Completed",
        searchQuery: "ABC",
        amountFilter: { kind: "preset", id: "1k-5k" },
      },
      { nowMs: Date.parse("2025-02-20T12:00:00.000Z"), suggestionQuery: "" },
    );

    expect(filtered.filteredTransactions.map(({ id }) => id)).toEqual(["match"]);
    expect(input.map(({ id }) => id)).toEqual(["old", "match", "invalid"]);
    expect(filtered.totalTransactions).toBe(3);
  });

  it("uses local calendar boundaries for today, week, month, and custom dates", () => {
    const today = new Date(2025, 1, 20, 12);
    const yesterday = new Date(2025, 1, 19, 12);
    const lastMonth = new Date(2025, 0, 31, 12);
    const rows = [
      createTransaction({ id: "today", date: today.toISOString() }),
      createTransaction({ id: "yesterday", date: yesterday.toISOString() }),
      createTransaction({ id: "last-month", date: lastMonth.toISOString() }),
    ];
    const options = {
      nowMs: today.getTime(),
      suggestionQuery: "",
    };

    expect(
      queryTransactions(rows, { ...filters, dateRange: "today" }, options)
        .filteredTransactions.map(({ id }) => id),
    ).toEqual(["today"]);
    expect(
      queryTransactions(
        rows,
        { ...filters, presetRange: "this-week" },
        options,
      ).filteredTransactions.map(({ id }) => id),
    ).toEqual(["today", "yesterday"]);
    expect(
      queryTransactions(
        rows,
        { ...filters, presetRange: "this-month" },
        options,
      ).filteredTransactions.map(({ id }) => id),
    ).toEqual(["today", "yesterday"]);
    expect(
      queryTransactions(
        rows,
        { ...filters, customStartDate: "2025-02-20", customEndDate: "2025-02-20" },
        options,
      ).filteredTransactions.map(({ id }) => id),
    ).toEqual(["today"]);
  });

  it("builds up to eight deduplicated suggestions in sorted transaction order", () => {
    const rows = [
      createTransaction({
        id: "old",
        date: "2025-02-19T12:00:00.000Z",
        lineName: "Old project",
        note: "Shared phrase",
      }),
      ...Array.from({ length: 10 }, (_, index) =>
        createTransaction({
          id: `new-${index}`,
          date: "2025-02-20T12:00:00.000Z",
          lineId: `phrase-${index}`,
          lineName: `Phrase ${index}`,
          note: index === 0 ? "Shared phrase" : undefined,
        }),
      ),
    ];

    const result = queryTransactions(rows, filters, {
      nowMs: Date.parse("2025-02-20T12:00:00.000Z"),
      suggestionQuery: " phrase ",
    });

    expect(result.suggestions).toEqual([
      "Phrase 9",
      "phrase-9",
      "Phrase 8",
      "phrase-8",
      "Phrase 7",
      "phrase-7",
      "Phrase 6",
      "phrase-6",
    ]);
  });

  it("returns empty results and suggestions for an empty ledger", () => {
    expect(
      queryTransactions([], filters, {
        nowMs: 0,
        suggestionQuery: "line",
      }),
    ).toEqual({
      filteredTransactions: [],
      suggestions: [],
      totalTransactions: 0,
    });
  });
});
