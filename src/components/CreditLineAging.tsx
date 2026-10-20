import { AgingTag } from "./AgingTag";
import { getDaysPastDue, getDelinquencyStartDate } from "../lib/delinquency";
import type { CreditLine } from "../types/creditLine";

interface CreditLineAgingProps {
  line: CreditLine;
}

export function CreditLineAging({ line }: CreditLineAgingProps) {
  const now = new Date();
  const startDate = getDelinquencyStartDate(line, now);
  const daysPastDue = getDaysPastDue(line, now);

  if (!startDate || daysPastDue === null) return null;

  const formattedDate = startDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <AgingTag
      daysPastDue={daysPastDue}
      title={`Past due since ${formattedDate}`}
    />
  );
}
