import { describe, expect, it } from "vitest";
import { getDrawPricingQuote } from "./draw-credit-pricing";
import { projectDraw } from "./draw-projection";
import { getDrawAmountValidation } from "@/utils/amountValidation";

const creditLine = {
  id: "cl-001",
  name: "Business Line of Credit",
  limit: 50000,
  available: 35000,
  utilization: 30,
  riskBand: "Standard" as const,
  termMonths: 12,
};

describe("projectDraw", () => {
  it("projects the fee-inclusive maximum without exceeding the limit", () => {
    const amount = 34653.47;
    const projection = projectDraw(
      creditLine,
      amount,
      getDrawPricingQuote(creditLine, amount),
    );

    expect(projection.fee).toBe(346.53);
    expect(projection.newBalance).toBe(50000);
    expect(projection.newUtilizationPct).toBe(100);
    expect(projection.remainingAvailable).toBe(0);
    expect(projection.exceedsLimit).toBe(false);
  });

  it.each([0.005, 1.005, 12.345])("rounds the fee at cent boundaries for %s", (amount) => {
    const quote = getDrawPricingQuote(creditLine, amount);
    expect(quote.fee).toBe(projectDraw(creditLine, amount, quote).fee);
  });

  it("never exceeds the limit for amounts accepted by validation", () => {
    for (let index = 1; index <= 100; index += 1) {
      const limit = 1000 + index * 137.23;
      const available = Math.max(1, limit * ((index % 90) / 100));
      const line = { ...creditLine, limit, available };
      const maximum = getDrawAmountValidation("", line).maxAmount;
      const amount = Math.floor((maximum * ((index * 37) % 101)) * 100) / 100;
      const validation = getDrawAmountValidation(amount.toFixed(2), line);

      if (validation.isValid) {
        const quote = getDrawPricingQuote(line, validation.amount);
        expect(projectDraw(line, validation.amount, quote).exceedsLimit).toBe(false);
      }
    }
  });
});