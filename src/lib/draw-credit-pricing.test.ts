import { describe, expect, it } from "vitest";
import { createCreditLine, mockCreditLines } from "@/lib/draw-credit-mock-data";
import {
  getDrawPricingQuote,
  getNextAprTier,
  projectDraw,
} from "@/lib/draw-credit-pricing";
import { CreditLine } from "@/types/draw-credit.types";

function lineById(id: string): CreditLine {
  const line = mockCreditLines.find((candidate) => candidate.id === id);

  if (!line) {
    throw new Error(`Missing mock credit line ${id}`);
  }

  return line;
}

function utilizationPoints(quote: ReturnType<typeof getDrawPricingQuote>) {
  const adjustment = quote.adjustments.find(
    (candidate) => candidate.kind === "utilization",
  );

  if (!adjustment) {
    throw new Error("Quote is missing its utilization adjustment");
  }

  return adjustment.points;
}

// ── Post-draw utilization tiers ───────────────────────────────────────────────

describe("getDrawPricingQuote — post-draw utilization tiers", () => {
  const cl001 = lineById("cl-001");

  it("prices a small draw that stays under 50% post-draw at the low adjustment", () => {
    const quote = getDrawPricingQuote(cl001, 1000);

    expect(projectDraw(cl001, 1000).utilizationAfter).toBeLessThan(50);
    expect(utilizationPoints(quote)).toBe(0.5);
    expect(quote.apr).toBe(11.5);
  });

  it("prices a draw that crosses 50% post-draw at the moderate adjustment", () => {
    const quote = getDrawPricingQuote(cl001, 10000);

    expect(projectDraw(cl001, 10000).utilizationAfter).toBeGreaterThanOrEqual(
      50,
    );
    expect(utilizationPoints(quote)).toBe(1.25);
    expect(quote.apr).toBe(12.25);
  });

  it("prices a draw that crosses 80% post-draw at the high adjustment", () => {
    const quote = getDrawPricingQuote(cl001, 25000);

    expect(projectDraw(cl001, 25000).utilizationAfter).toBeGreaterThanOrEqual(
      80,
    );
    expect(utilizationPoints(quote)).toBe(2);
    expect(quote.apr).toBe(13);
  });
});

// ── Tier boundaries ───────────────────────────────────────────────────────────

describe("getDrawPricingQuote — tier boundaries", () => {
  /** limit 20,000, 4,950 drawn: a 5,000 draw lands on exactly 50.00%. */
  const halfLine = createCreditLine({
    id: "test-50",
    name: "Half boundary",
    limit: 20000,
    utilization: 24.75,
    riskBand: "Standard",
    termMonths: 12,
  });

  /** limit 20,000, 10,950 drawn: a 5,000 draw lands on exactly 80.00%. */
  const eightyLine = createCreditLine({
    id: "test-80",
    name: "Eighty boundary",
    limit: 20000,
    utilization: 54.75,
    riskBand: "Standard",
    termMonths: 12,
  });

  it("pins exactly 50.00% post-draw to the moderate tier", () => {
    const projection = projectDraw(halfLine, 5000);

    expect(projection.utilizationAfter).toBe(50);
    expect(utilizationPoints(getDrawPricingQuote(halfLine, 5000))).toBe(1.25);
  });

  it("keeps one dollar below the 50% boundary on the low tier", () => {
    expect(projectDraw(halfLine, 4999).utilizationAfter).toBeLessThan(50);
    expect(utilizationPoints(getDrawPricingQuote(halfLine, 4999))).toBe(0.5);
  });

  it("pins exactly 80.00% post-draw to the high tier", () => {
    const projection = projectDraw(eightyLine, 5000);

    expect(projection.utilizationAfter).toBe(80);
    expect(utilizationPoints(getDrawPricingQuote(eightyLine, 5000))).toBe(2);
  });

  it("keeps one dollar below the 80% boundary on the moderate tier", () => {
    expect(projectDraw(eightyLine, 4999).utilizationAfter).toBeLessThan(80);
    expect(utilizationPoints(getDrawPricingQuote(eightyLine, 4999))).toBe(1.25);
  });
});

// ── Breakdown ─────────────────────────────────────────────────────────────────

describe("getDrawPricingQuote — breakdown", () => {
  it("returns a base APR that plus the adjustments equals the quoted APR", () => {
    for (const line of mockCreditLines) {
      for (const amount of [0, 1000, 10000, 25000]) {
        const quote = getDrawPricingQuote(line, amount);
        const summed = quote.adjustments.reduce(
          (total, adjustment) => total + adjustment.points,
          quote.baseApr,
        );

        expect(summed).toBeCloseTo(quote.apr, 2);
        expect(quote.adjustments.map((item) => item.kind)).toEqual([
          "utilization",
          "term",
        ]);
      }
    }
  });
});

// ── Monotonicity ──────────────────────────────────────────────────────────────

describe("getDrawPricingQuote — monotonic in the draw amount", () => {
  it("never lowers the APR as the draw amount increases", () => {
    for (const line of mockCreditLines) {
      let previousApr = Number.NEGATIVE_INFINITY;

      for (let amount = 0; amount <= line.available; amount += 250) {
        const { apr } = getDrawPricingQuote(line, amount);

        expect(apr).toBeGreaterThanOrEqual(previousApr);
        previousApr = apr;
      }
    }
  });

  it("never lowers the APR at single-dollar granularity", () => {
    const line = createCreditLine({
      id: "test-monotonic",
      name: "Monotonic",
      limit: 20000,
      utilization: 24.75,
      riskBand: "Prime",
      termMonths: 36,
    });
    let previousApr = Number.NEGATIVE_INFINITY;

    for (let amount = 0; amount <= line.available; amount += 1) {
      const { apr } = getDrawPricingQuote(line, amount);

      expect(apr).toBeGreaterThanOrEqual(previousApr);
      previousApr = apr;
    }
  });
});

// ── Next tier hint ────────────────────────────────────────────────────────────

describe("getNextAprTier", () => {
  const cl001 = lineById("cl-001");

  it("points at the amount above which the APR steps up", () => {
    const hint = getNextAprTier(cl001, 0);

    expect(hint).not.toBeNull();
    expect(hint?.apr).toBe(12.25);
    expect(getDrawPricingQuote(cl001, (hint?.aboveAmount ?? 0) + 1).apr).toBe(
      12.25,
    );
    expect(getDrawPricingQuote(cl001, hint?.aboveAmount ?? 0).apr).toBe(11.5);
  });

  it("returns null once no larger draw would raise the APR", () => {
    expect(getNextAprTier(cl001, cl001.available)).toBeNull();
  });
});

// ── Regression: pre-draw vs post-draw pricing ─────────────────────────────────

describe("draw pricing regression", () => {
  const cl001 = lineById("cl-001");

  it("prices a draw that crosses 80% as high instead of the pre-draw low tier", () => {
    // The old model read `creditLine.utilization` (30%), which sat in the low
    // tier, so a 25,000 draw was priced at 0.5 points.
    expect(cl001.utilization).toBeLessThan(50);
    expect(projectDraw(cl001, 25000).utilizationAfter).toBeGreaterThanOrEqual(
      80,
    );
    expect(utilizationPoints(getDrawPricingQuote(cl001, 25000))).toBe(2);
  });
});
