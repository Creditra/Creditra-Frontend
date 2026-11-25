import { beforeEach, describe, expect, it } from "vitest";
import { TRANSACTION_PRESETS_STORAGE_KEY } from "../constants/storageKeys";
import {
  DEFAULT_FILTERS,
  serializeTransactionFilters,
} from "./transaction-filters";
import {
  BUILTIN_TRANSACTION_PRESETS,
  MAX_TRANSACTION_PRESETS,
  deletePreset,
  isBuiltinPreset,
  loadPresets,
  savePreset,
  type TransactionPreset,
} from "./transaction-presets";

const userPresets = (presets: TransactionPreset[]) =>
  presets.filter((preset) => !isBuiltinPreset(preset.id));

const filterQuery = (overrides: Partial<typeof DEFAULT_FILTERS>) =>
  serializeTransactionFilters({ ...DEFAULT_FILTERS, ...overrides, page: 1 });

describe("transaction presets", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("ships a built-in overdue fees preset that cannot be deleted", () => {
    const presets = loadPresets();

    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      id: BUILTIN_TRANSACTION_PRESETS[0].id,
      name: "My overdue fees",
      query: "type=Fee&status=Pending",
    });
    expect(isBuiltinPreset(presets[0].id)).toBe(true);

    const afterDelete = deletePreset(presets[0].id);
    expect(afterDelete.map((preset) => preset.id)).toEqual([presets[0].id]);
  });

  it("persists a named preset with the page removed from the query", () => {
    const query = filterQuery({
      type: "Draw",
      status: "Pending",
      q: "equipment",
      page: 4,
    });

    const saved = savePreset("  My   draws ", query);
    const users = userPresets(saved);

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ name: "My draws", query });
    expect(users[0].query).not.toContain("page=");

    expect(userPresets(loadPresets())).toEqual(users);
  });

  it("accepts a preset object as well as name and query arguments", () => {
    const saved = savePreset({
      name: "Draws",
      query: filterQuery({ type: "Draw" }),
    });

    expect(userPresets(saved)).toHaveLength(1);
    expect(userPresets(saved)[0]).toMatchObject({
      name: "Draws",
      query: "type=Draw",
    });
  });

  it("replaces a preset when the same name is saved again, case-insensitively", () => {
    savePreset("Fees", filterQuery({ type: "Fee" }));
    savePreset("fees", filterQuery({ type: "Fee", status: "Pending" }));

    const users = userPresets(loadPresets());
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("fees");
    expect(users[0].query).toBe("type=Fee&status=Pending");
  });

  it("ignores an empty name", () => {
    expect(userPresets(savePreset("   ", filterQuery({ type: "Fee" })))).toEqual(
      [],
    );
  });

  it("does not shadow the built-in preset name", () => {
    const result = savePreset("My overdue fees", filterQuery({ type: "Fee" }));

    expect(userPresets(result)).toEqual([]);
    expect(result).toHaveLength(1);
  });

  it(`caps user presets at ${MAX_TRANSACTION_PRESETS}`, () => {
    for (let index = 1; index <= MAX_TRANSACTION_PRESETS + 2; index += 1) {
      savePreset(`Preset ${index}`, filterQuery({ q: `search-${index}` }));
    }

    const users = userPresets(loadPresets());
    expect(users).toHaveLength(MAX_TRANSACTION_PRESETS);
    expect(users.some((preset) => preset.name === `Preset ${MAX_TRANSACTION_PRESETS + 1}`)).toBe(
      false,
    );
  });

  it("deletes a user preset from storage", () => {
    const saved = savePreset("Fees", filterQuery({ type: "Fee" }));
    const target = userPresets(saved)[0];

    const remaining = deletePreset(target.id);

    expect(userPresets(remaining)).toEqual([]);
    expect(userPresets(loadPresets())).toEqual([]);
    expect(remaining).toHaveLength(1);
  });

  it("ignores corrupt or tampered storage without crashing", () => {
    window.localStorage.setItem(TRANSACTION_PRESETS_STORAGE_KEY, "{not json");
    expect(userPresets(loadPresets())).toEqual([]);

    window.localStorage.setItem(
      TRANSACTION_PRESETS_STORAGE_KEY,
      JSON.stringify({ presets: [] }),
    );
    expect(userPresets(loadPresets())).toEqual([]);

    window.localStorage.setItem(
      TRANSACTION_PRESETS_STORAGE_KEY,
      JSON.stringify([
        null,
        "nope",
        { id: "bad-type", name: "Bad type", query: "type=Bogus" },
        { id: "bad-page", name: "Bad page", query: "type=Fee&page=2" },
        { id: "bad-date", name: "Bad date", query: "start=2025-02-30" },
        { id: BUILTIN_TRANSACTION_PRESETS[0].id, name: "Shadow", query: "type=Fee" },
        { id: "good", name: "Good", query: "type=Fee" },
      ]),
    );

    expect(userPresets(loadPresets())).toEqual([
      { id: "good", name: "Good", query: "type=Fee" },
    ]);
  });

  it("rejects a non-canonical query on save", () => {
    const result = savePreset("Paged", "type=Fee&page=2");

    expect(userPresets(result)).toEqual([]);
  });

  it("degrades to built-in presets when storage is unavailable", () => {
    const originalStorage = window.localStorage;
    const unavailable = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
      removeItem: () => {
        throw new Error("storage unavailable");
      },
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as Storage;

    Object.defineProperty(window, "localStorage", {
      value: unavailable,
      configurable: true,
    });

    try {
      expect(loadPresets().map((preset) => preset.id)).toEqual([
        BUILTIN_TRANSACTION_PRESETS[0].id,
      ]);
      expect(
        userPresets(savePreset("Fees", filterQuery({ type: "Fee" }))),
      ).toEqual([]);
    } finally {
      Object.defineProperty(window, "localStorage", {
        value: originalStorage,
        configurable: true,
      });
    }
  });
});
