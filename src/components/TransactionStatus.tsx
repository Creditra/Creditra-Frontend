/*
 * TransactionStatus
 *
 * Step 4 (final) of the draw-credit flow. Shows the outcome of the draw
 * request: pending / success / error — with a transaction detail card and a
 * "Make Another Draw" reset button.
 *
 * Design-token classes used (all from `src/index.css` `.dc-*` block):
 *   dc-spinner-wrap (reused for centred text layout),
 *   dc-status-icon-bg, dc-status-icon-bg--accent/success/error,
 *   dc-status-icon, dc-status-icon--accent/success/error,
 *   dc-step__title, dc-step__subtitle,
 *   dc-status-detail-card, dc-status-detail-row,
 *   dc-status-detail-row__label, dc-status-detail-row__value,
 *   dc-status-detail-row__value--mono, dc-status-detail-row__value--large,
 *   dc-success-notice,
 *   dc-btn, dc-btn--primary, dc-btn--full, dc-btn--icon-gap
 *
 * Color-blind accessibility (WCAG 2.1 SC 1.4.1):
 *   The icon circle uses both a color-tint class AND a pattern-fill class
 *   (from src/styles/patterns.css) so each status is identifiable by shape,
 *   not color alone:
 *     pending → concentric dots  (dc-status-icon-bg--pattern-pending)
 *     success → diagonal stripes (dc-status-icon-bg--pattern-success)
 *     error   → crosshatch       (dc-status-icon-bg--pattern-error)
 *
 * Accessibility:
 *   - The outer div has role="status" + aria-live="polite" so the result is
 *     announced when it replaces the loading spinner.
 *   - On error, the region uses role="alert" and focus moves to the error
 *     heading so keyboard and screen-reader users are notified immediately.
 *   - Icons are aria-hidden="true"; all meaningful state info is in text.
 *   - forced-colors overrides in patterns.css preserve pattern geometry in
 *     Windows High Contrast mode.
 */

import { useEffect, useRef } from "react";
import { Transaction } from "@/types/draw-credit.types";
import { CheckCircle2, AlertCircle, Clock, RotateCcw } from "lucide-react";
import "@/styles/patterns.css";

export type DrawErrorKind = "retryable" | "terminal";

interface TransactionStatusProps {
  transaction: Transaction;
  onNewDraw: () => void;
  /** Optional retry handler. When provided and the error is retryable,
   * a primary "Try again" button is rendered. */
  onRetry?: () => void;
  /** Classification of the error. Defaults to "retryable" when omitted. */
  errorKind?: DrawErrorKind;
}

/**
 * Maps a transaction status to the CSS modifier and icon for that outcome.
 * All colour references go through the dc-status-icon-bg--* and
 * dc-status-icon--* token classes (var(--accent/success/error)).
 *
 * patternMod maps to the dc-status-icon-bg--pattern-* classes in
 * src/styles/patterns.css, providing a geometry cue beyond colour alone
 * (WCAG 2.1 SC 1.4.1 – Use of Color).
 */
const STATUS_CONFIG = {
  pending: {
    Icon: Clock,
    title: "Processing",
    colorMod: "accent",
    /** Concentric dots — conveys cyclical "in progress" motion. */
    patternMod: "pending",
    message: "Your draw request is being processed.",
  },
  success: {
    Icon: CheckCircle2,
    title: "Draw Successful",
    colorMod: "success",
    /** Diagonal stripes (45°, upward sweep) — positive direction cue. */
    patternMod: "success",
    message: "Funds have been disbursed to your account.",
  },
  error: {
    Icon: AlertCircle,
    title: "Draw Failed",
    colorMod: "error",
    /** Crosshatch (45° + 135°) — dense warning texture, distinct from success. */
    patternMod: "error",
    message: null, // filled from transaction.message at render time
  },
} as const;

