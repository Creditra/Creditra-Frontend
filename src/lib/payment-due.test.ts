import { describe, expect, it } from "vitest";
import { getPaymentDueState } from "./payment-due";

describe("getPaymentDueState", () => {
  const now = new Date(2025, 2, 1); // 2025-03-01 (local)

  it("returns 'none' when there is no scheduled payment", () => {
    expect(getPaymentDueState({}, now)).toBe("none");
    expect(getPaymentDueState({ nextPaymentDate: undefined }, now)).toBe("none");
  });

  it("returns 'none' for an unparseable date", () => {
    expect(getPaymentDueState({ nextPaymentDate: "not-a-date" }, now)).toBe("none");
  });

  it("returns 'overdue' when the due day is before today", () => {
    expect(getPaymentDueState({ nextPaymentDate: "2025-02-28" }, now)).toBe("overdue");
  });

  it("returns 'due_today' when the due day is today", () => {
    expect(getPaymentDueState({ nextPaymentDate: "2025-03-01" }, now)).toBe("due_today");
  });

  it("returns 'upcoming' when the due day is after today", () => {
    expect(getPaymentDueState({ nextPaymentDate: "2025-03-02" }, now)).toBe("upcoming");
  });

  it("reads a date-only string in local time (no UTC off-by-one)", () => {
    // Midnight local on the due day is still 'due_today', not 'overdue'.
    const midnight = new Date(2025, 2, 1, 0, 0, 0);
    expect(getPaymentDueState({ nextPaymentDate: "2025-03-01" }, midnight)).toBe(
      "due_today",
    );
  });

  it("accepts a full ISO timestamp", () => {
    expect(getPaymentDueState({ nextPaymentDate: "2025-02-25T09:00:00Z" }, now)).toBe(
      "overdue",
    );
  });
});
