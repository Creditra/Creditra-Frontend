import { CreditLine } from "@/types/draw-credit.types";
import { AlertCircle, ChevronRight } from "lucide-react";

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
        <h2 className="text-3xl font-bold text-foreground">
          Select Credit Line
        </h2>
        <p className="text-muted mt-2">
          Choose the account, then continue to amount entry.
        </p>
      </div>
      <div className="space-y-3">
        {creditLines.map((line) => {
          const utilized = line.limit - line.available;

          return (
            <button
              key={line.id}
              onClick={() => onSelect(line)}
              className="w-full text-left p-5 border-2 border-border rounded-xl hover:border-blue-400 hover:bg-surface hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-4">
                  <div className="font-semibold text-foreground text-lg">
                    {line.name}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="rounded-lg border border-border bg-background/60 p-3">
                      <p className="text-muted">Limit</p>
                      <p className="font-semibold text-foreground mt-1">
                        ${line.limit.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-3">
                      <p className="text-muted">Utilized</p>
                      <p className="font-semibold text-foreground mt-1">
                        ${utilized.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-3">
                      <p className="text-muted">Available</p>
                      <p className="font-semibold text-foreground mt-1">
                        ${line.available.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="text-muted">Utilization:</span>
                      <span
                        className={`font-semibold ${line.utilization > 80 ? "text-yellow-500" : "text-foreground"}`}
                      >
                        {line.utilization}%
                      </span>
                      {line.utilization > 80 && (
                        <span className="flex items-center gap-1 text-yellow-500">
                          <AlertCircle className="w-4 h-4" />
                          High utilization
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${line.utilization > 80 ? "bg-yellow-500" : "bg-blue-500"}`}
                        style={{ width: `${line.utilization}%` }}
                      />
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted group-hover:text-blue-400 shrink-0 mt-1 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
