export interface ScheduleRow {
  /** 1-based month number */
  month: number;
  /** Remaining principal at end of month */
  principal: number;
  /** Cumulative interest paid to end of month */
  cumulativeInterest: number;
  /** Interest component of this month's payment */
  interest: number;
  /** Principal component of this month's payment */
  principalPaid: number;
}

export interface TooltipData {
  month: number;
  principal: number;
  cumulativeInterest: number;
  x: number;
  y: number;
}

export function buildSchedule(
  principal: number,
  apr: number,
  monthlyPayment: number,
  maxMonths: number,
): ScheduleRow[] {
  if (principal <= 0 || monthlyPayment <= 0) return [];

  const monthlyRate = apr / 100 / 12;
  let remaining = principal;
  let cumInterest = 0;
  const rows: ScheduleRow[] = [];

  for (let m = 1; m <= maxMonths && remaining > 0; m++) {
    const interest = remaining * monthlyRate;
    const principalPaid = Math.min(monthlyPayment - interest, remaining);
    cumInterest += interest;
    remaining = Math.max(0, remaining - principalPaid);

    rows.push({
      month: m,
      principal: remaining,
      cumulativeInterest: cumInterest,
      interest,
      principalPaid: Math.max(0, principalPaid),
    });

    if (remaining <= 0) break;
  }

  return rows;
}
