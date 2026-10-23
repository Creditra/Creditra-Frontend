import type { CreditLine } from "../types/creditLine";

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
