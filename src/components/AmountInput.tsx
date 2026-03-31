import { CreditLine } from "@/types/draw-credit.types";
import { AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface AmountInputProps {
  creditLine: CreditLine;
  onAmountChange: (amount: number) => void;
  onNext: (amount: number) => void;
  onBack: () => void;
}

export function AmountInput({
  creditLine,
  onAmountChange,
  onNext,
  onBack,
}: AmountInputProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const inputId = "draw-amount-input";
  const helperId = "draw-amount-helper";
  const errorId = "draw-amount-error";

  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    onAmountChange(numAmount);

    if (numAmount > 0 && numAmount <= creditLine.available) {
      setError("");
    } else if (numAmount > creditLine.available) {
      setError(`Maximum available: $${creditLine.available.toLocaleString()}`);
    } else if (numAmount > 0) {
      setError("");
    }
  }, [amount, creditLine.available, onAmountChange]);

  const handlePreset = (percent: number) => {
    const preset = Math.floor((creditLine.available * percent) / 100);
    setAmount(preset.toString());
  };

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount > 0 && numAmount <= creditLine.available;
  const hasNoAvailability = creditLine.available <= 0;
  const describedBy = error ? `${helperId} ${errorId}` : helperId;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Enter Amount</h2>
        <p className="text-muted mt-2">{creditLine.name}</p>
      </div>

      <div className="space-y-3">
        <label htmlFor="amount-input" className="sr-only">Amount to draw</label>
        <div className="flex items-center gap-2 bg-surface p-4 rounded-xl border-2 border-border overflow-hidden">
          <span className="text-3xl font-bold text-foreground flex-shrink-0" aria-hidden="true">
            $
          </span>
          <input
            id="amount-input"
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-2xl font-bold bg-transparent outline-none flex-1 text-foreground placeholder:text-muted/50 min-w-0"
            min="0"
            max={creditLine.available}
            aria-invalid={!!error}
            aria-describedby={error ? "amount-error" : undefined}
          />
        </div>
        {error && (
          <div id="amount-error" className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/30" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">
          Quick preset
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[25, 50, 75, 100].map((percent) => (
            <button
              key={percent}
              onClick={() => handlePreset(percent)}
              className="py-2 px-3 border-2 border-border rounded-lg hover:border-blue-400 hover:bg-surface hover:shadow-md hover:shadow-blue-500/20 transition-all text-foreground font-medium text-sm"
              aria-label={`Set amount to ${percent} percent`}
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface p-5 rounded-xl border border-border space-y-3 shadow-lg shadow-blue-500/5">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Available:</span>
          <span className="font-semibold text-foreground">
            ${creditLine.available.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm border-t border-border pt-3">
          <span className="text-muted">Requested:</span>
          <span className="font-semibold text-foreground">
            ${numAmount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm border-t border-border pt-3">
          <span className="text-muted">Remaining:</span>
          <span className="font-semibold text-foreground">
            ${(creditLine.available - numAmount).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-4 border-2 border-border text-foreground rounded-lg hover:bg-surface transition-colors font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back
        </button>
        <button
          onClick={() => onNext(numAmount)}
          disabled={!isValid}
          className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/40 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
