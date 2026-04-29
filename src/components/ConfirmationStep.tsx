import { CreditLine } from "@/types/draw-credit.types";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { CreditLineSummaryBlock } from "@/components/CreditLineSummaryBlock";
import { PendingButton } from "@/components/PendingButton";

interface ConfirmationStepProps {
  creditLine: CreditLine;
  amount: number;
  onConfirm: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function ConfirmationStep({
  creditLine,
  amount,
  onConfirm,
  onBack,
  isLoading = false,
}: ConfirmationStepProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const newUtilization = Math.round(
    ((creditLine.limit - creditLine.available + amount) / creditLine.limit) *
      100,
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Review & Confirm</h2>
        <p className="text-muted mt-2">
          Confirm your draw details before submitting.
        </p>
      </div>

      <CreditLineSummaryBlock creditLine={creditLine} amount={amount} />

      <div className="space-y-4">
        <div className="bg-surface p-5 rounded-xl border border-border space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted font-medium">Draw Amount</span>
            <span className="text-2xl font-bold text-foreground">
              ${amount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-border pt-4">
            <span className="text-sm text-muted font-medium">Current Utilization</span>
            <span className="text-sm font-semibold text-foreground">
              {creditLine.utilization}%
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-border pt-4">
            <span className="text-sm text-muted font-medium">After Draw</span>
            <span
              className={`text-sm font-semibold ${newUtilization > 80 ? "text-yellow-500" : "text-foreground"}`}
            >
              {newUtilization}%
            </span>
          </div>
          {newUtilization > 80 && (
            <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-4">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-500">
                  High Utilization Warning
                </p>
                <p className="text-sm text-yellow-500 mt-1">
                  Your credit utilization will exceed 80%. This may impact your
                  credit terms.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer p-4 bg-surface rounded-lg hover:bg-border transition-colors border border-border">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-1 w-5 h-5 rounded accent-accent"
        />
        <span className="text-sm text-foreground">
          I agree to the terms and conditions and authorize this draw. The funds
          will be deposited within 1-2 business days.
        </span>
      </label>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="sm:flex-1 py-3 px-4 border-2 border-border text-foreground rounded-lg hover:bg-surface transition-colors font-semibold disabled:opacity-50"
        >
          Back
        </button>
        <div className="sm:flex-1 space-y-2">
          <PendingButton
            onClick={onConfirm}
            pending={isLoading}
            pendingLabel="Processing..."
            disabled={!agreedToTerms}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/40 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm draw
          </PendingButton>
          {!agreedToTerms && !isLoading && (
            <p className="text-xs text-muted text-center sm:text-right">
              Accept terms to enable confirmation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
