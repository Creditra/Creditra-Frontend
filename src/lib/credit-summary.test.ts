import { describe, expect, it } from "vitest";
import type { CreditLine } from "../types/creditLine";
import { summarizeCreditLines } from "./credit-summary";

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
});
