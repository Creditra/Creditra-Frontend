"use client";

import { useId } from "react";
import { Amount } from "./Amount";
import { usePrivacyMode } from "../context/PrivacyContext";

interface DrawingLimitProps {
  /** Current amount drawn (utilized) */
  drawnAmount: number;
  /** Total credit limit available */
  totalLimit: number;
  /** Optional label for the drawn amount (default: "Drawn") */
  drawnLabel?: string;
  /** Optional label for the available amount (default: "Available") */
  availableLabel?: string;
  /** Optional className for custom styling */
  className?: string;
  /**
   * Whether the percentage should be announced through its own polite live
   * region. Set to false when an adjacent live region already announces the
   * same value to avoid double announcements.
   */
  announcePercentage?: boolean;
}

/**
 * DrawingLimit visual indicator showing utilization vs available credit.
 * 
 * Features:
 * - Semantic colors based on utilization percentage
 * - Accessible ARIA labels and live region updates
 * - Responsive design with appropriate text sizes
 * - Dark mode compatible with design tokens
 * 
 * Color thresholds:
 * - Low (0-50%): Green (safe)
 * - Medium (50-80%): Amber (warning)
 * - High (80-100%): Red (danger)
 * - Exceeded (>100%): Red with error state
 */
export function DrawingLimit({
  drawnAmount,
  totalLimit,
  drawnLabel = "Drawn",
  availableLabel = "Available",
  className = "",
  announcePercentage = true,
}: DrawingLimitProps) {
  const id = useId();
  const { privacyMode } = usePrivacyMode();
  const percentage = totalLimit > 0 ? (drawnAmount / totalLimit) * 100 : 0;
  const available = Math.max(0, totalLimit - drawnAmount);
  const isExceeded = drawnAmount > totalLimit;

  // Determine color based on utilization
  let barColor = "bg-green-500";
  let barBackground = "bg-green-500/20";
  let textColor = "text-green-400";
  
  if (isExceeded) {
    barColor = "bg-red-500";
    barBackground = "bg-red-500/20";
    textColor = "text-red-400";
  } else if (percentage > 80) {
    barColor = "bg-red-500";
    barBackground = "bg-red-500/20";
    textColor = "text-red-400";
  } else if (percentage > 50) {
    barColor = "bg-amber-500";
    barBackground = "bg-amber-500/20";
    textColor = "text-amber-400";
  }

  const clampedPercentage = Math.min(percentage, 100);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with labels */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground">
            {drawnLabel}:{" "}
            <span className={`font-semibold ${textColor} tabular-nums`}>
              <Amount value={drawnAmount} format={formatCurrency} maskedLabel="Drawn amount hidden for privacy" />
            </span>
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">
            {availableLabel}:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              <Amount value={available} format={formatCurrency} maskedLabel="Available credit hidden for privacy" />
            </span>
          </span>
        </div>
        <span
          className={`text-sm font-semibold ${textColor} tabular-nums`}
          aria-live={announcePercentage ? "polite" : undefined}
          aria-atomic={announcePercentage ? "true" : undefined}
        >
          {isExceeded ? "Exceeded" : `${Math.round(clampedPercentage)}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className={`relative h-3 w-full overflow-hidden rounded-full ${barBackground}`}
        role="progressbar"
        aria-valuenow={Math.round(clampedPercentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Credit utilization: ${Math.round(clampedPercentage)} percent`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${clampedPercentage}%` }}
        >
          <span className="sr-only">
            {isExceeded
              ? privacyMode
                ? "Credit limit exceeded"
                : `Credit limit exceeded by ${formatCurrency(drawnAmount - totalLimit)}`
              : `${Math.round(clampedPercentage)}% of credit limit utilized`}
          </span>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Limit:{" "}
          <span className="font-medium text-foreground tabular-nums">
            <Amount value={totalLimit} format={formatCurrency} maskedLabel="Credit limit hidden for privacy" />
          </span>
        </span>
        {isExceeded && (
          <span className="font-medium text-red-400 tabular-nums">
            Overdrawn by <Amount value={drawnAmount - totalLimit} format={formatCurrency} maskedLabel="Overdrawn amount hidden for privacy" />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Format a number as currency with USD symbol
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}