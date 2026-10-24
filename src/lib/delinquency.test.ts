import { describe, expect, it } from "vitest";
import type { CreditLine, CreditLineStatus } from "../types/creditLine";
import { getDaysPastDue } from "./delinquency";

function makeLine({
  status = "Suspended",
  statusHistory = [],
  nextPaymentDate,
}: {
  status?: CreditLineStatus;
  statusHistory?: CreditLine["statusHistory"];
  nextPaymentDate?: string;
} = {}): CreditLine {
  return {
    id: "CL-TEST",
    name: "Test credit line",
    status,
    limit: 1000,
    utilized: 500,
    apr: 8,
    riskScore: 700,
    openedAt: "2024-01-01",
    updatedAt: "2025-02-20",
    transactions: [],
    statusHistory,
    nextPaymentDate,
  };
}

describe("getDaysPastDue", () => {
  it("counts calendar days since the suspension date", () => {
    const line = makeLine({
      statusHistory: [{ status: "Suspended", date: "2025-01-15" }],
    });

    expect(getDaysPastDue(line, new Date(2025, 1, 20))).toBe(36);
  });

  it("starts from the most recent delinquency episode after a cure", () => {
    const line = makeLine({
      statusHistory: [
        { status: "Active", date: "2025-01-01" },
        { status: "Suspended", date: "2025-01-15" },
        { status: "Active", date: "2025-02-01" },
        { status: "Suspended", date: "2025-02-10" },
      ],
    });

    expect(getDaysPastDue(line, new Date(2025, 1, 20))).toBe(10);
  });

  it("returns zero for a future-dated delinquency", () => {
    const line = makeLine({
      statusHistory: [{ status: "Suspended", date: "2025-02-21" }],
    });

    expect(getDaysPastDue(line, new Date(2025, 1, 20))).toBe(0);
  });

  it("does not count part of the current calendar day as one full day", () => {
    const line = makeLine({
      statusHistory: [{ status: "Suspended", date: "2025-02-20T11:59:00" }],
    });

    expect(getDaysPastDue(line, new Date(2025, 1, 20, 12))).toBe(0);
  });

  it("uses an earlier missed payment date as the delinquency start", () => {
    const line = makeLine({
      statusHistory: [{ status: "Suspended", date: "2025-02-10" }],
      nextPaymentDate: "2025-02-05",
    });

    expect(getDaysPastDue(line, new Date(2025, 1, 20))).toBe(15);
  });

  it("returns null for a non-delinquent line", () => {
    const line = makeLine({
      status: "Active",
      statusHistory: [{ status: "Active", date: "2025-01-01" }],
    });

    expect(getDaysPastDue(line, new Date(2025, 1, 20))).toBeNull();
  });

  it("does not count a cured earlier delinquency episode", () => {
    const line = makeLine({
      statusHistory: [
        { status: "Active", date: "2025-01-01" },
        { status: "Suspended", date: "2025-01-15" },
        { status: "Active", date: "2025-02-01" },
        { status: "Suspended", date: "2025-02-10" },
      ],
    });

    expect(getDaysPastDue(line, new Date(2025, 1, 20))).toBe(10);
  });
});
