import { CreditLine } from "@/types/draw-credit.types";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { formatMoney, getDrawAmountValidation } from "../utils/amountValidation";

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
  const inputId = "draw-amount-input";
  const helperId = "draw-amount-helper";
  const constraintsId = "draw-amount-constraints";
  const statusId = "draw-amount-status";

  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    onAmountChange(numAmount);
  }, [amount, onAmountChange]);

  const handlePreset = (percent: number) => {
    const preset = Math.floor((creditLine.available * percent) / 100);
    setAmount(preset.toString());
  };

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount > 0 && numAmount <= creditLine.available;
  const describedBy = error ? `${helperId} ${errorId}` : helperId;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Enter Amount</h2>
        <p className="text-muted mt-2">{creditLine.name}</p>
      </div>

      <div className="space-y-3">
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          Amount to Draw
          <span className="text-error ml-1" aria-label="required">*</span>
        </label>
        <p id={helperId} className="text-sm text-muted">
          Enter the amount you wish to draw from your available credit. Constraints appear inline as you type.
        </p>
        <div className={`flex items-center gap-2 bg-surface p-4 rounded-xl border-2 overflow-hidden transition-colors ${inputStateClassName}`}>
          <span className="text-3xl font-bold text-foreground flex-shrink-0" aria-hidden="true">
            $
          </span>
          <input
            id={inputId}
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-2xl font-bold bg-transparent outline-none flex-1 text-foreground placeholder:text-muted/50 min-w-0"
            min={validation.minAmount}
            max={creditLine.available}
            required
            aria-invalid={validation.feedback.severity === "danger"}
            aria-describedby={describedBy}
            aria-required="true"
          />
        </div>
        <div id={constraintsId} className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">Minimum</p>
            <p className="text-sm font-semibold text-foreground">{formatMoney(validation.minAmount)}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">Available limit</p>
            <p className="text-sm font-semibold text-foreground">{formatMoney(validation.maxAmount)}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">Reserve target</p>
            <p className="text-sm font-semibold text-foreground">{formatMoney(validation.recommendedReserve)}</p>
          </div>
        </div>
        <div
          id={statusId}
          className={`flex items-start gap-2 rounded-lg border px-3 py-3 text-sm ${currentTone.border} ${currentTone.bg} ${currentTone.text}`}
          role={validation.feedback.severity === "danger" ? "alert" : "status"}
          aria-live="polite"
        >
          {currentTone.icon}
          <div>
            <p className="font-semibold">{validation.feedback.title}</p>
            <p className="mt-1">{validation.feedback.message}</p>
          </div>
        </div>
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
            {formatMoney(creditLine.available)}
          </span>
        </div>
        <div className="flex justify-between text-sm border-t border-border pt-3">
          <span className="text-muted">Requested:</span>
          <span className="font-semibold text-foreground">
            {formatMoney(numAmount)}
          </span>
        </div>
        <div className="flex justify-between text-sm border-t border-border pt-3">
          <span className="text-muted">Remaining:</span>
          <span className={`font-semibold ${validation.remainingCredit < validation.recommendedReserve ? "text-amber-400" : "text-foreground"}`}>
            {formatMoney(validation.remainingCredit)}
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
          disabled={!validation.isValid}
          className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/40 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
