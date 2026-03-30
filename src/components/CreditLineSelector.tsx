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
      <div className="space-y-4">
        <h2 className="text-foreground">
          Select Credit Line
        </h2>
        <p className="text-muted">
          Choose an active credit line to draw from.
        </p>
      </div>
      <div className="space-y-3">
        {creditLines.map((line) => (
          <button
            key={line.id}
            onClick={() => onSelect(line)}
            className="w-full text-left p-5 border-2 border-border rounded-xl hover:border-blue-400 hover:bg-surface hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-foreground text-lg mb-3">
                  {line.name}
                </div>
                <div className="flex items-center gap-6 mb-3 flex-wrap">
                  <div className="text-sm">
                    <span className="text-muted">Available:</span>
                    <span className="font-semibold text-foreground ml-2">
                      ${line.available.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted">Utilization:</span>
                    <span
                      className={`font-semibold ml-2 ${line.utilization > 80 ? "text-yellow-500" : "text-foreground"}`}
                    >
                      {line.utilization}%
                    </span>
                  </div>
                  {line.utilization > 80 && (
                    <div className="flex items-center gap-1 text-yellow-500 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>High utilization</span>
                    </div>
                  )}
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${line.utilization > 80 ? "bg-yellow-500" : "bg-blue-500"}`}
                    style={{ width: `${line.utilization}%` }}
                  />
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted group-hover:text-blue-400 ml-4 shrink-0 mt-1 transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
