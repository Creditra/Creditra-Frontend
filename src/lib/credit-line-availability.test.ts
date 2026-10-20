import { describe, expect, it } from "vitest";
import {
  getDrawAvailability,
  normalizeCreditLineAvailability,
} from "@/lib/credit-line-availability";
import { mockCreditLines } from "@/lib/draw-credit-mock-data";

describe("getDrawAvailability", () => {
  it("derives the drawable balance from authoritative utilization", () => {
    expect(getDrawAvailability(50_000, 30)).toBe(35_000);
    expect(getDrawAvailability(100_000, 55)).toBe(45_000);
    expect(getDrawAvailability(75_000, 84)).toBe(12_000);
  });

  it("returns the full limit when nothing is utilized (0%)", () => {
    expect(getDrawAvailability(50_000, 0)).toBe(50_000);
  });

  it("returns zero when the line is fully utilized (100%)", () => {
    expect(getDrawAvailability(50_000, 100)).toBe(0);
  });

  it("clamps utilization above 100% to zero availability (invalid input)", () => {
    expect(getDrawAvailability(50_000, 120)).toBe(0);
    expect(getDrawAvailability(50_000, 1_000)).toBe(0);
  });

  it("treats negative utilization as fully available", () => {
    expect(getDrawAvailability(50_000, -10)).toBe(50_000);
  });

  it("floors fractional results to whole USD", () => {
    expect(getDrawAvailability(1_000, 33.33)).toBe(667);
    expect(getDrawAvailability(1_000, 50.5)).toBe(495);
  });

  it("treats non-finite utilization as fully available (no authority)", () => {
    expect(getDrawAvailability(50_000, Number.NaN)).toBe(50_000);
    expect(getDrawAvailability(50_000, Number.POSITIVE_INFINITY)).toBe(50_000);
  });

  it("returns zero for a non-positive or non-finite limit", () => {
    expect(getDrawAvailability(0, 30)).toBe(0);
    expect(getDrawAvailability(-5_000, 30)).toBe(0);
    expect(getDrawAvailability(Number.NaN, 30)).toBe(0);
  });

  it("is deterministic for duplicate inputs", () => {
    const first = getDrawAvailability(25_000, 40);
    expect(getDrawAvailability(25_000, 40)).toBe(first);
    expect(getDrawAvailability(25_000, 40)).toBe(first);
  });
});

describe("normalizeCreditLineAvailability", () => {
  it("re-derives available from authoritative utilization and preserves other fields", () => {
    const stale = {
      id: "cl-001",
      name: "Business Line of Credit",
      limit: 50_000,
      available: 20_000,
      utilization: 30,
      riskBand: "Standard" as const,
      termMonths: 24,
    };

    const normalized = normalizeCreditLineAvailability(stale);

    expect(normalized.available).toBe(35_000);
    expect(normalized.id).toBe("cl-001");
    expect(normalized.name).toBe("Business Line of Credit");
    expect(normalized.limit).toBe(50_000);
    expect(normalized.utilization).toBe(30);
    expect(normalized.riskBand).toBe("Standard");
    expect(normalized.termMonths).toBe(24);
  });

  it("clamps utilization above 100% to zero availability", () => {
    const normalized = normalizeCreditLineAvailability({
      id: "cl-x",
      name: "Overdrawn",
      limit: 10_000,
      available: 9_999,
      utilization: 120,
      riskBand: "Watch",
      termMonths: 12,
    });

    expect(normalized.available).toBe(0);
  });

  it("does not mutate the input object", () => {
    const stale = {
      id: "cl-001",
      name: "Business Line of Credit",
      limit: 50_000,
      available: 20_000,
      utilization: 30,
      riskBand: "Standard" as const,
      termMonths: 24,
    };

    normalizeCreditLineAvailability(stale);

    expect(stale.available).toBe(20_000);
  });
});

describe("mockCreditLines invariant", () => {
  it("keeps every stored `available` in sync with authoritative utilization", () => {
    for (const line of mockCreditLines) {
      expect(line.available).toBe(
        getDrawAvailability(line.limit, line.utilization),
      );
    }
  });

  it("keeps derived availability within the valid range for every stored line", () => {
    for (const line of mockCreditLines) {
      expect(line.available).toBeGreaterThanOrEqual(0);
      expect(line.available).toBeLessThanOrEqual(line.limit);
    }
  });
});