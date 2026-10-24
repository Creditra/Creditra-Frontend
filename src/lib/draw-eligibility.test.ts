import { describe, expect, it } from "vitest";
import { getDrawEligibility } from "@/lib/draw-eligibility";
import { createCreditLine } from "@/lib/draw-credit-mock-data";
import type { CreditLineStatus } from "@/types/creditLine";

function line(status: CreditLineStatus, utilization = 25) {
  return createCreditLine({
    id: `cl-${status.toLowerCase()}`,
    name: `${status} line`,
    status,
    limit: 10_000,
    utilization,
    riskBand: "Standard",
    termMonths: 12,
  });
}

describe("getDrawEligibility", () => {
  it("allows an Active line with available credit", () => {
    expect(getDrawEligibility(line("Active"))).toEqual({ eligible: true });
  });

  it("blocks an Active line with no available credit", () => {
    expect(getDrawEligibility(line("Active", 100))).toEqual({
      eligible: false,
      reason: "no_available",
    });
  });

  it("blocks Suspended lines even when credit is available", () => {
    expect(getDrawEligibility(line("Suspended"))).toEqual({
      eligible: false,
      reason: "suspended",
    });
  });

  it("blocks Defaulted lines even when credit is available", () => {
    expect(getDrawEligibility(line("Defaulted"))).toEqual({
      eligible: false,
      reason: "defaulted",
    });
  });

  it("blocks Frozen lines even when credit is available", () => {
    expect(getDrawEligibility(line("Frozen"))).toEqual({
      eligible: false,
      reason: "frozen",
    });
  });

  it("blocks Closed lines even when credit is available", () => {
    expect(getDrawEligibility(line("Closed"))).toEqual({
      eligible: false,
      reason: "closed",
    });
  });

  it("reports the lifecycle status before no_available for blocked lines", () => {
    expect(getDrawEligibility(line("Frozen", 100))).toEqual({
      eligible: false,
      reason: "frozen",
    });
    expect(getDrawEligibility(line("Suspended", 100))).toEqual({
      eligible: false,
      reason: "suspended",
    });
  });
});
