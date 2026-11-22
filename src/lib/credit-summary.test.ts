import { describe, expect, it } from "vitest";
import { MOCK_CREDIT_LINES } from "../data/mockData";
import type { CreditLine } from "../types/creditLine";
import { getBorrowerRiskScore, summarizeCreditLines } from "./credit-summary";

describe("getBorrowerRiskScore", () => {
  it("returns the limit-weighted score across all non-Closed fixture lines", () => {
    expect(getBorrowerRiskScore(MOCK_CREDIT_LINES)).toEqual({
      score: 687,
      basis: "limit_weighted",
    });
  });

  it("returns a shared borrower score without weighting", () => {
    const lines = MOCK_CREDIT_LINES
      .filter((line) => line.status !== "Closed")
      .map((line) => ({ ...line, riskScore: 700 }));

    expect(getBorrowerRiskScore(lines)).toEqual({
      score: 700,
      basis: "borrower",
    });
  });

  it("returns no score when there are no non-Closed lines", () => {
    const closedLines = MOCK_CREDIT_LINES.filter(
      (line) => line.status === "Closed",
    );

    expect(getBorrowerRiskScore(closedLines)).toEqual({
      score: null,
      basis: "none",
    });
  });

  it("excludes Closed lines from the weighted score", () => {
    const openLines = MOCK_CREDIT_LINES.filter(
      (line) => line.status !== "Closed",
    );
    const closedLines = MOCK_CREDIT_LINES.filter(
      (line) => line.status === "Closed",
    );

    expect(getBorrowerRiskScore([...openLines, ...closedLines])).toEqual(
      getBorrowerRiskScore(openLines),
    );
  });
});

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
