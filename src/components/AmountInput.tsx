import { CreditLine } from "@/types/draw-credit.types";
import { AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { CreditLineSummaryBlock } from "@/components/CreditLineSummaryBlock";

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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Enter Amount</h2>
        <p className="text-muted mt-2">Choose how much to draw</p>
      </div>

      <CreditLineSummaryBlock creditLine={creditLine} amount={numAmount} />

      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground block">Draw amount</label>
        <div className="flex items-center gap-2 bg-surface p-4 rounded-xl border-2 border-border overflow-hidden">
          <span className="text-3xl font-bold text-foreground flex-shrink-0">
            $
          </span>
          <input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-2xl font-bold bg-transparent outline-none flex-1 text-foreground placeholder:text-muted/50 min-w-0"
            min="0"
            max={creditLine.available}
          />
        </div>
        <div className="min-h-12">
          {error ? (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/30">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          ) : (
            <p className="text-sm text-muted px-1 pt-2">
              Enter an amount greater than $0 and up to ${creditLine.available.toLocaleString()}.
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Quick preset</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[25, 50, 75, 100].map((percent) => (
            <button
              key={percent}
              onClick={() => handlePreset(percent)}
              className="py-2 px-3 border-2 border-border rounded-lg hover:border-blue-400 hover:bg-surface hover:shadow-md hover:shadow-blue-500/20 transition-all text-foreground font-medium text-sm"
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button
          onClick={onBack}
          className="sm:flex-1 py-3 px-4 border-2 border-border text-foreground rounded-lg hover:bg-surface transition-colors font-semibold"
        >
          Back
        </button>
        <div className="sm:flex-1 space-y-2">
          <button
            onClick={() => onNext(numAmount)}
            disabled={!isValid}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/40 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to review
          </button>
          {!isValid && (
            <p className="text-xs text-muted text-center sm:text-right">
              Add a valid draw amount to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
