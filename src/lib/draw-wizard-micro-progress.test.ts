import { describe, expect, it } from "vitest";
import {
  buildMicroProgressAnnouncement,
  computeDrawWizardMicroProgress,
} from "@/lib/draw-wizard-micro-progress";
import type { CreditLine } from "@/types/draw-credit.types";

const standardLine: CreditLine = {
  id: "cl-001",
  name: "Business Line of Credit",
  status: "Active",
  limit: 50000,
  available: 35000,
  utilization: 30,
  riskBand: "Standard",
  termMonths: 24,
};

describe("computeDrawWizardMicroProgress", () => {
  it("returns muted select, amount, preview, and confirm when nothing is chosen", () => {
    const steps = computeDrawWizardMicroProgress({
      selectedCreditLine: null,
      amount: 0,
      confirmationAcknowledged: false,
      isOnConfirmStep: false,
    });

    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.tone)).toEqual([
      "muted",
      "muted",
      "muted",
      "muted",
    ]);
    expect(steps[0].label).toBe("Select a line");
  });

  it("marks select as success once a line is chosen", () => {
    const steps = computeDrawWizardMicroProgress({
      selectedCreditLine: standardLine,
      amount: 0,
      confirmationAcknowledged: false,
      isOnConfirmStep: false,
    });

    expect(steps[0]).toMatchObject({
      id: "select",
      tone: "success",
      label: "Line selected",
    });
    expect(steps[1].tone).toBe("muted");
    expect(steps[1].label).toBe("Enter amount");
  });

  it("marks amount as success and preview as ready when amount is in bounds", () => {
    const steps = computeDrawWizardMicroProgress({
      selectedCreditLine: standardLine,
      amount: 5000,
      confirmationAcknowledged: false,
      isOnConfirmStep: false,
    });

    expect(steps[1]).toMatchObject({
      id: "amount",
      tone: "success",
      label: "Amount valid",
    });
    expect(steps[2]).toMatchObject({
      id: "preview",
      tone: "success",
      label: "Preview ready",
    });
  });

  it("marks amount as warning when amount exceeds available credit", () => {
    const steps = computeDrawWizardMicroProgress({
      selectedCreditLine: standardLine,
      amount: 40000,
      confirmationAcknowledged: false,
      isOnConfirmStep: false,
    });

    expect(steps[1]).toMatchObject({
      tone: "warning",
      label: "Amount out of bounds",
    });
    expect(steps[2].tone).toBe("muted");
  });

  it("marks confirm as warning on confirm step until terms are acknowledged", () => {
    const steps = computeDrawWizardMicroProgress({
      selectedCreditLine: standardLine,
      amount: 1000,
      confirmationAcknowledged: false,
      isOnConfirmStep: true,
    });

    expect(steps[3]).toMatchObject({
      id: "confirm",
      tone: "warning",
      label: "Acknowledge terms",
    });
  });

  it("marks confirm as success when terms are acknowledged on confirm step", () => {
    const steps = computeDrawWizardMicroProgress({
      selectedCreditLine: standardLine,
      amount: 1000,
      confirmationAcknowledged: true,
      isOnConfirmStep: true,
    });

    expect(steps[3]).toMatchObject({
      tone: "success",
      label: "Terms acknowledged",
    });
  });
});

describe("buildMicroProgressAnnouncement", () => {
  it("returns empty string on first render (no prior snapshot)", () => {
    const current = computeDrawWizardMicroProgress({
      selectedCreditLine: standardLine,
      amount: 1000,
      confirmationAcknowledged: false,
      isOnConfirmStep: false,
    });

    expect(buildMicroProgressAnnouncement(null, current)).toBe("");
  });

  it("announces only steps whose state changed", () => {
    const before = computeDrawWizardMicroProgress({
      selectedCreditLine: null,
      amount: 0,
      confirmationAcknowledged: false,
      isOnConfirmStep: false,
    });
    const after = computeDrawWizardMicroProgress({
      selectedCreditLine: standardLine,
      amount: 0,
      confirmationAcknowledged: false,
      isOnConfirmStep: false,
    });

    const announcement = buildMicroProgressAnnouncement(before, after);
    expect(announcement).toContain("Select line:");
    expect(announcement).toContain("Business Line of Credit");
  });
});
