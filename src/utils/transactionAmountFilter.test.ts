import { describe, expect, it } from "vitest";
import {
  AMOUNT_PRESETS,
  amountPresetFromUrl,
  matchesAmountFilter,
} from "./transactionAmountFilter";

describe("transaction amount presets", () => {
  it.each([99.99, 100, 999.99, 1_000, 4_999.99, 5_000, 24_999.99, 25_000])(
    "%s belongs to exactly one preset",
    (amount) => {
      const matches = AMOUNT_PRESETS.slice(1).filter(({ value }) =>
        value !== "all" && matchesAmountFilter({ kind: "preset", id: value }, amount),
      );
      expect(matches).toHaveLength(1);
    },
  );

  it("uses absolute signed amounts", () => {
    expect(matchesAmountFilter({ kind: "preset", id: "under-100" }, -50)).toBe(true);
    expect(matchesAmountFilter({ kind: "preset", id: "100-1k" }, -500)).toBe(true);
  });

  it("uses half-open custom ranges", () => {
    expect(matchesAmountFilter({ kind: "custom", min: 0, max: 100 }, 99.99)).toBe(true);
    expect(matchesAmountFilter({ kind: "custom", min: 0, max: 100 }, 100)).toBe(false);
  });

  it.each([
    ["lt100", "under-100"],
    ["100-1000", "100-1k"],
  ])("maps legacy URL value %s", (legacy, expected) => {
    expect(amountPresetFromUrl(legacy)).toBe(expected);
  });

  it("leaves legacy open-ended amounts for the custom lower-bound filter", () => {
    expect(amountPresetFromUrl("gt1000")).toBeNull();
    expect(matchesAmountFilter({ kind: "custom", min: 1_000, max: null }, 100_000)).toBe(true);
  });
});
