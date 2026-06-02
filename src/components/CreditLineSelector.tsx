import { CreditLine } from "@/types/draw-credit.types";
import { AlertCircle, ChevronRight } from "lucide-react";
import { formatMoney } from "@/utils/amountValidation";

interface CreditLineSelectorProps {
  creditLines: CreditLine[];
  onSelect: (creditLine: CreditLine) => void;
}

export function CreditLineSelector({
  creditLines,
  onSelect,
}: CreditLineSelectorProps) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase text-muted">Step 1</p>
        <h2
          id="select-credit-line-heading"
          className="mt-1 text-2xl font-bold text-foreground sm:text-3xl"
        >
          Select Credit Line
        </h2>
        <p className="text-muted mt-2">
          Choose which line of credit to draw from
        </p>
      </div>
      <div className="space-y-3">
        {creditLines.map((line) => (
          <button
            key={line.id}
            onClick={() => onSelect(line)}
            className="group w-full rounded-lg border-2 border-border p-5 text-left transition-all duration-200 hover:border-blue-400 hover:bg-surface hover:shadow-lg hover:shadow-blue-500/20"
            aria-label={`Select ${line.name} credit line, available balance ${formatMoney(line.available)}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-3 text-lg font-semibold text-foreground">
                  {line.name}
                </div>
                <div className="mb-3 grid gap-3 sm:grid-cols-3">
                  <div className="text-sm">
                    <span className="block text-muted">Available</span>
                    <span className="mt-1 block font-semibold text-foreground">
                      {formatMoney(line.available)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="block text-muted">Utilization</span>
                    <span className={`mt-1 block font-semibold ${line.utilization > 80 ? "text-yellow-500" : "text-foreground"}`}>
                      {line.utilization}%
                    </span>
                  </div>
                  {line.utilization > 80 && (
                    <div className="flex items-center gap-1 text-sm text-yellow-500" role="status">
                      <AlertCircle className="w-4 h-4" aria-hidden="true" />
                      <span>High utilization</span>
                    </div>
                  )}
                </div>
                <div className="w-full bg-border rounded-full h-2" 
                  role="progressbar" 
                  aria-valuenow={line.utilization} 
                  aria-valuemin={0} 
                  aria-valuemax={100}
                  aria-label={`${line.name} utilization percentage`}
                >
                  <div
                    className={`h-2 rounded-full transition-all ${line.utilization > 80 ? "bg-yellow-500" : "bg-blue-500"}`}
                    style={{ width: `${line.utilization}%` }}
                  />
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted group-hover:text-blue-400 ml-4 shrink-0 mt-1 transition-colors" aria-hidden="true" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
