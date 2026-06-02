import { CreditLine } from "@/types/draw-credit.types";
import { DollarSign, TrendingUp } from "lucide-react";
import { formatMoney } from "@/utils/amountValidation";

interface PreviewSectionProps {
  creditLine: CreditLine;
  amount: number;
}

export function PreviewSection({ creditLine, amount }: PreviewSectionProps) {
  const utilizedBalance = creditLine.limit - creditLine.available;
  const safeAmount = Math.max(amount, 0);
  // Mock pricing keeps the UX explicit until backend quote fields are available.
  const fee = safeAmount > 0 ? Math.round(safeAmount * 0.01 * 100) / 100 : 0;
  const apr = 12.5;
  const estimatedMonthlyInterest =
    safeAmount > 0 ? Math.round(((safeAmount * apr) / 100 / 12) * 100) / 100 : 0;
  const newBalance = utilizedBalance + safeAmount + fee;
  const newUtilization = Math.round(
    (newBalance / creditLine.limit) * 100,
  );
  const remainingAvailable = Math.max(creditLine.limit - newBalance, 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-muted">Step 3</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">
          Preview draw
        </h2>
        <p className="mt-1 text-sm text-muted">
          Review estimated costs and projected balance before confirming.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 shadow-lg shadow-blue-500/5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted font-medium mb-2">Draw Amount</p>
              <p className="text-2xl font-bold text-blue-400">
                {formatMoney(safeAmount)}
              </p>
            </div>
            <DollarSign className="w-5 h-5 text-blue-500 shrink-0" />
          </div>
        </div>

        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 shadow-lg shadow-green-500/5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted font-medium mb-2">
                New Utilization
              </p>
              <p className="text-2xl font-bold text-green-400">
                {newUtilization}%
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-500 shrink-0" />
          </div>
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <dt className="text-muted">Estimated fee</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(fee)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <dt className="text-muted">Estimated monthly interest</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(estimatedMonthlyInterest)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <dt className="text-muted">New balance</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(newBalance)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <dt className="text-muted">Available after draw</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(remainingAvailable)}
          </dd>
        </div>
      </dl>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Current utilization</span>
          <span className="font-semibold text-foreground">
            {creditLine.utilization}%
          </span>
        </div>
        <div className="w-full bg-border rounded-full h-2.5">
          <div
            className="bg-blue-500 h-2.5 rounded-full"
            style={{ width: `${creditLine.utilization}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">After draw</span>
          <span
            className={`font-semibold ${newUtilization > 80 ? "text-yellow-500" : "text-foreground"}`}
          >
            {newUtilization}%
          </span>
        </div>
        <div className="w-full bg-border rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              newUtilization > 80 ? "bg-yellow-500" : "bg-blue-500"
            }`}
            style={{ width: `${newUtilization}%` }}
          />
        </div>
      </div>
    </div>
  );
}
