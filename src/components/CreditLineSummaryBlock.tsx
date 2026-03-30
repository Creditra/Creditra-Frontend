import { CreditLine } from "@/types/draw-credit.types";

interface CreditLineSummaryBlockProps {
  creditLine: CreditLine;
  amount?: number;
}

export function CreditLineSummaryBlock({
  creditLine,
  amount = 0,
}: CreditLineSummaryBlockProps) {
  const utilized = creditLine.limit - creditLine.available;
  const safeAmount = Math.max(amount, 0);
  const projectedUtilized = utilized + safeAmount;
  const projectedAvailable = Math.max(creditLine.available - safeAmount, 0);

  return (
    <section className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <header>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Credit Summary
        </h3>
        <p className="text-xs text-muted mt-1">{creditLine.name}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-muted">Limit</p>
          <p className="text-base font-semibold text-foreground mt-1">
            ${creditLine.limit.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-muted">Utilized</p>
          <p className="text-base font-semibold text-foreground mt-1">
            ${projectedUtilized.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-muted">Available</p>
          <p className="text-base font-semibold text-foreground mt-1">
            ${projectedAvailable.toLocaleString()}
          </p>
        </div>
      </div>
    </section>
  );
}
