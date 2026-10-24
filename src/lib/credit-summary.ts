import type { CreditLine } from "../types/creditLine";

export type BorrowerRiskScore = {
  score: number | null;
  basis: "borrower" | "limit_weighted" | "none";
};

export function getBorrowerRiskScore(
  lines: readonly CreditLine[],
): BorrowerRiskScore {
  const scoreLines = lines.filter((line) => line.status !== "Closed");
  if (scoreLines.length === 0) {
    return { score: null, basis: "none" };
  }

  const borrowerScore = scoreLines[0].riskScore;
  if (scoreLines.every((line) => line.riskScore === borrowerScore)) {
    return { score: borrowerScore, basis: "borrower" };
  }

  const totalLimit = scoreLines.reduce((total, line) => total + line.limit, 0);
  if (totalLimit <= 0) {
    return { score: null, basis: "none" };
  }

  const weightedScore =
    scoreLines.reduce(
      (total, line) => total + line.riskScore * line.limit,
      0,
    ) / totalLimit;

  return { score: Math.round(weightedScore), basis: "limit_weighted" };
}

export interface CreditSummary {
  drawableLimit: number;
  availableToDraw: number;
  totalOutstanding: number;
  delinquentOutstanding: number;
}

export function summarizeCreditLines(lines: CreditLine[]): CreditSummary {
  const active = lines.filter((line) => line.status === "Active");
  const outstanding = lines.filter(
    (line) => line.status !== "Closed" && line.utilized > 0,
  );
  const delinquent = outstanding.filter(
    (line) => line.status === "Suspended" || line.status === "Defaulted",
  );

  const activeUtilized = active.reduce((sum, line) => sum + line.utilized, 0);
  const drawableLimit = active.reduce((sum, line) => sum + line.limit, 0);

  return {
    drawableLimit,
    availableToDraw: drawableLimit - activeUtilized,
    totalOutstanding: outstanding.reduce((sum, line) => sum + line.utilized, 0),
    delinquentOutstanding: delinquent.reduce((sum, line) => sum + line.utilized, 0),
  };
}
