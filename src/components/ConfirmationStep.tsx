/**
 * ConfirmationStep
 *
 * Step 4 of the draw-credit flow. Displays a full summary of the draw
 * (credit line, amounts, projected utilization) and requires the user to
 * accept the terms before submitting.
 *
 * Design-token classes used (all from `src/index.css` `:root` block):
 *   bg-surface, border-border, text-foreground, text-muted,
 *   bg-background, accent-accent
 *
 * Polish additions (issue #429):
 *   - Prominent cost-breakdown card with draw amount, 1-time fee, monthly
 *     interest and totals in clear visual hierarchy.
 *   - Risk-band badge (Prime / Standard / Watch) with accessible aria-label.
 *   - Collapsible "How is my APR calculated?" disclosure (aria-expanded +
 *     aria-controls) exposing base rate, utilization and term adjustments.
 *   - Before / after utilization progress bars (role="progressbar").
 *   - Risk-adjusted fee notice (role="note") for Watch-band lines.
 *
 * Accessibility:
 *   - High-utilization warning has role="alert" so it is announced immediately.
 *   - Confirm button is `disabled` (not hidden) when terms are not accepted.
 *   - PendingButton sets aria-busy="true" while isLoading.
 *   - Color is never the sole signal — icons and text labels accompany every
 *     colored element (WCAG 1.4.1 Use of Color).
 */

