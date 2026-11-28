import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY_PAGE_SIZE,
  paginateByCursor,
  paginateTransactions,
} from "./cursorPagination";

type Entry = { id: string; date: string };
const pageOptions = {
  getDate: (entry: Entry) => entry.date,
  getId: (entry: Entry) => entry.id,
};

describe("paginateByCursor", () => {
  it("orders equal timestamps deterministically and continues with a cursor", () => {
    const entries: Entry[] = [
      { id: "a", date: "2026-01-01T00:00:00.000Z" },
      { id: "c", date: "2026-01-02T00:00:00.000Z" },
      { id: "b", date: "2026-01-01T00:00:00.000Z" },
    ];

    const first = paginateByCursor(entries, { ...pageOptions, pageSize: 2 });
    const second = paginateByCursor(entries, {
      ...pageOptions,
      cursor: first.nextCursor,
      pageSize: 2,
    });

    expect(first.items.map((entry) => entry.id)).toEqual(["c", "b"]);
    expect(second.items.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("does not duplicate or skip records inserted after the first page", () => {
    const original: Entry[] = [
      { id: "3", date: "2026-01-03T00:00:00.000Z" },
      { id: "2", date: "2026-01-02T00:00:00.000Z" },
      { id: "1", date: "2026-01-01T00:00:00.000Z" },
    ];
    const first = paginateByCursor(original, { ...pageOptions, pageSize: 2 });
    const withInsertion = [
      { id: "4", date: "2026-01-04T00:00:00.000Z" },
      ...original,
    ];
    const second = paginateByCursor(withInsertion, {
      ...pageOptions,
      cursor: first.nextCursor,
      pageSize: 2,
    });

    expect(first.items.map((entry) => entry.id)).toEqual(["3", "2"]);
    expect(second.items.map((entry) => entry.id)).toEqual(["1"]);
  });

  it("caps page sizes and handles malformed cursors safely", () => {
    const entries = Array.from({ length: MAX_HISTORY_PAGE_SIZE + 1 }, (_, index) => ({
      id: String(index),
      date: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));

    const result = paginateByCursor(entries, {
      ...pageOptions,
      cursor: "not-a-valid-cursor",
      pageSize: 999,
    });

    expect(result.items).toHaveLength(MAX_HISTORY_PAGE_SIZE);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("paginateTransactions", () => {
  type Row = { id: string };
  const rows: Row[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const ids = (page: { transactions: Row[] }) =>
    page.transactions.map((row) => row.id);

  it("returns the first page without a cursor", () => {
    const page = paginateTransactions(rows, { limit: 2 });

    expect(ids(page)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("b");
    expect(page.staleCursor).toBe(false);
  });

  it("continues after a valid cursor in the middle of the list", () => {
    const page = paginateTransactions(rows, { cursor: "b", limit: 1 });

    expect(ids(page)).toEqual(["c"]);
    expect(page.nextCursor).toBe("c");
    expect(page.staleCursor).toBe(false);
  });

  it("returns the last page with no next cursor", () => {
    const page = paginateTransactions(rows, { cursor: "c", limit: 2 });

    expect(ids(page)).toEqual(["d"]);
    expect(page.nextCursor).toBeNull();
    expect(page.staleCursor).toBe(false);
  });

  it("returns the remainder when no limit is supplied", () => {
    const page = paginateTransactions(rows, { cursor: "a" });

    expect(ids(page)).toEqual(["b", "c", "d"]);
    expect(page.nextCursor).toBeNull();
    expect(page.staleCursor).toBe(false);
  });

  it("reports a stale cursor instead of restarting at the first page", () => {
    const page = paginateTransactions(rows, {
      cursor: "removed-row",
      limit: 2,
    });

    expect(page.transactions).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(page.staleCursor).toBe(true);
    expect(ids(page)).not.toEqual(["a", "b"]);
  });

  it("handles an empty list with and without a cursor", () => {
    expect(paginateTransactions([], { limit: 2 })).toEqual({
      transactions: [],
      nextCursor: null,
      staleCursor: false,
    });
    expect(paginateTransactions([], { cursor: "gone", limit: 2 })).toEqual({
      transactions: [],
      nextCursor: null,
      staleCursor: true,
    });
  });

  it("returns an empty page for limit 0, even with a valid cursor", () => {
    const first = paginateTransactions(rows, { limit: 0 });
    const afterCursor = paginateTransactions(rows, {
      cursor: "b",
      limit: 0,
    });

    expect(first.transactions).toEqual([]);
    expect(first.nextCursor).toBeNull();
    expect(first.staleCursor).toBe(false);
    expect(afterCursor.transactions).toEqual([]);
    expect(afterCursor.nextCursor).toBeNull();
    expect(afterCursor.staleCursor).toBe(false);
  });

  it("keeps the previous behaviour for an empty-string cursor", () => {
    const page = paginateTransactions(rows, { cursor: "", limit: 2 });

    expect(ids(page)).toEqual(["a", "b"]);
    expect(page.staleCursor).toBe(false);
  });
});
