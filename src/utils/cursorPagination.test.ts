import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY_PAGE_SIZE,
  paginateByCursor,
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