import { AccessibleTooltip } from "@/components/AccessibleTooltip";
import { CreditLine, DrawQuote } from "@/types/draw-credit.types";
import { AlertCircle, ChevronDown, ChevronUp, Info, ShieldCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { CreditLineSummaryBlock } from "@/components/CreditLineSummaryBlock";
import { PendingButton } from "@/components/PendingButton";
import { formatMoney } from "@/utils/amountValidation";
import { useQuoteCountdown } from "@/hooks/useQuoteCountdown";
import { useReducedMotion } from "@/context/ReducedMotionContext";
import { Skeleton } from "@/components/Skeleton";

interface ConfirmationStepProps {
  /** The credit line the user is drawing from. */
  creditLine: CreditLine;
  /** Whole-USD draw amount the user entered in step 2. */
  amount: number;
  /**
   * Invoked when the user agrees to terms and presses the primary action.
   * The parent wizard handles network submission and step transition.
   */
  onConfirm: () => void;
  /** Return to the previous (preview) step without losing context. */
  onBack: () => void;
  /**
   * Exit the wizard entirely.  Optional — when omitted the Cancel button is
   * not rendered, but most callers (DrawCreditPage, tests) supply it.
   */
  onCancel?: () => void;
  /**
   * When true, the primary button shows the `PendingButton` spinner and is
   * disabled to prevent double-submission. Driven by the parent's
   * network request state.
   */
  isLoading?: boolean;
  /** Controlled checkbox state for terms acknowledgment (lifted to wizard). */
  agreedToTerms?: boolean;
  /** Notified when the user toggles the terms checkbox. */
  onAgreedToTermsChange?: (agreed: boolean) => void;
  /**
   * Authoritative pricing quote with quoteId and expiry.
   * When null, a loading skeleton is shown.
   */
  quote?: DrawQuote | null;
  /** Error message when quote fetch fails. */
  quoteError?: string | null;
  /** Loading state for quote fetch. */
  quoteLoading?: boolean;
  /** Callback to retry fetching the quote. */
  onRefreshQuote?: () => void;
}

/** Map a DrawPricingRiskBand to a human-readable label and visual tone. */
function getRiskBandMeta(riskBand: string): {
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
} {
  switch (riskBand) {
    case "Prime":
      return {
        label: "Prime",
        description: "Lowest risk tier — best available pricing.",
        colorClass: "text-green-400",
        bgClass: "bg-green-500/10",
        borderClass: "border-green-500/30",
      };
    case "Watch":
      return {
        label: "Watch",
        description: "Elevated risk tier — pricing reflects higher uncertainty.",
        colorClass: "text-yellow-400",
        bgClass: "bg-yellow-500/10",
        borderClass: "border-yellow-500/30",
      };
    case "Standard":
    default:
      return {
        label: "Standard",
        description: "Mid-tier risk — standard market pricing applies.",
        colorClass: "text-blue-400",
        bgClass: "bg-blue-500/10",
        borderClass: "border-blue-500/30",
      };
  }
}

/** Narrow progress bar used for utilization visualization. */
function UtilizationBar({
  pct,
  isHighlighted,
  "aria-label": ariaLabel,
}: {
  pct: number;
  isHighlighted: boolean;
  "aria-label": string;
}) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const barColor =
    clamped > 80
      ? "bg-yellow-500"
      : clamped > 50
        ? "bg-blue-400"
        : "bg-blue-500";

  return (
    <div
      className="w-full rounded-full bg-border h-2.5"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={`h-2.5 rounded-full transition-all duration-300 ${barColor} ${isHighlighted ? "ring-1 ring-offset-1 ring-blue-400" : ""}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function ConfirmationStep({
  creditLine,
  amount,
  onConfirm,
  onBack,
  onCancel,
  isLoading = false,
  agreedToTerms: agreedToTermsProp,
  onAgreedToTermsChange,
  quote: quoteProp,
  quoteError,
  quoteLoading = false,
  onRefreshQuote,
}: ConfirmationStepProps) {
  const [agreedToTermsInternal, setAgreedToTermsInternal] = useState(false);
  const agreedToTerms = agreedToTermsProp ?? agreedToTermsInternal;
  const setAgreedToTerms = (value: boolean) => {
    onAgreedToTermsChange?.(value);
    if (agreedToTermsProp === undefined) {
      setAgreedToTermsInternal(value);
    }
  };

  const { isReducedMotionActive } = useReducedMotion();
  
  // Use quote countdown hook
  const { formattedTime, isExpired, announcement } = useQuoteCountdown(
    quoteProp?.expiresAt,
    isReducedMotionActive,
  );

  // Reset terms checkbox when quote expires
  const quote = quoteProp;
  const wasExpiredRef = useState(false);
  if (isExpired && !wasExpiredRef[0]) {
    setAgreedToTerms(false);
    wasExpiredRef[1](true);
  } else if (!isExpired && wasExpiredRef[0]) {
    wasExpiredRef[1](false);
  }

  /** Controls the "How is my APR calculated?" collapsible section. */
  const [aprDisclosureOpen, setAprDisclosureOpen] = useState(false);

  const utilizedBalance = creditLine.limit - creditLine.available;
  const safeAmount = Math.max(Number.isFinite(amount) ? amount : 0, 0);

  // Extract values from quote or show loading state
  const fee = quote?.fee ?? 0;
  const apr = quote?.apr ?? 0;
  const estimatedMonthlyInterest = quote?.estimatedMonthlyInterest ?? 0;
  const riskBand = quote?.riskBand ?? 'Standard';
  const termMonths = quote?.termMonths ?? 12;
  const adjustments = quote?.adjustments ?? [];

  // Calculate base APR from adjustments
  const adjustmentTotal = adjustments.reduce((sum, adj) => sum + adj.points, 0);
  const baseApr = Math.round((apr - adjustmentTotal) * 100) / 100;

  const newBalance = utilizedBalance + safeAmount + fee;
  const remainingAvailable = Math.max(creditLine.limit - newBalance, 0);
  const newUtilization = Math.round((newBalance / creditLine.limit) * 100);
  const currentUtilizationPct = creditLine.utilization;

  const riskBandMeta = getRiskBandMeta(riskBand);
  const isWatchBand = riskBand === "Watch";
  const isHighUtilization = newUtilization > 80;
  const canConfirm = agreedToTerms && !isLoading && !isExpired && !!quote;

  // Show loading skeleton while quote is being fetched
  if (quoteLoading || !quote) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase text-muted">Step 4</p>
          <h2 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            Review and confirm
          </h2>
          <p className="text-muted mt-2">
            Fetching pricing quote...
          </p>
        </div>
        <CreditLineSummaryBlock creditLine={creditLine} amount={amount} />
        <div className="rounded-xl border border-border bg-surface p-5 space-y-5">
          <Skeleton style={{ width: '60%', height: '1.5rem' }} />
          <Skeleton style={{ width: '100%', height: '8rem' }} />
          <Skeleton style={{ width: '100%', height: '12rem' }} />
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (quoteError) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase text-muted">Step 4</p>
          <h2 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            Review and confirm
          </h2>
        </div>
        <CreditLineSummaryBlock creditLine={creditLine} amount={amount} />
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 space-y-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-500">Failed to fetch quote</p>
              <p className="text-sm text-red-500/90 mt-1">{quoteError}</p>
            </div>
          </div>
          {onRefreshQuote && (
            <button
              type="button"
              onClick={onRefreshQuote}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500 font-medium text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
        <div className="dc-actions dc-actions--stacked">
          <button onClick={onBack} type="button" className="dc-btn dc-btn--secondary dc-actions__slot">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Step header ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-semibold uppercase text-muted">Step 4</p>
        <h2
          id="confirm-draw-heading"
          className="mt-1 text-2xl font-bold text-foreground sm:text-3xl"
        >
          Review and confirm
        </h2>
        <p className="text-muted mt-2">
          Check your draw details below. Once you confirm, the request is
          submitted to the network.
        </p>
      </div>

      {/* ── Credit line summary card ─────────────────────────────────────── */}
      <CreditLineSummaryBlock creditLine={creditLine} amount={amount} />

      {/* ── Cost breakdown card ───────────────────────────────────────────── */}
      <section
        aria-labelledby="cost-breakdown-heading"
        className="rounded-xl border border-border bg-surface p-5 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3
            id="cost-breakdown-heading"
            className="text-sm font-semibold uppercase text-muted tracking-wide"
          >
            Cost breakdown
          </h3>
          {/* Quote countdown */}
          {!isExpired && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Quote valid for</span>
              <span
                className="font-semibold tabular-nums text-foreground"
                aria-live="polite"
                aria-atomic="false"
              >
                {formattedTime}
              </span>
            </div>
          )}
          {isExpired && (
            <span className="text-sm font-semibold text-yellow-500">Quote expired</span>
          )}
        </div>
        {announcement && (
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </div>
        )}

        {/* Primary number — draw amount + risk-band badge */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted font-medium">Draw amount</p>
            <p
              className="mt-1 text-4xl font-bold text-foreground tabular-nums"
              data-testid="draw-amount-display"
            >
              {formatMoney(safeAmount)}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${riskBandMeta.bgClass} ${riskBandMeta.borderClass} ${riskBandMeta.colorClass}`}
            data-testid="risk-band-badge"
            aria-label={`Risk band: ${riskBandMeta.label} — ${riskBandMeta.description}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            {riskBandMeta.label} band
          </span>
        </div>

        {/* Line items */}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <dt className="text-sm text-muted font-medium">One-time fee (1%)</dt>
            <dd className="mt-1 font-semibold text-foreground tabular-nums" data-testid="fee-display">
              {formatMoney(fee)}
            </dd>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <dt className="text-sm text-muted font-medium flex items-center gap-1.5">
              APR
              <AccessibleTooltip label="Annual Percentage Rate — the annualised cost of borrowing.">
                <span className="sr-only">What is APR?</span>
              </AccessibleTooltip>
            </dt>
            <dd
              className="mt-1 font-semibold text-foreground tabular-nums"
              data-testid="apr-display"
            >
              {apr}%
            </dd>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <dt className="text-sm text-muted font-medium">Est. monthly interest</dt>
            <dd className="mt-1 font-semibold text-foreground tabular-nums" data-testid="monthly-interest-display">
              {formatMoney(estimatedMonthlyInterest)}
            </dd>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <dt className="text-sm text-muted font-medium">Term</dt>
            <dd className="mt-1 font-semibold text-foreground tabular-nums">
              {termMonths} months
            </dd>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <dt className="text-sm text-muted font-medium">New balance</dt>
            <dd className="mt-1 font-semibold text-foreground tabular-nums" data-testid="new-balance-display">
              {formatMoney(newBalance)}
            </dd>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <dt className="text-sm text-muted font-medium">Available after draw</dt>
            <dd className="mt-1 font-semibold text-foreground tabular-nums">
              {formatMoney(remainingAvailable)}
            </dd>
          </div>
        </dl>

        {/* ── Collapsible APR breakdown ─────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-background/40">
          <button
            type="button"
            onClick={() => setAprDisclosureOpen((prev) => !prev)}
            aria-expanded={aprDisclosureOpen}
            aria-controls="apr-breakdown-body"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-border/40 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            data-testid="apr-disclosure-toggle"
          >
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
              How is my APR calculated?
            </span>
            {aprDisclosureOpen ? (
              <ChevronUp className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            )}
          </button>

          {aprDisclosureOpen && (
            <div
              id="apr-breakdown-body"
              data-testid="apr-breakdown-body"
              className="border-t border-border px-4 py-4 space-y-3 text-sm"
            >
              <p className="text-muted text-xs">
                Your APR is composed of a base rate for your risk band, plus
                adjustments for your current utilization level and the draw
                term length.
              </p>
              <dl className="space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">
                    Base rate ({riskBandMeta.label} band)
                  </dt>
                  <dd className="font-semibold text-foreground tabular-nums" data-testid="apr-base-rate">
                    {baseApr}%
                  </dd>
                </div>
                {adjustments.map((adj, idx) => (
                  <div key={idx} className="flex justify-between gap-4">
                    <dt className="text-muted">{adj.label}</dt>
                    <dd className="font-semibold text-foreground tabular-nums">
                      +{adj.points}%
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-border pt-2">
                  <dt className="font-semibold text-foreground">Total APR</dt>
                  <dd className="font-bold text-foreground tabular-nums" data-testid="apr-total">
                    {apr}%
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Risk-adjusted fee notice — Watch band only */}
        {isWatchBand && (
          <div
            className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3"
            role="note"
            data-testid="risk-fee-notice"
          >
            <AlertCircle
              className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-yellow-500">
                Risk-adjusted pricing
              </p>
              <p className="text-sm text-yellow-500/90 mt-1">
                Your credit line is in the Watch risk band. A higher APR applies
                to reflect elevated risk. Improving your on-chain repayment
                history may move you to a better band.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Utilization progress bars ─────────────────────────────────────── */}
      <section
        aria-labelledby="utilization-heading"
        className="rounded-xl border border-border bg-surface p-5 space-y-5"
      >
        <h3
          id="utilization-heading"
          className="text-sm font-semibold uppercase text-muted tracking-wide"
        >
          Credit utilization
        </h3>

        {/* Before */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted font-medium">Current utilization</span>
            <span className="font-semibold text-foreground tabular-nums">
              {currentUtilizationPct}%
            </span>
          </div>
          <UtilizationBar
            pct={currentUtilizationPct}
            isHighlighted={false}
            aria-label={`Current credit utilization: ${currentUtilizationPct} percent`}
          />
        </div>

        {/* After */}
        <div className="space-y-2" data-testid="utilization-after-section">
          <div className="flex justify-between text-sm">
            <span className="text-muted font-medium">After this draw</span>
            <span
              className={`font-semibold tabular-nums ${isHighUtilization ? "text-yellow-500" : "text-foreground"}`}
              data-testid="utilization-after-pct"
            >
              {newUtilization}%
            </span>
          </div>
          <UtilizationBar
            pct={newUtilization}
            isHighlighted
            aria-label={`Projected credit utilization after draw: ${newUtilization} percent`}
          />
        </div>

        {/* High utilization warning */}
        {isHighUtilization && (
          <div
            className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3"
            role="alert"
            data-testid="high-utilization-warning"
          >
            <AlertCircle
              className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-yellow-500">
                High utilization warning
              </p>
              <p className="text-sm text-yellow-500/90 mt-1">
                Your utilization will exceed 80% after this draw. High
                utilization may impact your credit terms and future pricing.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Terms checkbox ───────────────────────────────────────────────── */}
      <label className="dc-terms-label">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="dc-terms-label__checkbox"
          aria-label="I agree to the terms and conditions and authorise this draw"
          data-testid="terms-checkbox"
        />
        <span className="dc-terms-label__text">
          I agree to the terms and conditions and authorize this draw. The funds
          will be deposited within 1–2 business days.
        </span>
      </label>

      {/* Button order: Cancel → Back → Primary (docs/BUTTON_ORDER.md). */}
      <div className="dc-actions dc-actions--stacked">
        <button
          onClick={onCancel}
          disabled={isLoading || !onCancel}
          type="button"
          className="dc-btn dc-btn--secondary dc-actions__slot"
        >
          Cancel
        </button>
        <button
          onClick={onBack}
          disabled={isLoading}
          type="button"
          className="dc-btn dc-btn--secondary dc-actions__slot"
        >
          Back
        </button>
        <div className="dc-actions__slot">
          {isExpired && onRefreshQuote ? (
            <button
              type="button"
              onClick={onRefreshQuote}
              className="dc-btn dc-btn--primary dc-btn--full"
            >
              <RefreshCw className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
              Refresh quote
            </button>
          ) : (
            <>
              <PendingButton
                type="button"
                onClick={onConfirm}
                pending={isLoading}
                pendingLabel="Processing draw..."
                disabled={!canConfirm}
                className="dc-btn dc-btn--primary dc-btn--full"
              >
                Confirm draw
              </PendingButton>
              {!agreedToTerms && !isLoading && !isExpired && (
                <p className="dc-hint dc-hint--right">
                  Accept terms to enable confirmation.
                </p>
              )}
              {isExpired && (
                <p className="dc-hint dc-hint--right text-yellow-500">
                  Quote expired. Refresh to continue.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
