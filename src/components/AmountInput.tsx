import { CreditLine } from "@/types/draw-credit.types";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useState, useEffect } from "react";
import {
  formatMoney,
  getDrawAmountValidation,
} from "../utils/amountValidation";
import { FormMessage } from "./FormMessage";

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
  const errorId = "draw-amount-error";
  const constraintsId = "draw-amount-constraints";
  const statusId = "draw-amount-status";

  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    onAmountChange(numAmount);
  }, [amount, onAmountChange]);

  // Compute validation state using the validation function
  const validation = getDrawAmountValidation(amount, creditLine);
  const numAmount = validation.amount;
  const hasError = validation.feedback.severity === "danger";
  const isValid = validation.isValid;

  // Build aria-describedby: always include helper, add error message ID if there's an error
  const describedByIds = [helperId];
  if (hasError) {
    describedByIds.push(errorId);
  }
  const describedBy = describedByIds.join(" ");

  // Map validation severity to FormMessage type
  const getMessageType = (): "success" | "danger" | "warning" | "info" => {
    switch (validation.feedback.severity) {
      case "success":
        return "success";
      case "danger":
        return "danger";
      case "warning":
        return "warning";
      case "info":
      default:
        return "info";
    }
  };

  // Determine input border styling based on validation state
  const getInputStateClass = (): string => {
    if (hasError) {
      return "border-error ring-1 ring-error/30 focus-within:border-error focus-within:ring-error/50";
    }
    if (validation.feedback.severity === "success") {
      return "border-success ring-1 ring-success/30 focus-within:border-success focus-within:ring-success/50";
    }
    if (validation.feedback.severity === "warning") {
      return "border-warning ring-1 ring-warning/30 focus-within:border-warning focus-within:ring-warning/50";
    }
    return "border-border focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30";
  };

  // Handle "Max" button click - set amount to available credit
  const handleMaxClick = () => {
    setAmount(creditLine.available.toString());
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Enter Amount</h2>
        <p className="text-muted mt-2">{creditLine.name}</p>
      </div>

      <div className="space-y-3">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-foreground"
        >
          Amount to Draw
          <span className="text-error ml-1" aria-label="required">
            *
          </span>
        </label>

        {/* Helper text explaining the input */}
        <p id={helperId} className="text-sm text-muted">
          Enter the amount you wish to draw from your available credit.
          Available limit:{" "}
          <span className="font-semibold text-foreground">
            {formatMoney(creditLine.available)}
          </span>
        </p>

        {/* Input field with border styling based on validation state */}
        <div
          className={`flex items-center gap-2 bg-surface p-4 rounded-xl border-2 overflow-hidden transition-colors ${getInputStateClass()}`}
        >
          <span
            className="text-3xl font-bold text-foreground flex-shrink-0"
            aria-hidden="true"
          >
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
            aria-invalid={hasError}
            aria-describedby={describedBy}
            aria-required="true"
          />
          {/* Max button for quick-fill with accessible label */}
          <button
            onClick={handleMaxClick}
            className="px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface flex-shrink-0"
            aria-label="Set amount to maximum available credit"
            type="button"
          >
            Max
          </button>
        </div>

        {/* Constraint boxes showing min, available, and reserve */}
        <div id={constraintsId} className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Minimum
            </p>
            <p className="text-sm font-semibold text-foreground">
              {formatMoney(validation.minAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Available limit
            </p>
            <p className="text-sm font-semibold text-foreground">
              {formatMoney(validation.maxAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Reserve target
            </p>
            <p className="text-sm font-semibold text-foreground">
              {formatMoney(validation.recommendedReserve)}
            </p>
          </div>
        </div>

        {/* Inline validation message - displayed only when there's content */}
        <FormMessage
          id={errorId}
          title={validation.feedback.title}
          message={validation.feedback.message}
          type={getMessageType()}
          tone="inline"
          reserveSpace={true}
          minHeight={60}
        />
      </div>

      {/* Quick presets for percentage-based amounts */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">
          Quick preset
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[25, 50, 75, 100].map((percent) => (
            <button
              key={percent}
              onClick={() =>
                setAmount(
                  Math.floor((creditLine.available * percent) / 100).toString(),
                )
              }
              className="py-2 px-3 border-2 border-border rounded-lg hover:border-blue-400 hover:bg-surface hover:shadow-md hover:shadow-blue-500/20 transition-all text-foreground font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Set amount to ${percent} percent of available credit`}
              type="button"
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>

      {/* Summary display showing available, requested, and remaining */}
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
          <span
            className={`font-semibold ${validation.remainingCredit < validation.recommendedReserve && numAmount > 0 ? "text-amber-400" : "text-foreground"}`}
          >
            {formatMoney(validation.remainingCredit)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-4 border-2 border-border text-foreground rounded-lg hover:bg-surface transition-colors font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          type="button"
        >
          Back
        </button>
        <button
          onClick={() => onNext(numAmount)}
          disabled={!isValid}
          className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/40 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          type="button"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
