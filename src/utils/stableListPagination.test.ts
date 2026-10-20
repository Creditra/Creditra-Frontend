import { describe, expect, it } from "vitest";
import {
  createStableOrder,
  getStablePage,
  reconcileStableOrder,
} from "./stableListPagination";

type Entry = { id: string; value: number };
const getId = (entry: Entry) => entry.id;

describe("stable list pagination", () => {
  it("keeps existing page membership when live updates reorder records", () => {
    const initial: Entry[] = [
      { id: "a", value: 30 },
      { id: "b", value: 20 },
      { id: "c", value: 10 },
      { id: "d", value: 0 },
    ];
    const order = createStableOrder(initial, getId);

    const liveUpdate: Entry[] = [
      { id: "c", value: 50 },
      { id: "a", value: 30 },
      { id: "b", value: 20 },
      { id: "d", value: 0 },
    ];
    const reconciled = reconcileStableOrder(order, liveUpdate, getId);

    expect(getStablePage(liveUpdate, reconciled, { pageIndex: 0, pageSize: 2, getId }).items.map(getId))
      .toEqual(["a", "b"]);
    expect(getStablePage(liveUpdate, reconciled, { pageIndex: 1, pageSize: 2, getId }).items.map(getId))
      .toEqual(["c", "d"]);
  });

  it("appends newly observed ids without shifting previously visited pages", () => {
    const initial: Entry[] = [
      { id: "a", value: 3 },
      { id: "b", value: 2 },
      { id: "c", value: 1 },
    ];
    const order = createStableOrder(initial, getId);
    const withInsertion: Entry[] = [
      { id: "new", value: 99 },
      ...initial,
    ];
    const reconciled = reconcileStableOrder(order, withInsertion, getId);

    expect(reconciled).toEqual(["a", "b", "c", "new"]);
    expect(getStablePage(withInsertion, reconciled, { pageIndex: 0, pageSize: 2, getId }).items.map(getId))
      .toEqual(["a", "b"]);
    expect(getStablePage(withInsertion, reconciled, { pageIndex: 1, pageSize: 2, getId }).items.map(getId))
      .toEqual(["c", "new"]);
  });

  it("keeps a temporary removal as an empty slot and restores it in place", () => {
    const initial: Entry[] = [
      { id: "a", value: 3 },
      { id: "b", value: 2 },
      { id: "c", value: 1 },
    ];
    const order = createStableOrder(initial, getId);
    const withoutB = initial.filter((entry) => entry.id !== "b");

    expect(getStablePage(withoutB, order, { pageIndex: 0, pageSize: 2, getId }).items.map(getId))
      .toEqual(["a"]);
    expect(getStablePage(withoutB, order, { pageIndex: 1, pageSize: 2, getId }).items.map(getId))
      .toEqual(["c"]);

    expect(getStablePage(initial, order, { pageIndex: 0, pageSize: 2, getId }).items.map(getId))
      .toEqual(["a", "b"]);
  });

  it("deduplicates malformed ids and clamps invalid pagination boundaries", () => {
    const records: Entry[] = [
      { id: "a", value: 1 },
      { id: "a", value: 999 },
      { id: "b", value: 2 },
    ];
    const order = createStableOrder(records, getId);
    const page = getStablePage(records, order, {
      pageIndex: 999,
      pageSize: 0,
      getId,
    });

    expect(order).toEqual(["a", "b"]);
    expect(page.pageIndex).toBe(1);
    expect(page.pageCount).toBe(2);
    expect(page.items).toEqual([{ id: "b", value: 2 }]);
  });
});