/** Copy explaining what happened and how to recover, by error kind. */
const ERROR_HELPER = {
  retryable:
    "This was a temporary problem. Your line and amount have been kept, so you can try again.",
  terminal:
    "This request cannot be completed as-is. Start over to adjust your draw details.",
} as const;

export function TransactionStatus({
  transaction,
  onNewDraw,
  onRetry,
  errorKind = "retryable",
}: TransactionStatusProps) {
  const config = STATUS_CONFIG[transaction.status];
  const { Icon, title, colorMod, patternMod } = config;
  const isError = transaction.status === "error";
  const headingRef = useRef<HTMMHeadingElement>(null);

  // Move focus to the error heading when an error is shown so the failure
  // and its recovery actions are reachable immediately.
  useEffect(() => {
    if (isError && headingRef.current) {
      headingRef.current.focus();
    }
  }, [isError, transaction.id]);

  const message =
    transaction.status === "error"
      ? (transaction.message ?? "An error occurred during processing.")
      : config.message;

  const showRetry = isError && errorKind === "retryable" && Boolean(onRetry);
  const startOverLabel = isError ? "Start over" : "Make Another Draw";

  return (
    /*
     * role="status" + aria-live="polite" ensures the result is announced when
     * this replaces the loading spinner (which was removed from the DOM).
     * Errors use role="alert" for immediate attention.
     */
    <div
      className="dc-spinner-wrap"
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      {/* Status icon circle — colour tint + pattern fill for color-blind accessibility */}
      <div className="dc-status-icon-wrap" style={{ display: "flex", justifyContent: "center" }}>
        <div
          className={`dc-status-icon-bg dc-status-icon-bg--${colorMod} dc-status-icon-bg--pattern-${patternMod}`}
          data-status={transaction.status}
        >
          <Icon
            className={`dc-status-icon dc-status-icon--${colorMod}`}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Title + message */}
      <div>
        <h2
          ref={headingRef}
          className="dc-step__title"
          tabIndex={isError ? -1 : undefined}
        >
          {title}
        </h2>
        <p className="dc-step__subtitle">{message}</p>
        {isError && (
          <p className="dc-step__subtitle">{ERROR_HELPER[errorKind]}</p>
        )}
      </div>

      {/* Transaction detail card */}
      <div className="dc-status-detail-card">
        {/* Transaction ID */}
        <div className="dc-status-detail-row">
          <p className="dc-status-detail-row__label">Transaction ID</p>
          <p className="dc-status-detail-row__value dc-status-detail-row__value--mono">
            {transaction.id}
          </p>
        </div>

        {/* Amount drawn */}
        <div className="dc-status-detail-row">
          <p className="dc-status-detail-row__label">Amount Drawn</p>
          <p className="dc-status-detail-row__value dc-status-detail-row__value--large tabular-nums">
            ${transaction.amount.toLocaleString()}
          </p>
        </div>

        {/* Timestamp (optional) */}
        {transaction.timestamp && (
          <div className="dc-status-detail-row">
            <p className="dc-status-detail-row__label">Time</p>
            <p className="dc-status-detail-row__value">
              {transaction.timestamp.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Success notice — uses var(--success-tint/border) via dc-success-notice */}
      {transaction.status === "success" && (
        <div className="dc-success-notice">
          <p>
            Funds will be deposited to your account within 1-2 business days.
          </p>
        </div>
      )}

      {/* Retryable error — primary "Try again" button */}
      {showRetry && (
        <button
          onClick={onRetry}
          className="dc-btn dc-btn--primary dc-btn--full dc-btn--icon-gap"
        >
          <RotateCcw width={20} height={20} aria-hidden="true" />
          Try again
        </button>
      )}

      {/* Reset CTA -- secondary when a retry action is shown, primary otherwise */}
      <button
        onClick={onNewDraw}
        className={`dc-btn dc-btn--full dc-btn--icon-gap${showRetry ? "" : " dc-btn--primary"}`}
      >
        <RotateCcw width={20} height={20} aria-hidden="true" />
        {startOverLabel}
      </button>
    </div>
  );
}
