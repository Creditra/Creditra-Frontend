import { CreditLine } from "@/types/draw-credit.types";
import { DollarSign, TrendingUp } from "lucide-react";

interface PreviewSectionProps {
  creditLine: CreditLine;
  amount: number;
}

export function PreviewSection({ creditLine, amount }: PreviewSectionProps) {
  const newUtilization = Math.round(
    ((creditLine.limit - creditLine.available + amount) / creditLine.limit) *
      100,
  );

  return (
    <div className="space-y-6">
      <h3 className="text-muted text-tiny font-semibold uppercase tracking-wide">
        Summary
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/30 shadow-lg shadow-blue-500/5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted font-medium mb-2">Draw Amount</p>
              <p className="text-2xl font-bold text-blue-400">
                ${amount.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-5 h-5 text-blue-500 shrink-0" />
          </div>
        </div>

        <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/30 shadow-lg shadow-green-500/5">
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
