import { describe, expect, it } from "vitest";
import { MOCK_CREDIT_LINES } from "../data/mockData";
import type { CreditLine } from "../types/creditLine";
import {
  getBorrowerRiskScore,
  summarizeCreditLines,
  summarizeCreditLinesExact,
  lineMoney,
  utilisationBps,
  bpsToPercent,
} from "./credit-summary";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const line = (
  id: string,
  status: CreditLine["status"],
  limit: number,
  utilized: number,
): CreditLine => ({
  id,
  name: id,
  status,
  limit,
  utilized,
  apr: 0,
  riskScore: 0,
  openedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  transactions: [],
  statusHistory: [],
});

// ---------------------------------------------------------------------------
// lineMoney
// ---------------------------------------------------------------------------

describe("lineMoney", () => {
  it("converts a whole-dollar value", () => {
    const m = lineMoney(100);
    expect(m.units).toBe(10000n);
    expect(m.decimals).toBe(2);
    expect(m.asset).toBe("USD");
  });

  it("converts a fractional value exactly", () => {
    const m = lineMoney(0.1);
    expect(m.units).toBe(10n); // 0.10 = 10 cents
  });

  it("returns zero for negative input", () => {
    expect(lineMoney(-1).units).toBe(0n);
  });

  it("returns zero for non-finite input", () => {
    expect(lineMoney(NaN).units).toBe(0n);
    expect(lineMoney(Infinity).units).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// utilisationBps / bpsToPercent
// ---------------------------------------------------------------------------

describe("utilisationBps", () => {
  it("returns 5000 bps for 50 % utilisation", () => {
    expect(utilisationBps(lineMoney(500), lineMoney(1000))).toBe(5000);
  });

  it("returns 0 for zero limit", () => {
    expect(utilisationBps(lineMoney(100), lineMoney(0))).toBe(0);
  });

  it("returns 10000 bps for 100 %", () => {
    expect(utilisationBps(lineMoney(1000), lineMoney(1000))).toBe(10000);
  });

  it("handles sub-cent utilisation without float drift", () => {
    // 1/3 of 300 = 100 exactly
    const bps = utilisationBps(lineMoney(100), lineMoney(300));
    expect(bpsToPercent(bps)).toBe(33);
  });
});

describe("bpsToPercent", () => {
  it("converts 5000 bps to 50 %", () => {
    expect(bpsToPercent(5000)).toBe(50);
  });

  it("rounds half-up", () => {
    expect(bpsToPercent(3350)).toBe(34); // 33.5 → 34
  });
});

// ---------------------------------------------------------------------------
// getBorrowerRiskScore
// ---------------------------------------------------------------------------

describe("getBorrowerRiskScore", () => {
  it("returns the limit-weighted score across all non-Closed fixture lines", () => {
    expect(getBorrowerRiskScore(MOCK_CREDIT_LINES)).toEqual({
      score: 687,
      basis: "limit_weighted",
    });
  });

  it("returns a shared borrower score without weighting", () => {
    const lines = MOCK_CREDIT_LINES
      .filter((l) => l.status !== "Closed")
      .map((l) => ({ ...l, riskScore: 700 }));

    expect(getBorrowerRiskScore(lines)).toEqual({
      score: 700,
      basis: "borrower",
    });
  });

  it("returns no score when there are no non-Closed lines", () => {
    const closedLines = MOCK_CREDIT_LINES.filter(
      (l) => l.status === "Closed",
    );
    expect(getBorrowerRiskScore(closedLines)).toEqual({
      score: null,
      basis: "none",
    });
  });

  it("excludes Closed lines from the weighted score", () => {
    const openLines = MOCK_CREDIT_LINES.filter((l) => l.status !== "Closed");
    const closedLines = MOCK_CREDIT_LINES.filter((l) => l.status === "Closed");
    expect(getBorrowerRiskScore([...openLines, ...closedLines])).toEqual(
      getBorrowerRiskScore(openLines),
    );
  });
});

// ---------------------------------------------------------------------------
// summarizeCreditLines — numeric API (existing contract preserved)
// ---------------------------------------------------------------------------

describe("summarizeCreditLines", () => {
  it("includes suspended and defaulted balances in outstanding while keeping availability active-only", () => {
    const summary = summarizeCreditLines([
      line("active", "Active", 600_000, 397_500),
      line("suspended", "Suspended", 100_000, 70_000),
      line("defaulted", "Defaulted", 200_000, 50_000),
      line("frozen", "Frozen", 80_000, 0),
      line("closed", "Closed", 90_000, 90_000),
    ]);

    expect(summary).toEqual({
      drawableLimit: 600_000,
      availableToDraw: 202_500,
      totalOutstanding: 517_500,
      delinquentOutstanding: 120_000,
    });
  });

  it("counts frozen balances as outstanding but excludes closed balances", () => {
    const summary = summarizeCreditLines([
      line("frozen", "Frozen", 10_000, 2_500),
      line("closed", "Closed", 10_000, 9_000),
    ]);

    expect(summary.totalOutstanding).toBe(2_500);
    expect(summary.delinquentOutstanding).toBe(0);
    expect(summary.availableToDraw).toBe(0);
  });

  // ── New: exact arithmetic edge cases ──────────────────────────────────────

  it("sums 1,000 lines of 0.1 utilised exactly (no float drift)", () => {
    const lines = Array.from({ length: 1_000 }, (_, i) =>
      line(`cl-${i}`, "Active", 1, 0.1),
    );
    const summary = summarizeCreditLines(lines);
    // 1,000 × 0.1 = 100.00 exactly; float addition gives ~99.99999999999983
    expect(summary.totalOutstanding).toBe(100);
    expect(summary.availableToDraw).toBe(900);
  });

  it("handles values near Number.MAX_SAFE_INTEGER without precision loss", () => {
    // 2^53 - 1 = 9_007_199_254_740_991 — cannot be summed as floats without drift
    const bigVal = 9_007_199_254_740_991;
    const summary = summarizeCreditLines([
      line("big", "Active", bigVal, bigVal),
    ]);
    expect(summary.drawableLimit).toBe(bigVal);
    expect(summary.totalOutstanding).toBe(bigVal);
    expect(summary.availableToDraw).toBe(0);
  });

  it("excludes Closed and Frozen lines from drawable limit", () => {
    const summary = summarizeCreditLines([
      line("active", "Active", 1000, 0),
      line("closed", "Closed", 999, 0),
      line("frozen", "Frozen", 888, 0),
    ]);
    expect(summary.drawableLimit).toBe(1000);
    expect(summary.availableToDraw).toBe(1000);
  });

  it("zero-limit active line contributes zero to utilisation", () => {
    const summary = summarizeCreditLines([
      line("zero", "Active", 0, 0),
      line("normal", "Active", 500, 100),
    ]);
    expect(summary.drawableLimit).toBe(500);
    expect(summary.availableToDraw).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// summarizeCreditLinesExact — Money variant
// ---------------------------------------------------------------------------

describe("summarizeCreditLinesExact", () => {
  it("returns Money objects for each field", () => {
    const summary = summarizeCreditLinesExact([
      line("active", "Active", 1000, 400),
    ]);
    expect(typeof summary.drawableLimit.units).toBe("bigint");
    expect(summary.drawableLimit.asset).toBe("USD");
  });

  it("matches numeric summarizeCreditLines for typical inputs", () => {
    const lines = [
      line("active", "Active", 600_000, 397_500),
      line("suspended", "Suspended", 100_000, 70_000),
      line("defaulted", "Defaulted", 200_000, 50_000),
    ];
    const numeric = summarizeCreditLines(lines);
    const exact = summarizeCreditLinesExact(lines);

    expect(Number(exact.drawableLimit.units) / 100).toBe(numeric.drawableLimit);
    expect(Number(exact.totalOutstanding.units) / 100).toBe(numeric.totalOutstanding);
    expect(Number(exact.delinquentOutstanding.units) / 100).toBe(numeric.delinquentOutstanding);
  });

  it("sums 1,000 × 0.1 exactly in Money units", () => {
    const lines = Array.from({ length: 1_000 }, (_, i) =>
      line(`cl-${i}`, "Active", 1, 0.1),
    );
    const exact = summarizeCreditLinesExact(lines);
    // 1,000 × 10 cents = 10,000 cents = 100.00
    expect(exact.totalOutstanding.units).toBe(10_000n);
  });
});
