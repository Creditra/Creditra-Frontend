import { describe, expect, it } from "vitest";
import type { CreditLine } from "../types/creditLine";
import { getPaymentDueState } from "./payment-due";

function makeLine(overrides: Partial<CreditLine> = {}): CreditLine {
  return {
    id: "CL-TEST-001",
    name: "Test Credit Line",
    status: "Active",
    limit: 50000,
    utilized: 10000,
    apr: 12,
    riskScore: 720,
    openedAt: "2024-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    transactions: [],
    statusHistory: [],
    nextPaymentAmount: 500,
    ...overrides,
  };
}

describe("getPaymentDueState (Issue #1200)", () => {
  const baseNow = new Date(2026, 9, 19, 12, 0, 0); // 2026-10-19 12:00:00 local time

  it("Row 1: Due 3 days ago -> returns kind: overdue, days: 3", () => {
    // 3 calendar days before Oct 19 is Oct 16
    const line = makeLine({ nextPaymentDate: "2026-10-16" });
    const result = getPaymentDueState(line, baseNow);
    expect(result.kind).toBe("overdue");
    expect(result.days).toBe(3);
  });

  it("Row 2: Due today at 23:59, now at 08:00 -> returns kind: due_today, days: 0", () => {
    const morning = new Date(2026, 9, 19, 8, 0, 0);
    const line = makeLine({ nextPaymentDate: "2026-10-19T23:59:00" });
    const result = getPaymentDueState(line, morning);
    expect(result.kind).toBe("due_today");
    expect(result.days).toBe(0);
  });

  it("Row 3: Due in 5 days -> returns kind: upcoming, days: 5", () => {
    // 5 calendar days after Oct 19 is Oct 24
    const line = makeLine({ nextPaymentDate: "2026-10-24" });
    const result = getPaymentDueState(line, baseNow);
    expect(result.kind).toBe("upcoming");
    expect(result.days).toBe(5);
  });

  it("Row 4: Due in 10 days -> returns kind: none, days: 10", () => {
    // 10 calendar days after Oct 19 is Oct 29
    const line = makeLine({ nextPaymentDate: "2026-10-29" });
    const result = getPaymentDueState(line, baseNow);
    expect(result.kind).toBe("none");
    expect(result.days).toBe(10);
  });

  it("Row 5: Ordering with mixed lines -> overdue lines sort before due_today, then upcoming", () => {
    const lineOverdue = makeLine({ id: "CL-OVERDUE", nextPaymentDate: "2026-10-17" }); // 2 days overdue
    const lineDueToday = makeLine({ id: "CL-TODAY", nextPaymentDate: "2026-10-19" }); // due today
    const lineUpcoming = makeLine({ id: "CL-UPCOMING", nextPaymentDate: "2026-10-22" }); // in 3 days

    const stateOverdue = getPaymentDueState(lineOverdue, baseNow);
    const stateDueToday = getPaymentDueState(lineDueToday, baseNow);
    const stateUpcoming = getPaymentDueState(lineUpcoming, baseNow);

    expect(stateOverdue.kind).toBe("overdue");
    expect(stateDueToday.kind).toBe("due_today");
    expect(stateUpcoming.kind).toBe("upcoming");

    const lines = [lineUpcoming, lineOverdue, lineDueToday];
    const orderPriority = { overdue: 1, due_today: 2, upcoming: 3, none: 4 };

    const sorted = [...lines].sort((a, b) => {
      const stateA = getPaymentDueState(a, baseNow);
      const stateB = getPaymentDueState(b, baseNow);
      return orderPriority[stateA.kind] - orderPriority[stateB.kind];
    });

    expect(sorted.map((l) => l.id)).toEqual(["CL-OVERDUE", "CL-TODAY", "CL-UPCOMING"]);
  });

  it("Row 6: Suspended line overdue -> returns kind: overdue", () => {
    const line = makeLine({
      status: "Suspended",
      nextPaymentDate: "2026-10-15", // 4 days overdue
    });
    const result = getPaymentDueState(line, baseNow);
    expect(result.kind).toBe("overdue");
    expect(result.days).toBe(4);
  });

  it("Row 7: Regression on main: past due dates (daysUntil <= 0) were dropped, now detected as overdue or due_today", () => {
    // On main: Math.ceil((new Date(cl.nextPaymentDate).getTime() - Date.now()) / 86400000) <= 0 dropped all notices
    const linePast = makeLine({ nextPaymentDate: "2025-03-01" });
    const result = getPaymentDueState(linePast, baseNow);
    expect(result.kind).toBe("overdue");
    expect(result.days).toBeGreaterThan(0);
  });

  it("ignores non-active/suspended lines such as Closed or Defaulted", () => {
    const lineClosed = makeLine({ status: "Closed", nextPaymentDate: "2026-10-16" });
    const lineDefaulted = makeLine({ status: "Defaulted", nextPaymentDate: "2026-10-16" });

    expect(getPaymentDueState(lineClosed, baseNow).kind).toBe("none");
    expect(getPaymentDueState(lineDefaulted, baseNow).kind).toBe("none");
  });

  it("handles missing or invalid nextPaymentDate gracefully", () => {
    expect(getPaymentDueState(makeLine({ nextPaymentDate: undefined }), baseNow)).toEqual({
      kind: "none",
      days: 0,
    });
    expect(getPaymentDueState(makeLine({ nextPaymentDate: "invalid-date" }), baseNow)).toEqual({
      kind: "none",
      days: 0,
    });
  });

  it("handles 1 day overdue correctly", () => {
    const line = makeLine({ nextPaymentDate: "2026-10-18" });
    const result = getPaymentDueState(line, baseNow);
    expect(result.kind).toBe("overdue");
    expect(result.days).toBe(1);
  });

  it("handles 1 day upcoming correctly", () => {
    const line = makeLine({ nextPaymentDate: "2026-10-20" });
    const result = getPaymentDueState(line, baseNow);
    expect(result.kind).toBe("upcoming");
    expect(result.days).toBe(1);
  });
});
