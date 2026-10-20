import { describe, expect, it } from "vitest";
import { MOCK_CREDIT_LINES } from "../data/mockData";
import { getBorrowerRiskScore } from "./credit-summary";

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
